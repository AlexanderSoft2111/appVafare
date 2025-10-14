// src/app/core/printing/print-types.ts

/** Cliente del ticket */
export interface PrintCustomer {
    nombre?: string;
    ruc?: string;
    telefono?: string;
  }
  
  /** Línea (ítem) del ticket */
  export interface PrintLineItem {
    cantidad: number;
    /** Precio total de la línea (si no viene, se calcula como pvp * cantidad) */
    totalLinea?: number;
    /** Datos básicos del producto */
    producto?: {
      nombre?: string;
      pvp?: number;        // precio unitario
      check_iva?: boolean; // si aplica IVA
    };
    /** Descuentos opcionales por línea */
    descLineaPct?: number;
    descLineaMonto?: number;
  }
  
  /** Datos mínimos para imprimir un ticket de venta */
  export interface PrintSale {
    numero?: string | number;
    fecha?: string | Date;
    cliente?: PrintCustomer;
    items: PrintLineItem[];
    subtotalSinIVA?: number;
    iva?: number;
    total?: number;
    pago?: number;
    vuelto?: number;
    descGlobalPct?: number;
    descGlobalMonto?: number;
  }
  
  /** Ajustes/configuración de la impresora que controla el SDK */
  export interface PrinterSettings {
    /** IP de la impresora, p.ej. "192.168.1.60" */
    ip: string;
    /** Puerto ePOS-Device: 8008 en HTTP (DEV), 8043 en HTTPS (PROD) */
    port?: number;
    /** ID configurado en "ePOS-Device" del equipo (por defecto: "local_printer") */
    deviceId?: string;
  
    /** Cabecera del ticket */
    header?: { title?: string; ruc?: string; address?: string };
    /** Pie del ticket */
    footer?: { thanks?: string };
  
    /**
     * Columnas visibles (ancho lógico del ticket).
     *  - 80 mm ≈ 42
     *  - 58/56 mm ≈ 32
     */
    widthChars?: number;
  
    /** Forzar HTTPS (crypto) si tu app corre en HTTPS (producción) */
    useHttps?: boolean;
  }
  
  /** Respuesta simple de estado */
  export interface PrinterStatusResult {
    ok: boolean;
    step: 'connect' | 'device' | 'status';
    details?: any;
  }
  