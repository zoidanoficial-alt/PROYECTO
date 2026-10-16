import { chromium } from 'playwright';
const D = './out/';
const b = await chromium.launch(); const page = await (await b.newContext({ viewport: { width: 393, height: 851 }, deviceScaleFactor: 2 })).newPage();
const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('dialog', d => d.accept());
const pause = ms => new Promise(r => setTimeout(r, ms));
await page.clock.install({ time: new Date('2026-10-19T10:00:00') });
await page.goto('http://127.0.0.1:8765/index.html');
const R = {};
await page.fill('#ob-name', 'Daniel'); for (let k = 0; k < 6; k++) await page.click('#ob-next');
await page.click('[data-ch="level|avanzado"]'); await page.click('#ob-next');
await page.clock.runFor(900); for (let i = 0; i < 4; i++) await page.click('#gd-next'); await page.clock.runFor(2600);
// Historial: 7 sesiones en 5 semanas; las 3 últimas con caídas en press y sentadilla en Smith
const seed = (drops, badSleep) => page.evaluate(([drops, badSleep]) => {
  DB.lifts = []; DB.sessions = []; DB.days = {}; DB.checkins = [];
  const dates = ['2026-09-14', '2026-09-18', '2026-09-23', '2026-09-28', '2026-10-05', '2026-10-12', '2026-10-16'];
  dates.forEach((d, k) => {
    const sid = 's' + k, t0 = parseDate(d).getTime() + 3.6e7; DB.sessions.push({ id: sid, routine: 'pro', dayId: 'd1', dayName: 'Seed', date: d, start: t0, end: t0 + 3e6, extra: [], swaps: {} });
    const late = k >= 4, f = late && drops[k - 4] ? 0.88 : 1;
    [['Press banca con mancuernas', 30], ['Sentadilla en Smith', 80], ['Curl martillo', 14]].forEach(([ex, w], j) => DB.lifts.push({ id: sid + j, ex, w: w * f, r: 8, rir: 2, date: d, t: t0 + j, sid }));
    DB.days[d] = { weight: 88 - k * 0.3 };
  });
  for (let i = 0; i < 14; i++) { const d = addDays('2026-10-19', -i); DB.days[d] = DB.days[d] || {}; DB.days[d].rec = { sleepH: badSleep && i < 7 ? 5.5 : 7.5, energy: badSleep && i < 7 ? 2 : 4 }; }
  DB.profile.phase = 'definicion'; saveData(); return perfGuard().k;
}, [drops, badSleep]);
R.alert = await seed([1, 1, 1], true);
R.watch2 = await seed([1, 1, 1], false);
R.isolated = await seed([0, 0, 1], false);
R.stable = await seed([0, 0, 0], false);
R.alert2 = await seed([1, 1, 1], true);
await page.click('#tabs [data-tab=train]'); await page.clock.runFor(300);
R.card = await page.evaluate(() => { const c = document.querySelector('.pg-card'); return c && c.innerText.replace(/\s+/g, ' ').slice(0, 200); });
await page.evaluate(() => document.querySelector('.pg-card').scrollIntoView({ block: 'center' })); await pause(400); await page.screenshot({ path: D + 'v32-proteccion.png' });
await page.click('#pg-open'); await page.clock.runFor(300);
R.detail = await page.evaluate(() => ({ recs: [...document.querySelectorAll('.pg-rec b')].map(x => x.textContent), rec: [...document.querySelectorAll('.comp-list li')].map(x => x.textContent) }));
await pause(400); await page.screenshot({ path: D + 'v32-proteccion-detalle.png' });
await page.click('#pg-fat'); await page.clock.runFor(300);
R.fatigue = await page.evaluate(() => DB.profile.fatigueUntil);
await page.click('#pg-x'); await page.clock.runFor(300);
// Sesión: calentamiento adaptativo y molestias (sin chequeo del día para usar la semana de menos fatiga)
await page.evaluate(() => { const t = todayStr(); delete DB.days[t].rec; saveData(); startSession('libre'); const s = activeSession(); s.base = [['Sentadilla en Smith', 3, '8–10', 120], ['Prensa de piernas (máquina)', 3, '10–12', 120], ['Curl martillo', 3, '10–12', 60]]; s.dayName = 'Prueba'; saveData(); showTab('train'); });
await page.clock.runFor(400);
R.adjust = await page.evaluate(() => activeSession().adjust);
R.warm1 = await page.evaluate(() => { const w = warmupPlan(activeSession(), sessionExercises(activeSession())[0], 0); return w && { sets: w.sets, why: w.why }; });
R.warmIso = await page.evaluate(() => warmupPlan(activeSession(), sessionExercises(activeSession())[2], 2));
R.painCard = await page.evaluate(() => !!document.querySelector('#pa-no'));
await pause(300); await page.screenshot({ path: D + 'v32-sesion-molestias.png' });
await page.click('[data-pa="rodilla"]'); await page.clock.runFor(300);
R.pain = await page.evaluate(() => document.querySelector('.pain-card').innerText.replace(/\s+/g, ' '));
await page.click('#pa-swap'); await page.clock.runFor(300);
R.swapped = await page.evaluate(() => sessionExercises(activeSession()).map(e => e[0]));
await page.click('#pa-clear'); await page.clock.runFor(300);
await page.evaluate(() => { const s = activeSession(); s.swaps = {}; s.adapt = {}; saveData(); SESS_UI.open = 0; renderSession(s); }); await page.clock.runFor(300);
await page.click('[data-warm="0|0"]'); await page.clock.runFor(200);
R.warmTick = await page.evaluate(() => activeSession().warm);
await page.evaluate(() => document.querySelector('.warm').scrollIntoView({ block: 'center' })); await pause(300); await page.screenshot({ path: D + 'v32-calentamiento.png' });
// Tras registrar la sentadilla, la prensa ya no pide 3 series (cuádriceps ya caliente)
await page.fill('#w-0', '80'); await page.fill('#r-0', '8'); await page.click('#save-0'); await page.clock.runFor(300); await page.evaluate(() => stopRest());
R.warm2 = await page.evaluate(() => { const w = warmupPlan(activeSession(), sessionExercises(activeSession())[1], 1); return w && w.why; });
console.log(JSON.stringify(R, null, 1), 'ERRORS', JSON.stringify(errors));
await b.close();
