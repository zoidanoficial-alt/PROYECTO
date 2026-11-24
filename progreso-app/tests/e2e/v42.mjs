import { chromium } from 'playwright';
const D = './';
const b = await chromium.launch(); const page = await (await b.newContext({ viewport: { width: 393, height: 851 }, deviceScaleFactor: 2 })).newPage(); await page.addInitScript(() => { window.MP_DEFAULT_PLAN = 'gym'; });
const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
page.on('dialog', d => d.accept());
const pause = ms => new Promise(r => setTimeout(r, ms));
await page.clock.install({ time: new Date('2026-11-20T10:00:00') });
await page.goto('http://127.0.0.1:8765/index.html');
const R = {};
await page.fill('#ob-name', 'Daniel'); for (let k = 0; k < 6; k++) await page.click('#ob-next');
await page.click('[data-ch="level|avanzado"]'); await page.click('#ob-next');
await page.clock.runFor(900); for (let i = 0; i < 4; i++) await page.click('#gd-next'); await page.clock.runFor(2600);
// Hoy invita al proyecto antes de activarlo
await page.click('#tabs [data-tab=home]'); await page.clock.runFor(300);
R.cta = await page.evaluate(() => (document.querySelector('.ath-cta') || {}).innerText);
await page.evaluate(() => document.querySelectorAll('#view-home details').forEach(d => d.open = true)); await page.click('#ath-open'); await page.clock.runFor(200);
await page.fill('#as-age', '32'); await page.selectOption('#as-goal', 'ag'); await page.click('#as-s'); await page.clock.runFor(300);
R.empty = await page.evaluate(() => ({ caps: athCapacities().map(c => c.k + ':' + (c.show || 'sin medir')), plan: (({ years, cur, week }) => ({ years, cur, week }))(athPlan()) }));
await pause(400); await page.screenshot({ path: D + 'v42-atleta-vacio.png' });
await page.evaluate(() => closeModal());
// Fórmulas
R.vdot5k20 = await page.evaluate(() => Math.round(vdot(5000, 1200) * 10) / 10);   // Daniels: ~49.8
R.vdot10k42 = await page.evaluate(() => Math.round(vdot(10000, 2520) * 10) / 10);  // ~48.6
R.rfm = await page.evaluate(() => Math.round(rfm(180, 85, false) * 10) / 10);       // 21.6
// Datos reales del atleta: carreras con GPS, fuerza, cintura, pruebas, reloj
await page.evaluate(() => {
  DB.profile.height = 178; DB.profile.sex = 'm';
  DB.runs = [{ id: 'g1', date: '2026-11-10', km: 10.2, start: 1, best: { 1: 255, 5: 1290, 10: 2640 } }];
  DB.measures.push({ id: 'm1', date: '2026-11-15', waist: 86 });
  const d = '2026-11-12', t0 = parseDate(d).getTime() + 3.6e7; DB.sessions.push({ id: 'h1', routine: 'libre', dayName: 'Pierna', date: d, start: t0, end: t0 + 3e6, extra: [], swaps: {} });
  DB.lifts.push({ id: 'l1', ex: 'Sentadilla con barra', w: 110, r: 5, rir: 1, date: d, t: t0, sid: 'h1' }, { id: 'l2', ex: 'Peso muerto', w: 140, r: 5, rir: 1, date: d, t: t0 + 1, sid: 'h1' });
  DB.days[todayStr()] = Object.assign(DB.days[todayStr()] || {}, { weight: 80 });
  resState().tests.push({ kind: 'rep60', value: 15, date: '2026-10-01' }, { kind: 'rep60', value: 24, date: '2026-11-15' });
  for (let i = 0; i < 7; i++) { const dd = addDays(todayStr(), -i); DB.days[dd] = DB.days[dd] || {}; DB.days[dd].rec = { rhr: 54, hrv: 66, sleepH: 7.8 }; }
  ath().med.ecg = '2026-06-01';
  saveData();
});
R.caps = await page.evaluate(() => athCapacities().map(c => ({ k: c.k, show: c.show, score: c.score })));
R.areas = await page.evaluate(() => athAreas().map(a => a.k + ':' + a.st + ' (' + a.v + ')'));
// Plan: edad 32 → 8 años; semana 1 = Fundamentos, bloque prioriza tu brecha más grande si es < 40
R.plan = await page.evaluate(() => { const P = athPlan(); return { years: P.years, phase: P.ph.n, cur: P.cur, note: P.note, yrs: P.yrs.map(y => y.age + ':' + y.ph.k) }; });
// Avanzar en el tiempo: 1 año y 13 semanas después → año 2, bloque 3
R.later = await page.evaluate(() => { ath().start = addDays(todayStr(), -7 * (52 + 13)); const P = athPlan(); return { year: P.yearIdx + 1, blk: P.blkIdx + 1, cur: P.cur, phase: P.ph.n }; });
await page.evaluate(() => { ath().start = todayStr(); });
// Hoy: tarjeta del proyecto con anillo de perfil
await page.evaluate(() => render('home')); await page.clock.runFor(300);
R.card = await page.evaluate(() => document.querySelector('#td-goal').innerText.replace(/\s+/g, ' '));
await pause(400); await page.screenshot({ path: D + 'v42-hoy.png' });
await page.click('#td-goal'); await page.clock.runFor(300);
await pause(400); await page.screenshot({ path: D + 'v42-atleta.png' });
// Medicina: marcar chequeo; psicología: marcar práctica
await page.click('[data-area=med]'); await page.clock.runFor(200);
await page.click('[data-med=medico]'); await page.clock.runFor(200);
R.med = await page.evaluate(() => athAreas().find(a => a.k === 'med').v);
await page.click('#aa-x'); await page.clock.runFor(200);
await page.click('[data-area=psy]'); await page.clock.runFor(200); await page.click('[data-psy=viz]'); await page.click('[data-psy=plan]'); await page.clock.runFor(200);
R.psy = await page.evaluate(() => athAreas().find(a => a.k === 'psy').v);
await page.click('#aa-x'); await page.clock.runFor(200);
// Activar el bloque: Motor aeróbico → método Rončević en HYROX Lab (con perfil HYROX)
await page.evaluate(() => { hx().profile = { cat: 'open', sex: 'm', date: '2027-03-19', equip: 'gym', days: 5, exp: 'nuevo' }; saveData(); });
const cur = await page.evaluate(() => athPlan().cur);
await page.click('#ath-apply'); await page.clock.runFor(300);
R.apply = await page.evaluate(c => ({ cur: c, method: hx().profile.method || null, resist: !!(DB.resist && DB.resist.start), tab: currentTab }), cur);
R.persist = await page.evaluate(() => { flushSave(); const d = JSON.parse(localStorage.getItem(KEY)); return { on: d.athlete.on, goal: d.athlete.goal, age: d.profile.age }; });
console.log(JSON.stringify(R, null, 1));
console.log('ERRORS', JSON.stringify(errors));
await b.close();
