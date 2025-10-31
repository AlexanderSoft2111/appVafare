import { ModalventaComponent } from './../../components/modalventa/modalventa.component';
import { Component, inject, OnInit } from '@angular/core';
import { Venta } from 'src/app/models/models';
import { VentaService } from '../../../services/venta.service';

import { InteraccionService } from '../../../services/interaccion.service';
import { FireAuthService } from '../../../services/fire-auth.service';
import { environment } from '../../../../environments/environment';
import { IonHeader, IonToolbar,IonList, IonButtons, IonTitle, IonChip, IonLabel, IonIcon, IonContent, IonItem, IonGrid, IonRow, IonCol, IonFooter,IonMenuButton,ModalController, IonButton } from "@ionic/angular/standalone";
import { DatePipe } from '@angular/common';

import { addIcons } from 'ionicons';
import {
  refreshCircle,
  eye,

} from 'ionicons/icons';

@Component({
    selector: 'app-ventas',
    templateUrl: './ventas.component.html',
    styleUrls: ['./ventas.component.scss'],
    imports: [IonList, IonCol, IonRow, IonGrid, IonItem,
      IonContent, IonIcon, IonLabel, IonChip, IonTitle, IonButtons, IonToolbar, IonHeader,IonMenuButton,DatePipe ]
})
export default class VentasComponent implements OnInit {

  private ventaService = inject(VentaService);
  private modalCtrl = inject(ModalController);
  private interaccionService = inject(InteraccionService);
  private fireAuthService = inject(FireAuthService);

  ventas: Venta[] = [];
  encabezados = ['Venta', 'Fecha', 'Productos', 'IVA', 'Total'];
  encabezadosValores = ['', '', 'Productos', 'IVA', 'Total'];
  vendedor = true;
  uidAdmin = environment.uidAdmin;

  valores = {
      total: 0,
      iva: 0,
      numVentas: 0,
  };

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
    // reiniciamos antes de acumular
    this.valores = { total: 0, iva: 0, numVentas: 0 };

    this.ventas.forEach(venta => {
      this.valores.iva += venta.iva;
      this.valores.total += venta.total;
    });

    // 👇 aquí contamos las ventas (cantidad de registros en ventas)
    this.valores.numVentas = this.ventas.length;

  } else {
    this.valores = {
      total: 0,
      iva: 0,
      numVentas: 0,
    };
  }
}


  async openModalVenta(venta: Venta) {
    const modalVenta = await this.modalCtrl.create({
      component: ModalventaComponent,
      backdropDismiss: true,
      componentProps: {venta},
      mode: 'ios'
    });
    await modalVenta.present();
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
