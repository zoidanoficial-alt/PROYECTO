import { chromium } from 'playwright';
// 42.0 · Laboratorio de rendimiento: rankings reales HYROX México 2026, curvas, radar,
// carrera contra tu récord y la misma lectura para running, gimnasio y bici.
const D = './';
const b = await chromium.launch(); const page = await (await b.newContext({ viewport: { width: 393, height: 851 }, deviceScaleFactor: 2 })).newPage(); await page.addInitScript(() => { window.MP_DEFAULT_PLAN = 'gym'; });
const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
page.on('dialog', d => d.accept());
const pause = ms => new Promise(r => setTimeout(r, ms));
const shot = async (n, el) => { await pause(500); if (el) await page.evaluate(s => { const x = document.querySelector(s); if (x) x.scrollIntoView({ block: 'start' }); }, el); await page.screenshot({ path: D + n }); };
await page.clock.install({ time: new Date('2026-11-20T10:00:00') });
await page.goto('http://127.0.0.1:8765/index.html');
const R = {};
await page.fill('#ob-name', 'Daniel'); for (let k = 0; k < 6; k++) await page.click('#ob-next');
await page.click('[data-ch="level|avanzado"]'); await page.click('#ob-next');
await page.clock.runFor(900); for (let i = 0; i < 4; i++) await page.click('#gd-next'); await page.clock.runFor(2600);
await page.clock.runFor(6000);

// Unidad pura: lugar en el campo
R.unit = await page.evaluate(() => {
  const f = fieldOf('cdmx-open');
  return { n: f.n, len: f.t.length, first: hxT(f.t[0]), cut: hxT(f.t[99]), p1: fieldPlace(f, f.t[0]), tie: fieldPlace(f, f.t[16]).rank, out: fieldPlace(f, f.t[99] + 60), pro: fieldOf('cdmx-pro').t[0], targets: fieldTargets(f, 4300).map(x => x.n + ':' + x.done) };
});
// Sin datos: Competir muestra la tarjeta y el laboratorio enseña las metas
await page.click('#tabs [data-tab=hyrox]'); await page.clock.runFor(400);
R.cardNoProfile = await page.evaluate(() => document.querySelector('[data-hxp=lab]').innerText.replace(/\s+/g, ' '));
await page.click('[data-hxp=lab]'); await page.clock.runFor(300);
R.emptyLab = await page.evaluate(() => ({ tab: document.querySelector('.pl-tabs .on').textContent, goals: [...document.querySelectorAll('.pl-goal b')].map(x => x.textContent), empty: !!document.querySelector('.pl .cp-diag.empty') }));
await page.evaluate(() => closeModal(true));

// Datos: perfil HYROX, pruebas por estación (hace 10 semanas y ahora), 2 simulaciones con parciales
await page.evaluate(() => {
  hx().profile = { cat: 'open', sex: 'm', date: '2027-03-19', equip: 'gym', days: 4, exp: 'medio' };
  const old = addDays(todayStr(), -70), now = addDays(todayStr(), -5), T = Date.now();
  const st = { ski: [300, 262], push: [260, 205], pull: [330, 270], bbj: [360, 300], row: [290, 255], farm: [130, 105], lunge: [340, 290], wb: [420, 330] };
  Object.entries(st).forEach(([k, [a, c]], i) => { hx().results.push({ id: 'o' + k, kind: 'st', st: k, sec: a, date: old, t: T - 9e9 + i, std: true }, { id: 'n' + k, kind: 'st', st: k, sec: c, date: now, t: T - 1e8 + i, std: true }); });
  hx().results.push({ id: 'r1o', kind: 'run1k', sec: 245, date: old, t: T - 9e9 }, { id: 'r1n', kind: 'run1k', sec: 222, date: now, t: T - 1e8 });
  const segs = (scale, d) => [270, 265, 280, 215, 285, 280, 290, 310, 290, 262, 295, 112, 300, 300, 310, 345].map((s, i) => ({ k: i % 2 ? 'x' : 'run', n: 'S' + i, sec: Math.round(s * scale * (d && i > 9 ? 0.97 : 1)) }));
  const a = segs(1.08), bb = segs(1.0, true);
  hx().runs = [{ id: 'sa', mode: 'race', date: addDays(todayStr(), -40), total: a.reduce((x, s) => x + s.sec, 0), segs: a }, { id: 'sb', mode: 'race', date: addDays(todayStr(), -3), total: bb.reduce((x, s) => x + s.sec, 0), segs: bb }];
  hx().results.push({ id: 'sim1', kind: 'sim', sec: hx().runs[0].total, date: hx().runs[0].date, t: T - 5e9 }, { id: 'sim2', kind: 'sim', sec: hx().runs[1].total, date: hx().runs[1].date, t: T - 2e8 });
  saveData(); renderHyroxTab();
});
R.card = await page.evaluate(() => document.querySelector('[data-hxp=lab]').innerText.replace(/\s+/g, ' '));
await page.click('[data-hxp=lab]'); await page.clock.runFor(300);
R.hyrox = await page.evaluate(() => ({
  hero: document.querySelector('.pl-hero b').textContent, chips: [...document.querySelectorAll('.pl-chips span')].map(x => x.textContent),
  badge: document.querySelector('.pv-badge').textContent, sub: document.querySelector('.pv-head small').textContent,
  next: (document.querySelector('.pl-goal.next') || {}).innerText, plan: !!document.querySelector('.pl-plan'), radar: !!document.querySelector('.pv-radar .pv-prev'), race: !!document.querySelector('.pv-race'),
  cards: [...document.querySelectorAll('.pv-head > div > b')].map(x => x.textContent.trim())
}));
await shot('v47-hyrox.png');
await shot('v47-hyrox-radar.png', '.pv-radar');
await shot('v47-hyrox-carrera.png', '.pv-race');
R.rivals = await page.evaluate(() => ({ rows: [...document.querySelectorAll('.pl-riv')[0].querySelectorAll('tr')].map(t => t.innerText.replace(/\s+/g, ' ').trim()), all: document.querySelectorAll('.pl-all tr').length }));
await page.evaluate(() => document.querySelector('.pl-riv').scrollIntoView({ block: 'center' })); await shot('v47-rivales.png');
await page.click('.pl-riv [data-plriv]'); await page.clock.runFor(200);
R.rivalAdded = await page.evaluate(() => hxRivals().map(r => r.name + ' ' + hxT(r.sec) + ' ' + r.cat));
await page.click('[data-plf="gdl-pro"]'); await page.clock.runFor(200);
R.gdlPro = await page.evaluate(() => ({ on: document.querySelector('.pl-fields .on').textContent, sub: document.querySelector('.pv-head small').textContent }));
await page.evaluate(() => closeModal(true));

// Romper récord: simulación que entra al top 100 → aviso
R.react = await page.evaluate(() => { fieldReact(4500, 4380); return document.querySelector('.hype') ? document.querySelector('.hype').innerText : null; });
await page.clock.runFor(300);
await shot('v47-top100.png');
await page.clock.runFor(6000);

// Running, gimnasio y bici
await page.evaluate(() => {
  const mk = (d, km, best) => ({ id: uid(), date: addDays(todayStr(), d), start: Date.now(), dur: 1800, km, best, source: 'gps' });
  DB.runs = [mk(-150, 10.2, { 1: 250, 5: 1420, 10: 2950 }), mk(-120, 5.1, { 1: 245, 5: 1390 }), mk(-60, 21.2, { 1: 255, 5: 1400, 10: 2870, 21.0975: 6300 }), mk(-30, 5.0, { 1: 236, 5: 1340 }), mk(-6, 10.1, { 1: 232, 5: 1352, 10: 2790 })];
  const S = [['Sentadilla con barra', [[100, 5], [105, 5], [110, 3], [107.5, 5]]], ['Press banca con barra', [[80, 6], [82.5, 5], [85, 3], [82.5, 6]]], ['Peso muerto convencional', [[140, 5], [150, 3], [150, 5]]], ['Press militar con barra', [[50, 6], [52.5, 5], [55, 3]]]];
  S.forEach(([ex, sets]) => sets.forEach(([w, r], i) => { const d = addDays(todayStr(), -80 + i * 22); DB.lifts.push({ id: uid(), ex, w, r, rir: 1, date: d, t: parseDate(d).getTime(), sid: 'ss' + ex.length + i }); }));
  DB.days[todayStr()] = Object.assign(DB.days[todayStr()] || {}, { weight: 82 });
  DB.activities = (DB.activities || []).concat([[-40, 30, 75], [-20, 42, 90], [-4, 35, 70]].map(([d, km, min]) => ({ id: uid(), date: addDays(todayStr(), d), type: 'bici', km, min, rpe: 6 })));
  saveData();
});
await page.click('#tabs [data-tab=progress]'); await page.clock.runFor(400);
await page.click('[data-pshead=general]'); await page.clock.runFor(300);
R.evoBtn = await page.evaluate(() => !!document.querySelector('#evo-lab'));
await page.click('#evo-lab'); await page.clock.runFor(300);
await page.click('[data-plt=run]'); await page.clock.runFor(200);
R.run = await page.evaluate(() => ({ hero: document.querySelector('.pl-hero b').textContent, badge: (document.querySelector('.pv-badge') || {}).textContent, foot: (document.querySelector('.pv-foot') || {}).textContent, radar: !!document.querySelector('.pv-radar'), dists: [...document.querySelectorAll('[data-plr]')].map(x => x.textContent) }));
await shot('v47-running.png');
await page.click('[data-plt=gym]'); await page.clock.runFor(200);
R.gym = await page.evaluate(() => ({ hero: document.querySelector('.pl-hero b').textContent, foot: (document.querySelector('.pv-foot') || {}).textContent, radar: !!document.querySelector('.pv-radar'), lifts: [...document.querySelectorAll('[data-pll]')].map(x => x.textContent) }));
await shot('v47-gym.png');
await shot('v47-gym-radar.png', '.pv-radar');
await page.click('[data-plt=other]'); await page.clock.runFor(200);
R.bike = await page.evaluate(() => ({ hero: document.querySelector('.pl-hero b').textContent, badge: (document.querySelector('.pv-badge') || {}).textContent }));
await shot('v47-bici.png');
R.overflow = await page.evaluate(() => [...document.querySelectorAll('.pl *')].filter(e => e.getBoundingClientRect().right > innerWidth + 1).map(e => e.className || e.tagName).slice(0, 5));
console.log(JSON.stringify(R, null, 1));
console.log('ERRORS', JSON.stringify(errors));
await b.close();
