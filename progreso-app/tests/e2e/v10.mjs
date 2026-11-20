import { chromium } from 'playwright';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 393, height: 851 }, deviceScaleFactor: 2 });
const page = await ctx.newPage(); const errors = [];
page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('dialog', d => d.accept());
await page.goto('http://127.0.0.1:8765/index.html');
await page.fill('#ob-name', 'Dan'); for (let k = 0; k < 7; k++) await page.click('#ob-next'); await page.waitForTimeout(900); await page.evaluate(() => { /*__guideFix*/ /*__lvlFix*/ DB.profile.guideSeen = true; DB.profile.level = 'avanzado'; if (DB.profile.routine === 'custom') DB.profile.routine = 'pro'; saveData(); showTab(currentTab); if (document.querySelector('.guide')) closeModal(); }); await page.waitForTimeout(300); await page.evaluate(() => document.querySelectorAll('details.fold').forEach(d => d.open = true));
await page.waitForTimeout(300);
// seed 7 weeks of history
await page.evaluate(() => {
  const t = todayStr(), exs = [['Press banca con barra', 80, 1.2], ['Sentadilla con barra', 100, 1.5], ['Curl de bíceps con barra', 30, 0]];
  for (let k = 49; k >= 2; k -= 3) {
    const d = addDays(t, -k), sid = 's' + k;
    DB.sessions.push({ id: sid, routine: 'pro', dayId: 'x', dayName: 'Seed', date: d, start: parseDate(d).getTime() + 3.6e6 * 18, end: parseDate(d).getTime() + 3.6e6 * 19 });
    exs.forEach(([ex, w0, inc], j) => { const w = w0 + inc * (49 - k) / 3 + (Math.random() * 2 - 1); for (let n = 0; n < 3; n++) DB.lifts.push({ id: uid(), ex, w, r: 8, rir: j === 2 ? 3 : 2, date: d, t: parseDate(d).getTime() + n, sid, tech: 'normal' }); });
    day(d).weight = 88 - (49 - k) * 0.08 + (Math.random() - .5);
  }
  DB.measures.push({ id: 'm1', date: addDays(t, -40), waist: 92, chest: 104, arm: 38 }, { id: 'm2', date: addDays(t, -2), waist: 89.5, chest: 104.3, arm: 38.2 });
  saveData();
});
await page.reload(); await page.waitForTimeout(400);
await page.evaluate(() => document.querySelectorAll('details.fold').forEach(d => d.open = true)); // OPENFOLDS
await page.screenshot({ path: 'v10-home.png', fullPage: true });
await page.click('nav button[data-tab=train]'); await page.waitForTimeout(200);
await page.evaluate(() => document.querySelectorAll('details.fold').forEach(d => d.open = true)); // OPENFOLDS
await page.screenshot({ path: 'v10-train.png', fullPage: true });
await page.click('#view-train #ck-open');
await page.click('[data-sl="-0.5"]'); await page.click('[data-sl="-0.5"]'); await page.click('[data-sl="-0.5"]'); await page.click('[data-sl="-0.5"]');
await page.click('[data-ck="sleepQ|2"]'); await page.click('[data-ck="energy|2"]'); await page.click('[data-ck="soreness|4"]');
await page.click('#ck-next'); await page.waitForTimeout(200);
await page.screenshot({ path: 'v10-ready.png', fullPage: true });
console.log('recommended:', await page.evaluate(() => JSON.stringify({ s: readiness().score, p: readiness().plan })));
await page.click('.plan-pick button.on'); await page.waitForTimeout(200);
await page.evaluate(() => { startSession(DB.profile.routine, nextDay(DB.profile.routine).id); renderTrain(); });
await page.evaluate(() => document.querySelectorAll('details.fold').forEach(d => d.open = true)); // OPENFOLDS
await page.waitForTimeout(200);
console.log('adjust:', await page.evaluate(() => activeSession().adjust), 'sets:', await page.evaluate(() => sessionExercises(activeSession()).map(e => e[1]).join(',')));
await page.fill('#w-0', '60'); await page.fill('#r-0', '10'); await page.click('#save-0'); await page.waitForTimeout(200);
await page.click('#ss-finish'); await page.waitForTimeout(500);
await page.screenshot({ path: 'v10-summary.png', fullPage: true });
await page.click('#sum-ok');
await page.click('nav button[data-tab=progress]'); await page.waitForTimeout(300);
await page.evaluate(() => document.querySelectorAll('details.fold').forEach(d => d.open = true)); // OPENFOLDS
await page.click('[data-mode="analysis"]'); await page.waitForTimeout(200); await page.click('#goal-add'); await page.selectOption('#g-ex', 'Press banca con barra'); await page.fill('#g-t', '130'); await page.click('#g-save'); await page.waitForTimeout(300);
await page.screenshot({ path: 'v10-analysis.png', fullPage: true });
// pwo restart/cancel + water undo
await page.click('nav button[data-tab=food]'); await page.waitForTimeout(200);
await page.evaluate(() => document.querySelectorAll('details.fold').forEach(d => d.open = true)); // OPENFOLDS
await page.click('[data-wat="500"]'); await page.click('[data-wat="250"]'); await page.click('[data-wat="undo"]');
console.log('water:', await page.evaluate(() => DB.days[todayStr()].water));
await page.click('#view-food [data-pwo-act="restart"]'); await page.click('#view-food [data-pwo-act="cancel"]');
console.log('pwo:', await page.evaluate(() => DB.pwo));
await page.reload(); await page.waitForTimeout(300);
await page.evaluate(() => document.querySelectorAll('details.fold').forEach(d => d.open = true)); // OPENFOLDS
console.log('goals persisted:', await page.evaluate(() => DB.goals.length), 'challenges:', await page.evaluate(() => DB.challenges && DB.challenges.list.map(c => c.title)));
console.log('ERRORS', JSON.stringify(errors)); await b.close();
