import { Component, inject, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonHeader, IonToolbar, IonTitle, IonContent, IonButton, IonIcon, IonButtons,ModalController, IonChip, IonLabel } from "@ionic/angular/standalone";
import { MatTableModule } from '@angular/material/table';
import { MatDividerModule } from '@angular/material/divider';
import { Venta } from 'src/app/models/models';

import { addIcons } from 'ionicons';
import {
  close,printOutline
} from 'ionicons/icons';
import { EpsonPrinterService } from 'src/app/core/printer/epson-printer.service';
import { PAPER_WIDTH_CHARS } from 'src/app/core/printer/epson.config';
import { InteraccionService } from '../../../services/interaccion.service';

@Component({
    selector: 'app-modalventa',
    templateUrl: './modalventa.component.html',
    styleUrls: ['./modalventa.component.scss'],
imports: [IonLabel, IonChip, CommonModule, IonHeader,IonButtons, IonToolbar, IonTitle, IonContent, IonButton, IonIcon, MatTableModule, MatDividerModule]
})
export class ModalventaComponent {

  @Input() venta!: Venta;

  displayedColumns: string[] = ['codigo','nombre', 'cantidad', 'precio','IVA' ,'subtotal'];

  private modalCtrl = inject(ModalController);
  private printer   = inject(EpsonPrinterService);
  private interaccionService = inject(InteraccionService);

  isPrinting = false;

  constructor() { addIcons({close,printOutline}) }


  closeModal() {
      return this.modalCtrl.dismiss(null, 'cancel');
  }

   /** Mapea tu Venta → formato neutro del servicio y reimprime. */
   async reimprimir() {
    if (!this.venta) return;
    this.isPrinting = true;
    try {
      // Si estás en 58/56 mm deja 32; en 80 mm usa 42
      this.printer.setSettings({ widthChars: PAPER_WIDTH_CHARS.W58 }); // o W80

      const sale = {
        numero: this.venta.numero,
        fecha: this.venta.fecha ?? new Date(),
        cliente: {
          nombre: this.venta.cliente?.nombre,
          ruc: this.venta.cliente?.ruc,
          telefono: this.venta.cliente?.telefono,
        },
        items: (this.venta.productos || []).map(p => ({
          cantidad: p.cantidad,
          totalLinea: p.precio,
          producto: { nombre: p.producto?.nombre, pvp: p.producto?.pvp, check_iva: p.producto?.check_iva }
        })),
        subtotalSinIVA: this.venta.subtotal_sin_iva,
        iva: this.venta.iva,
        total: this.venta.total,
        // si quieres mostrar pago/vuelto guardados con la venta:
        pago: (this as any).pago ?? undefined,
        vuelto: (this as any).vuelto ?? undefined,
      };

      await this.printer.printSale(sale);
      // feedback simple (si tienes un servicio de toasts úsalo aquí)
      this.interaccionService.showToast('Ticket impreso');
    } catch (e:any) {
      this.interaccionService.showToast('No se pudo reimprimir el ticket');
      console.error('No se pudo reimprimir', e);
    } finally {
      this.isPrinting = false;
    }
  }


}
