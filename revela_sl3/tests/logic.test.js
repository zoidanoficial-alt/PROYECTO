import test from 'node:test';
import assert from 'node:assert/strict';
import { curveLut } from '../js/curve.js';
import {
  wbMultipliers, wbFromNeutral, toneStats, sharpness, noiseSigma, analyze, autoTone,
} from '../js/analysis.js';
import { advise, speechText } from '../js/advisor.js';
import { fitCrop, inside, withAspect, maxCrop } from '../js/crop.js';
import { clampToSliders, defaultParams, presetParams, PRESETS, applyPatch } from '../js/params.js';
import { isSL3, detectSize, formatShutter } from '../js/sl3.js';
import { image, rng } from './helpers.js';

test('curva: identidad y monotonía', () => {
  const id = curveLut([[0, 0], [1, 1]], 11);
  for (let i = 0; i < 11; i++) assert.ok(Math.abs(id[i] - i / 10) < 1e-6);
  const s = curveLut([[0, 0], [0.25, 0.1], [0.75, 0.95], [1, 1]], 256);
  for (let i = 1; i < 256; i++) assert.ok(s[i] >= s[i - 1] - 1e-6, `no monótona en ${i}`);
});

test('balance de blancos: el gotero neutraliza el color muestreado', () => {
  const toLin = (v) => ((v / 255) <= 0.04045 ? v / 255 / 12.92 : ((v / 255 + 0.055) / 1.055) ** 2.4);
  for (const rgb of [[230, 210, 170], [180, 200, 230], [200, 220, 200]]) {
    const wb = wbFromNeutral(...rgb);
    const m = wbMultipliers(wb.temperature, wb.tint);
    const out = rgb.map((v, i) => toLin(v) * m[i]);
    const spread = (Math.max(...out) - Math.min(...out)) / Math.max(...out);
    assert.ok(spread < 0.03, `${rgb} -> ${out} (${JSON.stringify(wb)})`);
  }
  assert.deepEqual(wbMultipliers(0, 0).map((v) => +v.toFixed(6)), [1, 1, 1]);
});

test('análisis: tonos, luces quemadas y exposición automática', () => {
  const dark = image(64, 64, (x) => [x, x, x]);
  const t = toneStats(dark);
  assert.ok(t.mean < 0.2);
  assert.equal(t.clipHigh, 0);
  assert.ok(autoTone(t).exposure > 0.5);

  const blown = image(64, 64, (x) => (x < 32 ? [255, 255, 255] : [200, 200, 200]));
  const b = toneStats(blown);
  assert.ok(b.clipHigh > 0.4);
  const p = autoTone(b);
  assert.ok(p.exposure <= 0);
  assert.ok(p.highlights < 0);
});

test('análisis: nitidez distingue foto enfocada de desenfocada', () => {
  const sharp = image(120, 120, (x, y) => ((Math.floor(x / 3) + Math.floor(y / 3)) % 2 ? [220, 220, 220] : [40, 40, 40]));
  const soft = image(120, 120, (x) => { const v = 128 + 60 * Math.sin(x / 15); return [v, v, v]; });
  assert.ok(sharpness(sharp).best > 10 * sharpness(soft).best);
});

test('análisis: ruido mayor en imagen ruidosa', () => {
  const r = rng(7);
  const clean = image(100, 100, () => [128, 128, 128]);
  const noisy = image(100, 100, () => { const v = 128 + (r() - 0.5) * 30; return [v, v, v]; });
  assert.ok(noiseSigma(clean) < 0.5);
  assert.ok(noiseSigma(noisy) > 3);
});

test('asesor: detecta problemas típicos de la SL3', () => {
  const r = rng(3);
  const img = image(120, 80, () => { const v = 120 + (r() - 0.5) * 40; return [v + 20, v, v - 20]; });
  const res = advise({
    exif: { make: 'Canon', model: 'Canon EOS Rebel SL3', iso: 3200, fNumber: 16, exposureTime: 1 / 15, focalLength: 18 },
    analysis: analyze(img), subject: 'blanco', fileSize: 1_000_000, fileType: 'jpeg', width: 3984, height: 2656,
  });
  const titles = res.items.map((i) => i.title).join(' | ');
  assert.match(titles, /tamaño M/);
  assert.match(titles, /ISO 3200/);
  assert.match(titles, /difracción/);
  assert.match(titles, /18 mm/);
  assert.match(titles, /pulso/);
  assert.ok(res.patch.nrLuma >= 38);
  assert.ok(res.score < 60);
  assert.equal(res.camera, 'Canon EOS Rebel SL3 / 250D');
  assert.ok(speechText(res).startsWith('Calificación'));
  // Los parches del asesor siempre caen dentro de los rangos de los controles.
  assert.deepEqual(clampToSliders(res.patch), Object.fromEntries(
    Object.entries(res.patch).map(([k, v]) => [k, clampToSliders({ [k]: v })[k]]),
  ));
});

test('asesor: foto correcta obtiene buena calificación', () => {
  const img = image(120, 80, (x, y) => ((Math.floor(x / 2) + Math.floor(y / 2)) % 2 ? [200, 200, 200] : [90, 90, 90]));
  const res = advise({
    exif: { model: 'Canon EOS 250D', iso: 100, fNumber: 8, exposureTime: 1 / 4, focalLength: 55 },
    analysis: analyze(img), subject: 'blanco', fileSize: 25_000_000, fileType: 'cr3', width: 6000, height: 4000,
  });
  assert.ok(!res.items.some((i) => i.level === 'alerta'), JSON.stringify(res.items.filter((i) => i.level === 'alerta')));
});

test('recorte: al enderezar no quedan esquinas vacías', () => {
  for (const angle of [-30, -5, 0, 7.5, 44]) {
    const c = maxCrop(angle, 3 / 2, 3000, 2000);
    for (const [u, v] of [[c.x, c.y], [c.x + c.w, c.y], [c.x, c.y + c.h], [c.x + c.w, c.y + c.h]]) {
      assert.ok(inside(u, v, 3000, 2000, angle), `ángulo ${angle}`);
    }
    assert.ok(Math.abs((c.w * 3000) / (c.h * 2000) - 1.5) < 0.01);
  }
  assert.deepEqual(maxCrop(0, null, 300, 200), { x: 0, y: 0, w: 1, h: 1, angle: 0 });
  const sq = withAspect({ x: 0, y: 0, w: 1, h: 1, angle: 0 }, 1, 3000, 2000);
  assert.ok(Math.abs(sq.w * 3000 - sq.h * 2000) < 1);
  const f = fitCrop({ x: 0.9, y: 0.9, w: 0.5, h: 0.5, angle: 0 }, 100, 100);
  assert.ok(f.x + f.w <= 1 && f.y + f.h <= 1);
});

test('ajustes: preestablecidos conservan el recorte; valores fuera de rango se limitan', () => {
  const cur = applyPatch(defaultParams(), { crop: { x: 0.1, y: 0.1, w: 0.5, h: 0.5 }, rotate: 1, exposure: 2 });
  const p = presetParams(cur, PRESETS[0]);
  assert.equal(p.crop.x, 0.1);
  assert.equal(p.rotate, 1);
  assert.equal(p.exposure, PRESETS[0].patch.exposure);
  assert.deepEqual(clampToSliders({ exposure: 9, contrast: -500, nope: 3, texture: 'x', sharpenRadius: 0.83 }),
    { exposure: 5, contrast: -100, sharpenRadius: 0.8 });
});

test('SL3: detección de modelo, tamaño y velocidad', () => {
  assert.ok(isSL3({ make: 'Canon', model: 'Canon EOS Kiss X10' }));
  assert.ok(isSL3({ model: 'Canon EOS 200D II' }));
  assert.ok(!isSL3({ model: 'Canon EOS Rebel SL2' }));
  assert.equal(detectSize(6000, 4000), 'L');
  assert.equal(detectSize(2656, 3984), 'M');
  assert.equal(detectSize(1000, 800), null);
  assert.equal(formatShutter(1 / 250), '1/250');
  assert.equal(formatShutter(2), '2"');
});

test('huevo blanco sobre fondo crema: auto no oscurece y el BB usa el cascarón', async () => {
  const { colorCast } = await import('../js/analysis.js');
  // Fondo crema (intencional) con un huevo blanco casi neutro al centro.
  const img = image(120, 80, (x, y) => (((x - 60) / 25) ** 2 + ((y - 40) / 32) ** 2 < 1 ? [248, 246, 242] : [236, 226, 205]));
  const p = autoTone(toneStats(img));
  assert.ok(p.exposure >= 0, `exposición ${p.exposure}`);
  assert.equal(p.blacks, 0);
  const c = colorCast(img);
  assert.ok(Math.abs(c.temperature) < 12, `temperatura ${c.temperature}`); // el fondo daría ~ -30
});
