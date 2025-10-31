import { Component, inject, OnInit } from '@angular/core';
import { ReactiveFormsModule,FormBuilder, Validators } from '@angular/forms';
import { Paths, Producto } from '../../../models/models';
import { FirestoreService } from '../../../services/firestore.service';
import { InteraccionService } from '../../../services/interaccion.service';
import { PrintEtiquetasService } from '../../../services/print-etiquetas.service';
import { IonHeader, IonToolbar, IonTitle, IonGrid, IonRow, IonCol, IonCard, IonCardContent, IonCardTitle, IonCardHeader, IonContent } from "@ionic/angular/standalone";

// Angular Material
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule }      from '@angular/material/input';
import { MatSelectModule }     from '@angular/material/select';
import { MatRadioModule }      from '@angular/material/radio';
import { MatCheckboxModule }   from '@angular/material/checkbox';
import { MatButtonModule }     from '@angular/material/button';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { PreviewEtiquetaComponent } from '../../components/preview-etiqueta-component/preview-etiqueta.component';

@Component({
  selector: 'app-generar-codigo',
  templateUrl: './generar-codigo.component.html',
  styleUrls: ['./generar-codigo.component.scss'],
  imports: [
    IonContent, IonHeader, IonToolbar,IonCardHeader, IonCardTitle, IonCardContent, IonCard, IonCol, IonRow, IonGrid, IonTitle, ReactiveFormsModule,
    ReactiveFormsModule,
    MatFormFieldModule, MatInputModule, MatSelectModule, MatRadioModule,
    MatCheckboxModule, MatButtonModule, MatSlideToggleModule,PreviewEtiquetaComponent
  ]
})
export default class GenerarCodigoComponent implements OnInit {
  private fb = inject(FormBuilder);
  private firestore = inject(FirestoreService);
  private ui = inject(InteraccionService);
  private printer = inject(PrintEtiquetasService);

  // generar-codigo.component.ts
  modo: 'nuevo' | 'existente' = 'nuevo';

      // Opciones de vista previa (si quieres tunear desde aquí)
    px = {
      barWidthPx: 1.6,
      barHeightPx: 80,
      format: 'CODE128' as 'CODE128' | 'EAN13',
    };

    // Si en tu form ya tienes sizeW/sizeH en mm, úsalo; si no, defaults:
  defaultSize = { w: 50, h: 30 };


  isSaving = false;
  mensaje = '';
  productoExistente: Producto | null = null;

  form = this.fb.group({
    // Búsqueda
    buscar: [''],

    // Datos mínimos del producto
    codigo: ['', [Validators.required, Validators.maxLength(13)]],
    nombre: ['', Validators.required],
    descripcion: [''],
    pvp: [null as number | null, [Validators.min(0)]],
    costo_compra: [null as number | null, [Validators.min(0)]],
    stock: [null as number | null, [Validators.min(0)]],
    fecha_caducidad: [''],
    categoria: [''],
    check_iva: [false],
    costo_sin_iva: [0],
    stock_minimo: [0],

    // Parámetros de etiqueta
    sizeW: [50, [Validators.required, Validators.min(10)]],
    sizeH: [30, [Validators.required, Validators.min(10)]],
    tipoCodigo: ['CODE128' as 'CODE128'|'EAN13'|'QR'],
    cantidad: [1, [Validators.required, Validators.min(1)]],
    qrUrl: [''],
    darkness: [15],
    speed: [3],

    // Lógica
    crearInventario: [true]
  });

    ngOnInit() {
    this.actualizarEstadoCrearInventario();
  }

  setModo(m: 'nuevo'|'existente') {
    this.modo = m;
    this.actualizarEstadoCrearInventario();
  }

  private actualizarEstadoCrearInventario() {
    const ctrl = this.form.get('crearInventario');
    if (!ctrl) return;
    if (this.modo === 'nuevo') ctrl.enable({ emitEvent: false });
    else ctrl.disable({ emitEvent: false });
  }


  // --------- Búsqueda / validación ----------
  async validarCodigoUnico() {
    if (this.modo !== 'nuevo') return;
    const codigo = (this.form.value.codigo || '').trim();
    if (!codigo) return;
    const p = await this.firestore.getDocumentQuery<Producto>(Paths.productos, 'codigo', codigo);
    if (p) {
      this.form.get('codigo')?.setErrors({ codigoDuplicado: true });
      this.ui.showToast('Ya existe un producto con este código');
    } else {
      this.form.get('codigo')?.setErrors(null);
    }
  }

  async buscarProductoExistente() {
    const q = (this.form.value.buscar || '').trim();
    if (!q) return;
    const p = await this.firestore.getDocumentQuery<Producto>(Paths.productos, 'codigo', q);
    if (p) {
      this.productoExistente = p;
      this.form.patchValue({
        codigo: p.codigo,
        nombre: p.nombre,
        descripcion: p.descripcion || '',
        pvp: p.pvp ?? null
      });
      this.ui.showToast('Producto cargado');
    } else {
      this.productoExistente = null;
      this.ui.showToast('No se encontró el producto');
    }
  }

  // --------- ZPL ----------
  private buildZpl(): string {
    const f = this.form.value;
    return this.printer.buildZplLabel({
      widthMm: f.sizeW!, heightMm: f.sizeH!,
      product: f.nombre || '',
      sku: f.codigo || '',
      price: f.pvp ?? undefined,
      barcodeType: f.tipoCodigo!,
      barcodeValue: f.codigo || '',
      qrUrl: f.qrUrl || '',
      darkness: f.darkness ?? undefined,
      speed: f.speed ?? undefined
    });
  }

  vistaPreviaZpl(): string {
    return this.buildZpl();
  }

  // --------- Impresión ----------
  private async imprimir() {
    const zpl = this.buildZpl();
    await this.printer.printZpl(zpl, { copies: this.form.value.cantidad || 1 });
  }

  // --------- Acciones ----------
  async soloImprimir() {
    this.mensaje = '';
    try {
      if (this.modo === 'existente' && !this.productoExistente) {
        await this.buscarProductoExistente();
        if (!this.productoExistente) return;
      }
      await this.imprimir();
      this.ui.showToast('Impresión enviada');
    } catch (e: any) {
      this.mensaje = 'Error al imprimir: ' + (e?.message || e);
      this.ui.showToast(this.mensaje);
    }
  }

  async guardarEImprimir() {
    if (this.modo === 'nuevo') {
      if (this.form.invalid) {
        this.form.markAllAsTouched();
        this.ui.showToast('Completa los datos requeridos');
        return;
      }
      if (this.form.get('codigo')?.hasError('codigoDuplicado')) {
        this.ui.showToast('El código ya existe');
        return;
      }
    }

    this.isSaving = true;
    this.mensaje = '';
    try {
      // 1) Guardar nuevo en Inventario si corresponde
      if (this.modo === 'nuevo' && this.form.value.crearInventario) {
        const data: Producto = {
          codigo: this.form.value.codigo!,
          nombre: this.form.value.nombre!,
          descripcion: this.form.value.descripcion || '',
          pvp: this.form.value.pvp ?? null as any,
          costo_compra: this.form.value.costo_compra ?? null as any,
          stock: this.form.value.stock ?? null as any,
          fecha_caducidad: this.form.value.fecha_caducidad || null as any,
          check_iva: this.form.value.check_iva  || false,
          costo_sin_iva: this.form.value.costo_sin_iva || 0 ,
          stock_minimo: this.form.value.stock_minimo  || 0,
          // agrega más campos si tu modelo los necesita
        };
        // Usa tu servicio existente (elige la API que prefieras)
        const { docPath, write } = await this.firestore.upsertOne<Producto>(
          Paths.productos,
          data,
          { idField: 'codigo', useAutoId: false, merge: true }
        );
        this.ui.showToast(this.firestore.isOffline() ? 'Guardado (pendiente de sincronizar)' : 'Guardado con éxito');

        // Notificación cuando sincronice (opcional)
        this.firestore.observeSyncStatus(docPath).subscribe(st => {
          if (st === 'synced') this.ui.showToast('Sincronizado');
        });

        // Manejo de error real al sincronizar
        write.catch(err => this.ui.showToast('Error al sincronizar: ' + (err?.message ?? 'desconocido')));
      }

      // 2) Imprimir
      await this.imprimir();
      this.ui.showToast('Producto guardado e impresión enviada');
    } catch (e: any) {
      this.mensaje = 'Error: ' + (e?.message || e);
      this.ui.showToast(this.mensaje);
    } finally {
      this.isSaving = false;
    }
  }
}
