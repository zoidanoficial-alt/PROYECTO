import { chromium } from 'playwright';
const D = './out/';
const b = await chromium.launch(); const page = await (await b.newContext({ viewport: { width: 393, height: 851 }, deviceScaleFactor: 2 })).newPage();
const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('dialog', d => d.accept());
const pause = ms => new Promise(r => setTimeout(r, ms));
await page.clock.install({ time: new Date('2026-10-16T10:00:00') });
await page.goto('http://127.0.0.1:8765/index.html');
const R = {};
await page.fill('#ob-name', 'Dan'); for (let k = 0; k < 6; k++) await page.click('#ob-next');
await page.click('[data-ch="level|avanzado"]'); await page.click('#ob-next');
await page.clock.runFor(900); for (let i = 0; i < 4; i++) await page.click('#gd-next'); await page.clock.runFor(2600);
// Mi rutina (semana): rutinas famosas arriba
await page.evaluate(() => { useRoutine('pro'); personalizeRoutine('pro'); }); await page.clock.runFor(300);
await page.click('#tabs [data-tab=train]'); await page.clock.runFor(300);
await page.click('#rc-edit'); await page.clock.runFor(300);
R.editor = await page.evaluate(() => ({ fam: [...document.querySelectorAll('[data-wef]')].map(b => b.innerText.replace(/\s+/g, ' ')), rows: document.querySelectorAll('.we-row').length, label: document.querySelector('.we-row b').textContent }));
await pause(400); await page.screenshot({ path: D + 'v30-mirutina.png' });
await page.click('[data-wef="cbum"]'); await page.clock.runFor(300);
R.cbumPrev = await page.evaluate(() => [...document.querySelectorAll('.rp-day[open] li')].map(li => li.innerText.replace(/\s+/g, ' ')));
await pause(400); await page.screenshot({ path: D + 'v30-cbum-preview.png' });
await page.click('#rp-custom'); await page.clock.runFor(300);
R.week = await page.evaluate(() => DB.plan.map(x => x ? workoutById(x).name : 'Descanso'));
// Kit
await page.evaluate(() => openCompete()); await page.clock.runFor(300);
R.kit = await page.evaluate(() => [...document.querySelectorAll('[data-kit]')].map(b => b.querySelector('b').textContent));
await pause(400); await page.screenshot({ path: D + 'v30-kit.png' });
await page.click('[data-kit="cbum"]'); await page.clock.runFor(300);
R.sessions = await page.evaluate(() => document.querySelectorAll('[data-cbs]').length);
await page.click('[data-cbs="cb-q24"]'); await page.clock.runFor(300);
R.q24 = await page.evaluate(() => [...document.querySelectorAll('.cbs-list li')].map(li => li.innerText.replace(/\s+/g, ' ')));
await pause(400); await page.screenshot({ path: D + 'v30-cbum-sesion.png' });
await page.click('#cbs-go'); await page.clock.runFor(400);
R.started = await page.evaluate(() => { const s = activeSession(); return { name: s.dayName, ex: sessionExercises(s).map(e => e[0]) }; });
await page.evaluate(() => exitSession()); await page.clock.runFor(300);
// Mi show + poses
await page.evaluate(() => { DB.profile.comp = { cat: 'classic', date: '2027-02-12' }; saveData(); openPoseGuide(); }); await page.clock.runFor(300);
R.poses = await page.evaluate(() => [...document.querySelectorAll('.pose-list b')].map(x => x.textContent));
await pause(400); await page.screenshot({ path: D + 'v30-poses.png' });
await page.click('[data-ph="20"]'); await page.click('#pz-go'); await page.clock.runFor(2000);
R.practice = await page.evaluate(() => document.querySelector('.pp-name').textContent + ' · ' + document.querySelector('.pp-time').textContent);
await pause(300); await page.screenshot({ path: D + 'v30-practica.png' });
await page.clock.runFor(40000); await page.click('#pp-stop'); await page.clock.runFor(300);
R.posing = await page.evaluate(() => posingMinutes(7) + ' min · ' + (DB.posing || []).length);
await page.click('#pp-ok'); await page.clock.runFor(300);
// Nutrición
await page.evaluate(() => openCompNutrition()); await page.clock.runFor(300);
R.nutri = await page.evaluate(() => [...document.querySelectorAll('.cn-grid b')].map(x => x.textContent).join(' | '));
await pause(400); await page.screenshot({ path: D + 'v30-nutricion.png' });
await page.click('#cn-apply'); await page.clock.runFor(300);
R.targets = await page.evaluate(() => { const t = targets(); return [t.kcal, t.protein, t.carbs, t.fat]; });
// Check-in
await page.evaluate(() => openCheckinWeekly()); await page.clock.runFor(300);
await page.fill('#ck-waist', '82'); await page.click('[data-ck="energy|4"]'); await page.click('#ck-save'); await page.clock.runFor(300);
R.checkin = await page.evaluate(() => DB.checkins);
// México, topes, show
for (const f of ['openCompeteMexico', 'openCpCaps', 'openShowDay']) { await page.evaluate(f => window[f](), f); await page.clock.runFor(200); }
R.caps = await page.evaluate(() => { openCpCaps(); return [...document.querySelectorAll('.cn-grid b')].map(x => x.textContent).join(' | '); });
await pause(300); await page.screenshot({ path: D + 'v30-tope.png' });
R.rot = await page.evaluate(() => ({ cbum: getRoutine('cbum').days.map(d => d.rest ? 'R' : d.ex.length).join(','), cbum24: getRoutine('cbum24').days.map(d => d.rest ? 'R' : d.ex.length).join(','), pfMiss: ['Pendulum squat', 'Belt squat', 'Hammer Strength press', 'Remo alto en máquina'].map(n => n + '→' + adaptedName(n)) }));
console.log(JSON.stringify(R, null, 1), 'ERRORS', JSON.stringify(errors));
await b.close();
