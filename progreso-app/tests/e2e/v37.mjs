import { chromium } from 'playwright';
const D = './';
const b = await chromium.launch(); const page = await (await b.newContext({ viewport: { width: 393, height: 851 }, deviceScaleFactor: 2 })).newPage();
const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
const pause = ms => new Promise(r => setTimeout(r, ms));
await page.clock.install({ time: new Date('2026-11-20T11:00:00') });
// Health Connect simulado con lo que escribiría Mi Fitness (y un baumanómetro de otra app)
await page.addInitScript(() => {
  const impl = {
    hcStatus: () => 'granted',
    hcRead: (id) => {
      const now = Date.now(), h = 36e5, m = 6e4;
      const wake = now - 4 * h, sleepStart = wake - 7.6 * h;
      const stages = [[sleepStart, sleepStart + 90 * m, 4], [sleepStart + 90 * m, sleepStart + 180 * m, 5], [sleepStart + 180 * m, sleepStart + 270 * m, 6], [sleepStart + 270 * m, sleepStart + 300 * m, 1], [sleepStart + 300 * m, wake, 4]];
      const hr = []; for (let t = wake; t < now; t += 2 * m) hr.push([t, 72]);
      // Entreno 1: carrera de 4:05 ayer 19:00 · Entreno 2: simulación de 75 min con 16 vueltas ayer 07:00
      const y = new Date(now - 864e5); y.setHours(19, 0, 0, 0); const r0 = y.getTime();
      for (let t = r0; t <= r0 + 245e3; t += 5e3) hr.push([t, 165]);
      const s0 = r0 - 12 * h, laps = []; let t = s0; const lap = [255, 240, 260, 200, 270, 300, 265, 330, 270, 250, 275, 120, 280, 400, 290, 330]; lap.forEach(sec => { laps.push([t, t + sec * 1000]); t += sec * 1000; });
      for (let u = s0; u <= t; u += 30e3) hr.push([u, 158]);
      setTimeout(() => window.onHcData(id, {
        hr, rhr: [[wake, 49]], hrv: [[wake, 74]],
        sleep: [[sleepStart, wake, stages]],
        bp: [[now - 2 * h, 121.4, 78.6, 'com.omron.connect']],
        spo2: [[now - 5 * h, 97], [now - 6 * h, 95], [now - 7 * h, 98]],
        steps: [], ex: [[r0, r0 + 245e3, 56, '', 'com.mi.health', [], []], [s0, t, 0, 'Libre', 'com.mi.health', laps, []]],
        origins: ['com.mi.health', 'com.omron.connect']
      }), 30);
    }
  };
  window.AndroidBridge = new Proxy(impl, { get: (o, k) => k in o ? o[k] : (() => '') });
});
await page.goto('http://127.0.0.1:8765/index.html');
const R = {};
await page.fill('#ob-name', 'Daniel'); for (let k = 0; k < 6; k++) await page.click('#ob-next');
await page.click('[data-ch="level|avanzado"]'); await page.click('#ob-next');
await page.clock.runFor(900); for (let i = 0; i < 4; i++) await page.click('#gd-next'); await page.clock.runFor(2600);
// Una semana de historial (para tus medias de HRV y pulso en reposo) y la carrera conectada
await page.evaluate(() => {
  for (let i = 1; i <= 7; i++) { const d = addDays(todayStr(), -i); DB.days[d] = { rec: { hrv: 60, rhr: 53, sleepH: 7 } }; }
  hx().profile = { cat: 'open', sex: 'm', date: '2027-03-19', equip: 'gym', days: 4, exp: 'nuevo' };
  DB.watch = { hcOn: true, hcOrigins: [], hrDev: null, remoteOk: false, maxHr: null }; saveData();
});
await page.evaluate(() => hcSync(true)); await page.clock.runFor(300); await pause(100); await page.clock.runFor(200);
await page.click('#tabs [data-tab=home]'); await page.clock.runFor(400);
R.data = await page.evaluate(() => { const d = DB.days[todayStr()]; return { sleepH: d.rec.sleepH, stages: d.sleepStages, bp: d.bp, spo2: d.spo2, hrDay: d.hrDay, rhr: d.rec.rhr, hrv: d.rec.hrv }; });
R.energy = await page.evaluate(() => bodyEnergy()); R.stress = await page.evaluate(() => bodyStress());
R.tiles = await page.$$eval('.bd-tile', t => t.map(x => x.innerText.replace(/\s+/g, ' ')));
R.inbox = await page.evaluate(() => DB.watch.exInbox.map(x => ({ type: x.type, laps: x.laps.length, hr: x.hrAvg, dur: Math.round((x.end - x.start) / 1000) })));
await page.evaluate(() => document.querySelector('.bd-card').scrollIntoView({ block: 'start' })); await pause(600);
await page.screenshot({ path: D + 'v37-cuerpo.png' });
await page.click('[data-bd=stress]'); await page.clock.runFor(200);
R.stressDetail = await page.evaluate(() => document.querySelector('.modal').innerText.slice(0, 260));
await pause(500); await page.screenshot({ path: D + 'v37-estres.png' });
await page.click('#bdd-x'); await page.clock.runFor(200);
await page.click('[data-bd=bp]'); await page.clock.runFor(200);
R.bpSrc = await page.evaluate(() => document.querySelector('.modal').innerText.includes('com.omron.connect'));
await page.click('#bdd-x'); await page.clock.runFor(200);
// Entrenamientos del reloj: el primero (más antiguo en la bandeja) es la simulación; luego la carrera de 4:05
await page.evaluate(() => document.querySelector('.ex-inbox').scrollIntoView({ block: 'center' })); await pause(500);
await page.screenshot({ path: D + 'v37-reloj-entreno.png' });
R.firstOpts = await page.$$eval('[data-exa]', x => x.map(y => y.dataset.exa));
await page.click('[data-exa=run1k]'); await page.clock.runFor(300);
R.run1k = await page.evaluate(() => { const r = hxBest('run1k'); const run = hx().runs[hx().runs.length - 1]; return { sec: r.sec, fromWatch: r.fromWatch, hrAvg: run.hrAvg }; });
R.secondOpts = await page.$$eval('[data-exa]', x => x.map(y => y.dataset.exa));
await page.click('[data-exa=race]'); await page.clock.runFor(300);
R.race = await page.evaluate(() => ({ sim: hx().results.filter(r => r.kind === 'sim' && r.fromWatch).map(r => r.sec), stations: hx().results.filter(r => r.kind === 'st' && r.fromWatch).length, lunge: (hx().results.find(r => r.st === 'lunge' && r.fromWatch) || {}).sec }));
R.inboxLeft = await page.evaluate(() => DB.watch.exInbox.length);
// No se vuelven a preguntar en la siguiente sincronización
await page.evaluate(() => hcSync(false)); await page.clock.runFor(300); await pause(100); await page.clock.runFor(200);
R.noRepeat = await page.evaluate(() => DB.watch.exInbox.length);
console.log(JSON.stringify(R, null, 1));
console.log('ERRORS', JSON.stringify(errors));
await b.close();
