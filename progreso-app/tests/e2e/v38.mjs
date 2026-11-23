import { chromium } from 'playwright';
const D = './';
const b = await chromium.launch(); const page = await (await b.newContext({ viewport: { width: 393, height: 851 }, deviceScaleFactor: 2 })).newPage(); await page.addInitScript(() => { window.MP_DEFAULT_PLAN = 'gym'; });
const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
const pause = ms => new Promise(r => setTimeout(r, ms));
await page.clock.install({ time: new Date('2026-11-18T10:00:00') });   // miércoles
await page.goto('http://127.0.0.1:8765/index.html');
const R = {};
await page.fill('#ob-name', 'Daniel'); for (let k = 0; k < 6; k++) await page.click('#ob-next');
await page.click('[data-ch="level|avanzado"]'); await page.click('#ob-next');
await page.clock.runFor(900); for (let i = 0; i < 4; i++) await page.click('#gd-next'); await page.clock.runFor(2600);
// Barra de 6 pestañas: la activa muestra su nombre completo, sin cortes ni desbordes
await page.click('#tabs [data-tab=hyrox]'); await page.clock.runFor(400); await pause(400);
R.nav = await page.evaluate(() => { const bs = [...document.querySelectorAll('#tabs button:not([hidden])')], on = document.querySelector('#tabs button.on .tl'), nav = document.querySelector('#tabs');
  return { tabs: bs.map(x => x.dataset.tab), activeLabel: on.textContent, labelFits: on.scrollWidth <= on.clientWidth + 1, navFits: nav.scrollWidth <= nav.clientWidth + 1, accent: getComputedStyle(document.documentElement).getPropertyValue('--accent').trim(), bg: getComputedStyle(document.body).backgroundColor, title: document.querySelector('#hdr-title').textContent }; });
for (const t of ['progress', 'more', 'hyrox']) { await page.click(`#tabs [data-tab=${t}]`); await page.clock.runFor(200); await pause(600); R['fits_' + t] = await page.evaluate(() => { const on = document.querySelector('#tabs button.on .tl'); return on.scrollWidth <= on.clientWidth + 1; }); }
await page.click('#tabs [data-tab=hyrox]'); await page.clock.runFor(300);
R.empty = await page.evaluate(() => !!document.querySelector('#hxp-setup') && !!document.querySelector('#ch-open'));
// Configurar con datos y elegir método
await page.evaluate(() => { hx().profile = { cat: 'open', sex: 'm', date: '2027-03-19', equip: 'gym', days: 5, exp: 'nuevo' };
  const add = (st, sec) => hx().results.push({ id: 'x' + st, kind: 'st', st, sec, date: '2026-11-10', t: 1, rpe: 9, std: true });
  [['ski', 255], ['push', 230], ['pull', 300], ['bbj', 320], ['row', 250], ['farm', 115], ['lunge', 400], ['wb', 330]].forEach(([s, t]) => add(s, t));
  hx().results.push({ id: 'r', kind: 'run1k', sec: 235, date: '2026-11-09', t: 1, rpe: 9 }, { id: 'c', kind: 'comp', sec: 290, date: '2026-11-15', t: 1, rpe: 9 }); saveData(); render('hyrox'); });
await page.clock.runFor(300);
R.hub = await page.evaluate(() => ({ items: [...document.querySelectorAll('[data-hxp]')].map(x => x.dataset.hxp), count: document.querySelector('.cp-count b').textContent, mission: document.querySelector('.hx-card h2').textContent }));
await page.click('#ch-open'); await page.clock.runFor(200);
R.champs = await page.$$eval('[data-champ]', x => x.map(y => y.dataset.champ));
await page.click('[data-champ=roncevic]'); await page.clock.runFor(200);
R.roncevic = await page.evaluate(() => ({ facts: document.querySelectorAll('.comp-list li').length, week: [...document.querySelectorAll('.ch-week span')].map(x => x.innerText.replace(/\s+/g, ' ')), sources: document.querySelectorAll('.ev-links a').length }));
await page.click('#ch-apply'); await page.clock.runFor(400);
const mission = () => page.evaluate(() => { const m = hxMission(); return { type: m.type, n: m.ses && m.ses.n, note: m.changes.find(c => /duras|completaste/.test(c)) || null }; });
R.day1 = await mission();
// Semana: completar sesiones y ver el orden del método
const done = (type, rpe, date) => page.evaluate(([type, rpe, date]) => { hx().sessions.push({ id: 's' + Math.random(), type, n: type, date: date || todayStr(), rpe, done: true }); saveData(); }, [type, rpe, date]);
await done('tempo', 8); R.day2 = await mission();
await done('durability', 8); R.day3 = await mission();
// Regla: ya hay 3 duras en 7 días (una de ayer) → la siguiente dura se cambia por aeróbico suave
await done('station', 8, '2026-11-17'); R.guard = await mission();
await page.evaluate(() => render('hyrox')); await page.clock.runFor(200);
R.weekCard = await page.evaluate(() => document.querySelector('.ch-card').innerText.replace(/\s+/g, ' ').slice(0, 220));
await pause(400); await page.screenshot({ path: D + 'v38-hyrox-metodo.png' });
// McIntyre: ciclo de 8 semanas (3 resistencia, 1 descarga, 3 fuerza, 1 descarga)
R.mcintyre = await page.evaluate(() => { hx().sessions = []; hx().profile.method = 'mcintyre'; const out = [];
  [0, 3, 4, 7].forEach(w => { hx().profile.methodStart = addDays(todayStr(), -7 * w); const k = hxMethodWeek(); out.push({ w: w + 1, label: k.label, first: k.types[0] }); }); return out; });
// Fase de rendimiento: el tempo se convierte en simulación
R.perfPhase = await page.evaluate(() => { hx().profile.method = 'roncevic'; hx().profile.date = addDays(todayStr(), 18); hx().sessions = []; return hxMission().type; });
// Quitar método: vuelve el plan por cuello de botella
R.noMethod = await page.evaluate(() => { delete hx().profile.method; hx().profile.date = '2027-03-19'; return hxMission().type; });
console.log(JSON.stringify(R, null, 1));
console.log('ERRORS', JSON.stringify(errors));
await b.close();
