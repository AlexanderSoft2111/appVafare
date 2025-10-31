import { DecimalPipe } from '@angular/common';
import { Component, Input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgxBarcode6Module } from 'ngx-barcode6';

// Angular Material
import { MatFormFieldModule } from '@angular/material/form-field';
import {MatSelectModule} from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';

@Component({
  selector: 'preview-etiqueta',
  imports: [FormsModule, NgxBarcode6Module,DecimalPipe,MatFormFieldModule, MatSelectModule,MatInputModule],
  templateUrl: './preview-etiqueta.component.html',
  styleUrls: ['./preview-etiqueta.component.scss']
})
export class PreviewEtiquetaComponent {

  /** ====== Inputs que vienen desde generar-codigo ====== */
  @Input() nombreFull: string = 'Galletas Vainilla Cuencanita 1 lb';
  @Input() descripcionFull: string = 'Galletas artesanales de vainilla';
  @Input() pvp: number | null = 1.5;
  @Input() codigo: string = '786800041750'; // Para EAN13: 12 dígitos (la librería calcula el 13)

  /** Tamaño de la etiqueta en mm (ej.: 50x30) */
  @Input() sizeWmm: number = 50;
  @Input() sizeHmm: number = 30;

  /** Barcode */
  @Input() format: 'EAN13' | 'CODE128' = 'CODE128';
  @Input() barWidthPx: number = 1.6;  // grosor de barra
  @Input() barHeightPx: number = 80;  // alto del símbolo

  // --- Derivados para UI (truncados elegantes) ---
  get nombreShort() {
    return this.trunc(this.nombreFull, 34);
  }
  get descripcionShort() {
    return this.trunc(this.descripcionFull, 40);
  }

  // Valor para el barcode según formato
  get barcodeValue(): string {
    if (this.format === 'EAN13') {
      // EAN-13: pasar 12 dígitos; el dígito de control lo calcula ngx-barcode6
      const digits = String(this.codigo ?? '').replace(/\D/g, '');
      return digits.padStart(12, '0').slice(0, 12);
    }
    return String(this.codigo ?? '').trim(); // CODE128 permite alfanumérico
  }

  private trunc(txt: string, max: number) {
    if (!txt) return '';
    return txt.length > max ? txt.slice(0, max - 1) + '…' : txt;
  }
}
