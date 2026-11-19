import { chromium } from 'playwright';
const D = './';
const b = await chromium.launch(); const page = await (await b.newContext({ viewport: { width: 393, height: 851 }, deviceScaleFactor: 2 })).newPage();
const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
page.on('dialog', d => d.accept());
const pause = ms => new Promise(r => setTimeout(r, ms));
const shot = async n => { await pause(700); await page.screenshot({ path: D + n }); };
await page.clock.install({ time: new Date('2026-11-19T10:00:00') });
// Puente Android simulado: reloj (sesión multimedia), sensor de pulso y Health Connect con datos de Mi Fitness.
await page.addInitScript(() => {
  const log = window.__br = { calls: [], queue: [], hcGranted: false, hrTimer: null, bpm: 120 };
  const impl = {
    watchStart: (t, s) => { log.calls.push(['watchStart', t, s]); log.running = true; },
    watchUpdate: (t, s, p, pos) => { log.calls.push(['watchUpdate', t, s, p, pos]); log.last = { t, s, p, pos }; },
    watchStop: () => { log.calls.push(['watchStop']); log.running = false; },
    watchRunning: () => !!log.running,
    watchDrain: () => { const q = JSON.stringify(log.queue); log.queue = []; return q; },
    hrScan: () => { setTimeout(() => { window.onHrStatus('scanning'); window.onHrDevice({ id: 'AA:BB', name: 'Polar H10', rssi: -58 }); }, 100); },
    hrConnect: id => { log.calls.push(['hrConnect', id]); setTimeout(() => window.onHrStatus('streaming'), 50); clearInterval(log.hrTimer); log.hrTimer = setInterval(() => window.onHr(log.bpm, [500, 510, 495, 505], true, Date.now()), 1000); },
    hrDisconnect: () => { clearInterval(log.hrTimer); window.onHrStatus('disconnected'); },
    hcStatus: () => log.hcGranted ? 'granted' : 'none',
    hcRequest: () => { log.hcGranted = true; setTimeout(() => window.onHcStatus('granted'), 50); },
    hcRead: (id, from, to) => {
      const now = Date.now(), h = 36e5, d = 864e5;
      const hr = []; for (let t = Number(from); t < Number(to); t += 60000) if (t > now - 3 * h) hr.push([t, 100 + (t / 60000) % 40]);
      setTimeout(() => window.onHcData(id, { hr, rhr: [[now - 5 * h, 52], [now - d - 5 * h, 54]], hrv: [[now - 5 * h, 61]], sleep: [[now - 9.5 * h, now - 2 * h], [now - d - 9 * h, now - d - h]], steps: [[now - 4 * h, now - 3 * h, 3200]], ex: [], origins: ['com.mi.health'] }), 50);
    },
    openMiFitness: () => log.calls.push(['openMiFitness']), hcOpenSettings: () => log.calls.push(['hcOpenSettings'])
  };
  window.AndroidBridge = new Proxy(impl, { get: (o, k) => k in o ? o[k] : (() => '') });
});
await page.goto('http://127.0.0.1:8765/index.html');
const R = {};
await page.fill('#ob-name', 'Daniel'); for (let k = 0; k < 6; k++) await page.click('#ob-next');
await page.click('[data-ch="level|avanzado"]'); await page.click('#ob-next');
await page.clock.runFor(900); for (let i = 0; i < 4; i++) await page.click('#gd-next'); await page.clock.runFor(2600);
await page.evaluate(() => { hx().profile = { cat: 'open', sex: 'm', date: '2027-03-19', equip: 'gym', days: 4, exp: 'nuevo' }; const y = addDays(todayStr(), -1); DB.days[y] = { rec: { sleepH: 6 } }; saveData(); });

// 1) Mi reloj: Mi Fitness → Health Connect
await page.click('#tabs [data-tab=more]'); await page.clock.runFor(300);
await page.evaluate(() => document.querySelector('[data-explore=watch]').scrollIntoView()); await page.click('[data-explore=watch]'); await page.clock.runFor(300);
R.steps = await page.$$eval('.wt-steps li', x => x.length);
await page.click('#wt-hcp'); await page.clock.runFor(400); await pause(200); await page.clock.runFor(200);
R.hc = await page.evaluate(() => { const t = todayStr(), y = addDays(t, -1); return { on: DB.watch.hcOn, today: DB.days[t].rec, yesterdayManual: DB.days[y].rec.sleepH, steps: DB.days[t].steps, origins: DB.watch.hcOrigins }; });
// 2) Probar el control desde el reloj
await page.click('#wt-test'); await page.clock.runFor(100);
R.testStart = await page.evaluate(() => __br.calls.filter(c => c[0] === 'watchStart').length);
await page.evaluate(() => window.onWatchCmd('play', Date.now())); await page.clock.runFor(200);
R.remoteOk = await page.evaluate(() => DB.watch.remoteOk);
// 3) Sensor de pulso
await page.click('#wt-scan'); await page.clock.runFor(300);
await page.click('[data-hrd="AA:BB"]'); await page.clock.runFor(2500);
R.live = await page.evaluate(() => ({ dev: DB.watch.hrDev, hr: WATCH.hr && WATCH.hr.bpm, shown: document.querySelector('.wt-live .live-hr').textContent }));
await shot('v35-mi-reloj.png');
await page.click('#wt-x');

// 4) Plan: la prueba que toca se cronometra (sin escribir tiempos)
await page.click('#tabs [data-tab=train]'); await page.clock.runFor(400);
R.cardBtn = await page.evaluate(() => (document.querySelector('#hx-test') || {}).innerText);
await page.click('#hx-test'); await page.clock.runFor(300);   // 1 km fresco
R.timerOpen = await page.evaluate(() => hxt() && hxt().mode);
await page.evaluate(() => window.onWatchCmd('play', Date.now()));   // ▶ desde el reloj
await page.clock.runFor(120000); await page.evaluate(() => { __br.bpm = 170; }); await page.clock.runFor(105000);
R.watchScreen = await page.evaluate(() => __br.last);
await shot('v35-temporizador.png');
await page.evaluate(() => window.onWatchCmd('next', Date.now()));   // ⏭ = terminar
await page.clock.runFor(300);
R.run1k = await page.evaluate(() => { const r = hxBest('run1k'); const run = hx().runs[hx().runs.length - 1]; return { sec: r.sec, auto: r.auto, hrAvg: run.hrAvg, hrMax: run.hrMax, stopped: !__br.running }; });
await shot('v35-resumen.png');
await page.click('[data-rpe="9"]'); R.rpe = await page.evaluate(() => hxBest('run1k').rpe);
await page.click('#hts-ok'); await page.clock.runFor(300);

// 5) Simulación completa controlada desde el reloj, con pausa, deshacer y toques mientras la app estaba cerrada
await page.evaluate(() => hxtCreate('race')); await page.clock.runFor(300);
const cmd = (c) => page.evaluate(c => window.onWatchCmd(c, Date.now()), c);
await cmd('play');
const times = [255, 240, 260, 200, 270, 300, 265, 330, 270, 250, 275, 120, 280, 400, 290, 330];
for (let i = 0; i < 16; i++) {
  await page.clock.runFor(times[i] * 1000);
  if (i === 5) { await cmd('pause'); await page.clock.runFor(30000); await cmd('play'); }   // 30 s de pausa: no cuentan
  if (i === 7) { await cmd('next'); await page.clock.runFor(2000); await cmd('prev'); }    // toque por error y deshacer
  if (i === 12) {   // la app estaba cerrada: el toque quedó en la cola nativa con su hora real
    await page.evaluate(() => { __br.queue.push({ c: 'next', at: Date.now() }); watchDrain(); }); continue;
  }
  if (i === 6) await shot('v35-carrera.png');
  await cmd('next');
}
await page.clock.runFor(300);
R.race = await page.evaluate(() => { const run = hx().runs[hx().runs.length - 1]; return { mode: run.mode, total: run.total, segs: run.segs.length, lunge: run.segs[13].sec, sled: run.segs[5].sec, sim: hx().results.filter(r => r.kind === 'sim').length, stations: hx().results.filter(r => r.kind === 'st' && r.auto).length, hrSegs: run.segs.filter(s => s.hrAvg).length }; });
R.expectedTotal = times.reduce((a, x) => a + x, 0) + 2;   // +2 s del toque deshecho (el tramo siguió corriendo)
R.pred = await page.evaluate(() => { const p = hxPredict(); return p.ok ? hxT(p.total) : null; });
await page.click('#hts-ok'); await page.clock.runFor(300);

// 6) Sin sensor en vivo: el pulso llega después desde Mi Fitness (Health Connect)
await page.evaluate(() => { DB.watch.hrDev = null; bridge.hrDisconnect(); WATCH.hr = null; hxtCreate('station', 'wb'); }); await page.clock.runFor(200);
await cmd('play'); await page.clock.runFor(330000); await cmd('next'); await page.clock.runFor(300);
R.noLive = await page.evaluate(() => { const r = hx().runs[hx().runs.length - 1]; return { hrLive: r.hrLive, hrAvg: r.hrAvg, msg: [...document.querySelectorAll('.pg-rec small')].map(x => x.innerText).join(' ').slice(0, 200) }; });
await page.click('#hts-ok');
await page.evaluate(() => hcSync(true)); await page.clock.runFor(500); await pause(100); await page.clock.runFor(100);
R.filled = await page.evaluate(() => { const r = hx().runs[hx().runs.length - 1]; return { hrFromWatch: r.hrFromWatch, hrAvg: r.hrAvg, segAvg: r.segs[0].hrAvg }; });

// 7) La sesión del día también responde al reloj
await page.evaluate(() => { const lib = hxSessionLib(240); hx().active = { id: 'hs1', type: 'comp', n: lib.comp.n, blocks: lib.comp.blocks.map(b => ({ t: b[0], d: b[1], done: false, skip: false })), measure: '', start: Date.now(), paused: null, pausedMs: 0, changes: [] }; saveData(); window.onWatchCmd('next', Date.now()); window.onWatchCmd('next', Date.now()); window.onWatchCmd('pause', Date.now()); });
R.session = await page.evaluate(() => { const a = hx().active; return a ? { done: a.blocks.filter(b => b.done).length, paused: !!a.paused } : null; });
R.persist = await page.evaluate(() => { flushSave(); const d = JSON.parse(localStorage.getItem(KEY)); return { watch: !!d.watch, runs: d.hyrox.runs.length }; });
console.log(JSON.stringify(R, null, 1));
console.log('ERRORS', JSON.stringify(errors));
await b.close();
