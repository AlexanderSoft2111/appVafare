import { Component, inject, OnInit } from '@angular/core';
import { Producto } from '../../../models/models';
import { FormBuilder, FormsModule, Validators } from '@angular/forms';
import {
  IonItem,
  IonLabel,
  IonButton,
  IonIcon,
  IonButtons,
  IonCard,
  IonGrid,
  IonRow,
  IonCol,
  IonInput,
  IonCheckbox,
  PopoverController
} from "@ionic/angular/standalone";

import { addIcons } from 'ionicons';
import {
  checkbox,
  close
} from 'ionicons/icons';

@Component({
  selector: 'app-pop-add-producto',
  templateUrl: './pop-add-producto.component.html',
  styleUrls: ['./pop-add-producto.component.scss'],
  imports: [
    IonCheckbox,
    IonInput,
    IonCol,
    IonRow,
    IonGrid,
    IonCard,
    IonButtons,
    IonIcon,
    IonButton,
    IonLabel,
    IonItem,
    FormsModule
    ]
})
export class PopAddProductoComponent {

  private popoverController = inject(PopoverController);

  producto: Producto = {
      nombre: '',
      descripcion: '',
      costo_compra: 0,
      check_iva: false,
      costo_sin_iva: 0,
      pvp: 0,
      codigo: 'xxxx',
      stock: 1,
      fecha_caducidad: new Date(),
      stock_minimo: 0,
  }

  constructor() {
    addIcons({checkbox,close})
  }

  add() {
      this.popoverController.dismiss(this.producto);
  }

  close() {
    this.popoverController.dismiss();
  }

}
