import { Timestamp } from 'firebase/firestore';

export const Paths = {
  productos: 'Productos',
  clientes: 'Clientes',
  ventas: 'Ventas',
  numeroVenta: 'Numeroventa/numeroventa',
}

export interface Producto {
  id?: string;
  nombre: string;
  date?: string;
  updatedAt?: Timestamp | number | string;
  descripcion: string;
  costo_compra: number;
  check_iva: boolean
  costo_sin_iva: number;
  pvp: number;
  codigo: string;
  stock: number;
  fecha_caducidad: string;
  stock_minimo: number;
}

export interface Cliente {
  id?: string;
  date?: string;
  nombre: string;
  ruc: string;
  direccion: string;
  telefono: string;
  email: string;
  updatedAt?: string;
}

export interface Venta {
  productos: ProductoVenta[];
  cliente: Cliente;
  subtotal_sin_iva: number;
  subtotal_con_iva: number;
  iva: number;
  total: number;
  fecha: Date;
  id: string;
  numero: number;
  updatedAt?: string;

}


export interface ProductoVenta {
  cantidad: number;
  producto: Producto;
  precio: number;
  updatedAt?: string;

}

export interface NumeroVenta {
  numero: number;
}

export interface OptimisticWrite {
  id: string;
  docPath: string;
  write: Promise<void>; // promesa que se resuelve cuando el backend confirma
}

export interface SaveManyOptions {
  /** Campo a usar como ID si NO se usa autoId. Default: 'codigo' */
  idField?: string;
  /** Si true, genera ID automático para cada item y lo guarda también en el campo 'id' */
  useAutoId?: boolean;
  /** Merge de campos. Default: true */
  merge?: boolean;
  /** Tamaño de lote. Default: 450 */
  chunkSize?: number;
  /** Progreso 0..1 */
  onProgress?: (p: number) => void;
}
