import { Component, inject, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonHeader, IonToolbar, IonTitle, IonContent, IonButton, IonIcon, IonButtons,ModalController } from "@ionic/angular/standalone";
import { MatTableModule } from '@angular/material/table';
import { MatDividerModule } from '@angular/material/divider';
import { Venta } from 'src/app/models/models';

import { addIcons } from 'ionicons';
import {
  close
} from 'ionicons/icons';

@Component({
    selector: 'app-modalventa',
    templateUrl: './modalventa.component.html',
    styleUrls: ['./modalventa.component.scss'],
imports: [CommonModule, IonHeader,IonButtons, IonToolbar, IonTitle, IonContent, IonButton, IonIcon, MatTableModule, MatDividerModule]
})
export class ModalventaComponent {

  @Input() venta!: Venta;

  displayedColumns: string[] = ['codigo','nombre', 'cantidad', 'precio','IVA' ,'subtotal'];

  private modalCtrl = inject(ModalController);

  constructor() { addIcons({close}) }


  closeModal() {
      return this.modalCtrl.dismiss(null, 'cancel');
  }


}
