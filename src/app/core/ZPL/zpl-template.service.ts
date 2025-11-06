import { Injectable } from '@angular/core';

export interface EtiquetaData {
  nombre: string;
  descripcion: string;
  pvp: number;
  codigo: string; // EAN13 (12 dígitos sin check) o CODE128 (SKU)
  anchoDots?: number; // ancho etiqueta en dots (p.ej., 400)
  altoDots?: number;  // alto etiqueta en dots (p.ej., 240)
  formato?: 'CODE128' | 'EAN13';
}

@Injectable({ providedIn: 'root' })
export class ZplTemplateService {

  build(data: EtiquetaData): string {
    const {
      nombre, descripcion, pvp, codigo,
      anchoDots = 400, altoDots = 240,
      formato = 'CODE128'
    } = data;

    // Truncs simples para no desbordar
    const n = this.trunc(nombre, 38);
    const d = this.trunc(descripcion, 42);
    const precio = this.formatPrice(pvp);

    const barcodeCmd = (formato === 'EAN13')
      ? `^BEN` // EAN-13
      : `^BCN`; // Code128

    // Para EAN-13: envía 12 dígitos, la Zebra calcula el dígito 13
    const codeToSend = (formato === 'EAN13')
      ? this.onlyDigits(codigo).padStart(12, '0').slice(0, 12)
      : (codigo ?? '').trim();

    return `
^XA
^PW${anchoDots}
^LL${altoDots}

^CF0,28
^FO20,20^FB${anchoDots - 40},2,0,L,0^FD${n}^FS

^CF0,20
^FO20,70^FB${anchoDots - 40},2,0,L,0^FD${d}^FS

^CF0,32
^FO20,110^FD PVP: $${precio} ^FS

^BY2,2,70
^FO20,150${barcodeCmd},70,Y,N,N
^FD${codeToSend}^FS

^XZ`.trim();
  }

  private trunc(t: string, max: number){ return (t || '').length > max ? t.slice(0, max-1) + '…' : (t || ''); }
  private formatPrice(n: number){ return (n ?? 0).toFixed(2); }
  private onlyDigits(s: string){ return (s || '').replace(/\D/g, ''); }
}
