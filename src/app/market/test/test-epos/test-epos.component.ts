import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonItem, IonLabel } from "@ionic/angular/standalone";

declare global {
  interface Window { epson?: any; }
}

@Component({
  standalone: true,
  selector: 'app-test-epos',
  imports: [CommonModule],
  templateUrl: 'test-epos.component.html'
})
export default class TestEposComponent implements OnDestroy, OnInit {



  // ====== CONFIG DEV ======
  readonly IP = '192.168.1.60';     // <-- AJUSTA si tu IP es otra
  readonly PORT = 8008;             // DEV: HTTP
  readonly CRYPTO = false;          // DEV: crypto:false
  readonly DEVICE_ID = 'local_printer';

  // Ruta del SDK (ajusta si lo pusiste en otra carpeta)
  private readonly SDK_SRC = '/assets/epson/epos-2.27.0.js';

  constructor(){ }

  ngOnInit(): void {

  }



  busy = false;
  log = 'Listo.\n';
  private sdkLoaded = false;

  ePosDev: any | null = null;
  printer: any | null = null;

  // ====== util ======
  private append(msg: string, obj?: any) {
    const line = obj ? `${msg} ${JSON.stringify(obj)}` : msg;
    this.log = `${this.log}${line}\n`;
    console.log('[EPOS]', msg, obj ?? '');
  }

  private async loadSdk(): Promise<void> {
    if (this.sdkLoaded && window.epson) return;
    await new Promise<void>((resolve, reject) => {
      const s = document.createElement('script');
      s.src = this.SDK_SRC;
      s.async = true;
      s.onload = () => {
        this.sdkLoaded = !!window.epson;
        this.sdkLoaded ? resolve() : reject(new Error('No se cargó window.epson'));
      };
      s.onerror = () => reject(new Error('Error cargando ' + this.SDK_SRC));
      document.head.appendChild(s);
    });
  }

  // ====== flujo ======
  async connect() {
    this.busy = true;
    try {
      await this.loadSdk();
      this.append('SDK cargado.');

      this.ePosDev = new window.epson.ePOSDevice();
      const resultConnect: string = await new Promise(res =>
        this.ePosDev!.connect(this.IP, this.PORT, (r: string) => res(r))
      );
      this.append('connect()', resultConnect);

      if (resultConnect !== 'OK') {
        alert('connect error: ' + resultConnect);
        return;
      }

      // Crea el dispositivo (Printer) — buffer:true y crypto según config
      this.printer = await new Promise((resolve, reject) => {
this.ePosDev!.createDevice(
  this.DEVICE_ID,
  this.ePosDev!.DEVICE_TYPE_PRINTER,
  { crypto: this.CRYPTO, buffer: false },   // ← buffer:false
  (dev: any, code: string) => dev ? resolve(dev) : reject(new Error('createDevice error: ' + code))
);
      });
      this.append('createDevice()', { ok: !!this.printer });

      // Handler de recepción (NO pasar objeto a send())
      this.printer.timeout = 60000;
      this.printer.onreceive = (res: any) => {
        this.append('onreceive', res);
        if (res.success !== true) {
          alert(`Fallo impresión: code=${res.code || 'unknown'}`);
        } else {
          alert('Impresión OK');
        }
      };

    } catch (e: any) {
      this.append('ERROR connect', { message: e?.message ?? String(e) });
      alert('ERROR connect: ' + (e?.message ?? e));
    } finally {
      this.busy = false;
    }
  }

async printHello(n: number = 40) {
  if (!this.printer) { alert('No hay conexión. Pulsa Connect.'); return; }
  this.busy = true;
  try {
    // set de idioma/alineación seguro (ASCII)
    this.printer.addTextLang('en');
    this.printer.addTextAlign(this.printer.ALIGN_LEFT);

    for (let i = 0; i < n; i++) {
      this.printer.addText('Hola\n');
    }

    // opcional: salto extra y corte
    this.printer.addFeedLine(1);
    this.printer.addCut(this.printer.CUT_FEED);

    this.printer.send();           // ¡un solo send!
    this.append(`send() Hola x${n}`);
  } catch (e:any) {
    this.append('send() ERROR', { message: e?.message ?? String(e) });
    alert('ERROR send: ' + (e?.message ?? e));
  } finally {
    this.busy = false;
  }
}



  async checkStatus() {
    if (!this.printer) { alert('No hay conexión. Pulsa Connect.'); return; }
    this.busy = true;
    try {
      if (typeof this.printer.getStatus === 'function') {
        const st = await new Promise<any>((resolve, reject) => {
          try { this.printer.getStatus((s: any) => resolve(s)); } catch (err) { reject(err); }
        });
        this.append('getStatus()', st);
        alert(`online=${!!st.online}, coverOpen=${!!st.coverOpen}, paper=${st.paper}`);
      } else {
        // Fallback: mandar vacío y leer flags
        this.printer.addText('');
        const r = await new Promise<any>((resolve, reject) => {
          try { this.printer.send(); this.printer.onreceive = (res:any)=>resolve(res); }
          catch (e) { reject(e); }
        });
        this.append('status(fallback)', r);
        alert('Status fallback: ' + JSON.stringify(r));
      }
    } catch (e:any) {
      this.append('ERROR status', { message: e?.message ?? String(e) });
      alert('ERROR status: ' + (e?.message ?? e));
    } finally {
      this.busy = false;
    }
  }

  disconnect() {
    try {
      if (this.ePosDev && this.printer) {
        this.ePosDev.deleteDevice(this.printer, () => {
          this.append('deleteDevice() OK');
          this.printer = null;
          this.ePosDev?.disconnect();
          this.append('disconnect() OK');
          this.ePosDev = null;
        });
      } else if (this.ePosDev) {
        this.ePosDev.disconnect();
        this.append('disconnect() OK (sin printer)');
        this.ePosDev = null;
      }
    } catch (e:any) {
      this.append('ERROR disconnect', { message: e?.message ?? String(e) });
    }
  }

  ngOnDestroy(): void {
    try { this.disconnect(); } catch {}
  }

  // Llama a esta función desde un botón "Print (ePOS-Print)"
async printViaEposPrint() {
  this.busy = true;
  try {
    await this.loadSdk();

    const addr = 'http://192.168.1.60/cgi-bin/epos/service.cgi?devid=local_printer&timeout=60000';
    const epos = new window.epson.ePOSPrint(addr);
    const b = new window.epson.ePOSBuilder();

    b.addTextLang('en');
    b.addTextAlign(b.ALIGN_LEFT);
    b.addText('Hello via ePOS-Print\n');
    // b.addCut(b.CUT_FEED); // actívalo después que salga el texto

    epos.onreceive = (r:any) => { this.append('ePOS-Print onreceive', r); alert('ePOS-Print success=' + r.success); };
    epos.onerror   = (e:any) => { this.append('ePOS-Print onerror', e);   alert('ePOS-Print error'); };

    epos.send(b.toString());
  } catch (e:any) {
    this.append('ePOS-Print ERROR', { message: e?.message ?? String(e) });
    alert('ERROR ePOS-Print: ' + (e?.message ?? e));
  } finally {
    this.busy = false;
  }
}

}
