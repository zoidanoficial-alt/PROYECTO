import { chromium } from 'playwright';
// 43.5 · Proyecto HYROX (sub-47): presupuesto, km por km, pérdida de velocidad, semana tipo,
// sesiones de running en el reproductor, simulación parcial y "Rompí la serie".
const D = './';
const b = await chromium.launch(); const page = await (await b.newContext({ viewport: { width: 393, height: 851 }, deviceScaleFactor: 2 })).newPage(); await page.addInitScript(() => { window.MP_DEFAULT_PLAN = 'hyrox'; });
const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
page.on('dialog', d => d.accept());
const pause = ms => new Promise(r => setTimeout(r, ms));
const shot = async (n, sel) => { if (sel) await page.evaluate(s => { const x = document.querySelector(s); if (x) x.scrollIntoView({ block: 'start' }); }, sel); await pause(450); await page.screenshot({ path: D + n }); };
await page.clock.install({ time: new Date('2026-11-24T10:00:00') });   // martes
await page.goto('http://127.0.0.1:8765/index.html');
const R = {};
await page.fill('#ob-name', 'Daniel'); for (let k = 0; k < 6; k++) await page.click('#ob-next');
await page.click('[data-ch="level|avanzado"]'); await page.click('#ob-next');
await page.clock.runFor(900); for (let i = 0; i < 4; i++) await page.click('#gd-next'); await page.clock.runFor(8600);
await page.evaluate(() => {
  hx().profile = { cat: 'open', sex: 'm', date: '2027-03-19', equip: 'gym', days: 5, exp: 'medio' };
  const d = addDays(todayStr(), -4);
  [['ski', 250], ['push', 170], ['pull', 250], ['bbj', 190], ['row', 255], ['farm', 95], ['lunge', 230], ['wb', 250]].forEach(([st, sec], i) => hx().results.push({ id: 'r' + i, kind: 'st', st, sec, date: d, t: i, std: true }));
  hx().results.push({ id: 'k', kind: 'run1k', sec: 225, date: d, t: 9 }, { id: 'c', kind: 'comp', sec: 262, after: 'push', date: d, t: 10 });
  const kms = [228, 232, 236, 240, 248, 255, 262, 251], st = [272, 185, 272, 205, 275, 103, 248, 270];
  const segs = []; kms.forEach((k, i) => { segs.push({ k: 'run', n: `Run ${i + 1}`, sec: k }); segs.push({ k: HX_STATIONS[i].k, n: HX_STATIONS[i].n, sec: st[i] }); });
  hx().runs = [{ id: 'sim', mode: 'race', date: d, total: segs.reduce((a, s) => a + s.sec, 0), segs }];
  hx().results.push({ id: 'sim', kind: 'sim', sec: hx().runs[0].total, date: d, t: 11 });
  saveData(); showTab('train');
});
await page.clock.runFor(6000);
await page.evaluate(() => { const p = document.getElementById('md-pop'); if (p) p.remove(); });
R.card = await page.evaluate(() => document.querySelector('#view-train .hp-card').innerText.replace(/\s+/g, ' '));
await page.click('#view-train .hp-card'); await page.clock.runFor(300);
R.proj = await page.evaluate(() => ({
  eyebrow: document.querySelector('.hp .hx-eyebrow').textContent, me: (document.querySelector('.hp-me') || {}).innerText,
  bud: [...document.querySelectorAll('.hp-b')].map(x => x.innerText.replace(/\s+/g, ' ')), kms: [...document.querySelectorAll('.hp-kp')].map(x => x.textContent),
  kmSum: hxT(hpKmPlan(hpBudget(hpState().target).run).reduce((a, b) => a + b, 0)), decay: document.querySelector('.pv-badge') && [...document.querySelectorAll('.pv-badge')].map(x => x.textContent),
  dec: [...document.querySelectorAll('.hp-dec div')].map(x => x.innerText.replace(/\s+/g, ' ')), today: document.querySelector('.hp-day.today b').textContent
}));
await shot('v51-1-proyecto.png');
await shot('v51-2-kms.png', '.hp-kms');
await shot('v51-3-perdida.png', '.hp-dec');
await shot('v51-4-semana.png', '.hp-week');
await page.click('[data-hpt="2999"]'); await page.clock.runFor(200);
R.t50 = await page.evaluate(() => ({ eyebrow: document.querySelector('.hp .hx-eyebrow').textContent, saved: hx().project.target }));
// Martes: intervalos en el reproductor
await page.click('[data-hpgo=hx1]'); await page.clock.runFor(300);
R.wod = await page.evaluate(() => ({ name: document.querySelector('.wp-top b').textContent, step: document.querySelector('.wp-name').textContent, n: WP.steps.length }));
await page.click('#wp-end'); await page.clock.runFor(300); await page.evaluate(() => closeModal(true));
// Sábado: simulación parcial de 2 bloques con "Rompí la serie"
await page.evaluate(() => openHxProject()); await page.clock.runFor(200);
await page.click('[data-hpgo=sat]'); await page.clock.runFor(200);
R.sat = await page.$$eval('#modal .kit-item b', x => x.map(y => y.textContent));
await page.click('[data-hpp="2"]'); await page.clock.runFor(300);
R.part = await page.evaluate(() => ({ segs: hxt().segs.map(s => s.n), title: document.querySelector('.hxt2 .wp-top small').textContent }));
await page.click('#hxt-next'); await page.clock.runFor(230000); await page.click('#hxt-next'); await page.clock.runFor(60000);
R.brkVisible = await page.evaluate(() => !document.querySelector('#hxt-brk').hidden);
await page.click('#hxt-brk'); await page.click('#hxt-brk'); await page.clock.runFor(200);
R.brk = await page.evaluate(() => document.querySelector('#hxt-brkn').textContent);
await shot('v51-5-rompi.png');
await page.clock.runFor(150000); await page.click('#hxt-next'); await page.clock.runFor(235000); await page.click('#hxt-next'); await page.clock.runFor(170000); await page.click('#hxt-next'); await page.clock.runFor(900);
R.partSaved = await page.evaluate(() => ({ sims: hx().results.filter(r => r.kind === 'sim').length, km: hx().results.filter(r => r.kind === 'km').map(r => r.blk), st: hx().results.filter(r => r.note && r.note.includes('simulación (÷1.08)')).length, breaks: hx().runs.slice(-1)[0].segs.map(s => s.breaks), summary: [...document.querySelectorAll('#modal tr')].map(t => t.innerText.replace(/\s+/g, ' ')) }));
await shot('v51-6-resumen.png');
await page.evaluate(() => closeModal(true)); await page.clock.runFor(7000);
// Ficha de estación con la clave del método y acceso desde la pestaña HYROX
await page.evaluate(() => openHxStation('wb')); await page.clock.runFor(200);
R.key = await page.evaluate(() => (document.querySelector('.hp-key') || {}).innerText);
await page.evaluate(() => closeModal(true));
await page.click('#tabs [data-tab=hyrox]'); await page.clock.runFor(300);
R.tabCard = await page.evaluate(() => !!document.querySelector('#view-hyrox .hp-card'));
console.log(JSON.stringify(R, null, 1));
console.log('ERRORS', JSON.stringify(errors));
await b.close();
