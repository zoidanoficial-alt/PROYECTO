import { chromium } from 'playwright';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 393, height: 851 }, deviceScaleFactor: 2 });
const page = await ctx.newPage(); const errors = [];
page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('dialog', d => d.accept());
await page.goto('http://127.0.0.1:8765/index.html');
await page.fill('#ob-name', 'Dan'); for (let k = 0; k < 7; k++) await page.click('#ob-next'); await page.waitForTimeout(900); await page.evaluate(() => { /*__guideFix*/ /*__lvlFix*/ DB.profile.guideSeen = true; DB.profile.level = 'avanzado'; if (DB.profile.routine === 'custom') DB.profile.routine = 'pro'; saveData(); showTab(currentTab); if (document.querySelector('.guide')) closeModal(); });
await page.waitForTimeout(300);
// history: strength 30-16 days ago, then 14-day pause
await page.evaluate(() => {
  const t = todayStr();
  for (let k = 30; k >= 16; k -= 2) { const d = addDays(t, -k), sid = 's' + k; DB.sessions.push({ id: sid, routine: 'pro', dayId: 'd1', dayName: 'Día 1 · Pierna', date: d, start: parseDate(d).getTime() + 6e7, end: parseDate(d).getTime() + 6.3e7 }); for (let n = 0; n < 3; n++) DB.lifts.push({ id: 'l' + k + n, ex: 'Hack squat', w: 100 + (30 - k), r: 12, rir: 2, date: d, t: parseDate(d).getTime() + n, sid }); }
  DB.runs.push({ id: 'r1', date: addDays(t, -20), start: Date.now() - 20 * 8.64e7, dur: 1800, km: 5.2, splits: [], title: 'x', source: 'gps', best: { 1: 330, 5: 1740 } });
  DB.commits.push({ id: 'c1', title: 'Caminar 10 min después de comer', perWeek: 5, created: addDays(t, -10) });
  saveData(); renderHome();
});
await page.waitForTimeout(200);
console.log('comeback shown:', await page.isVisible('#cb-yes'));
await page.screenshot({ path: 'v18-home.png', fullPage: true });
const green = await page.evaluate(() => todayMissions().map(m => m.kind + ': ' + m.goal));
console.log('missions (no check-in):', JSON.stringify(green));
await page.click('#cb-yes'); await page.waitForTimeout(200);
console.log('comeback active:', await page.evaluate(() => inComeback()), '| week target:', await page.evaluate(() => weekTarget()));
await page.evaluate(() => { startSession(DB.profile.routine, nextDay(DB.profile.routine).id); });
console.log('session adjust during comeback:', await page.evaluate(() => activeSession().adjust));
await page.evaluate(() => { DB.sessions = DB.sessions.filter(s => s.id !== DB.active); DB.active = null; });
// red readiness
await page.evaluate(() => { day(todayStr()).rec = { sleepH: 4.5, sleepQ: 1, energy: 1, soreness: 5, stress: 5 }; saveData(); });
const red = await page.evaluate(() => todayMissions().map(m => m.kind + ': ' + m.goal));
console.log('missions (red check-in):', JSON.stringify(red), '| progress mission present:', red.some(x => x.startsWith('str:')));
// run plan session today
await page.evaluate(() => { delete day(todayStr()).rec; DB.runPlan = buildRunPlan('10k', 3, null, null, 10); DB.runPlan.weeks[0].sessions[0].date = todayStr(); });
console.log('missions with run plan:', JSON.stringify(await page.evaluate(() => todayMissions().map(m => m.kind + ': ' + m.title))));
await page.click('nav button[data-tab=progress]'); await page.click('[data-mode="historia"]'); await page.waitForTimeout(200);
console.log('levels:', await page.evaluate(() => JSON.stringify({ f: activityLevels().fuerza.level, r: activityLevels().running.level })));
await page.screenshot({ path: 'v18-historia.png', fullPage: true });
// extra sets message no longer rewards excess
console.log('extra msg:', await page.evaluate(() => progMsg(5, 4, false)));
console.log('ERRORS', JSON.stringify(errors)); await b.close();
