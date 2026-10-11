// Lector de archivos CR3 (RAW de la Canon EOS Rebel SL3 / 200D II / Kiss X10).
//
// El CR3 es un contenedor ISO-BMFF (como un MP4). Dentro trae:
//   moov/uuid(85c0b687…) -> CMT1 (IFD0), CMT2 (EXIF), THMB (miniatura)
//   uuid(eaf42b5e…)      -> PRVW: vista previa JPEG de 1620x1080
//   trak #1              -> JPEG a resolución completa (6000x4000) en mdat
//   trak #2..            -> datos RAW (CRX) y metadatos
// Aquí extraemos el JPEG más grande y el EXIF. Ese JPEG es el revelado que
// hizo la propia cámara (Estilo de imagen, balance de blancos, ALO…), así que
// se edita con la calidad de un JPEG "Fino" de 24 MP.

import { parseTiff, parseJpeg } from './tiff.js';

const CANON_UUID = '85c0b687820f11e08111f4ce462b6a48';
const PRVW_UUID = 'eaf42b5e1c984b88b9fbb7dc406e4d16';

const hex = (u8, a, b) => Array.from(u8.subarray(a, b), (x) => x.toString(16).padStart(2, '0')).join('');
const fourcc = (u8, a) => String.fromCharCode(u8[a], u8[a + 1], u8[a + 2], u8[a + 3]);

export function isCR3(u8) {
  return u8.length > 12 && fourcc(u8, 4) === 'ftyp' && fourcc(u8, 8) === 'crx ';
}

function* boxes(u8, dv, start, end) {
  let p = start;
  while (p + 8 <= end) {
    let size = dv.getUint32(p, false);
    const type = fourcc(u8, p + 4);
    let header = 8;
    if (size === 1) {
      size = Number(dv.getBigUint64(p + 8, false));
      header = 16;
    } else if (size === 0) {
      size = end - p;
    }
    if (size < header || p + size > end) return;
    let uuid = null;
    if (type === 'uuid') {
      uuid = hex(u8, p + header, p + header + 16);
      header += 16;
    }
    yield { type, uuid, start: p, body: p + header, end: p + size };
    p += size;
  }
}

function find(u8, dv, box, path) {
  let cur = [box];
  for (const name of path) {
    const next = [];
    for (const b of cur) for (const c of boxes(u8, dv, b.body, b.end)) if (c.type === name) next.push(c);
    cur = next;
  }
  return cur;
}

function jpegAt(u8, offset, size) {
  if (offset + 3 > u8.length || u8[offset] !== 0xff || u8[offset + 1] !== 0xd8) return null;
  const end = Math.min(u8.length, offset + size);
  const { width, height } = parseJpeg(u8, offset, end);
  return { offset, size: end - offset, width, height };
}

function trackJpeg(u8, dv, trak) {
  const [stsz] = find(u8, dv, trak, ['mdia', 'minf', 'stbl', 'stsz']);
  const co = find(u8, dv, trak, ['mdia', 'minf', 'stbl', 'co64'])[0] ||
    find(u8, dv, trak, ['mdia', 'minf', 'stbl', 'stco'])[0];
  if (!stsz || !co) return null;
  let size = dv.getUint32(stsz.body + 4, false);
  if (size === 0) size = dv.getUint32(stsz.body + 12, false);
  const offset = co.type === 'co64'
    ? Number(dv.getBigUint64(co.body + 8, false))
    : dv.getUint32(co.body + 8, false);
  return jpegAt(u8, offset, size);
}

function scanJpeg(u8, from, to) {
  for (let i = from; i < to - 3; i++) {
    if (u8[i] === 0xff && u8[i + 1] === 0xd8 && u8[i + 2] === 0xff) return jpegAt(u8, i, to - i);
  }
  return null;
}

/**
 * @param {ArrayBuffer|Uint8Array} input
 * @returns {{jpeg: {offset,size,width,height}|null, previews: Array, exif: object}}
 */
export function parseCR3(input) {
  const u8 = input instanceof Uint8Array ? input : new Uint8Array(input);
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  if (!isCR3(u8)) throw new Error('No es un archivo CR3 de Canon');

  const exif = {};
  const previews = [];
  for (const top of boxes(u8, dv, 0, u8.length)) {
    if (top.type === 'moov') {
      for (const b of boxes(u8, dv, top.body, top.end)) {
        if (b.type === 'uuid' && b.uuid === CANON_UUID) {
          for (const c of boxes(u8, dv, b.body, b.end)) {
            if (/^CMT[12]$/.test(c.type)) {
              const tags = parseTiff(dv, c.body);
              for (const k in tags) if (exif[k] === undefined) exif[k] = tags[k];
            } else if (c.type === 'THMB') {
              const j = scanJpeg(u8, c.body, c.end);
              if (j) previews.push({ ...j, source: 'THMB' });
            }
          }
        } else if (b.type === 'trak') {
          const j = trackJpeg(u8, dv, b);
          if (j) previews.push({ ...j, source: 'trak' });
        }
      }
    } else if (top.type === 'uuid' && top.uuid === PRVW_UUID) {
      const j = scanJpeg(u8, top.body, top.end);
      if (j) previews.push({ ...j, source: 'PRVW' });
    }
  }
  previews.sort((a, b) => b.width * b.height - a.width * a.height || b.size - a.size);
  return { jpeg: previews[0] || null, previews, exif };
}
