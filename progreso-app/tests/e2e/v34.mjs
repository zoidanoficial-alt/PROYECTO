import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const D = './';
const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 393, height: 851 }, deviceScaleFactor: 2 }); const page = await ctx.newPage();
const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
page.on('dialog', d => d.accept());
const pause = ms => new Promise(r => setTimeout(r, ms));
const shot = async n => { await pause(700); await page.screenshot({ path: D + n }); };
// Catálogo "publicado" simulado: Guadalajara cambia de fecha y aparece un evento nuevo que el atleta sigue.
const cat = JSON.parse(readFileSync('../../../assets/www/data/events.json', 'utf8'));
const remote = JSON.parse(JSON.stringify(cat)); remote.generatedAt = '2099-01-01T00:00:00Z';
remote.events.find(e => e.id === 'hyrox-guadalajara-2027-03').startDate = '2027-03-20';
remote.events.push({ ...remote.events.find(e => e.id === 'hyrox-monterrey-2027-04'), id: 'hyrox-test-new', eventName: 'HYROX Prueba Nueva', startDate: '2027-09-01', endDate: '2027-09-02' });
let served = cat;   // al abrir Competiciones el remoto es igual al incluido; después se publica una versión con cambios
await page.route('https://raw.githubusercontent.com/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(served), headers: { 'access-control-allow-origin': '*' } }));
await page.clock.install({ time: new Date('2026-11-19T10:00:00') });
await page.goto('http://127.0.0.1:8765/index.html');
const R = {};
await page.fill('#ob-name', 'Daniel'); for (let k = 0; k < 6; k++) await page.click('#ob-next');
await page.click('[data-ch="level|avanzado"]'); await page.click('#ob-next');
await page.clock.runFor(900); for (let i = 0; i < 4; i++) await page.click('#gd-next'); await page.clock.runFor(2600);

// 1) HYROX Lab como día de la rutina (hoy es jueves → índice 3)
await page.evaluate(() => { DB.profile.routine = 'custom'; saveData(); openWeekEditor(3); });
await page.clock.runFor(300);
R.optHyrox = await page.$$eval('[data-wep="3"] option', os => os.some(o => o.value === '__hyrox'));
await page.selectOption('[data-wep="3"]', '__hyrox'); await page.clock.runFor(300);
R.setupOpened = !!(await page.$('#hs-cat'));
await page.click('#hs-s'); await page.clock.runFor(300);
await page.click('#tabs [data-tab=home]'); await page.clock.runFor(500);
R.homeHero = await page.evaluate(() => document.querySelector('.hero') && document.querySelector('.hero').innerText.replace(/\s+/g, ' ').slice(0, 120));
R.todayIsHyrox = await page.evaluate(() => !!nextDay('custom').hyrox);
await shot('v34-hoy-hyrox.png');

// 2) Competiciones
await page.click('#tabs [data-tab=more]'); await page.clock.runFor(300);
await page.evaluate(() => document.querySelector('[data-explore=events]').scrollIntoView()); await page.click('[data-explore=events]');
await page.clock.runFor(800); await pause(300); await page.clock.runFor(300);
R.cards = await page.$$eval('#ev-root .ev-card', cs => cs.length);
R.noFakeOfficial = await page.evaluate(() => evAll().every(e => e.verificationStatus !== 'officially_confirmed'));
await shot('v34-eventos.png');
const search = async q => { await page.fill('#ev-q', q); await page.press('#ev-q', 'Enter'); await page.clock.runFor(200); return page.evaluate(() => ({ why: (document.querySelector('.ev-why') || {}).innerText, ids: [...document.querySelectorAll('#ev-root .ev-card')].map(c => c.dataset.ev) })); };
R.q1 = await search('HYROX en México en marzo');
R.q2 = await search('maratones en México en enero');
R.q3 = await search('Spartan');
R.q4 = await search('ironman');
R.q5 = await search('campeonatos internacionales');
R.q6 = await search('bodybuilding en España');
R.q7 = await search('medio maratón');
await shot('v34-busqueda.png');
await search('');
// Cerca de mí (ubicación simulada en Monterrey)
await page.evaluate(() => { evState().loc = { lat: 25.67, lon: -100.31 }; evChips = new Set(['near']); evRender(); });
R.near = await page.$$eval('#ev-root .ev-card', cs => cs.map(c => c.dataset.ev));
await page.evaluate(() => { evChips = new Set(['foryou']); evRender(); });
// Vistas
await page.click('[data-evv=cal]'); await page.clock.runFor(200);
R.calTitle = await page.textContent('.ev-calh b');
await page.click('[data-evv=map]'); await page.clock.runFor(200);
R.pins = await page.$$eval('.ev-pin', p => p.length);
await page.click('[data-reg=world]'); await page.clock.runFor(200);
R.pinsWorld = await page.$$eval('.ev-pin', p => p.length);
await page.click('[data-reg=mx]'); await page.clock.runFor(200);
await page.dispatchEvent('.ev-pin >> nth=0', 'click'); await page.clock.runFor(200);
R.mapSel = await page.$$eval('#ev-mapsel .ev-card', c => c.length);
await shot('v34-mapa.png');
await page.click('[data-evv=list]'); await page.clock.runFor(200);

// 3) Detalle → guardar → objetivo
await page.evaluate(() => openEvent('hyrox-guadalajara-2027-03')); await page.clock.runFor(300);
R.detail = await page.evaluate(() => ({ badges: [...document.querySelectorAll('.ev-badges span')].map(x => x.innerText), src: document.querySelectorAll('.ev-src li').length, cd: (document.querySelector('.ev-cd-big b') || {}).innerText }));
await shot('v34-detalle.png');
await page.click('#evd-save'); await page.clock.runFor(300);
R.askGoal = await page.evaluate(() => (document.querySelector('.modal h3') || {}).innerText);
await shot('v34-objetivo.png');
await page.click('#ag-yes'); await page.clock.runFor(300);
R.goal = await page.evaluate(() => ({ goal: evState().goal, hxDate: hx().profile.date, phase: hxPhase().n, phases: evPhases(evById(evState().goal)).phases.map(p => p.k) }));
// Análisis de otro evento contra el objetivo
await page.evaluate(() => { evToggleSave('hyrox-cancun-2027-02'); openEvent('hyrox-cancun-2027-02'); }); await page.clock.runFor(300);
R.analysis = await page.$$eval('.pg-rec b', x => x.map(y => y.innerText));
await page.evaluate(() => openEvent('hyrox-monterrey-2027-04')); await page.clock.runFor(300);
R.analysisMty = await page.$$eval('.pg-rec b', x => x.map(y => y.innerText));
// Temporada y calendario personal
await page.evaluate(() => { openModal('<div id="ev-root"></div>', () => { evView = 'plan'; evRender(); }); }); await page.clock.runFor(300);
R.season = await page.evaluate(() => document.querySelector('#ev-body').innerText.slice(0, 300));
await page.click('#ev-mycal'); await page.clock.runFor(300);
R.agenda = await page.$$eval('.ev-ag', x => x.map(y => y.innerText.replace(/\s+/g, ' ')).slice(0, 6));
await page.click('[data-cm=agenda]'); await page.clock.runFor(300);
R.agenda2 = await page.$$eval('.ev-ag', x => x.length);
await shot('v34-calendario.png');
await page.click('#mc-x');
// Hoy muestra el objetivo
await page.click('#tabs [data-tab=home]'); await page.clock.runFor(400);
R.goalCard = await page.evaluate(() => (document.querySelector('.ev-goalcard') || {}).innerText);

// 4) Resultado de una carrera pasada con parciales → HYROX Lab
await page.evaluate(() => openEvent('hyrox-mexico-city-2026-10')); await page.clock.runFor(300);
await page.click('#evd-res'); await page.clock.runFor(300);
await page.fill('#er-t', '1:24:30'); await page.fill('#er-cpos', '57'); await page.fill('#er-cat', 'Men Open 30-34');
await page.evaluate(() => { document.querySelector('.modal details').open = true; });
const sp = ['4:20', '4:40', '4:30', '3:30', '4:45', '4:50', '4:50', '5:30', '4:55', '4:35', '5:00', '1:55', '5:10', '6:20', '5:20', '6:00'];
for (let i = 0; i < 16; i++) await page.fill(`[data-sp="${i}"]`, sp[i]);
await page.click('#er-s'); await page.clock.runFor(300);
R.resSheet = await page.evaluate(() => document.querySelector('.modal').innerText.slice(0, 160));
R.hxFromRace = await page.evaluate(() => ({ sim: hx().results.filter(r => r.kind === 'sim').length, st: hx().results.filter(r => r.kind === 'st' && r.eventId).length }));
await page.click('#er-ok'); await page.clock.runFor(200);
// Rankings y comparación
await page.evaluate(() => { hx().refs = [{ name: 'Ref', sec: 4500, splits: [240, 255, 245, 180, 250, 260, 250, 300, 255, 250, 255, 100, 260, 330, 270, 300] }]; openHxRanks(closeModal); });
await page.clock.runFor(400); await pause(200);
R.ranks = await page.evaluate(() => document.querySelector('.modal').innerText.replace(/\s+/g, ' ').slice(0, 400));
await shot('v34-rankings.png');

// 5) Sincronización remota y novedades
served = remote; await page.evaluate(() => { evState().follow.sports.push('hyrox'); saveData(); evSync(true); }); await page.clock.runFor(500); await pause(300);
R.inbox = await page.evaluate(() => evState().inbox.map(x => x.text));
R.catVersion = await page.evaluate(() => evCatalog().generatedAt);
R.goalFollowed = await page.evaluate(() => hx().profile.date);
// 6) Control de calidad y recordatorios
await page.evaluate(() => openEvQA()); await page.clock.runFor(300);
R.qa = await page.$$eval('.pg-rec b', x => x.slice(0, 4).map(y => y.innerText));
R.remind = await page.evaluate(() => evReminders(addDays(evById(evState().goal).startDate, -30)));
R.persist = await page.evaluate(() => { flushSave(); const d = JSON.parse(localStorage.getItem(KEY)); return { saved: d.ev.saved.length, goal: d.ev.goal, results: d.ev.results.length }; });
console.log(JSON.stringify(R, null, 1));
console.log('ERRORS', JSON.stringify(errors));
await b.close();
