import { chromium } from 'playwright';
// 39.0 · Protocolo de medallas: +1000 medallas, detección al guardar series, récords y estadísticas
const D = './';
const b = await chromium.launch(); const page = await (await b.newContext({ viewport: { width: 393, height: 851 }, deviceScaleFactor: 2 })).newPage(); await page.addInitScript(() => { window.MP_DEFAULT_PLAN = 'gym'; });
const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
page.on('dialog', d => d.accept());
const pause = ms => new Promise(r => setTimeout(r, ms));
const shot = async n => { await pause(700); await page.screenshot({ path: D + n }); };
await page.clock.install({ time: new Date('2026-11-20T10:00:00') });
await page.goto('http://127.0.0.1:8765/index.html');
const R = {};
await page.fill('#ob-name', 'Daniel'); for (let k = 0; k < 6; k++) await page.click('#ob-next');
await page.click('[data-ch="level|avanzado"]'); await page.click('#ob-next');
await page.clock.runFor(900); for (let i = 0; i < 4; i++) await page.click('#gd-next'); await page.clock.runFor(2600);
R.catalog = await page.evaluate(() => { const c = mdCatalog(); return { total: c.length, unique: new Set(c.map(m => m.id)).size, cats: Object.keys(MD_CATS).length, tiers: MD_TIERS.map((T, i) => c.filter(m => m.tier === i).length) }; });
// Historial previo: la primera revisión gana medallas en silencio (no inunda de avisos)
await page.evaluate(() => {
  const t = todayStr();
  for (let w = 10; w >= 1; w--) { const d = addDays(t, -7 * w), t0 = parseDate(d).getTime() + 3.6e7; DB.sessions.push({ id: 'h' + w, routine: 'libre', dayName: 'Pierna', date: d, start: t0, end: t0 + 3.6e6, extra: [], swaps: {} });
    DB.lifts.push({ id: 'q' + w, ex: 'Sentadilla con barra', w: 100 + (10 - w) * 3, r: 5, rir: 2, date: d, t: t0, sid: 'h' + w }, { id: 'p' + w, ex: 'Press banca con barra', w: 70 + (10 - w) * 2, r: 6, rir: 2, date: d, t: t0 + 1, sid: 'h' + w }); }
  DB.days[t] = Object.assign(DB.days[t] || {}, { weight: 80 }); DB.medals = null; saveData();   // como quien actualiza la app con historial
});
R.firstScan = await page.evaluate(() => { const n = medalScan(); return { n: n.length, pop: !!document.getElementById('md-pop'), retro: n.length > 0 && n.every(m => DB.medals.got[m.id].retro) }; });
R.sq127 = await page.evaluate(() => ['max-sq-120', 'max-sq-130', 'max-sq-140'].map(id => id + ':' + !!DB.medals.got[id]));
// Sesión de hoy: 1 repetición con 140 kg → medalla al guardar la serie
await page.evaluate(() => { startSession('libre'); const s = activeSession(); const set = { id: 'big', ex: 'Sentadilla con barra', w: 140, r: 1, rir: 0, date: todayStr(), t: Date.now(), sid: s.id }; DB.lifts.push(set); checkSetRecords(set); saveData(); });
await page.clock.runFor(800);
R.pop140 = await page.evaluate(() => (document.getElementById('md-pop') || {}).innerText);
R.got140 = await page.evaluate(() => ['max-sq-140', 'max-sq-150'].map(id => id + ':' + !!DB.medals.got[id]));
await shot('v45-medalla-140.png');
// 50 repeticiones con 50 kg
await page.clock.runFor(5000);
await page.evaluate(() => { const s = activeSession(); const set = { id: 'reps50', ex: 'Prensa de piernas (máquina)', w: 50, r: 50, rir: 1, date: todayStr(), t: Date.now() + 1, sid: s.id }; DB.lifts.push(set); checkSetRecords(set); saveData(); });
await page.clock.runFor(800);
R.pop50 = await page.evaluate(() => (document.getElementById('md-pop') || {}).innerText);
R.got50 = await page.evaluate(() => ['rw-50-50', 'rw-50-40', 'rw-50-75'].map(id => id + ':' + !!DB.medals.got[id]));
await page.evaluate(() => { const s = activeSession(); s.end = Date.now() + 3e6; DB.active = null; saveData(); });
// Sección Logros, estadísticas y medallas desde Perfil
await page.clock.runFor(5000);
await page.click('#tabs [data-tab=more]'); await page.clock.runFor(300);
R.perfilRow = await page.evaluate(() => document.getElementById('pf-medals').innerText.replace(/\s+/g, ' '));
await page.click('#tabs [data-tab=logros]'); await page.clock.runFor(500);
R.where = await page.evaluate(() => ({ tab: currentTab, title: document.getElementById('hdr-title').textContent }));
R.shelves = await page.$$eval('.sh', x => x.map(y => y.querySelector('.sh-h b').textContent + ' ' + y.querySelector('.sh-h em').textContent + ' · ' + y.querySelectorAll('.sh-m.on').length + ' en estante'));
R.hero = await page.evaluate(() => document.querySelector('.lg-hero').innerText.replace(/\s+/g, ' '));
await shot('v45-estante.png');
await page.evaluate(() => document.querySelector('[data-shelf=run]').scrollIntoView({ block: 'start' }));
await shot('v45-estante-2.png');
await page.click('[data-shall=gym]'); await page.clock.runFor(300);
R.vitrina = await page.$$eval('#modal .ds-h', x => x.map(y => y.textContent.replace(/\s+/g, ' ')));
await shot('v45-vitrina-gym.png');
await page.click('#modal [data-md="max-sq-140"]'); await page.clock.runFor(300);
R.detail = await page.evaluate(() => document.querySelector('.md-detail').innerText.replace(/\s+/g, ' ').slice(0, 160));
await shot('v45-detalle.png');
await page.click('[data-mdf2="max-sq-160"]'); await page.clock.runFor(300);
R.locked = await page.evaluate(() => document.querySelector('.md-prog').innerText.replace(/\s+/g, ' '));
await page.evaluate(() => closeModal()); await page.clock.runFor(200);
// Récords: tabla de repeticiones por peso
await page.click('[data-lgv=rec]'); await page.clock.runFor(300);
R.records = await page.evaluate(() => [...document.querySelectorAll('.md-tbl tbody tr')].slice(0, 3).map(r => r.innerText.replace(/\s+/g, ' ')));
await shot('v45-records.png');
await page.click('[data-lgv=est]'); await page.clock.runFor(400);
R.stats = await page.$$eval('.md-stats > div', x => x.slice(0, 5).map(y => y.innerText.replace(/\s+/g, ' ')));
await shot('v45-estadisticas.png');
R.persist = await page.evaluate(() => { flushSave(); const d = JSON.parse(localStorage.getItem(KEY)); return Object.keys(d.medals.got).length; });
console.log(JSON.stringify(R, null, 1));
console.log('ERRORS', JSON.stringify(errors));
await b.close();
