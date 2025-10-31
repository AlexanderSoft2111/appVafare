/** Convierte mm a dots para 203 dpi (≈ 8 dots/mm) */
export function mmToDots(mm: number, dpi = 203): number {
  return Math.round(mm * (dpi / 25.4));
}

/** Genera una etiqueta ZPL 50×30 mm con Code128/EAN13/QR */
export function buildZplLabel(opts: {
  widthMm: number; heightMm: number;
  product: string; sku: string; price?: number;
  barcodeType: 'CODE128'|'EAN13'|'QR';
  barcodeValue?: string; qrUrl?: string;
  darkness?: number;  // ^MD
  speed?: number;     // ^PR
}): string {
  const dpi = 203;
  const PW = mmToDots(opts.widthMm, dpi);
  const LL = mmToDots(opts.heightMm, dpi);

  // Opcional: oscuridad/velocidad
  const darkness = Number.isFinite(opts.darkness) ? `^MD${opts.darkness}\n` : '';
  const speed    = Number.isFinite(opts.speed)    ? `^PR${opts.speed}\n`     : '';

  // Textos base
  const product = (opts.product || '').substring(0, 28);
  const sku     = (opts.sku || '').substring(0, 24);
  const priceS  = (opts.price != null) ? `$${opts.price.toFixed(2)}` : '';

  // Posiciones simples (puedes ajustar según fuente y densidad)
  const txt = `
^FO20,20^A0N,28,28^FD${product}^FS
^FO20,55^A0N,24,24^FDSKU: ${sku}${priceS ? '  •  ' + priceS : ''}^FS`;

  // Código de barras / QR
  let symbol = '';
  if (opts.barcodeType === 'QR') {
    const payload = opts.qrUrl || '';
    symbol = `^FO260,20^BQN,2,4^FDQA,${payload}^FS`;
  } else if (opts.barcodeType === 'EAN13') {
    const data = (opts.barcodeValue || '').padStart(12, '0'); // EAN13 requiere 12; la impresora calcula dígito
    symbol = `^FO20,95^BEN,80,Y,N\n^FD${data}^FS`;
  } else {
    // CODE128
    const data = opts.barcodeValue || '';
    symbol = `^FO20,95^BCN,80,Y,N,N\n^FD${data}^FS`;
  }

  return `^XA
^CF0,20
^PW${PW}
^LL${LL}
^LH0,0
${darkness}${speed}${txt}
${symbol}
^XZ`;
}

/** Duplica el job N veces (cantidad) */
export function multiplyJob(zpl: string, qty: number): string {
  const n = Math.max(1, Math.floor(qty || 1));
  return new Array(n).fill(zpl).join('\n');
}
