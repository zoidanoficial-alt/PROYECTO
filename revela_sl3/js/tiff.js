// Lector mínimo de TIFF/EXIF. Sirve para el bloque APP1 de los JPEG y para
// las cajas CMT1/CMT2 de los CR3 de Canon (que son TIFF completos).

const TYPE_SIZE = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8, 11: 4, 12: 8 };

const TAGS = {
  0x010f: 'make',
  0x0110: 'model',
  0x0112: 'orientation',
  0x0132: 'dateTime',
  0x8769: 'exifIfd',
  0x829a: 'exposureTime',
  0x829d: 'fNumber',
  0x8822: 'exposureProgram',
  0x8827: 'iso',
  0x9003: 'dateTimeOriginal',
  0x9204: 'exposureBias',
  0x9207: 'meteringMode',
  0x9209: 'flash',
  0x920a: 'focalLength',
  0xa002: 'pixelWidth',
  0xa003: 'pixelHeight',
  0xa402: 'exposureMode',
  0xa403: 'whiteBalance',
  0xa431: 'bodySerial',
  0xa434: 'lensModel',
};

function readValue(dv, type, count, at, le) {
  const one = (o) => {
    switch (type) {
      case 1: case 7: return dv.getUint8(o);
      case 3: return dv.getUint16(o, le);
      case 4: return dv.getUint32(o, le);
      case 9: return dv.getInt32(o, le);
      case 5: { const d = dv.getUint32(o + 4, le); return d ? dv.getUint32(o, le) / d : 0; }
      case 10: { const d = dv.getInt32(o + 4, le); return d ? dv.getInt32(o, le) / d : 0; }
      case 11: return dv.getFloat32(o, le);
      case 12: return dv.getFloat64(o, le);
      default: return null;
    }
  };
  if (type === 2) {
    let s = '';
    for (let i = 0; i < count; i++) {
      const c = dv.getUint8(at + i);
      if (c === 0) break;
      s += String.fromCharCode(c);
    }
    return s.trim();
  }
  if (count === 1) return one(at);
  const size = TYPE_SIZE[type];
  const out = [];
  for (let i = 0; i < Math.min(count, 64); i++) out.push(one(at + i * size));
  return out;
}

function readIfd(dv, tiffStart, ifdOffset, le, out, depth) {
  const base = tiffStart + ifdOffset;
  if (depth > 3 || base + 2 > dv.byteLength) return;
  const n = dv.getUint16(base, le);
  for (let i = 0; i < n; i++) {
    const e = base + 2 + i * 12;
    if (e + 12 > dv.byteLength) return;
    const tag = dv.getUint16(e, le);
    const type = dv.getUint16(e + 2, le);
    const count = dv.getUint32(e + 4, le);
    const size = (TYPE_SIZE[type] || 0) * count;
    if (!size) continue;
    const at = size <= 4 ? e + 8 : tiffStart + dv.getUint32(e + 8, le);
    if (at + size > dv.byteLength) continue;
    const name = TAGS[tag];
    if (!name) continue;
    const value = readValue(dv, type, count, at, le);
    if (name === 'exifIfd') readIfd(dv, tiffStart, value, le, out, depth + 1);
    else if (out[name] === undefined) out[name] = value;
  }
}

/** Lee un TIFF que empieza en `start` dentro de `dv`. Devuelve {tag: valor}. */
export function parseTiff(dv, start = 0) {
  const out = {};
  try {
    const order = dv.getUint16(start, false);
    const le = order === 0x4949; // "II"
    if (!le && order !== 0x4d4d) return out;
    if (dv.getUint16(start + 2, le) !== 42) return out;
    readIfd(dv, start, dv.getUint32(start + 4, le), le, out, 0);
  } catch {
    // Archivo truncado o raro: devolvemos lo que se alcanzó a leer.
  }
  return out;
}

/** Recorre los marcadores de un JPEG: EXIF (APP1) y dimensiones (SOFn). */
export function parseJpeg(u8, offset = 0, end = u8.length) {
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  const info = { exif: {}, width: 0, height: 0 };
  if (u8[offset] !== 0xff || u8[offset + 1] !== 0xd8) return info;
  let p = offset + 2;
  while (p + 4 <= end) {
    if (u8[p] !== 0xff) { p++; continue; }
    const marker = u8[p + 1];
    if (marker === 0xff) { p++; continue; }
    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) { p += 2; continue; }
    const len = dv.getUint16(p + 2, false);
    const seg = p + 4;
    if (marker === 0xe1 && len > 8 &&
        u8[seg] === 0x45 && u8[seg + 1] === 0x78 && u8[seg + 2] === 0x69 && u8[seg + 3] === 0x66) {
      Object.assign(info.exif, parseTiff(dv, seg + 6));
    } else if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      info.height = dv.getUint16(seg + 1, false);
      info.width = dv.getUint16(seg + 3, false);
    }
    if (marker === 0xda || marker === 0xd9) break; // empieza la imagen comprimida
    p = seg + len - 2;
  }
  return info;
}
