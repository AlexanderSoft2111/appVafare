import { Injectable, Inject, Optional } from '@angular/core';
import { HttpClient } from '@angular/common/http';

/** Config opcional para centralizar URL del backend y IP/puerto default de la impresora */
export interface PrintConfig {
  apiUrl?: string;          // p. ej. '/api/print/label'
  defaultHost?: string;     // IP impresora (si tu backend pide host)
  defaultPort?: number;     // 9100 por defecto
  prefer?: 'backend' | 'browserPrint';
  allowBrowserPrintFallback?: boolean;
}

export interface PrintOptions {
  copies?: number;
  host?: string;
  port?: number;
  prefer?: 'backend' | 'browserPrint';
  allowFallback?: boolean;
}

@Injectable({ providedIn: 'root' })
export class PrintEtiquetasService {
  /** Ajusta estos defaults a tu proyecto (o inyecta vía providers cuando registres el servicio). */
  private cfg: Required<PrintConfig> = {
    apiUrl: '/api/print/label',
    defaultHost: '192.168.1.241',
    defaultPort: 9100,
    prefer: 'backend',
    allowBrowserPrintFallback: true,
  };

  constructor(
    private http: HttpClient,
    @Optional() @Inject('PRINT_CONFIG') userCfg?: PrintConfig
  ) {
    if (userCfg) this.cfg = { ...this.cfg, ...userCfg };
  }

  // ------------------ Helpers ZPL ------------------
  mmToDots(mm: number, dpi = 203): number {
    return Math.round(mm * (dpi / 25.4));
  }

  /** Plantilla ZPL simple: 50×30 mm por defecto; soporta CODE128/EAN13/QR */
  buildZplLabel(opts: {
    widthMm?: number; heightMm?: number; dpi?: number;
    product: string; sku: string; price?: number;
    barcodeType: 'CODE128'|'EAN13'|'QR';
    barcodeValue?: string; qrUrl?: string;
    darkness?: number;  // ^MD (0–30 aprox.)
    speed?: number;     // ^PR (2–6 aprox.)
  }): string {
    const dpi = opts.dpi ?? 203;
    const widthMm  = opts.widthMm  ?? 50;
    const heightMm = opts.heightMm ?? 30;

    const PW = this.mmToDots(widthMm,  dpi);
    const LL = this.mmToDots(heightMm, dpi);

    const md = Number.isFinite(opts.darkness) ? `^MD${opts.darkness}\n` : '';
    const pr = Number.isFinite(opts.speed)    ? `^PR${opts.speed}\n`     : '';

    const product = (opts.product || '').slice(0, 28);
    const sku     = (opts.sku || '').slice(0, 24);
    const priceS  = (opts.price != null) ? `$${opts.price.toFixed(2)}` : '';

    const text = `
^FO20,20^A0N,28,28^FD${product}^FS
^FO20,55^A0N,24,24^FDSKU: ${sku}${priceS ? '  •  ' + priceS : ''}^FS`;

    let symbol = '';
    if (opts.barcodeType === 'QR') {
      const payload = opts.qrUrl || '';
      symbol = `^FO260,20^BQN,2,4^FDQA,${payload}^FS`;
    } else if (opts.barcodeType === 'EAN13') {
      const data = (opts.barcodeValue || '').replace(/\D/g, '').padStart(12, '0'); // Zebra calcula dígito
      symbol = `^FO20,95^BEN,80,Y,N
^FD${data}^FS`;
    } else {
      const data = (opts.barcodeValue || '');
      symbol = `^FO20,95^BCN,80,Y,N,N
^FD${data}^FS`;
    }

    return `^XA
^CF0,20
^PW${PW}
^LL${LL}
^LH0,0
${md}${pr}${text}
${symbol}
^XZ`;
  }

  repeatJob(zpl: string, copies = 1): string {
    const n = Math.max(1, Math.floor(copies || 1));
    return new Array(n).fill(zpl).join('\n');
  }

  // ------------------ Impresión ------------------
  /** Vía backend → RAW 9100 (recomendado). Tu backend reenvía el ZPL a la impresora. */
  private printViaBackend(zpl: string, copies = 1, host?: string, port?: number) {
    const body: any = { zpl, copies };
    if (host) body.host = host;
    if (port) body.port = port;
    return this.http.post(this.cfg.apiUrl, body).toPromise();
  }

  /** Vía BrowserPrint (opcional, si lo tienes instalado en el PC). */
  private printViaBrowserPrint(zpl: string): Promise<void> {
    const w = window as any;
    if (!w.BrowserPrint) return Promise.reject('BrowserPrint no disponible en este PC');
    return new Promise<void>((resolve, reject) => {
      w.BrowserPrint.getDefaultDevice('printer', (dev: any) => {
        if (!dev) return reject('No hay impresora por defecto en BrowserPrint');
        dev.send(zpl, () => resolve(), (e: any) => reject(e));
      }, (err: any) => reject(err));
    });
  }

  /** API principal: envía ZPL según preferencias (backend o BrowserPrint) con fallback opcional. */
  async printZpl(zpl: string, opts: PrintOptions = {}): Promise<void> {
    const copies = opts.copies ?? 1;
    const job = this.repeatJob(zpl, copies);

    const prefer = opts.prefer ?? this.cfg.prefer;
    const allowFallback = opts.allowFallback ?? this.cfg.allowBrowserPrintFallback;
    const host = opts.host ?? this.cfg.defaultHost;
    const port = opts.port ?? this.cfg.defaultPort;

    if (prefer === 'backend') {
      try {
        await this.printViaBackend(job, 1, host, port);
        return;
      } catch (e) {
        if (!allowFallback) throw e;
        await this.printViaBrowserPrint(job);
        return;
      }
    } else {
      try {
        await this.printViaBrowserPrint(job);
        return;
      } catch (e) {
        if (!allowFallback) throw e;
        await this.printViaBackend(job, 1, host, port);
        return;
      }
    }
  }

  /** Prueba rápida: “Prueba ZPL OK” */
  async testPrint(): Promise<void> {
    const test = '^XA^FO10,10^ADN,18,10^FDPrueba ZPL OK^FS^XZ';
    await this.printZpl(test);
  }
}
