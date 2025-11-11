import { Component, inject, OnDestroy, OnInit} from '@angular/core';
import { ViewChild } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { NgClass } from '@angular/common';
import { Clipboard } from '@angular/cdk/clipboard';
import { Subscription } from 'rxjs';

// + añade:
import { ChangeDetectorRef } from '@angular/core';


//Ionic
import {
  IonHeader,IonToolbar,IonButtons,IonTitle,IonChip,
  IonLabel,IonIcon,IonContent,IonItem,IonInput,
  IonButton,IonMenuButton,PopoverController, IonRow,
  IonGrid, IonCol, IonSegment, IonSegmentButton, IonSearchbar } from "@ionic/angular/standalone";
import type { SegmentChangeEventDetail } from '@ionic/core';
import { addIcons } from 'ionicons';
import {
  refreshCircle,
  options,
  copy,
  trash,
  addCircle,
  create
} from 'ionicons/icons';

// Angular Material
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatTableModule } from '@angular/material/table';
import { MatSortModule,MatSort } from '@angular/material/sort';
import {MatProgressBarModule} from '@angular/material/progress-bar';

//servicios
import { FirestoreService } from '../../../services/firestore.service';
import { InteraccionService } from '../../../services/interaccion.service';
import { FireAuthService } from '../../../services/fire-auth.service';
import { InventarioSyncService } from '../../../services/inventario-sync.service';

//componentes
import { PopsetstockComponent } from '../../components/popsetstock/popsetstock.component';
import { PopsetProductComponent } from '../../components/pop-set-producto/pop-set-product.component';

//modelos
import { environment } from '../../../../environments/environment';
import { Paths, Producto } from '../../../models/models';

//utils
import { LocalPagedDataSource } from '../../../utils/local-paged-data-source';




// Tipos para el modo del filtro
type Mode = 'all' | 'expiry' | 'stock';

// Filtro estructurado (puede crecer sin romper nada)
interface InventarioFilter {
  term: string;     // texto libre (nombre, descripción, código)
  mode: Mode;       // all | expiry | stock
  soonDays: number; // cuántos días considerar "por caducar"
}

@Component({
  selector: 'app-inventario',
  templateUrl: './inventario.component.html',
  styleUrls: ['./inventario.component.scss'],
  imports: [ IonSegmentButton, IonSegment, IonCol, IonGrid, IonRow,
    IonButton,
    IonInput,
    IonItem,
    IonContent,
    IonIcon,
    IonLabel,
    IonChip,
    IonTitle,
    IonButtons,
    IonToolbar,
    IonHeader,
    IonMenuButton,
    MatTableModule,
    MatPaginatorModule,
    MatProgressBarModule,
    NgClass,
    ReactiveFormsModule,
    MatSortModule
  ],
})


export default class InventarioComponent implements OnInit, OnDestroy {

  private firestoreService = inject(FirestoreService);
  private popoverController = inject(PopoverController);
  private interaccionService = inject(InteraccionService);
  private clipboard = inject(Clipboard);
  private fireAuthService = inject(FireAuthService);
  private invSync = inject(InventarioSyncService);
   private cdr = inject(ChangeDetectorRef);


  filterState: InventarioFilter = {
  term: '',
  mode: 'all',
  soonDays: 30,
  };

  private readonly COSTS_KEY = 'inv.showCosts';
  showCosts = false;

  productos: Producto[] = [];

    /** Columnas base siempre visibles */
  private baseCols: string[] = [
    'editar',
    'nombre',
    'descripcion',
    'pvp',
    'stock',
    'stock_minimo',
    'fecha_caducidad'
  ];

    /** Columnas de costo (solo para admin cuando showCosts = true) */
  private costCols: string[] = ['costo_compra','costo_sin_iva'];


  /** Getter que decide qué columnas mostrar */
  get columns(): string[] {
    if (!this.showCosts) return this.baseCols;
    const i = this.baseCols.indexOf('descripcion');
    const before = this.baseCols.slice(0, i + 1);
    const after  = this.baseCols.slice(i + 1);
    return [...before, ...this.costCols, ...after];
  }

/*   displayedColumns: string[] = [
    'editar',
    'nombre',
    'descripcion',
    //'costo_compra',
    //'costo_sin_iva',
    'pvp',
    'stock',
    'stock_minimo',
    'fecha_caducidad'
  ]; */

  // Ajusta tus "campos" para que existan los contenedores de todas las columnas de datos:
  campos = [
    { campo: 'nombre', label: 'Nombre' },
    { campo: 'descripcion', label: 'Descripción' },
    { campo: 'costo_compra', label: 'Costo compra' },   // estarán ocultas a nivel de columns
    { campo: 'costo_sin_iva', label: 'Costo sin IVA' }, // idem
    { campo: 'pvp', label: 'PVP' },
    { campo: 'stock', label: 'Stock' },
    { campo: 'stock_minimo', label: 'Stock Mínimo' },
    { campo: 'fecha_caducidad', label: 'Fecha de Caducidad' },
  ];

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  hovered: Producto | null = null;
  selected: Producto | null = null;

  dataSource!: LocalPagedDataSource<Producto, InventarioFilter>;
  loading = true;

  productosAgotados: Producto[] = [];
  productosCaducados: Producto[] = [];
  vendedor = true;
  uidAdmin = environment.uidAdmin;

  numeroFecha: number = 70;
  subscriptionProductos?: Subscription;



  constructor() { addIcons({ refreshCircle, options, copy, trash, create }) }

  ngOnInit() {
    this.permisos();
        // cargar preferencia local
    this.showCosts = localStorage.getItem(this.COSTS_KEY) === '1';
  }

  ngOnDestroy(): void {
    this.subscriptionProductos?.unsubscribe();
  }

ngAfterViewInit() {
  this.dataSource = new LocalPagedDataSource<Producto, InventarioFilter>(
    this.invSync.stream(),
    this.paginator!,
    this.sort!,
    {
      initialPageSize: 25,
      filterFn: (p, f) => this.applyFilter(p, f),
    }
  );

  this.dataSource.setFilter(this.filterState);
}


  permisos() {
    this.fireAuthService.stateAuth.subscribe(async res => {
      if (res !== null) {
        this.cargarProductos();
        if (res.uid === this.uidAdmin) {
          this.vendedor = false;
        }
      }
    });
  }

    /** Solo admin puede alternar columnas de costo */
  toggleCosts() {
    if (this.vendedor) return;     // vendedor no puede
    this.showCosts = !this.showCosts;
    localStorage.setItem(this.COSTS_KEY, this.showCosts ? '1' : '0');
    this.cdr.detectChanges();      // refresca header/rows
  }

async  cargarProductos() {
          // 1) Inicializa cache y estado en memoria
      await this.invSync.init();
      // 2) Carga única (si hay cache no baja los 3000 otra vez)
      await this.invSync.loadOnce();

      // 3) Suscríbete al stream local (siempre rápido)
      this.subscriptionProductos = this.invSync.stream().subscribe( () => {
        this.loading = false;
      });
  }

/** Actualiza el texto de búsqueda y reaplica el filtro */
onSearch(ev: any) {
  const val = (ev?.detail?.value ?? '').toString();
  this.filterState = { ...this.filterState, term: val };
  this.dataSource.setFilter(this.filterState);
  this.paginator?.firstPage();
}

/** Cambia el umbral de días para "por caducar" y reaplica el filtro si estás en modo caducidad */
onSoonDays(ev: any) {
  const v = Number(ev?.detail?.value ?? this.filterState.soonDays);
  this.filterState = {
    ...this.filterState,
    soonDays: Number.isFinite(v) ? v : this.filterState.soonDays
  };
  // Refiltra de inmediato; especialmente relevante en modo "expiry"
  this.dataSource.setFilter(this.filterState);
  this.paginator?.firstPage();
}

  getRowClass(producto: Producto): string {
    const diasParaCaducar = this.getDiasParaCaducar(producto.fecha_caducidad);
    const stockCritico = this.esStockCritico(producto);

    if (stockCritico && diasParaCaducar <= this.numeroFecha) {
      return 'orange'; // Ambos: stock crítico y casi caduca
    }

    if (stockCritico) {
      return 'red'; // Solo stock bajo
    }

    if (diasParaCaducar <= this.numeroFecha) {
      return 'yellow'; // Solo próximo a caducar
    }

    return ''; // Normal
  }

  getDiasParaCaducar(fecha: Date | string): number {
    const today = new Date();
    const exp = new Date(fecha);
    return Math.floor((exp.getTime() - today.getTime()) / 86400000);
  }

  esStockCritico(producto: Producto): boolean {
    return producto.stock <= producto.stock_minimo;
  }



  async setStock(ev: any,producto: Producto) {
    const popover = await this.popoverController.create({
      component: PopsetstockComponent,
      event: ev,
      cssClass: 'popoverCss',
      translucent: false,
      backdropDismiss: true,
      componentProps: { producto,vendedor: this.vendedor },
      mode: 'ios'
    });
    await popover.present();
    const { data } = await popover.onWillDismiss();
  }

  copyCodigo(ev: any) {
    this.interaccionService.showToast('Código copiado: ' + ev.codigo);
    this.clipboard.copy(ev.codigo)

  }

  delete(producto: Producto) {
    this.interaccionService.preguntaAlert('Alerta',
      `¿Seguro que desea eliminar a ${producto.nombre}?`).then(res => {
        if(!producto.id){
          return
        }
        if (res) {
          const path = Paths.productos;
          this.firestoreService.deleteDocumentID(path, producto.id)
          .catch(err => this.interaccionService.showToast('Error al sincronizar: ' + (err?.message ?? 'desconocido')));

          this.invSync.deleteLocal(producto.id).then( () => {
            this.interaccionService.showToast('Eliminado (se sincronizará al tener internet)');

          })
        }
      })
  }

  async setProduct(newProduct: Producto) {
    const popover = await this.popoverController.create({
      component: PopsetProductComponent,
      cssClass: 'popoverCssProducto',
      translucent: false,
      backdropDismiss: true,
      componentProps: { newProduct, vendedor: this.vendedor },
      mode: 'ios'
    });
    await popover.present();
  }

  async addProduct() {
    const popover = await this.popoverController.create({
      component: PopsetProductComponent,
      cssClass: 'popoverCssProducto',
      translucent: false,
      backdropDismiss: true,
      mode: 'ios'
    });
    await popover.present();
  }

  // Cambia el modo según el segment (normaliza value para que nunca sea undefined)
onModeChange(ev: CustomEvent<SegmentChangeEventDetail>) {
  const raw = (ev?.detail?.value ?? 'all') as string;
  this.setMode(raw as Mode);
}

/** Establece el modo y reaplica el filtro + regresa a la primera página */
setMode(mode: Mode) {
  this.filterState = { ...this.filterState, mode };
  this.dataSource.setFilter(this.filterState);
  this.paginator?.firstPage();
}

// --- Helpers para el filtro ----
private daysToExpire(fecha?: string | Date): number {
  if (!fecha) return Number.POSITIVE_INFINITY;
  const today = new Date();
  const exp = new Date(fecha);
  return Math.floor((exp.getTime() - today.getTime()) / 86400000);
}
private isOut(p: Producto)  { return p.stock <= 0; }
private isLow(p: Producto)  { return p.stock > 0 && p.stock <= p.stock_minimo; }
private isSoon(p: Producto, days: number) {
  const d = this.daysToExpire(p.fecha_caducidad);
  return d >= 0 && d <= days;
}
private isExpired(p: Producto) {
  const d = this.daysToExpire(p.fecha_caducidad);
  return d < 0;
}
private matchesText(p: Producto, term: string) {
  if (!term) return true;
  const t = term.toLowerCase();
  return (p.nombre?.toLowerCase().includes(t))
      || (p.descripcion?.toLowerCase().includes(t))
      || (p.codigo?.toLowerCase().includes(t));
}

/** Filtro unificado: texto + modo (all/expiry/stock) */
private applyFilter(p: Producto, f: InventarioFilter): boolean {
  // 1) texto
  if (!this.matchesText(p, f.term)) return false;

  // 2) modo
  if (f.mode === 'all') return true;

  if (f.mode === 'expiry') {
    // Caducidad → caducados O por caducar
    return this.isExpired(p) || this.isSoon(p, f.soonDays);
  }

  if (f.mode === 'stock') {
    // Stock → agotados O por agotarse
    return this.isOut(p) || this.isLow(p);
  }

  return true;
}

}
