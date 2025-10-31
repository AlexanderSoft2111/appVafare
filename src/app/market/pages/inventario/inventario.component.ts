import { Component, inject, OnDestroy, OnInit} from '@angular/core';
import { FirestoreService } from '../../../services/firestore.service';
import { Paths, Producto } from '../../../models/models';

import { ViewChild } from '@angular/core';


// Angular Material
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatSort } from '@angular/material/sort';

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
  PopoverController, IonRow, IonGrid, IonCol } from "@ionic/angular/standalone";

import { addIcons } from 'ionicons';
import {
  refreshCircle,
  options,
  copy,
  trash,
  addCircle,
  create
} from 'ionicons/icons';

import { RouterLink } from '@angular/router';
import { DatePipe, AsyncPipe } from '@angular/common';
import { NgClass } from '@angular/common';
import { Subscription } from 'rxjs';
import { PopsetProductComponent } from '../../components/pop-set-producto/pop-set-product.component';



@Component({
  selector: 'app-inventario',
  templateUrl: './inventario.component.html',
  styleUrls: ['./inventario.component.scss'],
  imports: [IonCol, IonGrid, IonRow,
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
    NgClass
  ],
})
export default class InventarioComponent implements OnInit, OnDestroy {

  private firestoreService = inject(FirestoreService);
  private popoverController = inject(PopoverController);
  private interaccionService = inject(InteraccionService);
  private clipboard = inject(Clipboard);
  private fireAuthService = inject(FireAuthService);

  productos: Producto[] = [];
  displayedColumns: string[] = [
    'editar',
    'nombre',
    'descripcion',
    'costo_compra',
    'costo_sin_iva',
    'pvp',
    'stock',
    'fecha_caducidad'
  ];
  dataSource?: MatTableDataSource<Producto>;
  campos = [{ campo: 'nombre', label: 'Nombre' },
  { campo: 'descripcion', label: 'Descripción' },
  { campo: 'costo_compra', label: 'Costo compra' },
  { campo: 'costo_sin_iva', label: 'Costo sin IVA' },
  { campo: 'pvp', label: 'PVP' },
  { campo: 'stock', label: 'Stock' },
  { campo: 'fecha_caducidad', label: 'Fecha de Caducidad' },
  { campo: 'stock_minimo', label: 'Stock Minimo' },
  { campo: 'diferencia', label: 'Diferencia' },
  ];

  @ViewChild(MatPaginator) paginator?: MatPaginator;
  @ViewChild(MatSort) sort?: MatSort;

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

  permisos() {
    this.fireAuthService.stateAuth.subscribe(res => {
      if (res !== null) {
        this.getProductosFromServer();
        if (res.uid === this.uidAdmin) {
          this.vendedor = false;
        }

      }
    });
  }

  getProductosFromServer() {
    this.subscriptionProductos = this.firestoreService.getCollectionChanges<Producto>(Paths.productos, 'codigo')
      .subscribe(res => {
        this.productos = res;
        if (!this.dataSource) {
          this.dataSource = new MatTableDataSource(this.productos);
          this.setTableData(this.dataSource);
        } else {
          this.dataSource.data = this.productos;
        }
      });
  }

  getProductos() {
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


  applyFilter(event: Event) {
    const filterValue = (event.target as HTMLInputElement).value;
    this.dataSource!.filter = filterValue.trim().toLowerCase();

    if (this.dataSource!.paginator) {
      this.dataSource!.paginator.firstPage();
    }
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

}
