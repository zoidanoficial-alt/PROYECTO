import { chromium } from 'playwright';
const D = './';
const b = await chromium.launch(); const page = await (await b.newContext({ viewport: { width: 393, height: 851 }, deviceScaleFactor: 2 })).newPage(); await page.addInitScript(() => { window.MP_DEFAULT_PLAN = 'hyrox'; });
const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
page.on('dialog', d => d.accept());
const pause = ms => new Promise(r => setTimeout(r, ms));
await page.clock.install({ time: new Date('2026-11-16T10:00:00') });   // lunes
await page.goto('http://127.0.0.1:8765/index.html');
const R = {};
await page.fill('#ob-name', 'Daniel'); for (let k = 0; k < 6; k++) await page.click('#ob-next');
await page.click('[data-ch="level|avanzado"]'); await page.click('#ob-next');
await page.clock.runFor(900); for (let i = 0; i < 4; i++) await page.click('#gd-next'); await page.clock.runFor(2600);
// Historial de sentadilla (máximo estimado ~100 kg) para la carga del 60 %
await page.evaluate(() => { const d = '2026-11-10', t0 = parseDate(d).getTime() + 3.6e7; DB.sessions.push({ id: 'h1', routine: 'libre', dayName: 'Pierna', date: d, start: t0, end: t0 + 3e6, extra: [], swaps: {} }); DB.lifts.push({ id: 'l1', ex: 'Sentadilla con barra', w: 87.5, r: 5, rir: 1, date: d, t: t0, sid: 'h1' }, { id: 'l2', ex: 'Sentadilla goblet con mancuerna', w: 30, r: 12, rir: 2, date: d, t: t0 + 1, sid: 'h1' }); saveData(); });
// Explorar → Resistencia
await page.click('#tabs [data-tab=more]'); await page.clock.runFor(300);
await page.evaluate(() => document.querySelector('[data-explore=resist]').scrollIntoView()); await page.click('[data-explore=resist]'); await page.clock.runFor(300);
R.intro = await page.evaluate(() => [...document.querySelectorAll('.res-sci b')].map(x => x.textContent));
await pause(500); await page.screenshot({ path: D + 'v40-resistencia.png' });
// Pruebas iniciales
await page.click('[data-rt=rep60]'); await page.clock.runFor(200);
R.load60 = await page.evaluate(() => (document.querySelector('.modal').innerText.match(/Tu carga: ([\d.,]+) kg/) || [])[1]);
await page.fill('#rt-v', '14'); await page.click('#rt-s'); await page.clock.runFor(200);
await page.click('[data-rt=pushups]'); await page.clock.runFor(200); await page.fill('#rt-v', '22'); await page.click('#rt-s'); await page.clock.runFor(200);
await page.click('[data-rt=plank]'); await page.clock.runFor(200); await page.click('#rt-go'); await page.clock.runFor(75000); await page.click('#rt-go');
R.plankTimed = await page.evaluate(() => document.querySelector('#rt-v').value); await page.click('#rt-s'); await page.clock.runFor(200);
// Iniciar programa
await page.click('#res-go'); await page.clock.runFor(200);
R.week1 = await page.evaluate(() => ({ ph: resPhase().n, A: resSessionEx('A').map(e => e.slice(1).join(' · ')), B: resSessionEx('B')[0], next: resNext().k }));
R.load60goblet = await page.evaluate(() => resLoad60('Sentadilla goblet con mancuerna'));
await pause(400); await page.screenshot({ path: D + 'v40-programa.png' });
// Ponerlo en la semana: lunes, miércoles, viernes
await page.click('#res-week'); await page.clock.runFor(200);
for (const d of [0, 2, 4]) await page.click(`[data-d="${d}"]`);
await page.click('#rd-s'); await page.clock.runFor(200);
R.plan = await page.evaluate(() => DB.plan.map(id => { const w = workoutById(id); return w ? w.name : null; }));
// Empezar la sesión A: corre en el motor de entrenos de la app
await page.click('[data-rs=A]'); await page.clock.runFor(400);
R.session = await page.evaluate(() => { const s = activeSession(); return s && { name: s.dayName, ex: s.base.map(e => e[0] + ' ' + e[1] + '×' + e[2] + ' ' + e[3] + 's') }; });
// Terminar A y ver que la siguiente es B
await page.evaluate(() => { const s = activeSession(); s.end = Date.now(); DB.active = null; saveData(); });
R.nextAfterA = await page.evaluate(() => resNext());
// Plan muestra la tarjeta
await page.click('#tabs [data-tab=train]'); await page.clock.runFor(300);
R.card = await page.evaluate(() => (document.querySelector('.res-card') || {}).innerText);
// Semana 3: fase de desarrollo, más series y menos descanso; los entrenos de la semana se actualizan solos
await page.evaluate(() => { DB.resist.start = addDays(todayStr(), -14); renderTrain(); });
R.week3 = await page.evaluate(() => ({ ph: resPhase().n, A0: resSessionEx('A')[0], planA: workoutById(DB.plan[0]).ex[0] }));
R.week5 = await page.evaluate(() => { DB.resist.start = addDays(todayStr(), -28); return { ph: resPhase().n, C0: resSessionEx('C')[0] }; });
R.week6 = await page.evaluate(() => { DB.resist.start = addDays(todayStr(), -35); return { ph: resPhase().n, B0: resSessionEx('B')[0] }; });
// Repetir prueba: mejora
await page.evaluate(() => openResist()); await page.clock.runFor(200);
await page.click('[data-rt=rep60]'); await page.clock.runFor(200); await page.fill('#rt-v', '24'); await page.click('#rt-s'); await page.clock.runFor(200);
R.testDelta = await page.evaluate(() => document.querySelector('[data-rt=rep60] em').textContent);
// HYROX tab incluye Resistencia
await page.evaluate(() => closeModal()); await page.click('#tabs [data-tab=train]'); await page.clock.runFor(300);
R.hyroxItem = await page.evaluate(() => !!document.querySelector('[data-hxp=resist]'));
console.log(JSON.stringify(R, null, 1));
console.log('ERRORS', JSON.stringify(errors));
await b.close();
