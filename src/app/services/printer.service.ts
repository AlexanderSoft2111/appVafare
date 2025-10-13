// src/app/services/printer.service.ts
import { Injectable } from '@angular/core';

// El SDK expone window.epson
declare global {
  interface Window { epson?: any; }
}

// ===== Interfaces mínimas de datos =====
export interface VentaProducto {
  cantidad: number;
  precio?: number;  // total línea (si ya viene calculado)
  producto?: { nombre?: string; pvp?: number; check_iva?: boolean };
  descLineaPct?: number;
  descLineaMonto?: number;
}
export interface VentaData {
  numero?: string | number;
  fecha?: string | Date;
  cliente?: { nombre?: string; ruc?: string; telefono?: string };
  productos: VentaProducto[];
  subtotal_sin_iva?: number;
  iva?: number;
  total?: number;
  pago?: number;
  vuelto?: number;
  descGlobalPct?: number;
  descGlobalMonto?: number;
}

export interface PrinterConfig {
  ip: string;     // IP fija de la impresora
  port?: number;  // DEV: 8008 por defecto
  header?: { title?: string; ruc?: string; address?: string };
  footer?: { thanks?: string };
  widthChars?: number; // 80mm≈42, 58mm≈32
  deviceId?: string;   // por defecto 'local_printer'
}

@Injectable({ providedIn: 'root' })
export class PrinterService {
  // ===== Config por defecto (DEV) =====
  private cfg: PrinterConfig = {
    ip: '192.168.1.60',
    port: 8008,                  // DEV: HTTP
    header: { title: 'MI TIENDA', ruc: 'RUC 1234567890', address: 'Av España' },
    footer: { thanks: '¡Gracias por su compra!' },
    widthChars: 42,
    deviceId: 'local_printer'
  };

  private sdkLoaded = false;

  /** Permite sobreescribir config (ej. desde environment) */
  setConfig(partial: Partial<PrinterConfig>) {
    this.cfg = { ...this.cfg, ...partial };
  }

  /** Carga el SDK solo una vez */
  private async ensureSdk(): Promise<void> {
    if (this.sdkLoaded && window.epson) return;
    await this.loadScript('/assets/epson/epos-2.27.0.js');
    if (!window.epson) throw new Error('No se cargó ePOS SDK de Epson');
    this.sdkLoaded = true;
  }

  private loadScript(src: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src; s.async = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('Error cargando ' + src));
      document.head.appendChild(s);
    });
  }

  // ===== Helpers de conexión DEV (HTTP:8008 / crypto:false) =====
  private getConnDev() {
    const ip = String(this.cfg.ip ?? '').trim();
    const port = this.cfg.port ?? 8008;
    const crypto = false;
    return { ip, port, crypto };
  }

  // ===== Helpers de formato =====
  private r2(n: number) { return Math.round((n + Number.EPSILON) * 100) / 100; }
  private money(n: number) { return this.r2(n).toFixed(2); }
  private padR(txt: string, len: number) {
    return (txt.length >= len) ? txt.slice(0, len) : txt + ' '.repeat(len - txt.length);
  }
  private padL(txt: string, len: number) {
    return (txt.length >= len) ? txt.slice(0, len) : ' '.repeat(len - txt.length) + txt;
  }
  private line() { return '-'.repeat(this.cfg.widthChars!) + '\n'; }

  // ====== API pública ======

  /**
   * Imprime un ticket de venta (DEV: ePOS-Device HTTP:8008).
   * Espera VentaData con productos y totales ya calculados.
   */
  async printVenta(venta: VentaData): Promise<void> {
    await this.ensureSdk();

    const ePosDev = new window.epson.ePOSDevice();
    const { ip, port, crypto } = this.getConnDev();

    // 1) Conectar
    const connectRes: string = await new Promise((resolve) => {
      ePosDev.connect(ip, port, (r: string) => resolve(r));
    });
    if (connectRes !== 'OK') {
      try { ePosDev.disconnect(); } catch {}
      throw new Error('No conecta a impresora ePOS: ' + connectRes);
    }

    // 2) Crear printer (buffer:false para evitar SchemaError en algunos firmwares)
    const deviceId = this.cfg.deviceId || 'local_printer';
    const printer: any = await new Promise((resolve, reject) => {
      ePosDev.createDevice(
        deviceId,
        ePosDev.DEVICE_TYPE_PRINTER,
        { crypto, buffer: false },
        (dev: any, code: any) => dev ? resolve(dev) : reject(new Error('createDevice error: ' + code))
      );
    });

    try {
      // 3) Ticket (usar solo ASCII; establecer idioma explícito)
      const W = this.cfg.widthChars || 42;
      const hdr = this.cfg.header || {};
      const ftr = this.cfg.footer || {};
      const fecha = new Date(venta.fecha || new Date()).toLocaleString();

      printer.addTextLang('en');
      printer.addTextAlign(printer.ALIGN_CENTER);
      if (hdr.title)   printer.addText(String(hdr.title) + '\n');
      if (hdr.ruc)     printer.addText(String(hdr.ruc) + '\n');
      if (hdr.address) printer.addText(String(hdr.address) + '\n');
      printer.addText(this.line());

      printer.addTextAlign(printer.ALIGN_LEFT);
      printer.addText(`N#: ${venta.numero ?? ''}   Fecha: ${fecha}\n`);
      if (venta.cliente?.nombre)   printer.addText(`Cliente: ${venta.cliente.nombre}\n`);
      if (venta.cliente?.ruc)      printer.addText(`RUC: ${venta.cliente.ruc}\n`);
      if (venta.cliente?.telefono) printer.addText(`Tel: ${venta.cliente.telefono}\n`);
      printer.addText(this.line());

      // Encabezados (ajusta anchos si quieres)
      printer.addText(
        `${this.padR('Producto', 22)} ${this.padL('Cant', 4)} ${this.padL('P.U.', 7)} ${this.padL('Total', 7)}\n`
      );
      printer.addText(this.line());

      // Detalle de productos
      (venta.productos || []).forEach((it: VentaProducto) => {
        const nombre = String(it.producto?.nombre ?? '');
        const qty    = Number(it.cantidad ?? 0);
        const pu     = Number(it.producto?.pvp ?? 0);
        const tot    = Number(it.precio ?? (pu * qty));

        const nom = this.padR(nombre, 22);
        printer.addText(
          `${nom} ${this.padL(String(qty), 4)} ${this.padL(this.money(pu), 7)} ${this.padL(this.money(tot), 7)}\n`
        );

        if (it.descLineaPct || it.descLineaMonto) {
          const d = it.descLineaPct ? `${it.descLineaPct}%` : `$${this.money(Number(it.descLineaMonto))}`;
          printer.addText(`  * Desc: ${d}\n`);
        }
      });

      printer.addText(this.line());

      // Totales
      const subSin = Number(venta.subtotal_sin_iva ?? 0);
      const iva    = Number(venta.iva ?? 0);
      const total  = Number(venta.total ?? (subSin + iva));

      if (venta.descGlobalPct || venta.descGlobalMonto) {
        let txt = 'Desc. global: ';
        if (venta.descGlobalPct)   txt += `-${venta.descGlobalPct}% `;
        if (venta.descGlobalMonto) txt += `-$${this.money(Number(venta.descGlobalMonto))}`;
        printer.addText(`${this.padL(txt, W - 8)}\n`);
      }

      printer.addText(`${this.padL('SUBTOTAL', W - 8)} ${this.padL(this.money(subSin), 8)}\n`);
      printer.addText(`${this.padL('IVA',      W - 8)} ${this.padL(this.money(iva),    8)}\n`);
      printer.addText(`${this.padL('TOTAL',    W - 8)} ${this.padL(this.money(total),  8)}\n`);

      if (venta.pago !== undefined) {
        printer.addText(`${this.padL('PAGO',   W - 8)} ${this.padL(this.money(Number(venta.pago)), 8)}\n`);
      }
      if (venta.vuelto !== undefined) {
        printer.addText(`${this.padL('VUELTO', W - 8)} ${this.padL(this.money(Number(venta.vuelto)), 8)}\n`);
      }

      printer.addFeedLine(1);
      printer.addTextAlign(printer.ALIGN_CENTER);
      if (ftr.thanks) printer.addText(String(ftr.thanks) + '\n');
      printer.addFeedLine(1);

      // Corte (si el corte te causa SchemaError en tu firmware, comenta esta línea y prueba)
      printer.addCut(printer.CUT_FEED);

      // 4) Enviar (sin objeto en send)
      await new Promise<void>((resolve, reject) => {
        // handler único
        printer.onreceive = (res: any) => (res && res.success === true) ? resolve() : reject(res);
        try { printer.send(); } catch (e) { reject(e); }
      });
    } finally {
      // 5) Cerrar
      try { ePosDev.deleteDevice(printer); } catch {}
      try { ePosDev.disconnect(); } catch {}
    }
  }

  /**
   * Chequeo rápido de disponibilidad (DEV).
   */
  async checkPrinterReady(): Promise<{ ok:boolean; step:'connect'|'device'|'status'; details?:any; }> {
    if (!window.epson) {
      return { ok:false, step:'connect', details:'SDK ePOS no cargado' };
    }

    const { ip, port, crypto } = this.getConnDev();
    const dev = new window.epson.ePOSDevice();

    // connect
    const connectRes: string = await new Promise(res => dev.connect(ip, port, (r: string) => res(r)));
    if (connectRes !== 'OK') {
      try { dev.disconnect(); } catch {}
      return { ok:false, step:'connect', details: connectRes };
    }

    // createDevice
    let printer: any;
    try {
      const deviceId = this.cfg.deviceId || 'local_printer';
      printer = await new Promise((resolve, reject) => {
        dev.createDevice(
          deviceId,
          dev.DEVICE_TYPE_PRINTER,
          { crypto, buffer:false },
          (p:any, code:any) => p ? resolve(p) : reject(new Error('createDevice error: ' + code))
        );
      });
    } catch (e) {
      try { dev.disconnect(); } catch {}
      return { ok:false, step:'device', details: String(e) };
    }

    // status
    try {
      if (typeof printer.getStatus === 'function') {
        const st = await new Promise<any>((resolve, reject) => {
          try { printer.getStatus((s:any)=>resolve(s)); } catch (err) { reject(err); }
        });
        const ready = !!st.online && !st.coverOpen && (st.paper === printer.PAPER_OK || st.paper === 0);
        try { dev.deleteDevice(printer); } catch {}
        try { dev.disconnect(); } catch {}
        return { ok: ready, step:'status', details: st };
      }

      printer.addText('');
      // Nota: en DEV, algunos firmwares no devuelven flags completos; solo usamos success
      const ok = await new Promise<boolean>((resolve) => {
        try {
          printer.onreceive = (r:any) => resolve(!!r?.success);
          printer.send();
        } catch { resolve(false); }
      });

      try { dev.deleteDevice(printer); } catch {}
      try { dev.disconnect(); } catch {}
      return { ok, step:'status', details: { success: ok } };

    } catch (e) {
      try { dev.deleteDevice(printer); } catch {}
      try { dev.disconnect(); } catch {}
      return { ok:false, step:'status', details:String(e) };
    }
  }
}
