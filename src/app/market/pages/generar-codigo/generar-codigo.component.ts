import { Component, DestroyRef, inject, OnInit } from '@angular/core';
  import { ReactiveFormsModule, FormBuilder, FormsModule, Validators, FormGroup, AsyncValidatorFn, AbstractControl, ValidationErrors } from '@angular/forms';
  import { NgxBarcode6Module } from 'ngx-barcode6';
  import { CommonModule } from '@angular/common';
  import { ZebraBrowserPrintService } from '../../../services/zebra-browserprint.service';
  import { EtiquetaConfig, PreviewEtiquetaComponent, ProductoPreview } from '../../components/preview-etiqueta-component/preview-etiqueta.component';

  import { BrowserPrintService } from '../../../services/browser-print.service';
  import { buildZplLabel, multiplyJob } from '../../../utils/label-zpl';

  // Angular Material
  import { MatFormFieldModule } from '@angular/material/form-field';
  import { MatInputModule } from '@angular/material/input';
  import { MatSelectModule } from '@angular/material/select';
  import { MatRadioModule } from '@angular/material/radio';
  import { MatCheckboxModule } from '@angular/material/checkbox';
  import { MatButtonModule } from '@angular/material/button';
  import { MatSlideToggleModule } from '@angular/material/slide-toggle';

  import { IonGrid, IonRow, IonHeader, 
    IonCard, IonCardHeader, IonCardTitle, 
    IonCardContent, IonToolbar, IonTitle, 
    IonContent, IonCol,PopoverController } from "@ionic/angular/standalone";
  import { Paths, Producto } from 'src/app/models/models';
  import { FirestoreService } from '../../../services/firestore.service';
  import { InteraccionService } from 'src/app/services/interaccion.service';
  import { catchError, filter, firstValueFrom, from, map, of, take } from 'rxjs';
  import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

  import { InventarioSyncService } from '../../../services/inventario-sync.service';



  @Component({
      selector: 'app-generar-codigo',
      standalone: true,
      imports: [IonCol, IonContent, IonTitle, IonToolbar, IonCardContent, IonCardTitle, IonCardHeader, IonCard,
        IonHeader, IonRow, IonGrid,
        CommonModule, ReactiveFormsModule, NgxBarcode6Module,
        PreviewEtiquetaComponent, MatFormFieldModule,
        MatInputModule,
        MatSelectModule,
        MatRadioModule,
        MatCheckboxModule,
        MatButtonModule,
        MatSlideToggleModule,
        
      ],
      templateUrl: './generar-codigo.component.html',
      styleUrls: ['./generar-codigo.component.scss']
    })
  export default class GenerarCodigoComponent implements OnInit {

     private invSync = inject(InventarioSyncService);

    modo: 'nuevo' | 'existente' = 'nuevo';
    impresoras: any[] = [];
    cargando = false;
    mensaje = '';
    productoDuplicado?: Producto;
    productoExistenteCargado = false;

    // Getters prácticos
  get codigoCtl() { return this.form.get('codigo'); }
  get codigoDuplicado(): boolean { return !!this.codigoCtl?.errors?.['codigoDuplicado']; }

  // Reglas de habilitado:
  get puedeSoloImprimir(): boolean {
    // Permite imprimir si:
    // - hay código no vacío
    // - parámetros mínimos de etiqueta válidos (sizeW, sizeH, tipoCodigo, cantidad>0)
    const f = this.form.value;
    const tieneCodigo = !!(f.codigo && f.codigo.toString().trim().length >= 4);
    const etiquetaOk =
      Number(f.sizeW) > 0 &&
      Number(f.sizeH) > 0 &&
      ['CODE128','EAN13','QR'].includes(f.tipoCodigo) &&
      Number(f.cantidad) > 0;

    // No bloqueamos por duplicado
    return tieneCodigo && etiquetaOk;
  }

  get puedeGuardarEImprimir(): boolean {
    // Debe ser un producto nuevo (no cargado desde existente),
    // el form debe ser válido y NO debe haber duplicado.
    return !this.productoExistenteCargado && this.form.valid && !this.codigoDuplicado;
  }

    form: FormGroup = this.fb.group({
      // Selección / búsqueda
      buscar: [''],

      // Datos del producto (mínimos)
      //codigo: ['', [Validators.required, Validators.maxLength(13)]], // EAN13 -> 12 dígitos + dígito; o SKU
      codigo: this.fb.control(
      '',
      {
        validators: [Validators.required, Validators.maxLength(13)],
        asyncValidators: [this.codigoUnicoValidator()],
        updateOn: 'blur'      // dispara validación al salir del input
      }
    ),
      nombre: [null, Validators.required],
      descripcion: [null, Validators.required],
      costo_compra: [null, [Validators.required, Validators.min(0)]],
      check_iva: [false],
      costo_sin_iva: [null, [ Validators.min(0)]],
      pvp: [null, [Validators.required, Validators.min(0)]],
      stock: [null, [Validators.required, Validators.min(0)]],
      fecha_caducidad: [''],
      stock_minimo: [null, [Validators.required, Validators.min(0)]],

      // Parámetros de etiqueta
      sizeW: [60, [Validators.required, Validators.min(10)]],
      sizeH: [40, [Validators.required, Validators.min(10)]],
      tipoCodigo: ['CODE128' as 'CODE128' | 'EAN13' | 'QR'],
      cantidad: [1, [Validators.required, Validators.min(1)]],
      qrUrl: [''],
      darkness: [24], // 0–30 aprox.
      speed: [6],     // 2–6 aprox.

      // crear en inventario al imprimir
      crearInventario: [true]
    });

    //private inventario = new InventarioServiceMock();
    private firestoreService = inject(FirestoreService);
    private interaccionService = inject(InteraccionService);
    private popoverController = inject(PopoverController);
    private destroyRef = inject(DestroyRef);

    constructor(private fb: FormBuilder, private bp: BrowserPrintService) { }

    async ngOnInit() {
      try {
        await this.bp.init();
        this.impresoras = await this.bp.getPrinters();
      } catch (e: any) {
        this.mensaje = 'BrowserPrint no disponible. Instálalo en este PC.';
      }

    // (OPCIONAL) Limpieza inmediata al empezar a editar el código (antes del blur)
    this.codigoCtl?.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (this.productoExistenteCargado) {
          this.limpiarCamposProductoAutorrellenos();
          this.productoExistenteCargado = false;
        }
      });

    // Tu suscripción principal que reacciona cuando TERMINA la validación async
    this.codigoCtl?.statusChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(async status => {
        if (status === 'PENDING') return;

        const codigo = this.codigoCtl?.value?.toString().trim() || '';

        if (this.codigoDuplicado && codigo) {
          const prod = await this.firestoreService.getDocumentQuery<Producto>(Paths.productos, 'codigo', codigo);
          if (prod) {
            this.productoExistenteCargado = true;
            this.form.patchValue({
              nombre: prod.nombre ?? null,
              descripcion: prod.descripcion ?? null,
              stock: prod.stock ?? null,
              pvp: prod.pvp ?? null,
              costo_compra: prod.costo_compra ?? null,
              stock_minimo: prod.stock_minimo ?? null,
              fecha_caducidad: prod.fecha_caducidad ?? ''
            }, { emitEvent: false });
          }
        } else {
          if (this.productoExistenteCargado) {
            this.limpiarCamposProductoAutorrellenos();
          }
          this.productoExistenteCargado = false;
        }
      });
    }

    async onSubmit() {
    // Equivale a click en "Guardar + imprimir"
    await this.guardarEImprimir();
  }

    private async esperarValidaciones() {
    if (this.form.pending) {
      await firstValueFrom(
        this.form.statusChanges.pipe(filter(s => s !== 'PENDING'), take(1))
      );
    }
  }

  private codigoUnicoValidator(): AsyncValidatorFn {
    return (control: AbstractControl) => {
      const codigo = (control.value ?? '').toString().trim();

      // Evita consultas innecesarias
      if (!codigo || codigo.length < 4) {
        return of(null);
      }

      return from(
        this.firestoreService.getDocumentQuery<Producto>(Paths.productos, 'codigo', codigo)
      ).pipe(
        map(doc => (doc ? { codigoDuplicado: true } as ValidationErrors : null)),
        // Ante cualquier error de red/offline, no bloquees el usuario
        catchError(() => of(null))
      );
    };
  }

    campoNoValido(campo: string) {
      const c = this.form.controls[campo];
      return !!(c?.hasError('required') && c?.touched);
    }

    onModoCambio(m: 'nuevo' | 'existente') {
      this.modo = m;
      if (m === 'existente') {
        // reset campos producto si quieres
      }
    }

    async probarImpresora() {
      try {
        await this.bp.printRaw('^XA^FO10,10^ADN,18,10^FDPrueba ZPL OK^FS^XZ');
        this.mensaje = 'Prueba enviada.';
      } catch (e: any) {
        this.mensaje = 'No se pudo imprimir la prueba: ' + e;
      }
    }

    vistaPreviaZpl(): string {
      const f = this.form.value;
      const zpl = buildZplLabel({
        widthMm: f.sizeW!, heightMm: f.sizeH!,
        product: f.nombre || '',
        sku: f.codigo || '',
        price: f.pvp ?? undefined,
        barcodeType: f.tipoCodigo!,
        barcodeValue: f.codigo || '',
        qrUrl: f.qrUrl || '',
        darkness: f.darkness ?? undefined,
        speed: f.speed ?? undefined,
        descripcion: f.descripcion || ''  
      });
      return zpl;
    }

    async soloImprimir() {
        await this.esperarValidaciones();
  
      if (!this.puedeSoloImprimir) return;

    this.cargando = true;
    this.mensaje = '';
    try {
      const zpl = this.vistaPreviaZpl();
      const job = multiplyJob(zpl, this.form.value.cantidad || 1);
      await this.bp.printRaw(job);
      this.mensaje = 'Impresión enviada.';
    } catch (e: any) {
      this.mensaje = 'Error al imprimir: ' + e;
    } finally {
      this.cargando = false;
    }
    }

    async guardarEImprimir() {
    await this.esperarValidaciones();
    
    if (!this.puedeGuardarEImprimir) return; // opcional: muestra un toast
      this.cargando = true;
      this.mensaje = '';
       // 1) Crear/actualizar inventario si aplica
        if (this.form.value.crearInventario && this.modo === 'nuevo') {
          const nuevo: Producto = {
            codigo: this.form.value.codigo!,
            nombre: this.form.value.nombre!,
            descripcion: this.form.value.descripcion || '',
            stock: this.form.value.stock || 0,
            costo_compra: this.form.value.costo_compra || 0,
            pvp: this.form.value.pvp || 0,
            stock_minimo: this.form.value.stock_minimo || 0,
            fecha_caducidad: this.form.value.fecha_caducidad || '',
            check_iva: false,
            costo_sin_iva: this.form.value.costo_compra || 0,
          };
          
          const { id, docPath, write } = await this.firestoreService.createDocumentID<Producto>(
            nuevo, Paths.productos
          );

      // 3) Upsert local (UI instantánea, offline OK). El invSync pondrá updatedAt y encolará.
      await this.invSync.upsertLocal({ ...nuevo, id });

                // 2) Imprimir
        const zpl = this.vistaPreviaZpl();
        const job = multiplyJob(zpl, this.form.value.cantidad || 1);
        await this.bp.printRaw(job);

        // UX inmediata (funciona offline)
        this.interaccionService.showToast('Guardado (se sincronizará al tener internet)');
        this.popoverController.dismiss();
        this.resetFormulario()
          // 5) (Opcional) Maneja resultado final de la escritura (errores reales de red)
  write
    .catch(err => this.interaccionService.showToast('Error al sincronizar: ' + (err?.message ?? 'desconocido')))
        }
  }

    resetFormulario() {
    // Opcional: conserva tamaños, tipo y defaults de etiqueta
    const defaults = {
      sizeW: 60,
      sizeH: 40,
      tipoCodigo: 'CODE128' as const,
      cantidad: 1,
      qrUrl: '',
      darkness: 24,
      speed: 6
    };

    this.productoExistenteCargado = false;

    this.form.reset({
      // Datos del producto vacíos
      buscar: '',
      codigo: '',
      nombre: null,
      descripcion: null,
      costo_compra: null,
      check_iva: false,
      costo_sin_iva: null,
      pvp: null,
      stock: null,
      fecha_caducidad: '',
      stock_minimo: null,

      // Parámetros de etiqueta (defaults)
      ...defaults
    });

    // Marcar pristine/touched limpios
    this.form.markAsPristine();
    this.form.markAsUntouched();
  }

  private limpiarCamposProductoAutorrellenos() {
    // Limpia SOLO los campos que se rellenaron automáticamente
    this.form.patchValue({
      nombre: null,
      descripcion: null,
      stock: null,
      pvp: null,
      costo_compra: null,
      stock_minimo: null,
      fecha_caducidad: ''
    }, { emitEvent: false });

    // Opcional: dejar “limpio” el estado visual
    ['nombre','descripcion','stock','pvp','costo_compra','stock_minimo','fecha_caducidad']
      .forEach(key => {
        const c = this.form.get(key);
        c?.markAsPristine();
        c?.markAsUntouched();
        c?.updateValueAndValidity({ emitEvent: false });
      });
  }

  // En tu GenerarCodigoComponent
previewConfig(): EtiquetaConfig {
  const f = this.form.value;
  return {
    widthMm: f.sizeW || 60,
    heightMm: f.sizeH || 40,
    tipoCodigo: f.tipoCodigo || 'CODE128',
    cantidad: f.cantidad || 1,
    qrUrl: f.qrUrl || ''
  };
}

previewProducto(): ProductoPreview {
  const f = this.form.value;
  return {
    codigo: f.codigo || '',
    nombre: f.nombre || '',
    descripcion: f.descripcion || '',
    pvp: f.pvp ?? undefined
  };
}

  }
