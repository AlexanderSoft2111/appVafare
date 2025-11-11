import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { Producto } from '../../../models/models';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ViewChild } from '@angular/core';
import { ChangeDetectorRef } from '@angular/core';

//Ionic
import {
  IonButtons,
  IonLabel,IonIcon,IonItem,IonInput,
  IonButton,PopoverController 
} from "@ionic/angular/standalone";

import { addIcons } from 'ionicons';
import {
  checkbox,
  close,
  options
} from 'ionicons/icons';

// Angular Material
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatTableModule } from '@angular/material/table';
import { MatSortModule,MatSort } from '@angular/material/sort';
import {MatProgressBarModule} from '@angular/material/progress-bar';


import { InteraccionService } from '../../../services/interaccion.service';
import { InventarioSyncService } from '../../../services/inventario-sync.service';
import { LocalPagedDataSource } from '../../../utils/local-paged-data-source';
import { Subscription } from 'rxjs';



// Tipos para el modo del filtro
type Mode = 'all' | 'expiry' | 'stock';

// Filtro estructurado (puede crecer sin romper nada)
interface InventarioFilter {
  term: string;     // texto libre (nombre, descripción, código)
  mode: Mode;       // all | expiry | stock
  soonDays: number; // cuántos días considerar "por caducar"
}

@Component({
  selector: 'app-product-picker',
  templateUrl: './product-picker.component.html',
  styleUrls: ['./product-picker.component.scss'],
  imports: [
    IonButton,
    IonInput,
    IonItem,
    IonIcon,
    IonLabel,
    IonButtons,
    MatTableModule,
    MatPaginatorModule,
    MatProgressBarModule,
    ReactiveFormsModule,
    MatSortModule
  ],
})
export class ProductPickerComponent implements OnInit,OnDestroy {

  private popoverController = inject(PopoverController);
  private InteraccionService = inject(InteraccionService);
  private invSync = inject(InventarioSyncService);
  private cdr = inject(ChangeDetectorRef);   // ⬅️ inyección
  private booted = false;        
              // ⬅️ flag
  filterState: InventarioFilter = {
  term: '',
  mode: 'all',
  soonDays: 30,
  };

  displayedColumns: string[] = [
    'nombre',
    'descripcion',
    'pvp',
    'stock'
  ];
  campos = [{ campo: 'nombre', label: 'Nombre' },
  { campo: 'descripcion', label: 'Descripción' },
  { campo: 'pvp', label: 'PVP' },
  { campo: 'stock', label: 'Stock' }
  ];
  producto: Producto = {
      nombre: '',
      descripcion: '',
      costo_compra: 0,
      check_iva: false,
      costo_sin_iva: 0,
      pvp: 0,
      codigo: '',
      stock: 1,
      fecha_caducidad: '',
      stock_minimo: 0,
  }
  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  dataSource!: LocalPagedDataSource<Producto, InventarioFilter>;

  loading = true;

  subscriptionProductos?: Subscription;
  hovered: Producto | null = null;
  selected: Producto | null = null;
  private closing = false;

  constructor() {
    addIcons({ checkbox, close,options });
  }

  ngOnInit() {
    this.cargarProductos();
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
        initialPageSize: 10,
        filterFn: (p, f) => this.applyFilter(p, f),
      }
    );
  
    this.dataSource.setFilter(this.filterState);
    this.booted = true;
    this.cdr.detectChanges();
  }

  async cargarProductos() {
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


select(row: Producto) {
  this.selected = row;
}

confirm(row?: Producto) {
  if (this.closing) return;
  const prod = row ?? this.selected;
  if (!prod) return;
  this.closing = true;
  this.popoverController.dismiss(prod)
    .catch(() => {})               // evitar ruidos si ya se cerró
    .finally(() => this.closing = false);
}

  close() {
    this.popoverController.dismiss();
  }

  /** Establece el modo y reaplica el filtro + regresa a la primera página */
  setMode(mode: Mode) {
    this.filterState = { ...this.filterState, mode };
    this.dataSource.setFilter(this.filterState);
    this.paginator?.firstPage();
  }
  
  // --- Helpers para el filtro ----

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
  
    return true;
  }

}
