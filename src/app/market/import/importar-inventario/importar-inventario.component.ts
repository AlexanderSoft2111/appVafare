import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common'; // <-- para *ngIf, *ngFor, keyvalue
import * as XLSX from 'xlsx';                   // <-- lector Excel
import { Paths, Producto } from 'src/app/models/models';
import { FirestoreService } from 'src/app/services/firestore.service';
import {
  IonProgressBar, IonCard, IonCardHeader, IonCardTitle, IonCardSubtitle,
  IonCardContent, IonButton, IonList, IonItem, IonLabel, IonIcon,
  IonRippleEffect, IonChip
} from "@ionic/angular/standalone";
import { DecimalPipe } from '@angular/common';

import { addIcons } from 'ionicons';
import {
  cloudUploadOutline,saveOutline,documentTextOutline,eyeOutline,
} from 'ionicons/icons';
import { InteraccionService } from 'src/app/services/interaccion.service';


@Component({
  selector: 'app-importar-inventario',
  templateUrl: './importar-inventario.component.html',
  styleUrls: ['./importar-inventario.component.scss'],
  imports: [
    CommonModule, // <-- nuevo
    IonChip, IonRippleEffect, IonIcon, IonLabel, IonItem, IonList,
    IonButton, IonCardContent, IonCardSubtitle, IonCardTitle, IonCardHeader,
    IonCard, IonProgressBar, DecimalPipe
  ]
})
export default class ImportarInventarioComponent implements OnInit {
  private firestoreService = inject(FirestoreService);
  private interaccionService = inject(InteraccionService);

  // --- Estado de UI / datos previos ---
  fileName: string | null = null;     // nombre del archivo seleccionado
  rowsPreview: any[] = [];            // primeras filas crudas (para la tabla)
  errors: string[] = [];              // errores por fila (código/nombre vacíos, etc.)

  // --- Datos ya normalizados listos para guardar ---
  productos: Producto[] = [];

  // --- Progreso de guardado ---
  loading = false;
  progress = 0;

  // --- Parámetros comunes ---
  private readonly IVA_RATE = 0.15;   // 15% Ecuador

  constructor() {
    addIcons({ cloudUploadOutline,saveOutline,documentTextOutline,eyeOutline })
  }
  ngOnInit() {}

  // =============== Handlers Drag & Drop / Archivo =================

  onFileInput(ev: Event) {
    const input = ev.target as HTMLInputElement;
    if (!input.files?.length) return;
    this.readFile(input.files[0]);
  }

  onDrop(ev: DragEvent) {
    ev.preventDefault();
    const file = ev.dataTransfer?.files?.[0];
    if (file) this.readFile(file);
  }

  onDragOver(ev: DragEvent) {
    ev.preventDefault();
  }

  // =============== Lectura del Excel =================

  private readFile(file: File) {
    this.fileName = file.name;
    const reader = new FileReader();
    reader.onload = (e: any) => {
      const data = new Uint8Array(e.target.result);
      const wb = XLSX.read(data, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(ws, { defval: '' }); // objetos por fila

      this.mapearProductos(json as any[]);
      // Después de mapear a this.productos
      this.rowsPreview = this.productos.slice(0, 20).map(p => ({
        costo_compra: p.costo_compra.toFixed(2),
        costo_sin_iva: p.costo_sin_iva.toFixed(2),
        pvp: p.pvp.toFixed(2),
        check_iva: p.check_iva ? 'SI' : 'NO',
        codigo: p.codigo,
        descripcion: p.descripcion,
        fecha_caducidad: p.fecha_caducidad, // ya es 'YYYY-MM-DD'
        nombre: p.nombre,
        stock: p.stock,               // si prefieres también string: String(p.stock)
        stock_minimo: p.stock_minimo, // idem
      }));
    };
    reader.readAsArrayBuffer(file);
  }

  // =============== Mapeo filas Excel -> Producto =================

  private mapearProductos(rows: any[]) {
    this.errors = [];
    const out: Producto[] = [];

    rows.forEach((r, idx) => {
      const codigo = this.toCodigoString(r['codigo']);
      const nombre = String(r['nombre'] ?? '').trim();

      if (!codigo) { this.errors.push(`Fila ${idx + 2}: código vacío`); return; }
      if (!nombre) { this.errors.push(`Fila ${idx + 2}: nombre vacío`); return; }

      out.push(this.mapRowToProductoLocal(r));
    });
    this.productos = out;
    console.log(this.productos);
  }

  /** Regla IVA:
   * - Si check_iva = true y falta uno de los costos, se calcula el que falte.
   * - Si check_iva = false y falta uno, ambos quedan iguales.
   * - Si ambos vienen, se respetan.
   */
  private mapRowToProductoLocal(row: any): Producto {
    const codigo = this.toCodigoString(row['codigo']);
    const nombre = String(row['nombre'] ?? '').trim();
    const descripcion = String(row['descripcion'] ?? '').trim();

    const check_iva = this.siNoToBool(row['check_iva']);

    let costo_compra  = this.parseMoney(row['costo_compra']);   // con IVA si aplica
    let costo_sin_iva = this.parseMoney(row['costo_sin_iva']);  // sin IVA
    const pvp         = this.parseMoney(row['pvp']);

    // Completar SOLO si falta uno:
    if (check_iva) {
      if (!costo_sin_iva && costo_compra) costo_sin_iva = +(costo_compra / (1 + this.IVA_RATE)).toFixed(2);
      if (!costo_compra && costo_sin_iva) costo_compra   = +(costo_sin_iva * (1 + this.IVA_RATE)).toFixed(2);
    } else {
      if (costo_compra && !costo_sin_iva) costo_sin_iva = costo_compra;
      if (costo_sin_iva && !costo_compra) costo_compra   = costo_sin_iva;
    }


      // Fuerza 2 decimales
    costo_compra  = Number((costo_compra  ?? 0).toFixed(2));
    costo_sin_iva = Number((costo_sin_iva ?? 0).toFixed(2));



    const stock          = this.parseIntSafe(row['stock']);
    const stock_minimo   = this.parseIntSafe(row['stock_minimo']);
    //const fecha_caducidad = this.parseDateDMY(row['fecha_caducidad']);
    const fecha_caducidad = this.normalizeFechaCad(row['fecha_caducidad']); // <-- string Y-M-D

    console.log('fecha', fecha_caducidad);

    return {
      codigo,
      nombre,
      descripcion,
      check_iva,
      costo_compra,
      costo_sin_iva,
      pvp,
      stock,
      stock_minimo,
      fecha_caducidad
    };
  }

  // =============== Guardado (ya lo tenías) =================

  async guardar() {
    if (!this.productos.length) return;
    this.loading = true;
    this.progress = 0;
    console.log(this.productos);
    try {
      await this.firestoreService.upsertMany(Paths.productos, this.productos, {
        idField: 'codigo',
        merge: true,
        chunkSize: 450,
        onProgress: p => this.progress = p,
      });

      this.interaccionService.showToast(`Importados/actualizados: ${this.productos.length} productos.`);
    } catch (err: any) {
      console.error(err);
      this.interaccionService.showToast('Error al guardar: ' + (err?.message ?? 'desconocido'));
    } finally {
      this.loading = false;
    }
  }

  // =============== Helpers de parseo =================

private parseMoney(v: any): number {
  if (v === null || v === undefined || v === '') return 0;

  // Si ya es número (por raw:true), úsalo directo
  if (typeof v === 'number' && !isNaN(v)) return Number(v.toFixed(2));

  // Normaliza strings
  let s = String(v).trim();
  if (!s) return 0;
  s = s.replace(/[^\d.,-]/g, ''); // quita $, espacios, etc.

  // Si hay coma y punto, asume que el ÚLTIMO separador es decimal
  if (s.includes(',') && s.includes('.')) {
    const lastComma = s.lastIndexOf(',');
    const lastDot = s.lastIndexOf('.');
    if (lastComma > lastDot) s = s.replace(/\./g, '').replace(',', '.'); // 1.234,56 -> 1234.56
    else s = s.replace(/,/g, '');                                        // 1,234.56 -> 1234.56
  } else {
    if (s.includes(',')) s = s.replace(',', '.'); // 0,36 -> 0.36
  }

  const n = Number(s);
  return isNaN(n) ? 0 : Number(n.toFixed(2));
}

  private siNoToBool(v: any): boolean {
    const s = String(v ?? '').trim().toLowerCase();
    if (['si','sí','true','1'].includes(s)) return true;
    if (['no','false','0'].includes(s)) return false;
    return false;
  }

  private parseIntSafe(v: any): number {
    const n = Number(String(v).replace(/[^\d.-]/g, ''));
    return isNaN(n) ? 0 : Math.round(n);
  }


  private toCodigoString(v: any): string {
    return String(v ?? '').trim();
  }

  /** Excel serial (entero) -> Date en UTC (00:00:00Z), sin desfase por timezone */
private excelSerialToDateUTC(n: number): Date {
  // Excel: día 1 = 1899-12-31, pero por el bug del 1900 se usa base 1899-12-30
  const days = Math.floor(n); // ignora fracciones de día
  const baseUTC = Date.UTC(1899, 11, 30); // 1899-12-30T00:00:00Z
  return new Date(baseUTC + days * 86400000);
}

/** Construye "YYYY-MM-DD" usando getters UTC (evita -1 día por huso horario) */
private toYMDUTC(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Normaliza cualquier entrada de fecha a "YYYY-MM-DD" de forma UTC-safe */
private normalizeFechaCad(v: any): string {
  if (v == null || v === '') return '';

  // Ya viene bien
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v.trim())) return v.trim();

  // Serial de Excel (46356, etc.)
  if (typeof v === 'number' && Number.isFinite(v)) {
    return this.toYMDUTC(this.excelSerialToDateUTC(v));
  }

  // Date -> usar UTC
  if (v instanceof Date && !isNaN(v.getTime())) {
    return this.toYMDUTC(v);
  }

  // "dd/MM/yyyy" o "dd-MM-yyyy" -> crear Date en UTC y formatear en UTC
  if (typeof v === 'string') {
    const s = v.trim();
    const m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
    if (m) {
      const [, dd, mm, yyyy] = m;
      const year = Number(yyyy.length === 2 ? `20${yyyy}` : yyyy);
      const d = new Date(Date.UTC(year, Number(mm) - 1, Number(dd)));
      return this.toYMDUTC(d);
    }
  }

  // Timestamp de Firestore (por si re-importas)
  if (v && typeof v === 'object' && typeof v.toDate === 'function') {
    return this.toYMDUTC(v.toDate());
  }

  return '';
}
}
