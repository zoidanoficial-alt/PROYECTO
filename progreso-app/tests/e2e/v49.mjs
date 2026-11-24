import { chromium } from 'playwright';
// 43.1 · Temporizador HYROX con el diseño del reproductor: sin textos de instrucciones,
// "Guardar" en lugar de "Minimizar" (guarda lo que llevas) y "Descartar".
const D = './';
const b = await chromium.launch(); const page = await (await b.newContext({ viewport: { width: 393, height: 851 }, deviceScaleFactor: 2 })).newPage(); await page.addInitScript(() => { window.MP_DEFAULT_PLAN = 'hyrox'; });
const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
page.on('dialog', d => d.accept());
const pause = ms => new Promise(r => setTimeout(r, ms));
const shot = async n => { await pause(400); await page.screenshot({ path: D + n }); };
await page.clock.install({ time: new Date('2026-11-20T10:00:00') });
await page.goto('http://127.0.0.1:8765/index.html');
const R = {};
await page.fill('#ob-name', 'Daniel'); for (let k = 0; k < 6; k++) await page.click('#ob-next');
await page.click('[data-ch="level|avanzado"]'); await page.click('#ob-next');
await page.clock.runFor(900); for (let i = 0; i < 4; i++) await page.click('#gd-next'); await page.clock.runFor(8600);
await page.evaluate(() => { hx().profile = { cat: 'open', sex: 'm', date: '2027-03-19', equip: 'gym', days: 4, exp: 'medio' }; saveData(); showTab('train'); });
// Simulación completa: antes de empezar
await page.evaluate(() => { hxtCreate('race'); }); await page.clock.runFor(300);
R.idle = await page.evaluate(() => ({ idx: document.querySelector('#hxt-idx').textContent, go: document.querySelector('#hxt-next').textContent.trim(), playDis: document.querySelector('#hxt-play').disabled, saveDis: document.querySelector('#hxt-save').disabled, noMin: !document.querySelector('#hxt-min'), noHelp: !/control de música|bloquear el teléfono/.test(document.querySelector('.hxt2').innerText) }));
await shot('v49-1-listo.png');
await page.click('#hxt-next'); await page.clock.runFor(272000);
await page.click('#hxt-next'); await page.clock.runFor(95000);
R.running = await page.evaluate(() => ({ idx: document.querySelector('#hxt-idx').textContent, name: document.querySelector('#hxt-name').textContent, dose: document.querySelector('#hxt-dose').textContent, seg: document.querySelector('#hxt-seg').textContent, total: document.querySelector('#hxt-total').textContent, go: document.querySelector('#hxt-next').textContent.trim(), next: document.querySelector('#hxt-nexttxt').textContent, done: document.querySelector('#hxt-donesum').textContent }));
await shot('v49-2-corriendo.png');
await page.click('#hxt-play'); await page.clock.runFor(1000);
R.paused = await page.evaluate(() => ({ play: document.querySelector('#hxt-play').textContent.trim(), next: document.querySelector('#hxt-nexttxt').textContent }));
await shot('v49-3-pausa.png');
await page.click('#hxt-play'); await page.clock.runFor(60000);
// Guardar a la mitad: cierra el tramo en curso y registra lo hecho
await page.click('#hxt-save'); await page.clock.runFor(800);
R.saved = await page.evaluate(() => ({ timer: hx().timer, sims: hx().results.filter(r => r.kind === 'sim').length, runs: hx().runs.length, segs: hx().runs[0].segs.map(s => s.n + ' ' + Math.round(s.sec)), modal: (document.querySelector('#modal h3') || {}).textContent }));
await shot('v49-4-guardado.png');
await page.evaluate(() => closeModal(true)); await page.clock.runFor(7000);
// Estación sola
await page.evaluate(() => { hxtCreate('station', 'ski'); }); await page.clock.runFor(300);
await page.click('#hxt-next'); await page.clock.runFor(250000);
R.station = await page.evaluate(() => ({ idx: document.querySelector('#hxt-idx').textContent, go: document.querySelector('#hxt-next').textContent.trim() }));
await shot('v49-5-estacion.png');
await page.click('#hxt-next'); await page.clock.runFor(800);
R.stationSaved = await page.evaluate(() => hx().results.filter(r => r.kind === 'st' && r.st === 'ski').length);
// Sesión HYROX: sin "Minimizar"
await page.evaluate(() => { closeModal(true); if (typeof hxStartSession === 'function') hxStartSession(); }); await page.clock.runFor(400);
R.session = await page.evaluate(() => ({ noMin: !document.querySelector('#hx-min'), end: (document.querySelector('#hx-end') || {}).textContent }));
console.log(JSON.stringify(R, null, 1));
console.log('ERRORS', JSON.stringify(errors));
await b.close();
