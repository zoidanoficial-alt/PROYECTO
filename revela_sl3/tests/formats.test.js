import test from 'node:test';
import assert from 'node:assert/strict';
import { parseJpeg } from '../js/tiff.js';
import { parseCR3, isCR3 } from '../js/cr3.js';
import { tiff, fakeJpeg, fakeCR3 } from './helpers.js';

const exifTiff = tiff([
  [0x010f, 2, 'Canon'],
  [0x0110, 2, 'Canon EOS Rebel SL3'],
  [0x0112, 3, 6],
  [0x829a, 5, [1, 125]],
  [0x829d, 5, [80, 10]],
  [0x8827, 3, 200],
  [0x920a, 5, [55, 1]],
  [0xa434, 2, 'EF-S18-55mm f/4-5.6 IS STM'],
]);

test('JPEG: lee EXIF y dimensiones', () => {
  const jpg = new Uint8Array(fakeJpeg(6000, 4000, exifTiff));
  const info = parseJpeg(jpg);
  assert.equal(info.width, 6000);
  assert.equal(info.height, 4000);
  assert.equal(info.exif.make, 'Canon');
  assert.equal(info.exif.model, 'Canon EOS Rebel SL3');
  assert.equal(info.exif.orientation, 6);
  assert.equal(info.exif.exposureTime, 1 / 125);
  assert.equal(info.exif.fNumber, 8);
  assert.equal(info.exif.iso, 200);
  assert.equal(info.exif.focalLength, 55);
  assert.equal(info.exif.lensModel, 'EF-S18-55mm f/4-5.6 IS STM');
});

test('JPEG: datos basura no truenan', () => {
  const info = parseJpeg(new Uint8Array([1, 2, 3, 4, 5]));
  assert.deepEqual(info.exif, {});
});

test('CR3: extrae el JPEG de resolución completa y el EXIF', () => {
  const cmt1 = tiff([[0x010f, 2, 'Canon'], [0x0110, 2, 'Canon EOS 250D'], [0x0112, 3, 1]]);
  const cmt2 = tiff([[0x8827, 3, 1600], [0x829d, 5, [56, 10]], [0x829a, 5, [1, 30]], [0x920a, 5, [18, 1]]]);
  const full = fakeJpeg(6000, 4000, null, 4096);
  const prvw = fakeJpeg(1620, 1080, null, 512);
  const file = new Uint8Array(fakeCR3({ cmt1, cmt2, full, prvw }));
  assert.ok(isCR3(file));
  const r = parseCR3(file);
  assert.equal(r.jpeg.width, 6000);
  assert.equal(r.jpeg.height, 4000);
  assert.equal(r.jpeg.size, full.length);
  assert.deepEqual([...file.subarray(r.jpeg.offset, r.jpeg.offset + 2)], [0xff, 0xd8]);
  assert.ok(r.previews.some((p) => p.source === 'PRVW' && p.width === 1620));
  assert.equal(r.exif.model, 'Canon EOS 250D');
  assert.equal(r.exif.iso, 1600);
  assert.equal(r.exif.fNumber, 5.6);
  assert.equal(r.exif.focalLength, 18);
});

test('CR3: rechaza archivos que no son CR3', () => {
  assert.throws(() => parseCR3(new Uint8Array(fakeJpeg(10, 10))), /CR3/);
});
