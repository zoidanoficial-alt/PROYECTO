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
// Perfil y una referencia antigua (27.0) que debe migrar a rival
await page.evaluate(() => { hx().profile = { cat: 'open', sex: 'm', date: '2027-03-19', equip: 'gym', days: 4, exp: 'nuevo' }; hx().refs = [{ name: 'Ref vieja', sec: 4700, splits: null }]; saveData(); });
await page.click('#tabs [data-tab=hyrox]'); await page.clock.runFor(300);
R.itemSub = await page.evaluate(() => document.querySelector('[data-hxp=ladder] small').textContent);
await page.click('[data-hxp=ladder]'); await page.clock.runFor(300);
R.migrated = await page.evaluate(() => hx().rivals.map(r => r.name));
// Agregar rivales: dos de México, uno de otro país
const addRival = async (n, c, t) => { await page.click('#ld-add'); await page.clock.runFor(200); await page.fill('#rv-n', n); await page.selectOption('#rv-c', c); await page.fill('#rv-t', t); await page.click('#rv-s'); await page.clock.runFor(200); };
await addRival('Carlos del box', 'MX', '1:21:30');
await addRival('Ana (Monterrey)', 'MX', '1:12:10');
await addRival('Pro de Alemania', 'XX', '58:40');
R.ladderEmpty = await page.evaluate(() => { const L = hxLadder('all'); return { me: L.me && L.me.name, rows: L.rows.length }; });
// Primera simulación completa con el temporizador: 1:23:00 → entra a la escalera
const race = async (secs) => page.evaluate(sec => { hxtCreate('race'); const t = hx().timer, t0 = Date.now() - sec * 1000; t.t0 = t0; t.segs.forEach((s, i) => { s.start = t0 + i * sec * 1000 / 16; s.end = t0 + (i + 1) * sec * 1000 / 16; }); t.i = 15; t.segs[15].end = null; saveData(); hxtCommand('next', Date.now()); }, secs);
await race(4980); await page.clock.runFor(300);
R.first = await page.evaluate(() => ({ win: (document.querySelector('.ld-win') || {}).innerText || null, ladder: (({ rank, of, next }) => ({ rank, of, next: next && next.name }))(hxLadder('all')) }));
await page.click('#hts-ok'); await page.clock.runFor(200);
// Segunda simulación: 1:20:40 → supera a Carlos y rompe la meta sub 1:30 ya estaba… (sub 1:30 = 5400 se rompió en la primera)
await race(4840); await page.clock.runFor(300);
R.second = await page.evaluate(() => ({ win: (document.querySelector('.ld-win') || {}).innerText.replace(/\s+/g, ' ') || null, confetti: document.querySelectorAll('.confetti').length >= 0, ladder: (({ rank, of, next }) => ({ rank, of, next: next && next.name }))(hxLadder('all')) }));
await pause(500); await page.screenshot({ path: D + 'v39-superaste.png' });
await page.click('#hts-ok'); await page.clock.runFor(200);
// Escalera: filtros México / Mundo y siguiente objetivo
await page.evaluate(() => openHxLadder()); await page.clock.runFor(300);
R.all = await page.$$eval('.ld-row', x => x.map(y => y.innerText.replace(/\s+/g, ' ')));
R.next = await page.evaluate(() => document.querySelector('.ld-next').innerText.replace(/\s+/g, ' '));
await pause(500); await page.screenshot({ path: D + 'v39-escalera.png' });
await page.click('[data-ls=mx]'); await page.clock.runFor(200);
R.mx = await page.$$eval('.ld-row', x => x.map(y => y.querySelector('b').textContent));
await page.click('[data-ls=world]'); await page.clock.runFor(200);
R.world = await page.$$eval('.ld-row', x => x.map(y => y.querySelector('b').textContent));
// Editar y eliminar rival
await page.click('[data-ls=all]'); await page.clock.runFor(200);
await page.click('.ld-row.rival >> nth=0'); await page.clock.runFor(200);
await page.click('#rv-del'); await page.clock.runFor(200);
R.afterDelete = await page.evaluate(() => hx().rivals.length);
// Carrera oficial registrada en Competiciones también cuenta
await page.evaluate(async () => { await evLoadBundled(); openEvent('hyrox-mexico-city-2026-10'); }); await page.clock.runFor(300);
await page.click('#evd-res'); await page.clock.runFor(200); await page.fill('#er-t', '1:11:50'); await page.click('#er-s'); await page.clock.runFor(300);
R.official = await page.evaluate(() => ({ win: (document.querySelector('.ld-win') || {}).innerText.replace(/\s+/g, ' ') || null, best: hxMyBest().src }));
R.persist = await page.evaluate(() => { flushSave(); return JSON.parse(localStorage.getItem(KEY)).hyrox.rivals.length; });
console.log(JSON.stringify(R, null, 1));
console.log('ERRORS', JSON.stringify(errors));
await b.close();
