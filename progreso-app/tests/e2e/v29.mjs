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
R.gym = await page.evaluate(() => ({ gym: DB.profile.gym, bfija: DB.profile.equip.includes('bfija'), barra: DB.profile.equip.includes('barra') }));
// Explorar → Competir
await page.click('#tabs [data-tab=more]'); await page.clock.runFor(300);
await page.click('[data-explore="compite"]'); await page.clock.runFor(300); await page.click('[data-kit="programs"]'); await page.clock.runFor(300);
R.list = await page.evaluate(() => [...document.querySelectorAll('[data-cmp]')].map(b => b.innerText.replace(/\s+/g, ' ').trim()));
await pause(400); await page.screenshot({ path: D + 'v29-competir.png' });
await page.click('[data-cmp="arnold1"]'); await page.clock.runFor(300);
R.preview = await page.evaluate(() => ({ note: document.querySelector('.adapt-note') && document.querySelector('.adapt-note').innerText, swaps: [...document.querySelectorAll('.rp-day[open] li')].map(li => li.innerText.replace(/\s+/g, ' ')) }));
await pause(400); await page.screenshot({ path: D + 'v29-preview.png' });
await page.click('#rp-start'); await page.clock.runFor(400);
R.session = await page.evaluate(() => { const s = activeSession(); return { name: s.dayName, ex: sessionExercises(s).map(e => e[0]), adapt: Object.values(s.adapt || {}) }; });
await pause(400); await page.screenshot({ path: D + 'v29-sesion.png' });
await page.evaluate(() => exitSession()); await page.clock.runFor(300);
// Club con half rack: la sentadilla con barra se queda
await page.evaluate(() => { DB.profile.pfMachines = { rack: 'si' }; DB.profile.equip.push('barra'); saveData(); });
R.withRack = await page.evaluate(() => ['Sentadilla con barra', 'Peso muerto', 'Press banca con barra'].map(n => adaptedName(n)));
await page.evaluate(() => { DB.profile.pfMachines = {}; DB.profile.equip = DB.profile.equip.filter(e => e !== 'barra'); saveData(); });
R.noRack = await page.evaluate(() => ['Sentadilla con barra', 'Peso muerto', 'Press banca con barra', 'Remo en T (Magnum)', 'Fondos en paralelas (con lastre)', 'Curl femoral tumbado', 'Prensa 45°', 'Dominadas / chin-ups', 'Hack squat'].map(n => n + ' → ' + adaptedName(n)));
// Hoja de máquinas
await page.evaluate(() => openPfSheet()); await page.clock.runFor(300);
R.sheet = await page.evaluate(() => ({ items: document.querySelectorAll('.pf-item').length, secs: [...document.querySelectorAll('.pf-sec')].map(x => x.textContent) }));
await page.evaluate(() => { const m = document.querySelector('#modal'); const x = [...document.querySelectorAll('.pf-sec')][1]; x.scrollIntoView(); });
await pause(400); await page.screenshot({ path: D + 'v29-maquinas.png' });
await page.click('#pf-ok'); await page.clock.runFor(300);
// Plan: preparación
await page.evaluate(() => { useRoutine('cbum'); }); await page.clock.runFor(300);
await page.evaluate(() => { DB.profile.comp = { cat: 'classic', date: '2027-01-08' }; saveData(); renderTrain(); }); await page.clock.runFor(300);
R.comp = await page.evaluate(() => { const c = document.querySelector('.comp-card'); return c && c.innerText.replace(/\s+/g, ' ').slice(0, 260); });
await page.evaluate(() => document.querySelector('.comp-card').scrollIntoView({ block: 'center' })); await pause(400); await page.screenshot({ path: D + 'v29-preparacion.png' });
R.cbumDays = await page.evaluate(() => getRoutine('cbum').days.map(d => d.rest ? 'R' : d.ex.length).join(','));
// Galería
await page.click('#rc-change'); await page.clock.runFor(300);
R.gallery = await page.evaluate(() => ({ sec: document.querySelector('.rg-sec') && document.querySelector('.rg-sec').textContent, comp: [...document.querySelectorAll('.rg-sec ~ .rg-card')].length }));
await page.evaluate(() => closeModal());
// Gimnasio completo: sin cambios a Magnum
await page.evaluate(() => { DB.profile.gym = 'completo'; DB.profile.equip = GYM_PRESETS.completo.equip.slice(); saveData(); });
R.full = await page.evaluate(() => routineAdaptCount('arnold2'));
console.log(JSON.stringify(R, null, 1), 'ERRORS', JSON.stringify(errors));
await b.close();
