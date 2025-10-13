import { DestroyRef, Component, OnInit, Input, inject, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Paths, Producto } from '../../../models/models';
import { FirestoreService } from '../../../services/firestore.service';
import { InteraccionService } from '../../../services/interaccion.service';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { combineLatest, startWith, filter, take } from 'rxjs';


import {
  IonGrid,
  IonRow,
  IonButtons,
  IonIcon,
  IonButton,
  IonItem,
  IonLabel,
  IonCol,
  IonCard,
  PopoverController,
  ToastController
} from "@ionic/angular/standalone";

import { addIcons } from 'ionicons';
import {
  checkbox,
  close
} from 'ionicons/icons';

import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule, MatInput } from '@angular/material/input';


@Component({
  selector: 'app-popsetclient',
  templateUrl: './pop-set-product.component.html',
  styleUrls: ['./pop-set-product.component.scss'],
  imports: [
    IonGrid,
    IonRow,
    IonButtons,
    IonIcon,
    IonButton,
    IonItem,
    IonLabel,
    IonCol,
    IonCard,
    MatFormFieldModule,
    MatInputModule,
    MatCheckboxModule,
    ReactiveFormsModule
  ]
})

export class PopsetProductComponent implements OnInit, AfterViewInit {

  private fb = inject(FormBuilder);
  private popoverController = inject(PopoverController);
  private toastCtrl = inject(ToastController);
  private firestoreService = inject(FirestoreService);
  private interaccionService = inject(InteraccionService);
  private destroyRef = inject(DestroyRef);

  @Input() venta: boolean = false;
  @Input() newProduct?: Producto;
  @ViewChild('codigo', { read: ElementRef }) codigoInput?: ElementRef<HTMLInputElement>;


  producto?: Producto;
  productoDuplicado?: Producto;
  titulo = 'Nuevo Artículo';
  update = false;
  isSaving = false;
  IVA = 0.15;


  articuloForm: FormGroup = this.fb.group({
    nombre: [null, Validators.required],
    descripcion: [null, Validators.required],
    costo_compra: [null, [Validators.required, Validators.min(0)]],
    check_iva: [false],
    costo_sin_iva: [null, [Validators.required, Validators.min(0)]],
    pvp: [null, [Validators.required, Validators.min(0)]],
    codigo: [null, Validators.required,],
    stock: [null, [Validators.required, Validators.min(0)]],
    fecha_caducidad: [new Date(), Validators.required],
    stock_minimo: [null, [Validators.required, Validators.min(0)]],
  });

  constructor() { addIcons({ checkbox, close }) }

  ngOnInit() {
    this.subscribirCalculosIva();
    if (this.newProduct) this.recibirProducto();
  }

  ngAfterViewInit() {
    setTimeout(() => {
      this.codigoInput?.nativeElement.focus();

    }, 300); // tiempo ~animación del popover
  }

  private subscribirCalculosIva() {
    const checkIvaCtrl = this.articuloForm.get('check_iva')!;
    const costoCtrl = this.articuloForm.get('costo_compra')!;

    combineLatest([
      checkIvaCtrl.valueChanges.pipe(startWith(checkIvaCtrl.value)),
      costoCtrl.valueChanges.pipe(startWith(costoCtrl.value)),
    ])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.setCostoSinIva());
  }


setCostoSinIva() {
  const checkIva = !!this.articuloForm.get('check_iva')!.value;
  const costoBruto = Number(this.articuloForm.get('costo_compra')!.value) || 0;

  // Si el costo de compra incluye IVA → dividir entre (1+IVA)
  const neto = checkIva ? costoBruto / (1 + this.IVA) : costoBruto;

  this.articuloForm.get('costo_sin_iva')!
    .setValue(+neto.toFixed(2), { emitEvent: false });
}

  async validarCodigoUnico() {
    const codigo = this.articuloForm.get('codigo')?.value?.trim();
    if (!codigo || codigo.length < 4) return;

    const productoExistente = await this.firestoreService.getDocumentQuery<Producto>(Paths.productos, 'codigo', codigo);

    // Si ya existe y NO es el mismo cliente que estamos editando
    if (productoExistente && productoExistente.id !== this.newProduct?.id) {
      this.articuloForm.get('codigo')?.setErrors({ codigoDuplicado: true });
      this.productoDuplicado = productoExistente; // opcional, por si quieres mostrar datos
    } else {
      this.articuloForm.get('codigo')?.setErrors(null);
    }
  }


  campoNoValido(campo: string) {
    const c = this.articuloForm.controls[campo];
    return !!(c?.hasError('required') && c?.touched);
  }

  // RUC duplicado: solo si NO falta el required
  codigoDuplicado() {
    const c = this.articuloForm.get('codigo');
    return !!(c?.hasError('codigoDuplicado') && !c?.hasError('required') && c?.touched);
  }

  recibirProducto() {
    this.update = true;
    this.titulo = 'Editar Artículo'
    this.articuloForm.controls['codigo'].setValue(this.newProduct?.codigo);
    this.articuloForm.controls['nombre'].setValue(this.newProduct?.nombre);
    this.articuloForm.controls['descripcion'].setValue(this.newProduct?.descripcion);
    this.articuloForm.controls['costo_compra'].setValue(this.newProduct?.costo_compra);
    this.articuloForm.controls['check_iva'].setValue(this.newProduct?.check_iva);
    this.articuloForm.controls['costo_sin_iva'].setValue(this.newProduct?.costo_sin_iva);
    this.articuloForm.controls['pvp'].setValue(this.newProduct?.pvp);
    this.articuloForm.controls['stock'].setValue(this.newProduct?.stock);
    this.articuloForm.controls['fecha_caducidad'].setValue(this.newProduct?.fecha_caducidad);
    this.articuloForm.controls['stock_minimo'].setValue(this.newProduct?.stock_minimo);
  }

  async guardar() {
    if (this.articuloForm.invalid) {
      this.articuloForm.markAllAsTouched();
      return;
    }
    if (this.isSaving) return;
    this.isSaving = true;

    const data: Producto = this.articuloForm.value;
    const { id, docPath, write } = await this.firestoreService.createDocumentID<Producto>(data, Paths.productos);

    // UX inmediata (funciona offline)
    this.interaccionService.showToast(
      this.firestoreService.isOffline() ? 'Guardado (pendiente de sincronizar)' : 'Guardado con éxito'
    );
    this.popoverController.dismiss({ producto: { ...data, id } });
    this.articuloForm.reset();

    // (Opcional) Avisar cuando sincronice:
    this.firestoreService.observeSyncStatus(docPath)
      .pipe(
        filter(status => status === 'synced'),
        take(1),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => this.interaccionService.showToast('Sincronizado'));

    // Manejo de error real al sincronizar con backend
    write.catch(err => {
      this.interaccionService.showToast('Error al sincronizar: ' + (err?.message ?? 'desconocido'));
    }).finally(() => {
      this.isSaving = false;
    });
  }

  async showToast(message: string) {
    const toast = await this.toastCtrl.create({
      message,
      duration: 1000,
      position: 'bottom',
      cssClass: 'aviso',
    });
    toast.present();
  }

  async updateProduct() {
    if (this.articuloForm.invalid || !this.newProduct?.id) {
      this.articuloForm.markAllAsTouched();
      return;
    }
    if (this.isSaving) return;
    this.isSaving = true;

    const path = Paths.productos;
    const updateDoc: Partial<Producto> = {
      codigo: this.articuloForm.controls['codigo'].value,
      nombre: this.articuloForm.controls['nombre'].value,
      descripcion: this.articuloForm.controls['descripcion'].value,
      costo_compra: this.articuloForm.controls['costo_compra'].value,
      check_iva: this.articuloForm.controls['check_iva'].value,
      costo_sin_iva: this.articuloForm.controls['costo_sin_iva'].value,
      pvp: this.articuloForm.controls['pvp'].value,
      stock: this.articuloForm.controls['stock'].value,
      fecha_caducidad: this.articuloForm.controls['fecha_caducidad'].value,
      stock_minimo: this.articuloForm.controls['stock_minimo'].value
    };

    // Lanza la actualización optimista (aplica local inmediato; la Promise espera al backend)
    const { docPath, write } = await this.firestoreService
      .updateDocumentID<Producto>(updateDoc, path, this.newProduct.id);

    // UX inmediata (funciona sin internet)
    const offline = this.firestoreService.isOffline();
    this.interaccionService.showToast(
      offline ? 'Actualizado (pendiente de sincronizar)' : 'Actualizado con éxito'
    );

    // Cierra el popup pasando el objeto actualizado al caller
    this.popoverController.dismiss({
      producto: { ...this.producto, ...updateDoc },
    });

    // (Opcional) Avisar cuando pase de pendiente -> sincronizado
    this.firestoreService.observeSyncStatus(docPath)
      .pipe(
        filter(status => status === 'synced'),
        take(1),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => this.interaccionService.showToast('Sincronizado'));

    // Manejo de error real al sincronizar con backend
    write.catch(err => {
      this.interaccionService.showToast('Error al sincronizar: ' + (err?.message ?? 'desconocido'));
    }).finally(() => {
      this.isSaving = false;
    });
  }

  close() {
    this.popoverController.dismiss();
  }

  aceptar() {
    this.popoverController.dismiss({
      producto: this.producto,
    });
  }


}
