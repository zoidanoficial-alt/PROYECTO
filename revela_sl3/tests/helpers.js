// Constructores de archivos sintéticos para las pruebas.

/** TIFF little-endian con un IFD. entries: [tag, type, value] (2=ASCII, 3=SHORT, 5=RATIONAL). */
export function tiff(entries) {
  const head = 8;
  const ifdSize = 2 + entries.length * 12 + 4;
  const extra = [];
  let extraOff = head + ifdSize;
  const ifd = [];
  for (const [tag, type, value] of entries) {
    let count;
    let inline = null;
    let data = null;
    if (type === 2) {
      data = Buffer.from(`${value}\0`, 'latin1');
      count = data.length;
      if (count <= 4) { inline = Buffer.alloc(4); data.copy(inline); data = null; }
    } else if (type === 3) {
      count = 1;
      inline = Buffer.alloc(4);
      inline.writeUInt16LE(value);
    } else if (type === 4) {
      count = 1;
      inline = Buffer.alloc(4);
      inline.writeUInt32LE(value);
    } else if (type === 5) {
      count = 1;
      data = Buffer.alloc(8);
      const [n, d] = value;
      data.writeUInt32LE(n);
      data.writeUInt32LE(d, 4);
    }
    const e = Buffer.alloc(12);
    e.writeUInt16LE(tag);
    e.writeUInt16LE(type, 2);
    e.writeUInt32LE(count, 4);
    if (inline) inline.copy(e, 8);
    else {
      e.writeUInt32LE(extraOff, 8);
      extra.push(data);
      extraOff += data.length + (data.length % 2);
      if (data.length % 2) extra.push(Buffer.alloc(1));
    }
    ifd.push(e);
  }
  const h = Buffer.from([0x49, 0x49, 42, 0, 8, 0, 0, 0]);
  const n = Buffer.alloc(2);
  n.writeUInt16LE(entries.length);
  return Buffer.concat([h, n, ...ifd, Buffer.alloc(4), ...extra]);
}

/** JPEG mínimo (no decodificable, pero con marcadores válidos). */
export function fakeJpeg(width, height, exifTiff = null, payload = 64) {
  const parts = [Buffer.from([0xff, 0xd8])];
  if (exifTiff) {
    const body = Buffer.concat([Buffer.from('Exif\0\0', 'latin1'), exifTiff]);
    const len = Buffer.alloc(2);
    len.writeUInt16BE(body.length + 2);
    parts.push(Buffer.from([0xff, 0xe1]), len, body);
  }
  const sof = Buffer.from([0xff, 0xc0, 0, 17, 8, 0, 0, 0, 0, 3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1]);
  sof.writeUInt16BE(height, 5);
  sof.writeUInt16BE(width, 7);
  parts.push(sof, Buffer.from([0xff, 0xda, 0, 2]), Buffer.alloc(payload, 0x55), Buffer.from([0xff, 0xd9]));
  return Buffer.concat(parts);
}

export function box(type, ...children) {
  const body = Buffer.concat(children);
  const h = Buffer.alloc(8);
  h.writeUInt32BE(body.length + 8);
  h.write(type, 4, 'latin1');
  return Buffer.concat([h, body]);
}

export function uuidBox(uuidHex, ...children) {
  return box('uuid', Buffer.from(uuidHex, 'hex'), ...children);
}

/** CR3 sintético: CMT1/CMT2 + una pista con JPEG completo + PRVW. */
export function fakeCR3({ cmt1, cmt2, full, prvw }) {
  const ftyp = box('ftyp', Buffer.from('crx \0\0\0\x01crx isom', 'latin1'));
  const prvwBox = uuidBox('eaf42b5e1c984b88b9fbb7dc406e4d16', Buffer.alloc(8), box('PRVW', Buffer.alloc(14), prvw));
  const makeMoov = (offset) => {
    const stsz = box('stsz', Buffer.from([0, 0, 0, 0]), u32(full.length), u32(1));
    const co64 = box('co64', Buffer.from([0, 0, 0, 0]), u32(1), u64(offset));
    const trak = box('trak', box('mdia', box('minf', box('stbl', box('stsd', Buffer.alloc(8)), stsz, co64))));
    const canon = uuidBox('85c0b687820f11e08111f4ce462b6a48', box('CMT1', cmt1), box('CMT2', cmt2));
    return box('moov', canon, trak);
  };
  const pre = Buffer.concat([ftyp, makeMoov(0), prvwBox]);
  const mdatOffset = pre.length + 8;
  const moov = makeMoov(mdatOffset);
  const head = Buffer.concat([ftyp, moov, prvwBox]);
  if (head.length !== pre.length) throw new Error('tamaño inesperado');
  return Buffer.concat([head, box('mdat', full)]);
}

function u32(v) { const b = Buffer.alloc(4); b.writeUInt32BE(v); return b; }
function u64(v) { const b = Buffer.alloc(8); b.writeBigUInt64BE(BigInt(v)); return b; }

/** Imagen RGBA sintética. fn(x, y) -> [r, g, b]. */
export function image(width, height, fn) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [r, g, b] = fn(x, y);
      const i = (y * width + x) * 4;
      data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = 255;
    }
  }
  return { data, width, height };
}

/** Pseudoaleatorio determinista. */
export function rng(seed = 1) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
