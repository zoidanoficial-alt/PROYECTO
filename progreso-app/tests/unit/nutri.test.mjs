// Pruebas unitarias del motor nutricional (funciones puras de foods.js y nutri.js).
// Uso: node tests/unit/nutri.test.mjs
import fs from 'node:fs'; import vm from 'node:vm'; import assert from 'node:assert/strict';
const www = new URL('../../assets/www/', import.meta.url);
const ctx = { window: { addEventListener() {} }, console, Math, Date, Number, Object, Array, JSON, isFinite,
  parseDate: s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); },
  shortDate: s => s, fmt: (v, d) => Number(v).toFixed(d == null ? 1 : d) };
vm.createContext(ctx);
for (const f of ['foods.js', 'nutri.js']) vm.runInContext(fs.readFileSync(new URL(f, www), 'utf8').replace(/^'use strict';/, ''), ctx, { filename: f });
const run = (code) => vm.runInContext(code, ctx);
let n = 0; const test = (name, fn) => { fn(); n++; console.log('ok  ' + name); };
const base = { sex: 'm', kg: 80, cm: 178, age: 32, af: 'mod', exp: 'intermedio', minWeek: 240, adj: 0 };
const calc = o => run(`nCalc(${JSON.stringify({ ...base, ...o })})`);

test('Mifflin-St Jeor: hombre 80 kg, 178 cm, 32 años = 1757.5 kcal', () => assert.equal(run('nBmr("m", 80, 178, 32)'), 1757.5));
test('Mifflin-St Jeor: mujer resta 161', () => assert.equal(run('nBmr("f", 60, 165, 30)'), 1320.25));
test('Mantenimiento = BMR × 1.55 y proteína 1.6 g/kg', () => { const r = calc({ mode: 'mantener' }); assert.equal(r.tdee, Math.round(1757.5 * 1.55)); assert.equal(r.protein, 128); assert.equal(r.delta, 0); });
test('Volumen: superávit 5–15 % del gasto y proteína 1.8 g/kg', () => { const r = calc({ mode: 'volumen' }); assert.ok(r.delta >= r.tdee * 0.05 - 1 && r.delta <= r.tdee * 0.15 + 1, 'delta ' + r.delta); assert.equal(r.protein, 144); assert.equal(r.rate, 0.3); });
test('Volumen avanzado gana más lento que principiante', () => assert.ok(calc({ mode: 'volumen', exp: 'avanzado' }).delta <= calc({ mode: 'volumen', exp: 'principiante' }).delta));
test('Definición: déficit ≤ 25 % y ritmo limitado a 0.5–1 %/sem', () => { const r = calc({ mode: 'definicion', rate: 3 }); assert.equal(r.rate, 1); assert.ok(-r.delta <= r.tdee * 0.25 + 1); });
test('Definición con masa magra: proteína 2.6 g/kg de masa magra', () => assert.equal(calc({ mode: 'definicion', lbm: 65 }).protein, 169));
test('Piso de seguridad: nunca por debajo del basal ni de 1500 (H) / 1200 (M)', () => { const r = calc({ mode: 'definicion', adj: -2000 }); assert.ok(r.kcal >= r.bmr && r.floored); const f = run(`nCalc(${JSON.stringify({ ...base, sex: 'f', kg: 45, cm: 150, age: 60, af: 'sed', mode: 'definicion', adj: -900 })})`); assert.ok(f.kcal >= 1200); });
test('Grasa nunca por debajo de 0.6 g/kg', () => { const r = calc({ mode: 'definicion' }); assert.ok(r.fat >= 48); });
test('Macros suman las calorías (±25 kcal)', () => { for (const mode of ['volumen', 'definicion', 'recomp', 'mantener']) { const r = calc({ mode }); assert.ok(Math.abs(r.protein * 4 + r.carbs * 4 + r.fat * 9 - r.kcal) <= 25, mode); } });
test('Rendimiento: carbohidratos por carga (ACSM 2016)', () => { assert.equal(calc({ mode: 'rend', minWeek: 100 }).carbs, 320); assert.equal(calc({ mode: 'rend', minWeek: 600 }).carbs, 560); const r = calc({ mode: 'rend', minWeek: 600 }); assert.ok(r.fat * 9 / r.kcal >= 0.19); });
test('Recomposición con grasa alta: −10 %; sin grasa alta: mantenimiento', () => { assert.equal(calc({ mode: 'recomp' }).delta, 0); assert.equal(calc({ mode: 'recomp', highFat: true }).delta, Math.round(-calc({ mode: 'recomp' }).tdee * 0.1)); });
test('Calibración: mezcla el gasto observado (≤70 %) e ignora datos absurdos', () => { const r = calc({ mode: 'mantener', tdeeObs: { v: 3000, w: 0.5 } }); assert.equal(r.tdee, Math.round(r.tdeeEq * 0.5 + 1500)); assert.equal(calc({ mode: 'mantener', tdeeObs: { v: 9000, w: 0.5 } }).calib, null); });
test('Tendencia: regresión lineal de pesos', () => { const pts = Array.from({ length: 15 }, (_, i) => ({ date: `2026-11-${String(i + 1).padStart(2, '0')}`, w: 80 - i * 0.08 })); const t = run(`nTrendOf(${JSON.stringify(pts)})`); assert.ok(Math.abs(t.perWeek + 0.56) < 0.01); assert.ok(t.pctWeek < -0.6 && t.pctWeek > -0.8); });
const adv = o => run(`nAdviceFrom(${JSON.stringify(Object.assign({ mode: 'definicion', targetRate: -0.7, adh: { pct: 90, onKcal: 80 }, waist: null, str: null, sleepLow: false, rhrUp: false, daysInPhase: 28, daysSinceAdj: null, kg: 80 }, o))})`);
const tr = pct => ({ pctWeek: pct, perWeek: pct * 0.8, n: 12 });
test('Adaptación: nunca decide con menos de 14 días', () => assert.equal(adv({ daysInPhase: 6, trend: tr(0) }).st, 'wait'));
test('Adaptación: sin suficientes pesajes, espera', () => assert.equal(adv({ trend: { pctWeek: 0, n: 3 } }).st, 'wait'));
test('Definición a buen ritmo: mantener', () => assert.equal(adv({ trend: tr(-0.7) }).st, 'ok'));
test('Definición demasiado rápida: subir calorías', () => { const a = adv({ trend: tr(-1.5) }); assert.equal(a.st, 'adjust'); assert.ok(a.delta > 0); });
test('Estancamiento con mala adherencia: revisar registros, no recortar', () => { const a = adv({ trend: tr(0), adh: { pct: 50, onKcal: 40 } }); assert.equal(a.st, 'check'); assert.equal(a.delta, 0); });
test('Estancamiento de 2 semanas: espera (puede ser agua)', () => assert.equal(adv({ trend: tr(0), daysInPhase: 16 }).st, 'wait'));
test('Estancamiento real: propone, no aplica', () => { const a = adv({ trend: tr(0) }); assert.equal(a.st, 'adjust'); assert.ok(a.delta < 0 && a.delta >= -150); });
test('No ajusta de nuevo antes de 14 días del último ajuste', () => assert.equal(adv({ trend: tr(-1.5), daysSinceAdj: 5 }).delta, 0));
test('Volumen: sube demasiado rápido → bajar superávit', () => assert.ok(adv({ mode: 'volumen', targetRate: 0.3, trend: tr(0.8) }).delta < 0));
test('Volumen: no sube con buena adherencia → +125', () => assert.equal(adv({ mode: 'volumen', targetRate: 0.3, trend: tr(0.02) }).delta, 125));
test('Volumen: sube peso pero no fuerza → revisar entreno', () => assert.equal(adv({ mode: 'volumen', targetRate: 0.3, trend: tr(0.3), str: { d: -1 } }).st, 'check'));
test('Recomposición: cintura baja con peso estable = éxito', () => assert.equal(adv({ mode: 'recomp', trend: tr(0.05), waist: { delta: -1.2, baseDate: 'x' } }).st, 'ok'));
test('Rendimiento: pierde peso sin buscarlo → más energía', () => assert.ok(adv({ mode: 'rend', trend: tr(-0.8) }).delta > 0));
test('Alimentos: macros por gramos y búsqueda sin acentos', () => { const m = run('nfMacros("pollo", 150)'); assert.equal(m.kcal, 248); assert.equal(m.p, 46.5); assert.ok(run('nfSearch("platano").length') >= 1); assert.ok(run('nfSearch("arroz cocido").every(f => f[7] === "cocido")')); });
test('Base de alimentos: kcal coherentes con 4/4/9 (±15 %)', () => { const bad = run('NF.filter(f => { const k = f[3] * 4 + f[4] * 4 + f[5] * 9; return Math.abs(k - f[2]) > Math.max(20, f[2] * 0.15); }).map(f => f[0])'); assert.deepEqual([...bad], []); });
console.log(`\n${n} pruebas OK`);
