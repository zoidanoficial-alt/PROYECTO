// Pruebas del módulo «Revelado» (node tests/develop.test.js)
const C = require('../web/eg-core.js'), D = require('../web/eg-develop.js');
let fails = 0;
function check(name, cond, extra) { console.log((cond ? 'ok ' : 'MAL') + ' ' + name + (extra !== undefined ? '  ' + extra : '')); if (!cond) fails++; }
function photo(w, h) {
  const a = C.img(w, h, 3);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const j = (y * w + x) * 3, u = x / w, v = y / h;
    a.d[j] = 0.15 + 0.7 * u; a.d[j + 1] = 0.2 + 0.5 * v; a.d[j + 2] = 0.6 - 0.4 * u * v;
    if ((x - w / 2) ** 2 + (y - h / 2) ** 2 < (h / 5) ** 2) { a.d[j] = 0.85; a.d[j + 1] = 0.6; a.d[j + 2] = 0.45; }
  }
  return a;
}
const ctx = (a) => new C.Context(a.h, a.w, 1, [0, 0, 1, 1], 1, [a.w, a.h]);
const mean = (a, c) => { let s = 0; for (let i = c; i < a.d.length; i += 3) s += a.d[i]; return s / (a.d.length / 3); };
const lum = (a) => mean(a, 0) * C.LR + mean(a, 1) * C.LG + mean(a, 2) * C.LB;
const dev = (o) => Object.assign(D.defaults(), o);
const run = (o, a) => { a = a || photo(160, 120); return { a, b: D.develop(a, dev(o), ctx(a)) }; };
const mad = (x, y) => { let s = 0; for (let i = 0; i < x.d.length; i++) s += Math.abs(x.d[i] - y.d[i]); return s / x.d.length; };

check('ajustes por defecto = neutro', D.isNeutral(D.defaults()));
let r = run({});
check('revelado neutro no cambia la imagen', mad(r.a, r.b) < 1e-5, mad(r.a, r.b).toExponential(2));
r = run({ exposure: 1 }); check('exposición +1 aclara', lum(r.b) > lum(r.a) + 0.08, lum(r.b).toFixed(3) + ' vs ' + lum(r.a).toFixed(3));
r = run({ exposure: -1 }); check('exposición -1 oscurece', lum(r.b) < lum(r.a) - 0.08);
r = run({ temp: 60 }); check('temperatura + calienta (más rojo que azul)', mean(r.b, 0) - mean(r.b, 2) > mean(r.a, 0) - mean(r.a, 2) + 0.03);
r = run({ temp: 60 }); check('el balance de blancos conserva el brillo', Math.abs(lum(r.b) - lum(r.a)) < 0.03, (lum(r.b) - lum(r.a)).toFixed(3));
const gx = (a) => mean(a, 1) - (mean(a, 0) + mean(a, 2)) / 2;
r = run({ tint: 60 }); check('matiz + añade magenta (verde relativo baja)', gx(r.b) < gx(r.a) - 0.02, (gx(r.b) - gx(r.a)).toFixed(3));
r = run({ highlights: -100 }); check('iluminaciones -100 bajan las luces', mean(r.b, 0) < mean(r.a, 0));
r = run({ shadows: 100 }); check('sombras +100 aclaran', lum(r.b) > lum(r.a));
r = run({ saturation: -100 }); check('saturación -100 da gris', Math.abs(r.b.d[300] - r.b.d[301]) < 0.01 && Math.abs(r.b.d[301] - r.b.d[302]) < 0.01);
r = run({ contrast: 80 }); check('contraste + aumenta la desviación', C.std(r.b.d) > C.std(r.a.d));
const hsl = D.defaults().hsl; hsl.blue = { h: 0, s: -100, l: 0 };
r = run({ hsl });
const a0 = r.a, b0 = r.b, j0 = 3 * (5 * 160 + 3), jc = 3 * (60 * 160 + 80);
check('HSL azul -100 desatura los azules', Math.abs(b0.d[j0 + 2] - b0.d[j0]) < Math.abs(a0.d[j0 + 2] - a0.d[j0]));
check('HSL azul no toca la piel', Math.abs(b0.d[jc] - a0.d[jc]) < 0.01);
r = run({ curve: Object.assign(D.defaults().curve, { rgb: [[0, 0], [0.5, 0.65], [1, 1]] }) }); check('curva con punto alto aclara medios', lum(r.b) > lum(r.a) + 0.04);
r = run({ gs_sat: 80, gs_hue: 220 }); check('gradación: sombras azuladas', mean(r.b, 2) > mean(r.a, 2));
r = run({ dehaze: 60 }); check('neblina + aumenta contraste', C.std(r.b.d) > C.std(r.a.d));
r = run({ clarity: 80 }); check('claridad cambia la imagen', mad(r.a, r.b) > 0.001, mad(r.a, r.b).toFixed(4));
r = run({ nr_luma: 80, nr_color: 80 }); check('reducción de ruido sin NaN', r.b.d.every(Number.isFinite));
r = run({ sharp: 120 }); check('enfoque cambia la imagen', mad(r.a, r.b) > 0.0005);
r = run({ vig: -80 }); check('viñeta oscurece la esquina', r.b.d[0] < r.a.d[0] - 0.05);
r = run({ aspect: '1:1' }); check('recorte 1:1 cuadrado', r.b.w === r.b.h && r.b.w === 120, r.b.w + '×' + r.b.h);
r = run({ angle: 10 }); check('enderezar recorta sin bordes vacíos', r.b.w < 160 && r.b.h < 120 && r.b.d.every((v) => v >= 0 && v <= 1), r.b.w + '×' + r.b.h);
// todo junto: sin valores fuera de rango
r = run({ exposure: 2, contrast: 100, highlights: -100, shadows: 100, whites: 100, blacks: -100, texture: 100, clarity: 100,
  dehaze: 100, vibrance: 100, saturation: 100, gs_sat: 100, gh_sat: 100, sharp: 150, nr_luma: 100, nr_color: 100, vig: 100, grain: 100, angle: -30 });
check('extremos: valores finitos y en [0,1]', r.b.d.every((v) => Number.isFinite(v) && v >= 0 && v <= 1));
const au = D.auto(photo(160, 120)); check('Auto devuelve ajustes válidos', Math.abs(au.exposure) <= 2 && au.vibrance === 15, JSON.stringify({ e: au.exposure, c: au.contrast, w: au.whites, b: au.blacks }));
// rendimiento a 900 px con muchos controles
const big = photo(900, 600), t0 = Date.now();
D.develop(big, dev({ exposure: 0.5, contrast: 30, highlights: -40, shadows: 40, clarity: 30, texture: 20, vibrance: 20, gs_sat: 30, nr_color: 25, sharp: 40 }), ctx(big));
console.log('revelado completo a 900 px: ' + (Date.now() - t0) + ' ms');
console.log(fails ? fails + ' fallos' : 'todo correcto');
process.exit(fails ? 1 : 0);
