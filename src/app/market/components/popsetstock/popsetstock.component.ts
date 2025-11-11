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
  @Input() vendedor = false;

  stock = 0;
  cantidadAgregar = 1;
  isSaving = false;

  constructor() { }

  ngOnInit() {
    this.stock = this.producto.stock;
  }

/*   async saveStock() {
      if (this.isSaving) return;
      this.isSaving = true;
      let nuevoStock = this.stock;

      if (this.vendedor) {
        if (!Number.isFinite(this.cantidadAgregar) || this.cantidadAgregar! <= 0) {
          this.interaccionService.showToast('Ingresa una cantidad válida (>0).'); return;
        }
        nuevoStock = (this.producto.stock || 0) + this.cantidadAgregar!;
      } else {
        if (!Number.isFinite(this.stock) || this.stock! < 0) {
          this.interaccionService.showToast('Stock inválido.'); return;
        }
      }


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
  } */

      async saveStock() {
  if (this.isSaving) return;
  this.isSaving = true;

  try {
    // 1) Calcula el nuevo stock según el rol
    let nuevoStock: number;

    if (this.vendedor) {
      // Coerce a número por si viene como string desde ion-input
      const add = Number(this.cantidadAgregar);
      if (!Number.isFinite(add) || add <= 0) {
        this.interaccionService.showToast('Ingresa una cantidad válida mayor a 0.');
        return;
      }
      const base = Number(this.producto.stock || 0);
      nuevoStock = base + add;
    } else {
      // Admin: edita el stock absoluto
      const abs = Number(this.stock);
      if (!Number.isFinite(abs) || abs < 0) {
        this.interaccionService.showToast('Stock inválido.');
        return;
      }
      nuevoStock = abs;
    }

    // 2) Arma el update
    const updateDoc: Partial<Producto> = { stock: nuevoStock };

    // 3) Optimista: backend + cache local (offline-first)
    const { write } = await this.firestoreService
      .updateDocumentID<Producto>(updateDoc, Paths.productos, this.producto.id ?? '');

    await this.invSync.upsertLocal({ ...this.producto, ...updateDoc });

    // 4) UX
    this.interaccionService.showToast(
      this.firestoreService.isOffline()
        ? 'Actualizado (pendiente de sincronizar)'
        : 'Actualizado con éxito'
    );
    this.popoverController.dismiss();

    // 5) Error real del backend
    await write; // si falla, cae al catch externo
  } catch (err: any) {
    this.interaccionService.showToast('Error al sincronizar: ' + (err?.message ?? 'desconocido'));
  } finally {
    this.isSaving = false;
  }
}

  cancelar() {
    this.popoverController.dismiss();
  }

}
