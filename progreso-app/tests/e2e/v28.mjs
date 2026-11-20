import { chromium } from 'playwright';
const D = './out/';
const b = await chromium.launch(); const page = await (await b.newContext({ viewport: { width: 393, height: 851 }, deviceScaleFactor: 2 })).newPage();
const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('dialog', d => d.accept());
await page.clock.install({ time: new Date('2026-10-15T10:00:00') });   // jueves: descanso con L/X/V
await page.goto('http://127.0.0.1:8765/index.html');
const R = {}; const pause = ms => new Promise(r => setTimeout(r, ms));
await page.fill('#ob-name', 'Ana'); await page.click('#ob-next');
await page.click('[data-ch="minutes|30"]'); await page.click('[data-ch="recovery|mal"]'); await page.click('#ob-next');
await page.click('#ob-next');
await page.click('[data-ch="phase|definicion"]'); await page.click('#ob-next');
await page.click('#ob-next'); await page.click('#ob-next');
R.obNote = await page.textContent('.adapt-note');
await page.click('#ob-next');
await page.clock.runFor(900); for (let i = 0; i < 4; i++) await page.click('#gd-next'); await page.clock.runFor(2600);
R.plan = await page.evaluate(() => ({ why: DB.profile.planWhy, wos: DB.workouts.map(w => ({ n: w.name, ex: w.ex.map(e => e[0] + ' ' + e[1] + 'x' + e[2] + ' ' + e[3]) })), days: DB.plan.map(x => !!x) }));
// 1) Día de descanso: misión de recuperación
await page.evaluate(() => scrollTo(0, 0));
R.rest = await page.evaluate(() => ({ eyebrow: document.querySelector('.hero .eyebrow').textContent, h3: document.querySelector('.hero h3').textContent, p: document.querySelector('.hero p').textContent, items: [...document.querySelectorAll('[data-recov]')].map(x => x.dataset.recov), anyway: !!document.querySelector('#home-anyway'), train: !!document.querySelector('#home-train') }));
await pause(450); await page.screenshot({ path: D + 'v28-descanso.png' });
await page.click('[data-recov="walk"]'); await page.clock.runFor(200);
R.walkOn = await page.evaluate(() => document.querySelector('[data-recov="walk"]').classList.contains('on'));
await page.click('#home-recov'); await page.clock.runFor(200);
R.recovDone = await page.evaluate(() => !!document.querySelector('.rest-mission .m-out') && !document.querySelector('#home-recov'));
// 2) Plan: por qué esta rutina
await page.click('#tabs [data-tab=train]'); await page.clock.runFor(300);
R.why = await page.evaluate(() => { const d = document.querySelector('.rc-why'); if (d) d.open = true; return d ? d.querySelectorAll('li').length : 0; });
await page.evaluate(() => document.querySelector('.rc-why') && document.querySelector('.rc-why').scrollIntoView());
await pause(450); await page.screenshot({ path: D + 'v28-plan.png' });
// 3) Viernes: primer entreno guiado
await page.clock.setSystemTime(new Date('2026-10-16T10:00:00'));
await page.evaluate(() => showTab('home')); await page.clock.runFor(300);
R.fri = await page.evaluate(() => ({ eyebrow: document.querySelector('.hero .eyebrow').textContent, out: document.querySelector('.m-out') && document.querySelector('.m-out').textContent }));
await page.click('#home-train'); await page.clock.runFor(400);
R.guided = await page.evaluate(() => ({ cards: document.querySelectorAll('.ex-card.guided').length, open: document.querySelectorAll('.ex-card.guided.open').length, how: !!document.querySelector('.g-how li'), eff: document.querySelectorAll('.eff-row button').length, ck: !!document.querySelector('.ck-prompt'), env: !!document.querySelector('.env-row'), goal: document.querySelector('.g-goal b').textContent }));
await pause(450); await page.screenshot({ path: D + 'v28-sesion.png', fullPage: false });
await page.evaluate(() => document.querySelector('.eff-row').scrollIntoView({ block: 'center' })); await pause(300); await page.screenshot({ path: D + 'v28-sesion-registro.png' });
// registra todas las series
const exN = await page.evaluate(() => sessionExercises(activeSession()).length);
for (let i = 0; i < exN; i++) {
  const sets = await page.evaluate(i => sessionExercises(activeSession())[i][1], i);
  await page.evaluate(i => { SESS_UI.open = i; renderSession(activeSession()); }, i);
  for (let k = 0; k < sets; k++) {
    await page.fill(`#w-${i}`, String(20 + i * 5)); await page.fill(`#r-${i}`, '12');
    await page.click(`#save-${i}`); await page.clock.runFor(200);
  }
}
await page.evaluate(() => stopRest());
R.allDone = await page.evaluate(() => ({ card: !!document.querySelector('.all-done'), btn: document.querySelector('#ss-finish').textContent }));
await page.evaluate(() => document.querySelector('.all-done').scrollIntoView({ block: 'center' }));
await pause(450); await page.screenshot({ path: D + 'v28-completo.png' });
await page.click('#ss-finish'); await page.clock.runFor(600);
R.sum = await page.evaluate(() => ({ h: document.querySelector('.rs-head h3').textContent, stage: document.querySelector('.rs-stage') && document.querySelector('.rs-stage').textContent, rows: document.querySelectorAll('.rs-row').length, next: document.querySelectorAll('.rs-next').length, when: document.querySelector('.rs-when') && document.querySelector('.rs-when').textContent, fb: !!document.querySelector('[data-fb]') }));
await pause(450); await page.screenshot({ path: D + 'v28-resultado.png' });
await page.click('[data-fb="medio"]'); await page.fill('#fb-note', 'No sabía el peso'); await page.clock.runFor(100);
await pause(450); await page.screenshot({ path: D + 'v28-resultado-fb.png', fullPage: false });
await page.click('#sum-ok'); await page.clock.runFor(300);
// 4) Segunda vez: el objetivo clave sale del historial
await page.clock.setSystemTime(new Date('2026-10-19T10:00:00'));   // lunes
await page.evaluate(() => showTab('home')); await page.clock.runFor(300);
R.mon = await page.evaluate(() => ({ eyebrow: document.querySelector('.hero .eyebrow').textContent, out: document.querySelector('.m-out').textContent, path: document.querySelector('.path-card .pc-head').textContent, done: document.querySelector('.pc-stages li.done small') && document.querySelector('.pc-stages li.done small').textContent, now: document.querySelector('.pc-stages li.now') && document.querySelector('.pc-stages li.now').textContent }));
await page.evaluate(() => scrollTo(0, 0)); await pause(450); await page.screenshot({ path: D + 'v28-hoy2.png' });
await page.evaluate(() => document.querySelector('.path-card').scrollIntoView({ block: 'center' })); await pause(450); await page.screenshot({ path: D + 'v28-camino.png' });
await page.click('#home-train'); await page.clock.runFor(400);
R.goal2 = await page.evaluate(() => document.querySelector('.g-goal b').textContent);
await page.evaluate(() => exitSession()); await page.clock.runFor(300);
// 5) Progreso: historia por ejercicio
await page.click('#tabs [data-tab=progress]'); await page.clock.runFor(300);
R.prog = await page.evaluate(() => { const d = document.querySelector('.bp-ex'); if (d) d.open = true; return { n: document.querySelectorAll('.bp-ex').length, story: d && d.querySelector('.story').innerText }; });
await pause(450); await page.screenshot({ path: D + 'v28-progreso.png' });
// 6) Explorar: reporte anónimo
await page.click('#tabs [data-tab=more]'); await page.clock.runFor(300);
R.report = await page.evaluate(() => { const r = usageReport(); return { fb: !!document.querySelector('.fb-card'), r, hasName: JSON.stringify(r).includes('Ana') }; });
// 7) Ajustar rutina
await page.evaluate(() => openPlanTune()); await page.click('[data-pt="days|4"]'); await page.click('[data-pt="minutes|60"]'); await page.click('[data-pt="recovery|bien"]'); await page.click('#pt-ok'); await page.clock.runFor(300);
R.tuned = await page.evaluate(() => ({ wos: DB.workouts.map(w => w.name + ':' + w.ex.length + ':' + w.ex[0][1]), plan: DB.plan.map(x => x ? DB.workouts.find(w => w.id === x).name : '-'), why: DB.profile.planWhy[0] }));
R.stages = await page.evaluate(() => {
  const out = [], seed = (date, w) => { const sid = 'q' + date; const t0 = parseDate(date).getTime() + 3.6e7; DB.sessions.push({ id: sid, routine: 'custom', dayId: 'w0', dayName: 'Seed', date, start: t0, end: t0 + 3e6, extra: [], swaps: {}, base: [['Sentadilla en Smith', 2, '10–12', 90]] }); DB.lifts.push({ id: 'l1' + date, ex: 'Sentadilla en Smith', w: w, r: 10, rir: 2, date, t: t0 + 1, sid }, { id: 'l2' + date, ex: 'Sentadilla en Smith', w: w, r: 10, rir: 2, date, t: t0 + 2, sid }); };
  out.push(pathState().doneN); seed('2026-10-19', 20); out.push(pathState().doneN); seed('2026-10-21', 20); out.push(pathState().doneN); seed('2026-10-23', 25); out.push(pathState().doneN);
  return { seq: out, proof: PATH[2].proof(), story: exStory('Sentadilla en Smith').improved, next: exStory('Sentadilla en Smith').next.txt };
});
console.log(JSON.stringify(R, null, 1), 'ERRORS', JSON.stringify(errors));
await b.close();
