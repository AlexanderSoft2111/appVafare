import { Component, inject, Input, OnInit } from '@angular/core';
import { Producto, Paths } from '../../../models/models';
import { FirestoreService } from '../../../services/firestore.service';
import { InteraccionService } from '../../../services/interaccion.service';

import {
  IonGrid,
  IonRow,
  IonButton,
  IonItem,
  IonLabel,
  IonCol,
  IonCard,
  IonInput,
  PopoverController
} from "@ionic/angular/standalone";
import { FormsModule } from '@angular/forms';


@Component({
  selector: 'app-popsetstock',
  templateUrl: './popsetstock.component.html',
  styleUrls: ['./popsetstock.component.scss'],
  imports: [IonInput,
    IonGrid,
    IonRow,
    IonButton,
    IonItem,
    IonLabel,
    IonCol,
    IonCard,
    FormsModule
  ]
})
export class PopsetstockComponent implements OnInit {

  private firestoreService = inject(FirestoreService);
  private interaccionService = inject(InteraccionService);
  private popoverController = inject(PopoverController);

  @Input() producto!: Producto;
  stock = 0;
  isSaving = false;

  constructor() { }

  ngOnInit() {
    this.stock = this.producto.stock;
  }

  async saveStock() {
    if (this.isSaving) return;
    this.isSaving = true;

    const updateDoc: Partial<Producto> = {
      stock: this.stock
    }

    // Lanza la actualización optimista (aplica local inmediato; la Promise espera al backend)
    const { docPath, write } = await this.firestoreService.updateDocumentID<Producto>(updateDoc, Paths.productos, this.producto.id ?? '');

    // UX inmediata (funciona sin internet)
    const offline = this.firestoreService.isOffline();
    this.interaccionService.showToast(
      offline ? 'Actualizado (pendiente de sincronizar)' : 'Actualizado con éxito'
    );

    // Cierra el popup pasando el objeto actualizado al caller
    this.popoverController.dismiss({
      Producto: { ...this.producto, ...updateDoc },
    });

    // Manejo de error real al sincronizar con backend
    write.catch(err => {
      this.interaccionService.showToast('Error al sincronizar: ' + (err?.message ?? 'desconocido'));
    }).finally(() => {
      this.isSaving = false;
    });
  }

  cancelar() {
    this.popoverController.dismiss();
  }

}
