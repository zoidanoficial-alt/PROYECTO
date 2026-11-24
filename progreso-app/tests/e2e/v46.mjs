import { chromium } from 'playwright';
// 41.0 · Estaciones HYROX con ilustración (competencia y Planet Fitness), cada una individual,
// LOGRO DESBLOQUEADO al romper récord y Apollo Creed cuando no.
const D = './';
const b = await chromium.launch(); const page = await (await b.newContext({ viewport: { width: 393, height: 851 }, deviceScaleFactor: 2 })).newPage(); await page.addInitScript(() => { window.MP_DEFAULT_PLAN = 'gym'; });
const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
page.on('dialog', d => d.accept());
const pause = ms => new Promise(r => setTimeout(r, ms));
const shot = async n => { await pause(600); await page.screenshot({ path: D + n }); };
await page.clock.install({ time: new Date('2026-11-20T10:00:00') });
await page.goto('http://127.0.0.1:8765/index.html');
const R = {};
await page.fill('#ob-name', 'Daniel'); for (let k = 0; k < 6; k++) await page.click('#ob-next');
await page.click('[data-ch="level|avanzado"]'); await page.click('#ob-next');
await page.clock.runFor(900); for (let i = 0; i < 4; i++) await page.click('#gd-next'); await page.clock.runFor(2600);
await page.clock.runFor(6000);
// Competir sin carrera configurada: igual se puede entrenar cada estación
await page.click('#tabs [data-tab=hyrox]'); await page.clock.runFor(400);
R.grid = await page.$$eval('.hxs-cell', x => x.map(y => y.querySelector('b').textContent));
R.arts = await page.$$eval('.hxs-cell svg.hx-art', x => x.length);
await page.evaluate(() => document.querySelector('.hxs-grid').scrollIntoView({ block: 'start' }));
await shot('v46-estaciones.png');
await page.click('[data-cpst=ski]'); await page.clock.runFor(300);
R.station = await page.evaluate(() => ({ title: document.querySelector('.hxs h3').textContent, mode: document.querySelector('.hxs-mode .on').textContent, anim: document.querySelectorAll('.hxs-art animate').length > 10 }));
await shot('v46-ski-competencia.png');
await page.click('[data-hxsm="1"]'); await page.clock.runFor(300);
R.stationPF = await page.evaluate(() => ({ title: document.querySelector('.hxs h3').textContent, dose: document.querySelector('.hxs-dose').textContent, tag: document.querySelector('.hxs-art text').textContent }));
await shot('v46-ski-pf.png');
// Entrenar sola (versión PF): primera marca → LOGRO DESBLOQUEADO
const runStation = async sec => {
  await page.evaluate(() => window.onWatchCmd('play', Date.now())); await page.clock.runFor(sec * 1000);
  await page.evaluate(() => window.onWatchCmd('next', Date.now())); await page.clock.runFor(900);
};
await page.click('#hxs-go'); await page.clock.runFor(300);
R.timer = await page.evaluate(() => ({ seg: hxt().segs[0].n, pf: hxt().pf }));
await runStation(250);
R.hype1 = await page.evaluate(() => (document.querySelector('.hype') || {}).innerText);
await shot('v46-logro-primera.png');
await page.clock.runFor(6000); await page.evaluate(() => closeModal(true));
// Segundo intento más lento → Apollo
await page.evaluate(() => { hxsPF = true; openHxStation('ski'); }); await page.click('#hxs-go'); await page.clock.runFor(300);
await runStation(262);
R.hype2 = await page.evaluate(() => (document.querySelector('.hype') || {}).innerText);
await shot('v46-apollo-estacion.png');
await page.clock.runFor(7000); await page.evaluate(() => closeModal(true));
// Tercer intento más rápido → récord
await page.evaluate(() => { openHxStation('ski'); }); await page.click('#hxs-go'); await page.clock.runFor(300);
await runStation(241);
R.hype3 = await page.evaluate(() => (document.querySelector('.hype') || {}).innerText);
await page.clock.runFor(6000); await page.evaluate(() => closeModal(true));
R.skiRecord = await page.evaluate(() => { openHxStation('ski'); return document.querySelector('.hx-kpis').innerText.replace(/\s+/g, ' '); });
await shot('v46-ski-record.png');
await page.evaluate(() => closeModal(true));
// Competencia: 1 km individual
await page.evaluate(() => { hxsPF = false; openHxStation('run'); }); await page.clock.runFor(200);
R.run = await page.evaluate(() => document.querySelector('.hxs h3').textContent);
await page.click('#hxs-go'); await runStation(235);
R.hype4 = await page.evaluate(() => (document.querySelector('.hype') || {}).innerText);
await page.clock.runFor(6000); await page.evaluate(() => closeModal(true));

// Gimnasio: récord → logro; ejercicio terminado sin récord → Apollo
await page.evaluate(() => {
  const d = addDays(todayStr(), -7), t0 = parseDate(d).getTime() + 3.6e7;
  DB.sessions.push({ id: 'old', routine: 'libre', dayName: 'Pierna', date: d, start: t0, end: t0 + 3e6, extra: [], swaps: {} });
  DB.lifts.push({ id: 'o1', ex: 'Sentadilla con barra', w: 100, r: 5, rir: 2, date: d, t: t0, sid: 'old' }, { id: 'o2', ex: 'Press banca con barra', w: 80, r: 6, rir: 1, date: d, t: t0 + 1, sid: 'old' });
  startSession('libre'); const s = activeSession(); s.extra = [['Sentadilla con barra', 1, '5', 120], ['Press banca con barra', 2, '6', 120]]; saveData();
});
const logSet = (ex, w, r) => page.evaluate(([ex, w, r]) => { const s = activeSession(); const set = { id: uid(), ex, w, r, rir: 1, date: todayStr(), t: Date.now(), sid: s.id }; DB.lifts.push(set); checkSetRecords(set); saveData(); }, [ex, w, r]);
await logSet('Sentadilla con barra', 105, 5); await page.clock.runFor(800);
R.gymWin = await page.evaluate(() => (document.querySelector('.hype') || {}).innerText);
await shot('v46-logro-gym.png');
await page.clock.runFor(6000);
await logSet('Press banca con barra', 75, 6); await page.clock.runFor(800);
R.gymMid = await page.evaluate(() => !!document.querySelector('.hype'));
await logSet('Press banca con barra', 75, 5); await page.clock.runFor(800);
R.gymApollo = await page.evaluate(() => (document.querySelector('.hype') || {}).innerText);
await shot('v46-apollo-gym.png');
await page.clock.runFor(7000);
// Ajustes en Logros: se puede apagar Apollo
await page.click('#tabs [data-tab=logros]'); await page.clock.runFor(400);
R.settings = await page.$$eval('.hy-set label', x => x.map(y => y.textContent.trim()));
await page.click('#hy-ap');
R.apolloOff = await page.evaluate(() => { apolloToast('x'); return { pref: DB.profile.apollo, shown: !!document.querySelector('.hy-apollo') }; });
console.log(JSON.stringify(R, null, 1));
console.log('ERRORS', JSON.stringify(errors));
await b.close();
