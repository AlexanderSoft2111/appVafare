/** Convierte mm a dots para 203 dpi (≈ 8 dots/mm) */
/** Convierte mm a dots para 203 dpi (≈ 8 dots/mm) */
export function mmToDots(mm: number, dpi = 203): number {
  return Math.round(mm * (dpi / 25.4));
}

/** Genera una etiqueta ZPL con Descripción + PVP grande (sin SKU) y código */
export function buildZplLabel(opts: {
  widthMm: number; heightMm: number;
  product: string;            // aquí usaremos product como "nombre"
  sku: string;                // ya no se imprime
  price?: number;             // PVP
  barcodeType: 'CODE128'|'EAN13'|'QR';
  barcodeValue?: string; qrUrl?: string;
  darkness?: number; speed?: number;
  descripcion?: string;       // <-- añade esta propiedad si quieres pasarla explícita
}): string {
  const dpi = 203;
  const PW = mmToDots(opts.widthMm, dpi);
  const LL = mmToDots(opts.heightMm, dpi);

  // === AJUSTES RÁPIDOS DEL CÓDIGO DE BARRAS ===
  const BAR_W   = 2.4;                 // ← AJUSTA AQUÍ: grosor barras (2–5 típico en 203dpi)
  const BAR_H   = mmToDots(22, dpi); // ← AJUSTA AQUÍ: altura en mm (22mm ≈ 176 dots)
  const QR_MAG  = 7;                 // ← AJUSTA AQUÍ: escala QR (5–9 común)

  const darkness = Number.isFinite(opts.darkness) ? `^MD${opts.darkness}\n` : '';
  const speed    = Number.isFinite(opts.speed)    ? `^PR${opts.speed}\n`     : '';

  const marginX   = mmToDots(3, dpi);
  const marginTop = mmToDots(3, dpi);
  const contentW  = PW - marginX * 2;

  const nombre = (opts.product || '').substring(0, 36);
  const desc   = (opts.descripcion || '').substring(0, 40);
  const priceS = (opts.price != null) ? `$${opts.price.toFixed(2)}` : '';

  // Tamaños aproximados
  const fNombre = 28;  // tamaño fuente nombre
  const fDesc   = 24;  // tamaño fuente descripción
  const fPrecio = 56;  // tamaño fuente precio (grande)

  let y = marginTop;

  // NOMBRE (izquierda)
  const nombreBlock = `
^FO${marginX},${y}
^A0N,${fNombre},${fNombre}
^FB${Math.floor(contentW*0.66)},1,0,L,0
^FD${nombre}^FS`;
  y += fNombre + mmToDots(1.5, dpi);

  // DESCRIPCION (izquierda, más pequeña, bajo nombre)
  const descBlock = `
^FO${marginX},${y}
^A0N,${fDesc},${fDesc}
^FB${Math.floor(contentW*0.66)},1,0,L,0
^FD${desc}^FS`;

  // PRECIO (derecha, grande)
  const precioBlock = priceS ? `
^FO${marginX},${marginTop}
^A0N,${fPrecio},${fPrecio}
^FB${contentW},1,0,R,0
^FD${priceS}^FS` : '';

  // Avanza Y bajo la descripción
  y += fDesc + mmToDots(2.5, dpi);

  // CODIGO (centrado abajo)
  let symbol = '';
  if (opts.barcodeType === 'QR') {
    const payload = opts.qrUrl || '';
    symbol = `
^FO${marginX},${y}
^BQN,2,5
^FDQA,${payload}^FS`;
  } else if (opts.barcodeType === 'EAN13') {
    const data = (opts.barcodeValue || '').padStart(12, '0');
    symbol = `
^FO${marginX},${y}
^FB${contentW},1,0,C,0
^BY${BAR_W}                 ; ← grosor de barras
^BEN,${BAR_H},Y,N           ; ← altura del símbolo (sube o baja con BAR_H)
^FD${data}^FS`;
  } else {
    const data = opts.barcodeValue || '';
    symbol = `
^FO${marginX},${y}
^FB${contentW},1,0,C,0
^BY${BAR_W}                 ; ← grosor de barras
^BCN,${BAR_H},Y,N,N         ; ← altura del símbolo
^FD${data}^FS`;
  }

  return `^XA
^CF0,20
^PW${PW}
^LL${LL}
^LH0,0
${darkness}${speed}
${nombreBlock}
${descBlock}
${precioBlock}
${symbol}
^XZ`;
}
/** Duplica el job N veces (cantidad) */
export function multiplyJob(zpl: string, qty: number): string {
  const n = Math.max(1, Math.floor(qty || 1));
  return new Array(n).fill(zpl).join('\n');
}
