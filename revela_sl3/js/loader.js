// Carga de archivos: CR3 (RAW Canon), JPEG, PNG, WebP, HEIC (si el navegador
// lo soporta). Devuelve mapas de bits ya orientados.

import { isCR3, parseCR3 } from './cr3.js';
import { parseJpeg } from './tiff.js';

export function fileKind(file) {
  const n = file.name.toLowerCase();
  if (n.endsWith('.cr3')) return 'cr3';
  if (/\.(jpe?g)$/.test(n) || file.type === 'image/jpeg') return 'jpeg';
  return 'otro';
}

export function isSupported(file) {
  return /\.(cr3|jpe?g|png|webp|heic|heif|avif)$/i.test(file.name) || /^image\//.test(file.type);
}

async function orient(bitmap, orientation) {
  if (![3, 6, 8].includes(orientation)) return bitmap;
  const swap = orientation !== 3;
  const w = swap ? bitmap.height : bitmap.width;
  const h = swap ? bitmap.width : bitmap.height;
  const c = new OffscreenCanvas(w, h);
  const ctx = c.getContext('2d');
  ctx.translate(w / 2, h / 2);
  ctx.rotate(orientation === 6 ? Math.PI / 2 : orientation === 8 ? -Math.PI / 2 : Math.PI);
  ctx.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2);
  bitmap.close();
  return c.transferToImageBitmap();
}

/** Gira un mapa de bits en cuartos de vuelta (horario). Cierra el original. */
export async function rotateQuarter(bitmap, turns) {
  const t = ((turns % 4) + 4) % 4;
  return t === 0 ? bitmap : orient(bitmap, [1, 6, 3, 8][t]);
}

/** Lee metadatos (rápido) y prepara cómo decodificar. */
export async function inspect(file) {
  const kind = fileKind(file);
  if (kind === 'cr3') {
    const buf = new Uint8Array(await file.arrayBuffer());
    if (!isCR3(buf)) throw new Error(`${file.name} no parece un CR3 válido`);
    const info = parseCR3(buf);
    if (!info.jpeg) throw new Error(`${file.name}: no se encontró imagen dentro del CR3`);
    const small = [...info.previews].reverse().find((p) => p.width >= 300) || info.jpeg;
    return { kind, exif: info.exif, full: info.jpeg, small, app1: null };
  }
  let exif = {};
  let app1 = null;
  if (kind === 'jpeg') {
    const head = new Uint8Array(await file.slice(0, 256 * 1024).arrayBuffer());
    exif = parseJpeg(head).exif;
    try { app1 = extractApp1(head); } catch { app1 = null; }
  }
  return { kind, exif, app1 };
}

function sliceBlob(file, part) {
  return file.slice(part.offset, part.offset + part.size, 'image/jpeg');
}

/** Decodifica la imagen completa y la orienta. */
export async function decodeFull(file, info) {
  if (info.kind === 'cr3') {
    const bmp = await createImageBitmap(sliceBlob(file, info.full));
    return orient(bmp, info.exif.orientation);
  }
  return createImageBitmap(file); // el navegador aplica la orientación EXIF
}

/** Miniatura para la tira de película. */
export async function decodeThumb(file, info, size = 320) {
  const blob = info.kind === 'cr3' ? sliceBlob(file, info.small) : file;
  let bmp;
  try {
    bmp = await createImageBitmap(blob, { resizeWidth: size, resizeQuality: 'medium' });
  } catch {
    bmp = await createImageBitmap(blob);
  }
  if (info.kind === 'cr3') bmp = await orient(bmp, info.exif.orientation);
  const c = document.createElement('canvas');
  const s = size / Math.max(bmp.width, bmp.height);
  c.width = Math.round(bmp.width * Math.min(1, s));
  c.height = Math.round(bmp.height * Math.min(1, s));
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close();
  return c.toDataURL('image/jpeg', 0.8);
}

/** Reduce un mapa de bits (para la vista previa rápida) con buena calidad. */
export async function downscale(bitmap, maxSide) {
  const s = maxSide / Math.max(bitmap.width, bitmap.height);
  if (s >= 1) return bitmap;
  const w = Math.round(bitmap.width * s);
  const h = Math.round(bitmap.height * s);
  try {
    return await createImageBitmap(bitmap, { resizeWidth: w, resizeHeight: h, resizeQuality: 'high' });
  } catch {
    const c = new OffscreenCanvas(w, h);
    const ctx = c.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, 0, 0, w, h);
    return c.transferToImageBitmap();
  }
}

// ---------- EXIF en la exportación ----------

/** Copia el segmento APP1/EXIF del JPEG original. */
export function extractApp1(u8) {
  if (u8[0] !== 0xff || u8[1] !== 0xd8) return null;
  let p = 2;
  while (p + 4 < u8.length && u8[p] === 0xff) {
    const m = u8[p + 1];
    const len = (u8[p + 2] << 8) | u8[p + 3];
    if (m === 0xe1 && u8[p + 4] === 0x45 && u8[p + 5] === 0x78) {
      const seg = u8.slice(p, p + 2 + len);
      resetOrientation(seg);
      return seg;
    }
    if (m === 0xda) break;
    p += 2 + len;
  }
  return null;
}

// Los píxeles exportados ya están girados: la etiqueta Orientación debe ser 1.
function resetOrientation(seg) {
  const t = 10; // FF E1 len(2) "Exif\0\0"
  const dv = new DataView(seg.buffer, seg.byteOffset, seg.byteLength);
  const le = dv.getUint16(t) === 0x4949;
  const ifd = t + dv.getUint32(t + 4, le);
  const n = dv.getUint16(ifd, le);
  for (let i = 0; i < n; i++) {
    const e = ifd + 2 + i * 12;
    if (dv.getUint16(e, le) === 0x0112) dv.setUint16(e + 8, 1, le);
  }
}

/** Inserta un APP1 justo después del SOI de un JPEG exportado. */
export async function withExif(blob, app1) {
  if (!app1 || blob.type !== 'image/jpeg') return blob;
  const u8 = new Uint8Array(await blob.arrayBuffer());
  // El JPEG de canvas empieza con SOI + APP0 (JFIF); EXIF va después de SOI.
  return new Blob([u8.subarray(0, 2), app1, u8.subarray(2)], { type: 'image/jpeg' });
}
