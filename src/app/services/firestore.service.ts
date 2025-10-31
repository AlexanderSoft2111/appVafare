  import { inject, Injectable, EnvironmentInjector, runInInjectionContext } from '@angular/core';
  import { Observable } from 'rxjs';

  import {
    getDoc,
    Firestore,
    docData,
    serverTimestamp,
    DocumentSnapshot,
    QuerySnapshot,
    collectionGroup,
    collectionData,
    getCountFromServer,
    doc,updateDoc,query,
    orderBy,getDocs,
    setDoc,deleteDoc,
    collection,where,
    onSnapshot,writeBatch
  } from '@angular/fire/firestore';

 import { OptimisticWrite, SaveManyOptions } from '../models/models';


  type SortDir = 'asc' | 'desc';


  @Injectable({
    providedIn: 'root'
  })
  export class FirestoreService {

  private db: Firestore = inject(Firestore);
  private env = inject(EnvironmentInjector);

  constructor() {}

async upsertMany<T extends Record<string, any>>(
    path: string,
    items: T[],
    options: SaveManyOptions = {}
  ): Promise<void> {
    if (!Array.isArray(items) || items.length === 0) return;

    const {
      idField = 'codigo',
      useAutoId = true,
      merge = true,
      chunkSize = 450,
      onProgress,
    } = options;

    const total = items.length;
    let escritos = 0;

    for (let i = 0; i < total; i += chunkSize) {
      const slice = items.slice(i, i + chunkSize);
      const batch = writeBatch(this.db);
      const colRef = collection(this.db, path);

      for (const raw of slice) {
        // 1) Obtener la referencia de documento
        let refId: string;
        let refDoc;

        if (useAutoId) {
          // === ID automático, igual que cuando haces doc(collection) ===
          refDoc = doc(colRef);   // genera ID
          refId = refDoc.id;
        } else {
          // === Usa idField si viene; si no, genera uno ===
          const fromField = raw[idField];
          if (fromField !== undefined && fromField !== null && String(fromField).trim() !== '') {
            refId = String(fromField).trim();
            refDoc = doc(this.db, `${path}/${refId}`);
          } else {
            refDoc = doc(colRef);
            refId = refDoc.id;
          }
        }

        // 2) Construir payload final
        const hasDate = Object.prototype.hasOwnProperty.call(raw, 'date');
        const payload = {
          ...raw,
          id: refId,                       // guarda el id también como campo
          date: hasDate ? (raw as any).date : serverTimestamp(),
          updatedAt: serverTimestamp(),
        };

        // 3) Upsert
        batch.set(refDoc, payload, { merge });
      }

      await batch.commit();
      escritos += slice.length;
      onProgress?.(escritos / total);
    }
  }

  async upsertOne<T extends Record<string, any>>(
    path: string,
    item: T,
    options: Omit<SaveManyOptions, 'onProgress' | 'chunkSize'> = {}
  ): Promise<{ id: string; docPath: string; write: Promise<void> }> {
    const { idField = 'codigo', useAutoId = false, merge = true } = options;

    const colRef = collection(this.db, path);
    let refId: string;
    let refDoc;

    if (useAutoId) {
      refDoc = doc(colRef);
      refId = refDoc.id;
    } else {
      const fromField = item[idField];
      if (fromField !== undefined && fromField !== null && String(fromField).trim() !== '') {
        refId = String(fromField).trim();
        refDoc = doc(this.db, `${path}/${refId}`);
      } else {
        refDoc = doc(colRef);
        refId = refDoc.id;
      }
    }

    const payload = {
      ...item,
      id: refId,
      date: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    const write = setDoc(refDoc, payload, { merge });
    return { id: refId, docPath: refDoc.path, write };
  }



  /** Helper para no repetir y envolver todo dentro de los cambios de angulay y evitar los warnings de zoneless*/
  private inCtx<T>(fn: () => T): T {
    return runInInjectionContext(this.env, fn);
  }

    // ------ UTILIDAD: saber si está offline ------
  isOffline(): boolean {
    return typeof navigator !== 'undefined' && !navigator.onLine;
  }

    /**
   * Devuelve el conteo de documentos de una colección (opcionalmente ordenada para coincidir con tu consulta).
   * Útil para mostrar "N registros" o para precargas con progreso.
   * @param path Colección (ej: 'Clientes')
   */
  async getTotalDocuments(path: string): Promise<number> {
    return this.inCtx( async () => {
      const refCollection = collection(this.db, path);
      const snap = await getCountFromServer(refCollection);
      return snap.data().count;

    })
  }

    /**
   * Suscribe a una colección en tiempo real (offline-first) ordenada por un campo.
   * @param path Colección (ej: 'Clientes', 'Productos')
   * @param orderField Campo por el que vamos a ordenar (ej: 'nombre')
   * @param dir Dirección del orden ('asc' | 'desc')
   * @param idField Nombre de la propiedad donde inyectar el id del doc (por defecto 'id')
   * @returns Observable<T[]> que emite el array completo; Firestore aplica diffs internamente
   */
  getCollectionChanges<tipo>(path: string,orderField: string,dir: SortDir = 'asc',idField: string = 'id'): Observable<tipo[]> {

    const ref = collection(this.db, path);
    const q  = query(ref, orderBy(orderField, dir));
    return this.inCtx(() => collectionData(q, { idField }) as Observable<tipo[]>);

  }

  getDocumentChanges <tipo>(path: string): Observable<tipo> {
    const docRef = doc(this.db, path);
        return this.inCtx(() => docData(docRef) as Observable<tipo>);

  }

  /**
   * Busca el primer documento que cumpla field == value dentro de una colección.
   * @param collectionPath Colección (ej: 'Clientes')
   * @param field Campo a comparar (ej: 'ruc', 'codigo')
   * @param value Valor a buscar
   * @returns El documento con id inyectado o null si no existe
   */
  async getDocumentQuery<tipo>(collectionPath: string, field: string, value: unknown){
    return this.inCtx(async () => {
      const refCollection = collection(this.db, collectionPath);
      const q = query(refCollection, where(field, "==", value));
      const snap = await getDocs(q);
      if (snap.empty) return null;
      const doc = snap.docs[0];
      return { id: doc.id, ...(doc.data() as tipo) } as tipo;
    })
  }


  async getDocument<tipo>(enlace: string) {
    const refDoc = doc(this.db, enlace);
    return this.inCtx(async () => await getDoc(refDoc) as DocumentSnapshot<tipo>);

  }

  async getCollection<tipo>(path: string) {
    return this.inCtx(async () => {
      const colRefCollection = collection(this.db, path);
      return await getDocs(colRefCollection) as QuerySnapshot<tipo>
    })
  }

  async createDocument<tipo>(data: tipo, enlace: string) {
     return this.inCtx(async () => {
    const refColecction = collection(this.db,enlace);
    const refDoc = doc(refColecction);
    const dataDoc: any = data;
    dataDoc.id = refDoc.id;
    dataDoc.date = serverTimestamp();
    return await  setDoc(refDoc,dataDoc);
     });
  }

  /**
   * Crea un documento (con id generado o con un id específico si lo pasas).
   * Agrega propiedades de auditoría: id (si es generado), date y updatedAt (serverTimestamp).
   * @param data Datos a guardar
   * @param enlace Colección (ej: 'Clientes')
   * @param idDoc (opcional) ID personalizado del documento
   * @returns El id del documento creado
   */
  async createDocumentID<tipo>(data: tipo,enlace: string,idDoc?: string): Promise<OptimisticWrite> {
    const refColecction = collection(this.db, enlace);
    const refDoc = idDoc
      ? doc(this.db, `${enlace}/${idDoc}`)
      : doc(refColecction);

    const payload: any = {
      ...data,
      id: refDoc.id,
      date: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    const write = setDoc(refDoc, payload); // Se aplica local; la Promise espera al backend
    return { id: refDoc.id, docPath: refDoc.path, write };
  }


      // ------ Observa estado de sincronización del doc ------
  observeSyncStatus(docPath: string): Observable<'local' | 'synced'> {
    return new Observable(sub => {
      const ref = doc(this.db, docPath);
      const unsub = onSnapshot(ref, { includeMetadataChanges: true }, snap => {
        const pending = snap.metadata.hasPendingWrites;
        sub.next(pending ? 'local' : 'synced');
      }, err => sub.error(err));
      return () => unsub();
    });
  }


    /**
   * Actualiza un documento por id. Agrega updatedAt: serverTimestamp() automáticamente.
   * @param data Datos a actualizar (solo los campos necesarios)
   * @param path Colección (ej: 'Clientes')
   * @param idDoc ID del documento
   */
  async updateDocumentID <tipo>(data: Partial<tipo>, path: string, idDoc: string):Promise<OptimisticWrite>  {
    const refDoc = doc(this.db, `${path}/${idDoc}`);
    const write = updateDoc(refDoc, { ...data, updatedAt: serverTimestamp() } as any);
    return { id: idDoc, docPath: refDoc.path, write };
  }

  createIdDoc(): string {
    return doc(collection(this.db, '_')).id;
  }

  /**
 * Elimina un documento por id dentro de una colección.
 * @param path Colección (ej: 'Clientes')
 * @param idDoc ID del documento a eliminar
 */

  async deleteDocumentID(collectionPath: string, idDoc: string): Promise<OptimisticWrite> {
    const refDoc = doc(this.db, `${collectionPath}/${idDoc}`);
    const write = deleteDoc(refDoc);
    return { id: idDoc, docPath: refDoc.path, write };
  }

}
