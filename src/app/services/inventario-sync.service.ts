import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { FirestoreService } from './firestore.service';
import { LocalstorageService } from './localstorage.service';

// 👇 usa TU modelo oficial
import { Producto } from '../models/models';

// Extra interno para el sync (opcional)
type SyncProducto = Producto & {
  deleted?: boolean;
};

type PendingType = 'upsert' | 'delete';

interface PendingOp {
  id: string;
  type: PendingType;
  payload?: SyncProducto;
  updatedAt: number;
}

// keys-sync.ts (opcional) — o pega estas const en el sync service
const LS_KEYS = {
  PRODUCTS: 'Inventario', // array de productos cacheados
  LAST_SYNC: 'inv.lastSync.v1', // cursor de sincronización (epoch ms)
  PENDING:  'inv.pending.v1',   // cola de operaciones offline
};




@Injectable({ providedIn: 'root' })
export class InventarioSyncService {
  private fs = inject(FirestoreService);
  private ls = inject(LocalstorageService);

    // 👇 expón SIEMPRE el tipo oficial hacia fuera
  private products$ = new BehaviorSubject<Producto[]>([]);
  private byId = new Map<string, SyncProducto>();
  private syncing = false;
  private loaded = false;

  constructor() {
    // Sincroniza automáticamente cuando vuelva Internet
    window.addEventListener('online', () => this.trySync());
  }

    // ---------- utils muy pequeñas para normalizar updatedAt ----------
  private toMs(u?: Producto['updatedAt']): number {
    // Timestamp → ms
    // @ts-ignore (si TS no infiere .toMillis)
    if (u && typeof (u as any).toMillis === 'function') return (u as any).toMillis();
    // number → ms
    if (typeof u === 'number') return u;
    // string(legacy) → Date.parse → ms (o ahora)
    if (typeof u === 'string') {
      const t = Date.parse(u);
      return Number.isFinite(t) ? t : Date.now();
    }
    // undefined → ahora
    return Date.now();
  }

  /** Llamar una sola vez antes de usar stream/loadOnce */
  async init(): Promise<void> {
    const cached: SyncProducto[] = (await this.ls.getDoc(LS_KEYS.PRODUCTS)) ?? [];
    this.byId = new Map(cached.map(p => [p.id!, p]));
    this.products$.next(cached as Producto[]);
    this.loaded = cached.length > 0;
  }


  stream(): Observable<Producto[]> {
    return this.products$.asObservable();
  }

  snapshot(): Producto[] {
    return this.products$.value;
  }

  /** Carga única: si ya hay cache, no vuelve a bajar los 3000 */
  async loadOnce(): Promise<Producto[]> {
    if (this.loaded) { 
      this.pullDeltasInBackground(); 
      return this.snapshot(); 
    }

    const cached = this.snapshot();
    if (cached.length) { this.loaded = true; this.pullDeltasInBackground(); return cached; }

    const full = await this.fs.getAllOnce<SyncProducto>('Productos', 'codigo', 'asc');
    const norm = full.map(p => ({ ...p, updatedAt: this.toMs(p.updatedAt) }));
    await this.saveFull(norm);
    this.loaded = true;
    console.log('me volvi a llamar',this.loaded)
    return norm as Producto[];
  }

   async upsertLocal(p: Producto) {
    const updated: SyncProducto = { ...p, updatedAt: Date.now() };
    this.byId.set(updated.id!, updated);
    await this.flush();

    const q: any[] = (await this.ls.getDoc(LS_KEYS.PENDING)) ?? [];
    const filtered = q.filter(op => op.id !== updated.id);
    filtered.push({ id: updated.id!, type: 'upsert', payload: updated, updatedAt: updated.updatedAt });
    await this.ls.setDoc(LS_KEYS.PENDING, filtered);

    this.trySync();
  }
async deleteLocal(id: string) {
    this.byId.delete(id);
    await this.flush();

    const q: any[] = (await this.ls.getDoc(LS_KEYS.PENDING)) ?? [];
    q.push({ id, type: 'delete', updatedAt: Date.now() });
    await this.ls.setDoc(LS_KEYS.PENDING, q);

    this.trySync();
  }

  async trySync() {
    if (this.syncing || !navigator.onLine) return;
    this.syncing = true;
    try {
      const pending: any[] = (await this.ls.getDoc(LS_KEYS.PENDING)) ?? [];
      if (pending.length) {
        const upserts = pending.filter(op => op.type === 'upsert').map(op => op.payload);
        if (upserts.length) {
          await this.fs.upsertMany('Productos', upserts, { idField: 'id', useAutoId: false });
        }
        const deletes = pending.filter(op => op.type === 'delete');
        for (const d of deletes) {
          await this.fs.deleteDocumentID('Productos', d.id);
        }
        await this.ls.setDoc(LS_KEYS.PENDING, []);
      }
      await this.pullDeltasInBackground();
    } finally {
      this.syncing = false;
    }
  }

  // ---------------- privados ----------------

  private async saveFull(items: SyncProducto[]) {
    this.byId.clear();
    items.forEach(p => this.byId.set(p.id!, p));
    await this.flush();
    await this.ls.setDoc(LS_KEYS.LAST_SYNC, Date.now());
  }

  private async flush() {
    const arr = Array.from(this.byId.values());
    await this.ls.setDoc(LS_KEYS.PRODUCTS, arr);
    this.products$.next(arr as Producto[]);
  }

  private async pullDeltasInBackground() {
    const lastSync: number = (await this.ls.getDoc(LS_KEYS.LAST_SYNC)) ?? 0;
    const deltas = await this.fs.getDeltasSince<SyncProducto>('Productos', lastSync);

    if (deltas?.length) {
      for (const d of deltas) {
        const merged: SyncProducto = {
          ...(this.byId.get(d.id!) ?? {}),
          ...d,
          updatedAt: this.toMs(d.updatedAt),
        };
        if ((merged as any).deleted) this.byId.delete(merged.id!);
        else this.byId.set(merged.id!, merged);
      }
      await this.flush();
    }
    await this.ls.setDoc(LS_KEYS.LAST_SYNC, Date.now());
  }
}
