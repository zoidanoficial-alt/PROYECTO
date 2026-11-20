import { chromium } from 'playwright';
const D = './out/';
const b = await chromium.launch(); const page = await (await b.newContext({ viewport: { width: 393, height: 851 }, deviceScaleFactor: 2 })).newPage();
const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('dialog', d => d.accept());
const pause = ms => new Promise(r => setTimeout(r, ms));
await page.clock.install({ time: new Date('2026-10-19T10:00:00') });   // lunes
await page.goto('http://127.0.0.1:8765/index.html');
const R = {};
await page.fill('#ob-name', 'Daniel'); for (let k = 0; k < 6; k++) await page.click('#ob-next');
await page.click('[data-ch="level|avanzado"]'); await page.click('#ob-next');
await page.clock.runFor(900); for (let i = 0; i < 4; i++) await page.click('#gd-next'); await page.clock.runFor(2600);
await page.evaluate(() => { personalizeRoutine('pro'); }); await page.clock.runFor(300);
// Plan: tira desplazable
await page.click('#tabs [data-tab=train]'); await page.clock.runFor(300);
R.strip = await page.evaluate(() => { const st = document.querySelector('.cp-strip'); return st ? { items: st.querySelectorAll('.cp-item').length, scrolls: st.scrollWidth > st.clientWidth, hint: document.querySelector('.cp-hint').textContent } : null; });
await pause(400); await page.screenshot({ path: D + 'v31-plan-tira.png' });
// Mi rutina: elegir por día
await page.click('#rc-edit'); await page.clock.runFor(300);
R.groups = await page.evaluate(() => [...document.querySelectorAll('[data-wep="1"] optgroup')].map(g => g.label + ' (' + g.children.length + ')'));
await page.selectOption('[data-wep="1"]', 'fam|cbs:cb-q24'); await page.clock.runFor(300);
await page.selectOption('[data-wep="2"]', 'fam|rd:heroe:h1'); await page.clock.runFor(300);
await page.selectOption('[data-wep="3"]', ''); await page.clock.runFor(300);
await page.selectOption('[data-wep="4"]', 'fam|rd:arnold1:a1'); await page.clock.runFor(300);
R.week = await page.evaluate(() => DB.plan.map((x, k) => WEEKDAYS[k].slice(0, 3) + ': ' + (x ? workoutById(x).name : 'Descanso')));
R.selected = await page.evaluate(() => document.querySelector('[data-wep="1"]').value);
await pause(400); await page.screenshot({ path: D + 'v31-mirutina-dias.png' });
// otra vez CBUM el sábado: reutiliza el mismo entreno
await page.selectOption('[data-wep="5"]', 'fam|cbs:cb-q24'); await page.clock.runFor(300);
R.reuse = await page.evaluate(() => DB.workouts.filter(w => w.fam === 'cbs:cb-q24').length);
await page.click('#we-ok'); await page.clock.runFor(300);
// Martes: entrenas como CBUM
await page.clock.setSystemTime(new Date('2026-10-20T10:00:00'));
await page.evaluate(() => showTab('home')); await page.clock.runFor(300);
R.eyebrow = await page.evaluate(() => document.querySelector('.hero .eyebrow').textContent);
await pause(400); await page.screenshot({ path: D + 'v31-hoy-cbum.png' });
await page.click('#home-train'); await page.clock.runFor(400);
R.session = await page.evaluate(() => ({ banner: document.querySelector('.coach-banner') && document.querySelector('.coach-banner').innerText.replace(/\s+/g, ' '), tip: document.querySelector('.cb-extip') && document.querySelector('.cb-extip').innerText, ex: sessionExercises(activeSession()).map(e => e[0]) }));
await pause(400); await page.screenshot({ path: D + 'v31-sesion-cbum.png' });
await page.evaluate(() => exitSession()); await page.clock.runFor(300);
// Miércoles: Tom Holland
await page.clock.setSystemTime(new Date('2026-10-21T10:00:00'));
await page.evaluate(() => showTab('home')); await page.clock.runFor(300);
R.wed = await page.evaluate(() => document.querySelector('.hero .eyebrow').textContent);
await page.click('#home-train'); await page.clock.runFor(400);
R.tom = await page.evaluate(() => document.querySelector('.coach-banner') && document.querySelector('.coach-banner').innerText.replace(/\s+/g, ' '));
await page.evaluate(() => exitSession()); await page.clock.runFor(300);
// Sesión suelta desde el kit
await page.evaluate(() => { previewCbumSession('cb-arm24'); }); await page.clock.runFor(300); await page.click('#cbs-go'); await page.clock.runFor(400);
R.loose = await page.evaluate(() => ({ coach: sessionCoach(activeSession()), banner: !!document.querySelector('.coach-banner') }));
await page.evaluate(() => exitSession()); await page.clock.runFor(300);
// Barra inferior con letra grande
await page.evaluate(() => { document.documentElement.style.fontSize = '130%'; document.body.style.zoom = '1.3'; }); await page.clock.runFor(200);
R.tabs = await page.evaluate(() => [...document.querySelectorAll('#tabs .tl')].filter(x => x.offsetParent).map(x => ({ t: x.textContent, over: x.scrollWidth > x.clientWidth + 1 })));
await pause(300); await page.screenshot({ path: D + 'v31-tabs-zoom.png' });
console.log(JSON.stringify(R, null, 1), 'ERRORS', JSON.stringify(errors));
await b.close();
