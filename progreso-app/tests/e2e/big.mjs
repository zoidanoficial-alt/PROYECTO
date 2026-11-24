import { chromium } from 'playwright';
// Revisión visual con letra grande (como el teléfono del usuario): Progreso → HYROX y laboratorio.
const Z = Number(process.argv[2] || 1.3);
const b = await chromium.launch(); const page = await (await b.newContext({ viewport: { width: 393, height: 851 }, deviceScaleFactor: 2 })).newPage(); await page.addInitScript(() => { window.MP_DEFAULT_PLAN = 'hyrox'; });
const errors = []; page.on('pageerror', e => errors.push(e.message));
await page.clock.install({ time: new Date('2026-11-24T10:00:00') });
await page.goto('http://127.0.0.1:8765/index.html');
await page.fill('#ob-name', 'Daniel'); for (let k = 0; k < 6; k++) await page.click('#ob-next');
await page.click('[data-ch="level|avanzado"]'); await page.click('#ob-next');
await page.clock.runFor(900); for (let i = 0; i < 4; i++) await page.click('#gd-next'); await page.clock.runFor(8600);
await page.evaluate(() => {
  hx().profile = { cat: 'open', sex: 'm', date: '2027-03-19', equip: 'gym', days: 4, exp: 'medio' };
  const d = addDays(todayStr(), -3); [['ski', 127], ['push', 179], ['pull', 311], ['bbj', 125], ['row', 230], ['farm', 95], ['lunge', 260], ['wb', 300]].forEach(([st, sec], i) => hx().results.push({ id: 'r' + i, kind: 'st', st, sec, date: d, t: i, std: true }));
  hx().results.push({ id: 'k', kind: 'run1k', sec: 210, date: d, t: 9 }, { id: 's', kind: 'sim', sec: 4167, date: d, t: 10 });
  saveData(); showTab('progress'); medalScan && (DB.medals = DB.medals || null);
});
await page.clock.runFor(6000);
await page.evaluate(() => { document.getElementById('md-pop') && document.getElementById('md-pop').remove(); });
await page.click('[data-pshead=hyrox]'); await page.clock.runFor(400);
await page.evaluate(Z => { const els = [...document.querySelectorAll('body *')]; const fs = els.map(e => parseFloat(getComputedStyle(e).fontSize)); els.forEach((e, i) => { e.style.fontSize = fs[i] * Z + 'px'; }); }, Z);
const R = await page.evaluate(() => {
  const over = [...document.querySelectorAll('#view-progress *')].filter(e => e.offsetParent && e.getBoundingClientRect().right > innerWidth + 1).map(e => e.className || e.tagName).slice(0, 6);
  const wrapped = [...document.querySelectorAll('.pl-t, .pl-gap, .pl-pr small, .pl-pr b')].filter(e => e.getClientRects().length > 1 || e.scrollWidth > e.clientWidth + 1).map(e => e.textContent).slice(0, 6);
  return { over, wrapped };
});
for (const [sel, n] of [['.pl-ladder', 'big-metas.png'], ['.pl-plan', 'big-plan.png'], ['.pl-riv', 'big-rivales.png']]) { await page.evaluate(s => { const x = document.querySelector(s); if (x) x.scrollIntoView({ block: 'center' }); }, sel); await new Promise(r => setTimeout(r, 400)); await page.screenshot({ path: './' + n }); }
console.log(JSON.stringify(R)); console.log('ERRORS', JSON.stringify(errors));
await b.close();
