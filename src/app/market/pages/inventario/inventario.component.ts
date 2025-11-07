import { Component, inject, OnDestroy, OnInit} from '@angular/core';
import { FirestoreService } from '../../../services/firestore.service';
import { Paths, Producto } from '../../../models/models';

import { ViewChild } from '@angular/core';
import type { SegmentChangeEventDetail } from '@ionic/core';


// Angular Material
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatSortModule,MatSort } from '@angular/material/sort';
import {MatProgressBarModule} from '@angular/material/progress-bar';

import { LocalPagedDataSource } from '../../../utils/local-paged-data-source';

import { PopsetstockComponent } from '../../components/popsetstock/popsetstock.component';

import { InteraccionService } from '../../../services/interaccion.service';

import { Clipboard } from '@angular/cdk/clipboard';
import { FireAuthService } from '../../../services/fire-auth.service';
import { environment } from '../../../../environments/environment';
import {
  IonHeader,
  IonToolbar,
  IonButtons,
  IonTitle,
  IonChip,
  IonLabel,
  IonIcon,
  IonContent,
  IonItem,
  IonInput,
  IonButton,
  IonMenuButton,
  PopoverController, IonRow, IonGrid, IonCol, IonSegment, IonSegmentButton } from "@ionic/angular/standalone";

import { addIcons } from 'ionicons';
import {
  refreshCircle,
  options,
  copy,
  trash,
  addCircle,
  create
} from 'ionicons/icons';

import { NgClass } from '@angular/common';
import { debounceTime, Subscription } from 'rxjs';
import { PopsetProductComponent } from '../../components/pop-set-producto/pop-set-product.component';
import { InventarioSyncService } from '../../../services/inventario-sync.service';
import { ReactiveFormsModule, FormControl } from '@angular/forms';

type StockFilter = 'all' | 'low' | 'out';            // low: <= stock_minimo; out: stock === 0
type ExpiryFilter = 'all' | 'expired' | 'soon';      // soon: dentro de X días

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
  imports: [IonSegmentButton, IonSegment, IonCol, IonGrid, IonRow,
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


  filterState: InventarioFilter = {
  term: '',
  mode: 'all',
  soonDays: 30,
  };

  productos: Producto[] = [];
  displayedColumns: string[] = [
    'editar',
    'nombre',
    'descripcion',
    //'costo_compra',
    //'costo_sin_iva',
    'pvp',
    'stock',
    'stock_minimo',
    'fecha_caducidad'
  ];
  //dataSource?: MatTableDataSource<Producto>;
  campos = [{ campo: 'nombre', label: 'Nombre' },
  { campo: 'descripcion', label: 'Descripción' },
  { campo: 'costo_compra', label: 'Costo compra' },
  { campo: 'costo_sin_iva', label: 'Costo sin IVA' },
  { campo: 'pvp', label: 'PVP' },
  { campo: 'stock', label: 'Stock' },
  { campo: 'fecha_caducidad', label: 'Fecha de Caducidad' },
  { campo: 'stock_minimo', label: 'Stock Mínimo' },
  { campo: 'diferencia', label: 'Diferencia' },
  ];

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;
  
  search = new FormControl('', { nonNullable: true });

  //dataSource!: LocalPagedDataSource<Producto>;
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

private isStockLow = (p: Producto): boolean => p.stock <= p.stock_minimo;
private isStockOut = (p: Producto): boolean => p.stock <= 0;

  permisos() {
    this.fireAuthService.stateAuth.subscribe(async res => {
      if (res !== null) {
        //this.getProductosFromServer();
      // 1) Inicializa cache y estado en memoria
      await this.invSync.init();
      // 2) Carga única (si hay cache no baja los 3000 otra vez)
      await this.invSync.loadOnce();

      // 3) Suscríbete al stream local (siempre rápido)
      this.subscriptionProductos = this.invSync.stream().subscribe( () => {
       this.loading = false;
        });

        if (res.uid === this.uidAdmin) {
          this.vendedor = false;
        }

      }
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

 /*   getProductos() {
    this.dataSource = new MatTableDataSource(this.productos);
    this.setTableData(this.dataSource);
  }

  getProductosAgotados() {
    const filtrados = this.productos.filter(p => this.esStockCritico(p));
    this.dataSource = new MatTableDataSource(filtrados);
    this.setTableData(this.dataSource);
  }

  getProductosCaducados() {
    const filtrados = this.productos.filter(p => this.getDiasParaCaducar(p.fecha_caducidad) <= this.numeroFecha);
    this.dataSource = new MatTableDataSource(filtrados);
    this.setTableData(this.dataSource);
  } 

  private setTableData(data: MatTableDataSource<Producto>) {
    setTimeout(() => {
      data.paginator = this.paginator;
      data.sort = this.sort;
    }, 300);
  }*/

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
      componentProps: { producto },
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
      '¿Seguro que desea eliminar?').then(res => {
        if (res) {
          const path = Paths.productos;
          this.firestoreService.deleteDocumentID(path, producto.codigo);
        }
      })
  }

  async setProduct(newProduct: Producto) {
    const popover = await this.popoverController.create({
      component: PopsetProductComponent,
      cssClass: 'popoverCssProducto',
      translucent: false,
      backdropDismiss: true,
      componentProps: { newProduct },
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
