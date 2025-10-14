// src/app/core/printing/epson.config.ts
import { PrinterSettings } from "./print.types";


/** Constantes típicas de ancho en caracteres */
export const PAPER_WIDTH_CHARS = {
  W80: 42, // 80 mm
  W58: 32, // 58/56 mm
} as const;

/** Config por defecto (pensada para desarrollo en HTTP:8008) */
export const DEFAULT_PRINTER_SETTINGS: PrinterSettings = {
  ip: '192.168.1.60',
  port: 8008,            // DEV: HTTP → 8008
  deviceId: 'local_printer',
  header: { title: 'VAFARE Supermercado', ruc: 'RUC 1234567890', address: 'Quinta Chica Baja' },
  footer: { thanks: '¡Gracias por su compra!' },
  widthChars: PAPER_WIDTH_CHARS.W58, // cambia a W58 si usas papel 58/56 mm
  useHttps: false,         // En producción con HTTPS: true (y puerto 8043)
};
