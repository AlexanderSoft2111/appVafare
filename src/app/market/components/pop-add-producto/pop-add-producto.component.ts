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
import { InteraccionService } from '../../../services/interaccion.service';
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
export class PopAddProductoComponent implements OnInit {

  private popoverController = inject(PopoverController);
  private InteraccionService = inject(InteraccionService);

  producto: Producto = {
      nombre: '',
      descripcion: '',
      costo_compra: 0,
      check_iva: false,
      costo_sin_iva: 0,
      pvp: 0,
      codigo: 'xxxx',
      stock: 1,
      fecha_caducidad: '',
      stock_minimo: 0,
  }

  constructor() {
    addIcons({checkbox,close});
  }
  ngOnInit(): void {
    this.setFocusNewProducto();
  }

    setFocusNewProducto() {
    setTimeout(() => {
      const inputs = document.getElementsByClassName("nombre") as any;
      if (inputs.length) {
        inputs[inputs.length - 1].setFocus();
      }
    }, 300);
  }


  add() {
    if (this.producto.nombre.trim().length === 0) {
      this.InteraccionService.showToast('El nombre del producto es obligatorio',1000);
      return;
    }
    if (this.producto.pvp <= 0) {
      this.InteraccionService.showToast('El precio del producto debe ser mayor a cero',1000);
      return;
    }
    this.popoverController.dismiss(this.producto);
  }

  close() {
    this.popoverController.dismiss();
  }

}
