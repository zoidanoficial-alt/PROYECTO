import { chromium } from 'playwright';
const D = './';
const b = await chromium.launch(); const page = await (await b.newContext({ viewport: { width: 393, height: 851 }, deviceScaleFactor: 2 })).newPage(); await page.addInitScript(() => { window.MP_DEFAULT_PLAN = 'hyrox'; });
const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
page.on('dialog', d => d.accept());
const pause = ms => new Promise(r => setTimeout(r, ms));
await page.clock.install({ time: new Date('2026-11-20T10:00:00') });
await page.goto('http://127.0.0.1:8765/index.html');
const R = {};
await page.fill('#ob-name', 'Daniel'); for (let k = 0; k < 6; k++) await page.click('#ob-next');
await page.click('[data-ch="level|avanzado"]'); await page.click('#ob-next');
await page.clock.runFor(900); for (let i = 0; i < 4; i++) await page.click('#gd-next'); await page.clock.runFor(2600);
// Socio de Planet Fitness: el perfil HYROX propone "Planet Fitness" solo
await page.evaluate(() => { DB.profile.gym = 'pf'; saveData(); });
await page.click('#tabs [data-tab=train]'); await page.clock.runFor(300);
await page.click('#hxp-setup'); await page.clock.runFor(200);
R.equipDefault = await page.$eval('#hs-eq', s => s.value);
await page.fill('#hs-date', '2027-03-19'); await page.click('#hs-s'); await page.clock.runFor(300);
R.isPF = await page.evaluate(() => hxIsPF());
R.pfCard = await page.evaluate(() => !!document.querySelector('#pf-open'));
// Pantalla PF: 8 estaciones con sustituto, comparables y "contra ti"
await page.click('#pf-open'); await page.clock.runFor(300);
R.stations = await page.$$eval('.pf-st', x => x.map(y => y.querySelector('b').textContent + ' [' + y.querySelector('.pf-tag').textContent + ']'));
await pause(500); await page.screenshot({ path: D + 'v41-pf.png' });
await page.evaluate(() => closeModal());
// Primera prueba: 1 km en caminadora (comparable)
await page.evaluate(() => { hx().results.push({ id: 'r1', kind: 'run1k', sec: 240, date: '2026-11-18', t: 1, rpe: 9 }); saveData(); });
R.mission1 = await page.evaluate(() => { const m = hxMission(); return { assess: m.assess, why: m.why }; });
// Cronometrar el sustituto de SkiErg con el temporizador
await page.evaluate(() => { hxtCreate('station', 'ski'); }); await page.clock.runFor(200);
R.timerName = await page.evaluate(() => document.querySelector('#hxt-name').textContent + ' · ' + hxt().segs[0].d);
await page.evaluate(() => window.onWatchCmd('play', Date.now())); await page.clock.runFor(185000); await page.evaluate(() => window.onWatchCmd('next', Date.now())); await page.clock.runFor(300);
R.skiResult = await page.evaluate(() => { const r = hx().results.filter(x => x.st === 'ski'); return { n: r.length, pf: r[0].pf, inStandard: hxResults('st', 'ski').length, bestPF: hxBestPF('ski').sec }; });
await page.click('#hts-ok'); await page.clock.runFor(200);
R.mission2 = await page.evaluate(() => hxMission().assess);
// Segunda vez: más rápido → compara contra su marca PF
await page.evaluate(() => { hxtCreate('station', 'ski'); window.onWatchCmd('play', Date.now()); }); await page.clock.runFor(170000); await page.evaluate(() => window.onWatchCmd('next', Date.now())); await page.clock.runFor(300);
R.skiImprove = await page.evaluate(() => [...document.querySelectorAll('.pg-rec small')].map(x => x.innerText).find(t => /mejor marca|más rápido/.test(t)));
await page.click('#hts-ok'); await page.clock.runFor(200);
// Estaciones comparables y no comparables medidas → predicción con 4 comparables
await page.evaluate(() => { const add = (st, sec, pf) => hx().results.push({ id: 'x' + st, kind: 'st', st, sec, date: '2026-11-19', t: 2, rpe: 9, std: !pf, pf });
  add('bbj', 330, false); add('row', 255, false); add('farm', 120, false); add('lunge', 410, false); add('push', 150, true); add('pull', 200, true); add('wb', 290, true);
  hx().results.push({ id: 'c1', kind: 'comp', sec: 285, date: '2026-11-19', t: 3, rpe: 9 }); saveData(); });
R.pred = await page.evaluate(() => { const p = hxPredict(); return { ok: p.ok, est: p.parts.filter(x => x.how === 'estimado').map(x => x.k), range: hxT(p.lo) + '–' + hxT(p.hi), flag: p.flags.find(f => /Planet/.test(f)) || null }; });
// Sesiones adaptadas a PF
R.sessions = await page.evaluate(() => { const lib = hxSessionLib(240); return { push: lib.station('push').blocks.map(b => b[1]).join(' | ').slice(0, 160), comp: lib.comp.blocks[1][1].slice(0, 140), dur: lib.durability.blocks[1][1], strength: lib.strengthLegs.blocks[1][1] }; });
// Sin poleas en el club → ski usa la alternativa
R.noCables = await page.evaluate(() => { DB.profile.pfMachines = Object.assign({}, DB.profile.pfMachines, { poleas: 'no' }); return pfSubFor('ski').use; });
// Simulación PF completa: nombres sustitutos y no cuenta para "Mi escalera"
await page.evaluate(() => { hxtCreate('race'); const t = hx().timer; R_names = t.segs.filter(s => s.k !== 'run').map(s => s.n); const t0 = Date.now() - 5000e3; t.t0 = t0; t.segs.forEach((s, i) => { s.start = t0 + i * 5000e3 / 16; s.end = t0 + (i + 1) * 5000e3 / 16; }); t.i = 15; t.segs[15].end = null; saveData(); hxtCommand('next', Date.now()); });
await page.clock.runFor(300);
R.raceNames = await page.evaluate(() => R_names);
R.simPF = await page.evaluate(() => ({ sim: hx().results.filter(r => r.kind === 'sim').map(r => r.pf), ladderBest: hxMyBest() }));
await page.click('#hts-ok'); await page.clock.runFor(200);
// Usuario que NO es de PF: todo igual que antes
R.nonPF = await page.evaluate(() => { DB.profile.gym = 'completo'; hx().profile.equip = 'full'; const lib = hxSessionLib(240); return { isPF: hxIsPF(), name: lib.station('push').n, seg: hxtSegments('station', 'wb')[0].n }; });
console.log(JSON.stringify(R, null, 1));
console.log('ERRORS', JSON.stringify(errors));
await b.close();
