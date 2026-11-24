import { chromium } from 'playwright';
// 43.6 · Rutina HYROX por pesos: Gimnasio con trineos y Planet Fitness, 8 semanas con cargas
// calculadas desde el peso de competencia de tu categoría, y récord de kilos por ejercicio.
const D = './';
const b = await chromium.launch(); const page = await (await b.newContext({ viewport: { width: 393, height: 851 }, deviceScaleFactor: 2 })).newPage(); await page.addInitScript(() => { window.MP_DEFAULT_PLAN = 'hyrox'; });
const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
page.on('dialog', d => d.accept());
const pause = ms => new Promise(r => setTimeout(r, ms));
const shot = async (n, sel) => { if (sel) await page.evaluate(s => { const x = document.querySelector(s); if (x) x.scrollIntoView({ block: 'start' }); }, sel); await pause(450); await page.screenshot({ path: D + n }); };
await page.clock.install({ time: new Date('2026-11-24T10:00:00') });
await page.goto('http://127.0.0.1:8765/index.html');
const R = {};
await page.fill('#ob-name', 'Daniel'); for (let k = 0; k < 6; k++) await page.click('#ob-next');
await page.click('[data-ch="level|avanzado"]'); await page.click('#ob-next');
await page.clock.runFor(900); for (let i = 0; i < 4; i++) await page.click('#gd-next'); await page.clock.runFor(8600);
await page.evaluate(() => { hx().profile = { cat: 'open', sex: 'm', date: '2027-03-19', equip: 'gym', days: 5, exp: 'medio' }; planState().comp = 'ex'; saveData(); showTab('train'); });
await page.clock.runFor(400);
R.card = await page.evaluate(() => document.querySelector('#view-train [data-hxp=routine]').innerText.replace(/\s+/g, ' '));
await page.click('#view-train [data-hxp=routine]'); await page.clock.runFor(300);
const read = () => page.evaluate(() => ({ week: document.querySelector('.hr .ds-h').innerText.replace(/\s+/g, ' '), race: [...document.querySelectorAll('.hr-race > div')].map(x => x.innerText.replace(/\s+/g, ' ')), A: [...document.querySelectorAll('.hr-day')[0].querySelectorAll('li')].map(x => x.innerText.replace(/\s+/g, ' ')), B: [...document.querySelectorAll('.hr-day')[1].querySelectorAll('li')].map(x => x.innerText.replace(/\s+/g, ' ')) }));
R.gym1 = await read();
await shot('v52-1-gym.png');
await page.click('[data-hrw="5"]'); await page.clock.runFor(200);
R.gym6 = await read();
await shot('v52-2-gym-sem6.png', '.hr-day');
await page.click('[data-hrv="1"]'); await page.clock.runFor(200);
R.pf6 = await read();
await shot('v52-3-pf.png');
await shot('v52-4-pf-dias.png', '.hr-day');
await page.click('[data-hrw="7"]'); await page.clock.runFor(200);
R.pf8 = (await read()).B;
// Pro hombre: cargas mayores
await page.evaluate(() => { hx().profile.cat = 'pro'; hx().routine.pf = false; hrWeekSel = 3; openHxRoutine(); }); await page.clock.runFor(200);
R.pro4 = await read();
// Sesión de pierna en gimnasio, guardando kilos
await page.evaluate(() => { hx().profile.cat = 'open'; hrWeekSel = 0; openHxRoutine(); }); await page.clock.runFor(200);
await page.click('[data-hrgo="hr-gym-a"]'); await page.clock.runFor(300);
const kg = [100, 120, 85, 15, 70];
for (let i = 0; i < 5; i++) { await page.fill('#wp-val', String(kg[i])); await page.clock.runFor(60000); await page.click('#wp-go'); await page.clock.runFor(150); }
R.summary = await page.evaluate(() => document.querySelector('.wp-sum').innerText.replace(/\s+/g, ' ').slice(0, 300));
await shot('v52-5-resumen.png');
await page.click('#wp-save'); await page.clock.runFor(800);
R.best = await page.evaluate(() => Object.entries(wodDB().best).filter(([k]) => k.startsWith('hyrox|')).map(([k, v]) => k.split('|')[1] + ' ' + v.v + ' ' + v.u));
R.toast = await page.evaluate(() => (document.querySelector('.hype') || {}).innerText);
console.log(JSON.stringify(R, null, 1));
console.log('ERRORS', JSON.stringify(errors));
await b.close();
