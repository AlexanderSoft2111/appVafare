import { ModalventaComponent } from './../../components/modalventa/modalventa.component';
 import { Component, inject, OnInit } from '@angular/core';
 import { Venta } from 'src/app/models/models';
 import { VentaService } from '../../../services/venta.service';

 import { InteraccionService } from '../../../services/interaccion.service';
 import { FireAuthService } from '../../../services/fire-auth.service';
 import { environment } from '../../../../environments/environment';
 import { IonHeader, IonToolbar, IonButtons, IonTitle,
          IonChip, IonLabel, IonIcon, IonContent, IonItem,
          IonGrid, IonRow, IonCol, IonFooter,IonMenuButton,
          ModalController, IonButton, IonList
} from "@ionic/angular/standalone";

import { DatePipe } from '@angular/common';

 import { addIcons } from 'ionicons';
 import {
   refreshCircle,
   eye,

 } from 'ionicons/icons';


@Component({
  selector: 'app-diseno',
  standalone: true,
  imports: [
    IonButton, IonCol, IonRow, IonGrid,
    IonItem, IonContent, IonIcon, IonLabel, IonChip,
    IonTitle, IonButtons, IonToolbar, IonHeader,IonMenuButton,IonList,DatePipe ],
  templateUrl: './diseno.component.html',
  styleUrls: ['./diseno.component.scss']
})
export default class DisenoComponent implements OnInit {


   ventas: Venta[] = [];
   encabezados = ['Venta', 'Fecha', 'Productos', 'IVA', 'Total']
   encabezadosValores = ['', '', 'Productos', 'IVA', 'Total']
   vendedor = true;
   uidAdmin = environment.uidAdmin;

   valores = {
       total: 0,
       iva: 0,
       productos: 0,
   }

   private ventaService = inject(VentaService);
   private modalController = inject(ModalController);
   private interaccionService = inject(InteraccionService);
   private fireAuthService = inject(FireAuthService);

   constructor() {
           addIcons({refreshCircle,eye});
           this.permisos();
           this.ventas = this.ventaService.ventas;
           this.getValores();
           this.ventaService.getVentasChanges().subscribe( res => {
                 if (res) {
                     this.ventas = res;
                     console.log('ventas -> ', this.ventas);
                     this.getValores();
                 }
           });
   }

   ngOnInit() {
   }

   permisos(){
     this.fireAuthService.stateAuth.subscribe( res => {
         if(res !== null){
           if (res.uid === this.uidAdmin){
                 this.vendedor = false;
           }

         }
     });
   }

   getValores() {
       if (this.ventas.length) {
           this.ventas.forEach( venta => {
                 this.valores.iva = this.valores.iva + venta.iva;
                 this.valores.productos = this.valores.productos + venta.productos.length;
                 this.valores.total = this.valores.total + venta.total;
                 venta.productos.forEach( (item, index) => {
                   if (!item.producto.nombre) {
                         venta.productos.splice(index, 1);
                   }
                 });
           });
       } else {
             this.valores = {
               total: 0,
               iva: 0,
               productos: 0,
             }
       }


   }

   async openModalVenta(venta: Venta) {
     const modal = await this.modalController.create({
       component: ModalventaComponent,
       backdropDismiss: true,
       componentProps: {venta},
       mode: 'ios'
     });
     await modal.present();
   }

   resetReport() {
     this.interaccionService.preguntaAlert('Alerta',
     '¿Reiniciar reporte de ventas?').then( res => {
         if (res) {
           this.ventaService.resetReport();
         }
     })
   }

 }

