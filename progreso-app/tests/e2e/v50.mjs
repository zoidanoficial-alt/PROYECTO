import { chromium } from 'playwright';
// 43.2 · "Km y estación" con los 8 km, Diagnóstico y Entrena por estación plegables,
// y los tiempos imposibles (temporizador olvidado o dedazo) fuera de récords y diagnóstico.
const D = './';
const b = await chromium.launch(); const page = await (await b.newContext({ viewport: { width: 393, height: 851 }, deviceScaleFactor: 2 })).newPage(); await page.addInitScript(() => { window.MP_DEFAULT_PLAN = 'hyrox'; });
const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
page.on('dialog', d => d.accept());
const pause = ms => new Promise(r => setTimeout(r, ms));
const shot = async n => { await pause(400); await page.screenshot({ path: D + n }); };
await page.clock.install({ time: new Date('2026-11-24T10:00:00') });
await page.goto('http://127.0.0.1:8765/index.html');
const R = {};
await page.fill('#ob-name', 'Daniel'); for (let k = 0; k < 6; k++) await page.click('#ob-next');
await page.click('[data-ch="level|avanzado"]'); await page.click('#ob-next');
await page.clock.runFor(900); for (let i = 0; i < 4; i++) await page.click('#gd-next'); await page.clock.runFor(8600);
// Los datos de las capturas: Farmers 36:54, Row 0:06 y Sled pull 0:39 son imposibles
await page.evaluate(() => {
  hx().profile = { cat: 'open', sex: 'm', date: '2027-03-19', equip: 'gym', days: 4, exp: 'medio' };
  const d = addDays(todayStr(), -3), add = (st, sec, i) => hx().results.push({ id: 'r' + st + i, kind: 'st', st, sec, date: d, t: Date.now() - 1e6 + i, std: true });
  [['ski', 118], ['push', 166], ['pull', 39], ['bbj', 120], ['row', 6], ['farm', 2214], ['lunge', 260], ['wb', 300]].forEach(([s, t], i) => add(s, t, i));
  add('pull', 260, 20); add('farm', 95, 21);
  hx().results.push({ id: 'k1', kind: 'run1k', sec: 230, date: d, t: Date.now() - 9e5 });
  hx().runs = [{ id: 'sim', mode: 'race', date: d, total: 5000, segs: Array.from({ length: 16 }, (_, i) => ({ k: i % 2 ? 'x' : 'run', n: i % 2 ? 'E' + i : `Run ${i / 2 + 1}`, sec: i % 2 ? 200 : 270 + i })) }];
  saveData(); showTab('train');
});
await page.clock.runFor(300);
R.folds = await page.evaluate(() => [...document.querySelectorAll('#view-train .cp-fold')].map(d => d.querySelector('summary').innerText.replace(/\s+/g, ' ') + (d.open ? ' [abierto]' : ' [cerrado]')));
R.diag = await page.evaluate(() => { const bn = hxBottleneck(hxPerformance()); return bn && bn.main ? bn.main.n + ' · ' + hxT(Math.round(bn.main.lost)) : null; });
R.best = await page.evaluate(() => ({ farm: hxT(hxBest('st', 'farm').sec), row: hxBest('st', 'row'), pull: hxT(hxBest('st', 'pull').sec) }));
await shot('v50-1-plegado.png');
await page.click('#view-train [data-cpfold=hx-diag] summary'); await page.clock.runFor(200);
await pause(100); R.opened = await page.evaluate(() => ({ open: document.querySelector('[data-cpfold=hx-diag]').open, saved: (DB.profile.folds || {})['hx-diag'] }));
await shot('v50-2-diagnostico.png');
// Km y estación
await page.evaluate(() => openHxTimerPicker()); await page.clock.runFor(200);
await page.click('[data-tm=comp]'); await page.clock.runFor(200);
R.blkRows = await page.$$eval('.hxk', x => x.map(y => y.innerText.replace(/\s+/g, ' ')));
await shot('v50-3-km-estacion.png');
await page.click('[data-ord=comp]'); await page.clock.runFor(200);
R.compRows = await page.$$eval('.hxk', x => x.slice(0, 2).map(y => y.innerText.replace(/\s+/g, ' ')));
await page.click('[data-ord=blk]'); await page.clock.runFor(200);
await page.click('.hxk[data-ps=push]'); await page.clock.runFor(300);
R.timer = await page.evaluate(() => ({ mode: hxt().mode, segs: hxt().segs.map(s => s.n), title: document.querySelector('.hxt2 .wp-top small').textContent }));
await page.click('#hxt-next'); await page.clock.runFor(262000); await page.click('#hxt-next'); await page.clock.runFor(150000); await page.click('#hxt-next'); await page.clock.runFor(900);
R.saved = await page.evaluate(() => ({ km: hx().results.filter(r => r.kind === 'km').map(r => 'Km ' + r.blk + ' ' + hxT(r.sec)), push: hxT(hxBest('st', 'push').sec), kmBest2: hxT(hxKmBest(2)) }));
await page.evaluate(() => closeModal(true)); await page.clock.runFor(7000);
// Ficha de estación: aviso y borrar
await page.evaluate(() => openHxStation('farm')); await page.clock.runFor(200);
R.bad = await page.evaluate(() => (document.querySelector('.hxs-bad') || {}).innerText);
await shot('v50-4-imposible.png');
await page.click('#hxs-badx'); await page.clock.runFor(300);
R.afterDel = await page.evaluate(() => ({ left: hx().results.filter(r => r.st === 'farm').map(r => r.sec), warn: !!document.querySelector('.hxs-bad') }));
console.log(JSON.stringify(R, null, 1));
console.log('ERRORS', JSON.stringify(errors));
await b.close();
