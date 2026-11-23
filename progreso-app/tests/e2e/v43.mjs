import { chromium } from 'playwright';
// 37.0 · Evolución por disciplina, objetivo en vivo, cómo sostenerlo, reloj universal, fantasma y fluidez
const D = './';
const b = await chromium.launch(); const page = await (await b.newContext({ viewport: { width: 393, height: 851 }, deviceScaleFactor: 2 })).newPage(); await page.addInitScript(() => { window.MP_DEFAULT_PLAN = 'gym'; });
const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
page.on('dialog', d => d.accept());
const pause = ms => new Promise(r => setTimeout(r, ms));
const shot = async n => { await pause(700); await page.screenshot({ path: D + n }); };
await page.clock.install({ time: new Date('2026-11-20T10:00:00') });
await page.addInitScript(() => {
  const log = window.__br = { calls: [], queue: [], running: false };
  const impl = {
    watchStart: (t, s) => { log.calls.push(['watchStart', t, s]); log.running = true; },
    watchUpdate: (t, s, p, pos) => { log.calls.push(['watchUpdate', t, s]); log.last = { t, s, p }; },
    watchStop: () => { log.calls.push(['watchStop']); log.running = false; },
    watchRunning: () => !!log.running, watchDrain: () => '[]', hcStatus: () => 'granted'
  };
  window.AndroidBridge = new Proxy(impl, { get: (o, k) => k in o ? o[k] : (() => '') });
});
await page.goto('http://127.0.0.1:8765/index.html');
const R = {};
await page.fill('#ob-name', 'Daniel'); for (let k = 0; k < 6; k++) await page.click('#ob-next');
await page.click('[data-ch="level|avanzado"]'); await page.click('#ob-next');
await page.clock.runFor(900); for (let i = 0; i < 4; i++) await page.click('#gd-next'); await page.clock.runFor(2600);

// 16 semanas de datos reales simulados: carreras mejorando, fuerza subiendo, HYROX, reloj
await page.evaluate(() => {
  DB.profile.age = 32; DB.profile.height = 178; DB.profile.sex = 'm';
  const t = todayStr();
  for (let w = 15; w >= 0; w--) {
    const d = addDays(t, -7 * w - 2), k5 = 1500 - (15 - w) * 14, t0 = parseDate(d).getTime() + 3.6e7;
    DB.runs.push({ id: 'r' + w, date: d, start: t0, dur: k5 + 600, km: 7, best: { 1: Math.round(k5 / 5.4), 5: k5 }, rpe: 7 });
    const g = addDays(t, -7 * w - 4), g0 = parseDate(g).getTime() + 3.6e7;
    DB.sessions.push({ id: 's' + w, routine: 'libre', dayName: 'Fuerza', date: g, start: g0, end: g0 + 3.6e6, extra: [], swaps: {} });
    DB.lifts.push({ id: 'a' + w, ex: 'Sentadilla con barra', w: 80 + (15 - w) * 2, r: 5, rir: 2, date: g, t: g0, sid: 's' + w }, { id: 'b' + w, ex: 'Peso muerto', w: 110 + (15 - w) * 2.5, r: 5, rir: 2, date: g, t: g0 + 1, sid: 's' + w });
    DB.days[g] = Object.assign(DB.days[g] || {}, { weight: 84 - (15 - w) * 0.25 });
  }
  for (let i = 0; i < 28; i++) { const dd = addDays(t, -i); DB.days[dd] = DB.days[dd] || {}; DB.days[dd].rec = { rhr: 52 + Math.round(i / 7), hrv: 70 - Math.round(i / 5), sleepH: 7.5 }; }
  hx().profile = { cat: 'open', sex: 'm', date: '2027-03-19', equip: 'gym', days: 5, exp: 'nuevo' };
  const add = (st, sec, d) => hx().results.push({ id: 'x' + st + d, kind: 'st', st, sec, date: d, t: 1, rpe: 8, std: true });
  const d1 = addDays(t, -40), d2 = addDays(t, -12);
  [['ski', 270], ['push', 240], ['pull', 310], ['bbj', 330], ['row', 262], ['farm', 120], ['lunge', 420], ['wb', 345]].forEach(([s, x]) => add(s, x, d1));
  hx().results.push({ id: 'r1', kind: 'run1k', sec: 250, date: d1, t: 1, rpe: 9 }, { id: 'r2', kind: 'run1k', sec: 238, date: d2, t: 1, rpe: 9 });
  [['ski', 255], ['row', 250], ['wb', 330]].forEach(([s, x]) => add(s, x, d2));
  DB.watch = { hrDev: { id: 'AA', name: 'Mi Watch' }, hcOn: true, hcSync: Date.now(), hcOrigins: ['com.mi.health'], remoteOk: true, maxHr: 186 };
  saveData();
});
R.sport = await page.evaluate(() => mainSport());
R.metrics = await page.evaluate(() => sportMetrics(true));
R.series = await page.evaluate(() => Object.fromEntries(sportMetrics(true).map(k => [k, metricSeries(k, 16).length])));
R.hxNowVsBefore = await page.evaluate(() => ({ now: Math.round(metricAt('hyrox', todayStr())), d30: Math.round(metricAt('hyrox', addDays(todayStr(), -30))) }));
R.run10k = await page.evaluate(() => Math.round(metricAt('runT', todayStr())));
R.form = await page.evaluate(() => { const f = trForm(1)[0]; return { ctl: Math.round(f.ctl), acwr: Math.round(trAcwr(todayStr()) * 100) / 100 }; });
R.sustain = await page.evaluate(() => ['str', 'runT', 'hyrox', 'ctl', 'rhr'].map(k => k + ':' + sustainState(k).st));

// Hoy: objetivo en vivo
await page.evaluate(() => showTab('home')); await page.clock.runFor(400);
R.goalLive = await page.evaluate(() => document.querySelector('.td-live') && document.querySelector('.td-live').innerText.replace(/\s+/g, ' '));
await shot('v43-hoy.png');
// En vivo: una nueva prueba mejora la predicción → aviso al volver a Hoy
await page.evaluate(() => { hx().results.push({ id: 'new', kind: 'st', st: 'lunge', sec: 380, date: todayStr(), t: 2, rpe: 9, std: true }); saveData(); showTab('home'); });
await page.clock.runFor(300);
R.liveToast = await page.evaluate(() => (document.querySelector('.snack') || document.querySelector('#toast') || {}).innerText || null);
R.liveLog = await page.evaluate(() => (DB.live.log || []).map(e => e.k + ' ' + Math.round(e.from) + '→' + Math.round(e.to)));

// Progreso → Evolución (por defecto)
await page.click('#tabs [data-tab=progress]'); await page.clock.runFor(400); await page.click('[data-pshead=general]'); await page.clock.runFor(300);
R.evDefault = await page.evaluate(() => progMode);
R.evChips = await page.$$eval('[data-metric]', x => x.map(y => y.dataset.metric));
await page.evaluate(() => window.scrollTo(0, 260)); await shot('v43-evolucion-hyrox.png');
await page.click('[data-metric=str]'); await page.clock.runFor(300);
R.keepStr = await page.evaluate(() => document.querySelector('.evo-keep').innerText.replace(/\s+/g, ' ').slice(0, 160));
await page.evaluate(() => document.querySelector('#evo-form').scrollIntoView({ block: 'center' })); await shot('v43-forma.png');
// Cambiar de disciplina: running
await page.evaluate(() => window.scrollTo(0, 0));
await page.click('#evo-sport'); await page.clock.runFor(200);
await page.click('[data-sport=run]'); await page.click('[data-km="10"]'); await page.click('#sp-ok'); await page.clock.runFor(300);
R.runChips = await page.$$eval('[data-metric]', x => x.map(y => y.dataset.metric));
R.runTop = await page.evaluate(() => document.querySelector('.evo-top').innerText.replace(/\s+/g, ' '));
await page.evaluate(() => window.scrollTo(0, 260)); await shot('v43-evolucion-running.png');
await page.evaluate(() => showTab('home')); await page.clock.runFor(300);
R.goalRun = await page.evaluate(() => document.querySelector('#td-goal').innerText.replace(/\s+/g, ' '));
await page.evaluate(() => { DB.profile.sport = 'fisico'; DB.measures.push({ id: 'm1', date: addDays(todayStr(), -30), waist: 92 }, { id: 'm2', date: addDays(todayStr(), -2), waist: 88 }); saveData(); });
R.fisico = await page.evaluate(() => ({ main: mainMetric(), fat: Math.round(metricAt('fat', todayStr()) * 10) / 10 }));
await page.evaluate(() => { DB.profile.sport = 'hyrox'; saveData(); });

// Reloj universal en el gimnasio: ▶ descanso, pulso guiado, ⏭ saltar
await page.evaluate(() => { startSession('libre'); const s = activeSession(); s.extra = [['Sentadilla con barra', 4, '5', 120]]; saveData(); showTab('home'); });
await page.clock.runFor(1500);
R.gymStart = await page.evaluate(() => ({ mode: wgMode(), started: __br.calls.some(c => c[0] === 'watchStart' && c[1] === 'Gimnasio') }));
R.liveBar = await page.evaluate(() => { const b = document.getElementById('live-bar'); return b && !b.hidden ? b.innerText.replace(/\s+/g, ' ') : null; });
await shot('v43-barra-en-curso.png');
await page.evaluate(() => window.onWatchCmd('play', Date.now())); await page.clock.runFor(1200);
R.rest = await page.evaluate(() => ({ resting: REST.end > Date.now(), watch: __br.last }));
await page.evaluate(() => window.onHr(150, [], true, Date.now())); await page.clock.runFor(1100);
R.hrBusy = await page.evaluate(() => (document.getElementById('tb-hr') || {}).textContent);
await page.evaluate(() => window.onHr(100, [], true, Date.now())); await page.clock.runFor(1100);
R.hrReady = await page.evaluate(() => ({ txt: document.getElementById('tb-hr').textContent, ready: restReadyBpm() }));
await shot('v43-descanso-pulso.png');
await page.evaluate(() => window.onWatchCmd('next', Date.now())); await page.clock.runFor(300);
R.skipped = await page.evaluate(() => REST.end > Date.now());
await page.evaluate(() => { DB.active = null; saveData(); }); await page.clock.runFor(1200);
R.stopped = await page.evaluate(() => __br.calls.some(c => c[0] === 'watchStop'));

// Fantasma en el temporizador HYROX
await page.evaluate(() => hxtCreate('station', 'ski')); await page.clock.runFor(300);
await page.evaluate(() => window.onWatchCmd('play', Date.now())); await page.clock.runFor(200000);
R.ghost = await page.evaluate(() => document.getElementById('hxt-ghost').innerText.replace(/\s+/g, ' '));
R.ghostWatch = await page.evaluate(() => hxtPush(true) || __br.last.s);
await shot('v43-fantasma.png');
await page.evaluate(() => { hx().timer = null; saveData(); closeModal(true); });

// Mi reloj: panel de objetivo
await page.evaluate(() => openWatch()); await page.clock.runFor(300);
R.wgRows = await page.$$eval('.wg-row', x => x.map(y => (y.classList.contains('ok') ? '✓ ' : '· ') + y.querySelector('b').textContent));
await shot('v43-reloj-objetivo.png');
await page.evaluate(() => closeModal());

// Atrás de Android sigue la jerarquía y siempre hay ✕
await page.evaluate(() => showTab('hyrox')); await page.clock.runFor(300);
await page.evaluate(() => openHxStations(() => closeModal())); await page.clock.runFor(200);
await page.click('#modal [data-s=ski]'); await page.clock.runFor(200);
R.closeX = await page.evaluate(() => !!document.querySelector('#modal > .modal-x'));
R.back1 = await page.evaluate(() => { window.onAndroidBack(); return document.querySelector('#modal h3') && document.querySelector('#modal h3').textContent; });
R.back2 = await page.evaluate(() => { window.onAndroidBack(); return document.getElementById('modal-bg').classList.contains('open'); });
R.persist = await page.evaluate(() => { flushSave(); const d = JSON.parse(localStorage.getItem(KEY)); return { sport: d.profile.sport, runKm: d.profile.runKm, live: !!d.live }; });
console.log(JSON.stringify(R, null, 1));
console.log('ERRORS', JSON.stringify(errors));
await b.close();
