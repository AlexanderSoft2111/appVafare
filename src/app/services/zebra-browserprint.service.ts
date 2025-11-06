// src/app/services/zebra-test.service.ts
import { Injectable } from '@angular/core';

/* declare global {
  interface Window { BrowserPrint: any; }
}
 */
export interface ZebraConnOptions {
  preferName?: string;        // ej. "ZDesigner ZD888-203dpi ZPL"
  fallbackToDefault?: boolean; // intenta default si no encuentra por nombre
}

/**
 * Servicio minimalista para Zebra BrowserPrint.
 * - Requiere el script del SDK en index.html.
 * - Requiere el "BrowserPrint Service" instalado en el PC.
 */


@Injectable({ providedIn: 'root' })
export class ZebraBrowserPrintService {
  private browserPrint: any;
  private device: any | null = null;

  /** 1) Conectar con BrowserPrint y seleccionar impresora */
  async init(opts: ZebraConnOptions = {preferName : 'ZDesigner ZD888-203dpi ZPL', fallbackToDefault: true}): Promise<void> {
    this.browserPrint = await this.waitForBP();

    if (opts.preferName) {
      const byName = await this.pickByName(opts.preferName);
      if (byName) { this.device = byName; return; }
    }

    if (opts.fallbackToDefault !== false) {
      const def = await this.getDefault();
      if (def) { this.device = def; return; }
    }

    const first = await this.getFirstLocal();
    if (first) { this.device = first; return; }

    throw new Error('No se encontró impresora Zebra vía BrowserPrint.');
  }

  /** 2) Estado actual para mostrar en UI */
  status() {
    if (!this.device) return { connected: false };
    const { name, deviceType, uid } = this.device;
    return { connected: true, name, deviceType, uid };
  }

  /** 3) Imprimir texto simple para probar */
  async testPrint() {
    const zpl = '^XA^LH20,20^CF0,30^FO0,0^FDTest OK desde BrowserPrint^FS^XZ';
    await this.ensureAndSend(zpl);
    
  }

  /** 4) Imprimir etiqueta simple (Nombre / Desc / PVP / CODE128) */
  async printSampleLabel(data: { nombre: string; descripcion: string; pvp: number; codigo: string }) {
    const nombre = this.trunc(data.nombre, 30);
    const descr  = this.trunc(data.descripcion, 36);
    const pvpTxt = `PVP: $${(Number(data.pvp) || 0).toFixed(2)}`;
    const code   = String(data.codigo ?? '').trim() || '123456789012';

    // ZPL básico para etiqueta ~50x30mm (ajústalo según tu plantilla real)
    // ^PW ancho, ^LL largo en dots (203dpi ≈ 8 dots por mm). 50mm*8=400, 30mm*8=240
    const zpl = [
      '^XA',
      '^CI28', //codigo internacional UTF-8
      '^PW400', // ancho etiqueta en dots
      '^LL240', // largo etiqueta en dots
      '^LH10,10', // margen
      '^FO0,0^CF0,28^FD', this.esc(nombre), '^FS',
      '^FO0,34^CF0,22^FD', this.esc(descr), '^FS',
      '^FO0,64^CF0,24^FD', this.esc(pvpTxt), '^FS',
      // Código de barras CODE128
      '^BY2,3,70',              // ancho barras, ratio, alto
      '^FO0,100^BCN,70,Y,N,N',  // N = normal; 70 = alto; Y = imprime texto legible
      '^FD', this.esc(code), '^FS',
      '^XZ'
    ].join('');

    await this.ensureAndSend(zpl);
  }

  // ---------- Helpers ----------
  private trunc(t: string, n: number) {
    if (!t) return '';
    return t.length > n ? t.slice(0, n - 1) + '…' : t;
  }
  private esc(t: string) {
    return (t ?? '').replace(/[\\^_~]/g, ' ');
  }
  private async ensureAndSend(zpl: string) {
    if (!this.device) {
      throw new Error('No hay impresora seleccionada. Llama init() primero.');
    }
    if (!this.device.name) {
      throw new Error('La impresora no expone "name". Re-selecciona con init().');
    }
    await new Promise<void>((resolve, reject) => {
      this.device.send(
        zpl,
        () => resolve(),
        (err: any) => reject(new Error(typeof err === 'string' ? err : 'Fallo al enviar a la impresora'))
      );
    });
  }
  private waitForBP(): Promise<any> {
    return new Promise((resolve, reject) => {
      let tries = 0;
      const t = setInterval(() => {
        tries++;
        if (window.BrowserPrint) { clearInterval(t); resolve(window.BrowserPrint); }
        if (tries > 100) { clearInterval(t); reject(new Error('BrowserPrint no está cargado.')); }
      }, 100);
    });
  }
  private getDefault(): Promise<any|null> {
    return new Promise(res => this.browserPrint.getDefaultDevice('printer', (d:any)=>res(d??null), ()=>res(null)));
  }
  private getFirstLocal(): Promise<any|null> {
    return new Promise(res => this.browserPrint.getLocalDevices((ls:any[])=>{
      const ps = (ls||[]).filter(d=>d?.deviceType==='printer');
      res(ps[0]??null);
    }, ()=>res(null), 'printer'));
  }
  private pickByName(name: string): Promise<any|null> {
    return new Promise(res => this.browserPrint.getLocalDevices((ls:any[])=>{
      const ps = (ls||[]).filter(d=>d?.deviceType==='printer');
      const m = ps.find(p=>(p?.name??'').toLowerCase()===name.toLowerCase());
      res(m??null);
    }, ()=>res(null), 'printer'));
  }
}
