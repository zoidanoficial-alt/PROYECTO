import { chromium } from 'playwright';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 393, height: 851 }, deviceScaleFactor: 2 });
const page = await ctx.newPage(); const errors = [];
page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('dialog', d => { errors.push('DIALOG: ' + d.message()); d.accept(); });
const D = './out/';
await page.goto('http://127.0.0.1:8765/index.html');
await page.fill('#ob-name', 'Dan'); for (let k = 0; k < 7; k++) await page.click('#ob-next'); await page.waitForTimeout(900); await page.evaluate(() => { /*__guideFix*/ /*__lvlFix*/ DB.profile.guideSeen = true; DB.profile.level = 'avanzado'; if (DB.profile.routine === 'custom') DB.profile.routine = 'pro'; saveData(); showTab(currentTab); if (document.querySelector('.guide')) closeModal(); });
await page.waitForTimeout(3500);
const log2 = async () => page.evaluate(() => { const s = activeSession(); s.adjustDone = true; renderTrain(); for (let k = 0; k < 2; k++) { document.querySelector('#w-0').value = 60; document.querySelector('#r-0').value = 8; logSet(s, 0); } stopRest(); return DB.lifts.filter(l => l.sid === s.id).length; });
await page.evaluate(() => { DB.profile.routine = 'heroe'; saveData(); startSession('heroe', 'h1'); showTab('train'); });
const n0 = await log2();
await page.screenshot({ path: D + 'v23-session.png' });
const ach0 = await page.evaluate(() => DB.achievements.length);
// back arrow: deletes immediately, no dialog
await page.click('#ss-back'); await page.waitForTimeout(250);
const afterBack = await page.evaluate(() => ({ active: DB.active, sess: DB.sessions.length, lifts: DB.lifts.length, ach: DB.achievements.length, snack: document.querySelector('#snack.show') && document.querySelector('#snack').textContent, inSession: document.body.classList.contains('in-session'), view: !!document.querySelector('#rt-sel') }));
await page.screenshot({ path: D + 'v23-snack.png' });
await page.click('#snack-act'); await page.waitForTimeout(250);
const afterUndo = await page.evaluate(() => ({ active: !!DB.active, lifts: DB.lifts.length, ach: DB.achievements.length, name: activeSession() && activeSession().dayName, onSession: !!document.querySelector('#ss-back') }));
// reset: add extra + change set target first
const pre = await page.evaluate(() => { const s = activeSession(); s.extra.push(['Plancha', 3, '30 s', 45]); s.sets = { 0: 3 }; saveData(); renderTrain(); return { exs: sessionExercises(s).length, start: s.start }; });
await page.evaluate(() => { window.__t0 = Date.now(); });
await page.click('#ss-reset'); await page.waitForTimeout(250);
const afterReset = await page.evaluate(() => { const s = activeSession(); return { lifts: DB.lifts.filter(l => l.sid === s.id).length, exs: sessionExercises(s).length, sets0: sessionExercises(s)[0][1], extra: s.extra.length, startNew: s.start >= window.__t0, snack: document.querySelector('#snack').textContent, active: !!DB.active }; });
await page.click('#snack-act'); await page.waitForTimeout(250);
const undoReset = await page.evaluate(() => { const s = activeSession(); return { lifts: DB.lifts.filter(l => l.sid === s.id).length, extra: s.extra.length, sets0: sessionExercises(s)[0][1] }; });
// back with 0 sets, then let snack expire and reload: gone for good
await page.click('#ss-reset'); await page.click('#ss-back'); await page.waitForTimeout(200);
const zero = await page.evaluate(() => document.querySelector('#snack').textContent);
await page.waitForTimeout(6300);
const gone = await page.evaluate(() => !document.querySelector('#snack.show'));
await page.reload(); await page.waitForTimeout(700);
const persisted = await page.evaluate(() => ({ active: DB.active, sess: DB.sessions.length, lifts: DB.lifts.length }));
// header fits at 320px with big text
await page.setViewportSize({ width: 320, height: 700 });
await page.evaluate(() => { startSession('heroe', 'h1'); showTab('train'); document.querySelectorAll('.sess-head *').forEach(e => e.style.fontSize = parseFloat(getComputedStyle(e).fontSize) * 1.4 + 'px'); });
const fit = await page.evaluate(() => { const c = document.querySelector('.sess-head').getBoundingClientRect(); return { ovf: document.documentElement.scrollWidth - innerWidth, back: document.querySelector('#ss-back').getBoundingClientRect().width, right: Math.round(c.right) <= innerWidth }; });
console.log(JSON.stringify({ n0, ach0, afterBack, afterUndo, pre, afterReset, undoReset, zero, gone, persisted, fit }));
console.log('ERRORS', JSON.stringify(errors.slice(0, 5)));
await b.close();
