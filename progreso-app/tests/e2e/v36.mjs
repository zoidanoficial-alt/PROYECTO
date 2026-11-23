import { chromium } from 'playwright';
const D = './';
const b = await chromium.launch(); const page = await (await b.newContext({ viewport: { width: 393, height: 851 }, deviceScaleFactor: 2 })).newPage(); await page.addInitScript(() => { window.MP_DEFAULT_PLAN = 'gym'; });
const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
const pause = ms => new Promise(r => setTimeout(r, ms));
await page.clock.install({ time: new Date('2026-11-20T10:00:00') });
// Android 13: Health Connect es una app aparte. Primero no está instalada; luego se instala y se dan permisos.
await page.addInitScript(() => {
  const st = window.__hc = { state: 'install', calls: [] };
  const impl = {
    hcStatus: () => st.state,
    hcInstall: () => { st.calls.push('install'); st.state = 'none'; },
    hcRequest: () => { st.calls.push('request'); st.state = 'granted'; setTimeout(() => window.onHcStatus('granted', true), 50); },
    hcRead: (id) => setTimeout(() => window.onHcData(id, { hr: [], rhr: [[Date.now() - 3e6, 55]], hrv: [], sleep: [[Date.now() - 3.3e7, Date.now() - 4e6]], steps: [], ex: [], origins: ['com.mi.health'] }), 50),
    openMiFitness: () => st.calls.push('mifit')
  };
  window.AndroidBridge = new Proxy(impl, { get: (o, k) => k in o ? o[k] : (() => '') });
});
await page.goto('http://127.0.0.1:8765/index.html');
const R = {};
await page.fill('#ob-name', 'Daniel'); for (let k = 0; k < 6; k++) await page.click('#ob-next');
await page.click('[data-ch="level|avanzado"]'); await page.click('#ob-next');
await page.clock.runFor(900); for (let i = 0; i < 4; i++) await page.click('#gd-next'); await page.clock.runFor(2600);
await page.evaluate(() => openWatch()); await page.clock.runFor(300);
R.installShown = await page.evaluate(() => !!document.querySelector('#wt-hci') && document.querySelector('.wt-sec .status').innerText.slice(0, 40));
await pause(500); await page.screenshot({ path: D + 'v36-instalar-hc.png' });
await page.click('#wt-hci');
// Al volver de Google Play la app vuelve a pintar el estado (onResume → refresh)
await page.evaluate(() => window.onHcStatus('none', false)); await page.clock.runFor(200);
R.afterInstall = await page.evaluate(() => ({ btn: !!document.querySelector('#wt-hcp'), hcOn: DB.watch.hcOn }));
await page.click('#wt-hcp'); await page.clock.runFor(400); await pause(100); await page.clock.runFor(200);
R.granted = await page.evaluate(() => ({ hcOn: DB.watch.hcOn, rhr: (DB.days[todayStr()].rec || {}).rhr, sleep: (DB.days[todayStr()].rec || {}).sleepH, origins: DB.watch.hcOrigins, calls: __hc.calls }));
// Un onResume normal (sin venir de la solicitud) no debe mostrar avisos repetidos ni resincronizar si ya es reciente
const before = await page.evaluate(() => DB.watch.hcSync);
await page.evaluate(() => window.onHcStatus('granted', false)); await page.clock.runFor(300);
R.noResync = await page.evaluate(b => DB.watch.hcSync === b, before);
console.log(JSON.stringify(R, null, 1));
console.log('ERRORS', JSON.stringify(errors));
await b.close();
