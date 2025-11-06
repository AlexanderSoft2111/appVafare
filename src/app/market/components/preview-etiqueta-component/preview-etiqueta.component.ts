import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgxBarcode6Module } from 'ngx-barcode6';

export type BarcodeKind = 'CODE128' | 'EAN13' | 'QR';

export interface EtiquetaConfig {
  widthMm: number;    // ancho etiqueta en mm
  heightMm: number;   // alto etiqueta en mm
  tipoCodigo: BarcodeKind;
  cantidad?: number;
  qrUrl?: string;
}

export interface ProductoPreview {
  codigo: string;       // valor a codificar (o URL si QR)
  nombre: string;       // arriba izquierda (negrita)
  descripcion: string;  // debajo del nombre (pequeño)
  pvp?: number;         // precio grande a la derecha
}
@Component({
  selector: 'app-preview-etiqueta',
  standalone: true,
  imports: [CommonModule, NgxBarcode6Module],
  templateUrl: './preview-etiqueta.component.html',
  styleUrls: ['./preview-etiqueta.component.scss']
})
export class PreviewEtiquetaComponent {
  @Input() config: EtiquetaConfig = { widthMm: 60, heightMm: 40, tipoCodigo: 'CODE128' };
  @Input() producto: ProductoPreview = { codigo: '', nombre: '', descripcion: '', pvp: undefined };
  /** Zoom visual del preview (no afecta impresión) */
  @Input() scale = 1.12;


  /** padding interno de la etiqueta en mm (ajústalo a gusto) */
  readonly paddingMm = 3;

  get etiquetaStyle() {
    return {
      width: `${this.config.widthMm}mm`,
      height: `${this.config.heightMm}mm`,
      padding: `${this.paddingMm}mm`,
    };
  }

  get showQR() { return this.config.tipoCodigo === 'QR'; }
  get showBar() { return this.config.tipoCodigo === 'CODE128' || this.config.tipoCodigo === 'EAN13'; }

  /** El valor que enviamos al código */
  get barcodeValue(): string {
    if (this.config.tipoCodigo === 'QR') {
      return this.config.qrUrl || this.producto.codigo || '';
    }
    return this.producto.codigo || '';
  }

  /** Formato para ngx-barcode6 */
  get bcFormat() {
    return this.config.tipoCodigo === 'EAN13' ? 'EAN13' : 'CODE128';
  }

  /** Hacemos el código de barras más grande */
  get bcHeightPx(): number {
    // Deja espacio suficiente para textos arriba y dígitos abajo
    const altoDisponibleMm = this.config.heightMm - (this.paddingMm * 2) - 20;
    return Math.max(48, Math.min(70, Math.round(altoDisponibleMm * 2.2)));
  }
  get bcBarWidth(): number { return 2.2; }   // grosor de barras
  get bcFontPx(): number { return 16; }      // tamaño de los dígitos
  get bcTextMargin(): number { return 2; }   // separación dígitos-barras

  get precioTexto(): string {
    return (this.producto.pvp != null) ? `$${this.producto.pvp.toFixed(2)}` : '';
  }
}
