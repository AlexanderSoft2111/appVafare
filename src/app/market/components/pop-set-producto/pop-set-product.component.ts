import { DestroyRef, Component, OnInit, Input, inject, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Paths, Producto } from '../../../models/models';
import { FirestoreService } from '../../../services/firestore.service';
import { InteraccionService } from '../../../services/interaccion.service';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { combineLatest, startWith, filter, take } from 'rxjs';

import { InventarioSyncService } from '../../../services/inventario-sync.service';


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
  private invSync = inject(InventarioSyncService);

  private destroyRef = inject(DestroyRef);

  @Input() venta: boolean = false;
  @Input() newProduct?: Producto;
  @Input() vendedor: boolean = false;

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
    fecha_caducidad: [''],
    stock_minimo: [null, [Validators.required, Validators.min(0)]],
  });

  constructor() { addIcons({ checkbox, close }) }

  ngOnInit() {
    this.subscribirCalculosIva();
    if (this.newProduct) this.recibirProducto();
    console.log(this.vendedor)
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
  if (this.articuloForm.invalid || this.isSaving) {
    this.articuloForm.markAllAsTouched();
    return;
  }
  this.isSaving = true;

  // 1) Tomar los datos del form
  const data: Producto = this.articuloForm.value;

  // 2) Generar id y escribir en la base de datos
  const { id, docPath, write } = await this.firestoreService.createDocumentID<Producto>(
    data,
    Paths.productos,
  );

  // 3) Upsert local (UI instantánea, offline OK). El invSync pondrá updatedAt y encolará.
   await this.invSync.upsertLocal({ ...data, id });

  // 4) UX y cierre
  this.interaccionService.showToast('Guardado (se sincronizará al tener internet)');
  this.popoverController.dismiss(); // no hace falta devolver el producto
  this.articuloForm.reset();
  this.isSaving = false;

  // 5) (Opcional) Maneja resultado final de la escritura (errores reales de red)
  write
    .catch(err => this.interaccionService.showToast('Error al sincronizar: ' + (err?.message ?? 'desconocido')))
    .finally(() => this.isSaving = false);

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
    if (this.articuloForm.invalid || !this.newProduct?.id || this.isSaving) {
      this.articuloForm.markAllAsTouched();
      return;
    }
    this.isSaving = true;

    const id = this.newProduct.id;
    const updateProduct: Partial<Producto> = {
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

    // 1) Update en Firestore (refresca updatedAt)
    const { docPath, write } = await this.firestoreService.updateDocumentID<Producto>(
      updateProduct, Paths.productos, id
    );

    // 2) UI inmediata (cache + stream)
    await this.invSync.upsertLocal({ ...this.newProduct, ...updateProduct });

    // 3) UX
    this.interaccionService.showToast('Actualizado (se sincronizará al tener internet)');
    this.popoverController.dismiss();

    // 4) Errores reales
    write
      .catch(err => this.interaccionService.showToast('Error al sincronizar: ' + (err?.message ?? 'desconocido')))
      .finally(() => this.isSaving = false);
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
