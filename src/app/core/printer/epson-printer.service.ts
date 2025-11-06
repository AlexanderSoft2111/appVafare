// src/app/core/printing/epson-printer.service.ts
import { Injectable } from '@angular/core';
import {
  PrintSale,
  PrintLineItem,
  PrinterSettings,
  PrinterStatusResult,
} from './print.types';
import { DEFAULT_PRINTER_SETTINGS, PAPER_WIDTH_CHARS } from './epson.config';

// El SDK expone window.epson (ePOS-Device / ePOS-Print)
declare global {
  interface Window { epson?: any; }
}

/**
 * Servicio para imprimir tickets en impresoras Epson TM vía ePOS-Device (LAN).
 * En DEV (HTTP) usa puerto 8008 y crypto:false.
 * En PROD (HTTPS) usa puerto 8043 y crypto:true (debes confiar el certificado del equipo).
 */
@Injectable({ providedIn: 'root' })
export class EpsonPrinterService {

  /** Configuración activa (sobrescribible con setSettings) */
  private settings: PrinterSettings = { ...DEFAULT_PRINTER_SETTINGS };

  /** Bandera de SDK cargado para no re-cargar el script */
  private sdkLoaded = false;

  /**
   * Permite sobreescribir la configuración activa del servicio
   * (p.ej. al cambiar IP, ancho de papel o pasar a HTTPS).
   */
  setSettings(partial: Partial<PrinterSettings>): void {
    this.settings = { ...this.settings, ...partial };
    // Ajuste automático de puerto según HTTPS si no se especifica
    if (partial.useHttps !== undefined && partial.port === undefined) {
      this.settings.port = partial.useHttps ? 8043 : 8008;
    }
  }

  /**
   * Imprime un ticket de venta (formato neutro) usando ePOS-Device.
   * @throws Error si no conecta, no crea device o la impresora devuelve error en onreceive.
   */
  async printSale(sale: PrintSale): Promise<void> {
    await this.ensureSdkLoaded();

    const { ip, port, crypto } = this.resolveConnection();
    const ePosDev = new window.epson.ePOSDevice();

    // 1) Conexión
    console.log(ip, port, crypto);
    const connectRes: string = await new Promise(res => ePosDev.connect(ip, port, (r: string) => res(r)));
    if (connectRes !== 'OK' && connectRes !== 'SSL_CONNECT_OK') {
      try { ePosDev.disconnect(); } catch {}
      throw new Error('No conecta a ePOS-Device: ' + connectRes);
    }

    // 2) Crear objeto "printer" (buffer:false para evitar SchemaError en firmwares sensibles)
    const deviceId = this.settings.deviceId || 'local_printer';
    const printer: any = await new Promise((resolve, reject) => {
      ePosDev.createDevice(
        deviceId,
        ePosDev.DEVICE_TYPE_PRINTER,
        { crypto, buffer: false },
        (dev: any, code: string) => dev ? resolve(dev) : reject(new Error('createDevice error: ' + code))
      );
    });

    try {
      // 3) Construcción del ticket (solo ASCII; idioma explícito)
      const { W, name, qty, unit, total } = this.getLayout();
      const hdr = this.settings.header || {};
      const ftr = this.settings.footer || {};
      const fechaStr = new Date(sale.fecha || new Date()).toLocaleString();

      // Idioma y encabezado de tienda
      printer.addTextLang('en');
      printer.addTextAlign(printer.ALIGN_CENTER);
      if (hdr.title)   printer.addText(String(hdr.title) + '\n');
      if (hdr.ruc)     printer.addText(String(hdr.ruc) + '\n');
      if (hdr.address) printer.addText(String(hdr.address) + '\n');
      printer.addText(this.lineW(W));

      // Datos de venta / cliente
      printer.addTextAlign(printer.ALIGN_LEFT);
      printer.addText(`N#: ${sale.numero ?? ''}   Fecha: ${fechaStr}\n`);
      if (sale.cliente?.nombre)   printer.addText(`Cliente: ${sale.cliente.nombre}\n`);
      if (sale.cliente?.ruc)      printer.addText(`RUC: ${sale.cliente.ruc}\n`);
      if (sale.cliente?.telefono) printer.addText(`Tel: ${sale.cliente.telefono}\n`);
      printer.addText(this.lineW(W));

      // Encabezado de tabla
      printer.addText(
        `${this.padR('Producto', name)} ${this.padL('Cant', qty)} ${this.padL('P.U.', unit)} ${this.padL('Total', total)}\n`
      );
      printer.addText(this.lineW(W));

      // Detalle de ítems
      (sale.items || []).forEach((it: PrintLineItem) => {
        const nombre = String(it.producto?.nombre ?? '');
        const c     = Number(it.cantidad ?? 0);
        const pvp   = Number(it.producto?.pvp ?? 0);
        const tot   = Number(it.totalLinea ?? (pvp * c));

        printer.addText(
          `${this.padR(nombre, name)} ${this.padL(String(c), qty)} ${this.padL(this.money(pvp), unit)} ${this.padL(this.money(tot), total)}\n`
        );

        // Descuento por línea (opcional)
        if (it.descLineaPct || it.descLineaMonto) {
          const d = it.descLineaPct ? `${it.descLineaPct}%` : `$${this.money(Number(it.descLineaMonto))}`;
          printer.addText(`  * Desc: ${d}\n`);
        }
      });

      printer.addText(this.lineW(W));

      // Totales
      const subSin = Number(sale.subtotalSinIVA ?? 0);
      const iva    = Number(sale.iva ?? 0);
      const tot    = Number(sale.total ?? (subSin + iva));

      // Columna de montos fija (8 chars) y etiqueta ajustada
      const amountCol = 8;
      const labelW = Math.max(8, W - 1 - amountCol);

      if (sale.descGlobalPct || sale.descGlobalMonto) {
        let txt = 'Desc. global: ';
        if (sale.descGlobalPct)   txt += `-${sale.descGlobalPct}% `;
        if (sale.descGlobalMonto) txt += `-$${this.money(Number(sale.descGlobalMonto))}`;
        printer.addText(`${this.padL(txt, labelW)} ${this.padL('', amountCol)}\n`);
      }

      printer.addText(`${this.padL('SUBTOTAL', labelW)} ${this.padL(this.money(subSin), amountCol)}\n`);
      printer.addText(`${this.padL('IVA',      labelW)} ${this.padL(this.money(iva),    amountCol)}\n`);
      printer.addText(`${this.padL('TOTAL',    labelW)} ${this.padL(this.money(tot),    amountCol)}\n`);

      if (sale.pago !== undefined) {
        printer.addText(`${this.padL('PAGO',   labelW)} ${this.padL(this.money(Number(sale.pago)),   amountCol)}\n`);
      }
      if (sale.vuelto !== undefined) {
        printer.addText(`${this.padL('VUELTO', labelW)} ${this.padL(this.money(Number(sale.vuelto)), amountCol)}\n`);
      }

      // Pie
      printer.addFeedLine(1);
      printer.addTextAlign(printer.ALIGN_CENTER);
      if (ftr.thanks) printer.addText(String(ftr.thanks) + '\n');
      printer.addFeedLine(1);

      // Corte (si tu firmware diera problema, comenta esta línea)
      printer.addCut(printer.CUT_FEED);

      // 4) Enviar (el callback llega a onreceive)
      await new Promise<void>((resolve, reject) => {
        printer.onreceive = (res: any) => (res && res.success === true) ? resolve() : reject(res);
        try { printer.send(); } catch (e) { reject(e); }
      });

    } finally {
      // 5) Cerrar conexiones
      try { ePosDev.deleteDevice(printer); } catch {}
      try { ePosDev.disconnect(); } catch {}
    }
  }

  /**
   * Comprueba rápidamente si la impresora está disponible.
   * @returns estado simple: paso (connect/device/status) y detalles.
   */
  async checkStatus(): Promise<PrinterStatusResult> {
    if (!window.epson) return { ok: false, step: 'connect', details: 'SDK ePOS no cargado' };

    const { ip, port, crypto } = this.resolveConnection();
    const dev = new window.epson.ePOSDevice();

    // Conectar
    const connectRes: string = await new Promise(res => dev.connect(ip, port, (r: string) => res(r)));
    if (connectRes !== 'OK' && connectRes !== 'SSL_CONNECT_OK') {
      try { dev.disconnect(); } catch {}
      return { ok: false, step: 'connect', details: connectRes };
    }

    // Crear device
    let printer: any;
    try {
      const deviceId = this.settings.deviceId || 'local_printer';
      printer = await new Promise((resolve, reject) => {
        dev.createDevice(
          deviceId,
          dev.DEVICE_TYPE_PRINTER,
          { crypto, buffer: false },
          (p: any, code: string) => p ? resolve(p) : reject(new Error('createDevice error: ' + code))
        );
      });
    } catch (e) {
      try { dev.disconnect(); } catch {}
      return { ok: false, step: 'device', details: String(e) };
    }

    // Status
    try {
      if (typeof printer.getStatus === 'function') {
        const st = await new Promise<any>((resolve, reject) => {
          try { printer.getStatus((s: any) => resolve(s)); } catch (err) { reject(err); }
        });
        const ready = !!st.online && !st.coverOpen && (st.paper === printer.PAPER_OK || st.paper === 0);
        try { dev.deleteDevice(printer); } catch {}
        try { dev.disconnect(); } catch {}
        return { ok: ready, step: 'status', details: st };
      }

      // Fallback: mandar vacío y mirar success
      printer.addText('');
      const ok = await new Promise<boolean>((resolve) => {
        try { printer.onreceive = (r: any) => resolve(!!r?.success); printer.send(); }
        catch { resolve(false); }
      });

      try { dev.deleteDevice(printer); } catch {}
      try { dev.disconnect(); } catch {}
      return { ok, step: 'status', details: { success: ok } };

    } catch (e) {
      try { dev.deleteDevice(printer); } catch {}
      try { dev.disconnect(); } catch {}
      return { ok: false, step: 'status', details: String(e) };
    }
  }

  // ================== Privados (helpers) ==================

  /** Carga el script del SDK si no está en memoria */
  private async ensureSdkLoaded(): Promise<void> {
    if (this.sdkLoaded && window.epson) return;
    await this.loadScript('/assets/epson/epos-2.27.0.js');
    if (!window.epson) throw new Error('No se cargó window.epson');
    this.sdkLoaded = true;
  }

  /** Inserta un <script> para cargar el SDK */
  private loadScript(src: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src; s.async = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('Error cargando ' + src));
      document.head.appendChild(s);
    });
  }

  /**
   * Resuelve puertos y crypto según `useHttps`.
   * - DEV (HTTP): port 8008, crypto:false
   * - PROD (HTTPS): port 8043, crypto:true
   */
  private resolveConnection() {
    const ip = String(this.settings.ip ?? '').trim();
    const useHttps = !!this.settings.useHttps;
    const port = this.settings.port ?? (useHttps ? 8043 : 8008);
    const crypto = useHttps;
    return { ip, port, crypto };
  }

  // ---------- Formato / Layout ----------
  private money(n: number) { return (Math.round((n + Number.EPSILON) * 100) / 100).toFixed(2); }
  private padR(txt: string, len: number) { return (txt.length >= len) ? txt.slice(0, len) : txt + ' '.repeat(len - txt.length); }
  private padL(txt: string, len: number) { return (txt.length >= len) ? txt.slice(0, len) : ' '.repeat(len - txt.length) + txt; }
  private lineW(W: number) { return '-'.repeat(W) + '\n'; }

  /**
   * Calcula columnas según widthChars.
   * name + qty(4) + unit(7) + total(7) + 3 espacios = W
   */
  private getLayout() {
    const W = this.settings.widthChars ?? PAPER_WIDTH_CHARS.W80; // 42→80mm, 32→58/56mm
    const qty   = 4;
    const unit  = 7;
    const total = 7;
    const gaps  = 3;
    const name  = Math.max(8, W - (qty + unit + total + gaps));
    return { W, name, qty, unit, total };
  }
}
