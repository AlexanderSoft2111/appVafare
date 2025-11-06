// Minimalista y robusto para ZPL desde navegador
declare global { interface Window { BrowserPrint?: any } }

import { Injectable } from '@angular/core';
import { ZebraConnOptions } from './zebra-browserprint.service';

@Injectable({ providedIn: 'root' })
export class BrowserPrintService {
  private device: any | null = null;

  /** Inicializa y toma la impresora por defecto (si hay) */


  
    async init(opts: ZebraConnOptions = {preferName : 'ZDesigner ZD888-203dpi ZPL', fallbackToDefault: true}): Promise<void> {
      window.BrowserPrint = await this.waitForBP();
  
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

  /** Lista impresoras locales detectadas por Browser Print */
  async getPrinters(): Promise<any[]> {
    return new Promise((resolve, reject) => {
      if (!window.BrowserPrint) return reject('BrowserPrint no disponible');
      window.BrowserPrint.getLocalDevices((devs: any[]) => {
        resolve(devs.filter(d => d.deviceType === 'printer'));
      }, (err: any) => reject(err), 'printer');
    });
  }

  /** Selecciona impresora por nombre (contiene) */
  async selectPrinterByName(partialName: string = 'ZDesigner ZD888-203dpi ZPL') {
    const printers = await this.getPrinters();
    const found = printers.find(p => (p.name || '').toLowerCase().includes(partialName.toLowerCase()));
    console.log('Impresora seleccionada:', found);
    if (!found) throw new Error(`No se encontró una impresora con: ${partialName}`);
    this.device = found;
  }

  /** Envía texto RAW (ZPL) a la impresora seleccionada */
  async printRaw(zpl: string) {
    if (!this.device) throw new Error('Impresora no inicializada / no seleccionada');
    return new Promise<void>((resolve, reject) => {
      this.device.send(zpl, () => resolve(), (e: any) => reject(e));
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
    return new Promise(res => window.BrowserPrint.getDefaultDevice('printer', (d:any)=>res(d??null), ()=>res(null)));
  }
  private getFirstLocal(): Promise<any|null> {
    return new Promise(res => window.BrowserPrint.getLocalDevices((ls:any[])=>{
      const ps = (ls||[]).filter(d=>d?.deviceType==='printer');
      res(ps[0]??null);
    }, ()=>res(null), 'printer'));
  }
  private pickByName(name: string): Promise<any|null> {
    return new Promise(res => window.BrowserPrint.getLocalDevices((ls:any[])=>{
      const ps = (ls||[]).filter(d=>d?.deviceType==='printer');
      const m = ps.find(p=>(p?.name??'').toLowerCase()===name.toLowerCase());
      res(m??null);
    }, ()=>res(null), 'printer'));
  }
}
