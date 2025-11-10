import { Component, inject, Input, OnInit } from '@angular/core';
import { Producto, Paths } from '../../../models/models';
import { FirestoreService } from '../../../services/firestore.service';
import { InteraccionService } from '../../../services/interaccion.service';
import { InventarioSyncService } from '../../../services/inventario-sync.service';

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
  private invSync = inject(InventarioSyncService);

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

    // 2) UI inmediata (cache + stream)
    await this.invSync.upsertLocal({ ...this.producto, ...updateDoc });

    // 3) UX
    this.interaccionService.showToast('Actualizado (se sincronizará al tener internet)');
    this.popoverController.dismiss();

    // 4) Errores reales
    write
      .catch(err => this.interaccionService.showToast('Error al sincronizar: ' + (err?.message ?? 'desconocido')))
      .finally(() => this.isSaving = false);
  }

  cancelar() {
    this.popoverController.dismiss();
  }

}
