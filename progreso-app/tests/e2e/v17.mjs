import { chromium } from 'playwright';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 393, height: 851 }, deviceScaleFactor: 2 });
const page = await ctx.newPage(); const errors = [];
page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('dialog', d => d.accept());
await page.goto('http://127.0.0.1:8765/index.html');
await page.fill('#ob-name', 'Dan'); for (let k = 0; k < 7; k++) await page.click('#ob-next'); await page.waitForTimeout(900); await page.evaluate(() => { /*__guideFix*/ /*__lvlFix*/ DB.profile.guideSeen = true; DB.profile.level = 'avanzado'; if (DB.profile.routine === 'custom') DB.profile.routine = 'pro'; saveData(); showTab(currentTab); if (document.querySelector('.guide')) closeModal(); });
await page.waitForTimeout(300);
// 1) plan rules for all types
console.log(await page.evaluate(() => Object.keys(RUN_PLANS).map(k => {
  const p = buildRunPlan(k, k === 'inicio' ? 3 : 4, null, null, 12);
  let ok10 = true, lastFull = null, maxSum = 0;
  p.weeks.forEach((w, i) => { if (w.target == null) return; if (i > 0 && !w.cut && !w.taper && lastFull && w.target > lastFull.t * 1.1 + 0.1) ok10 = false; if (i > 0 && !w.cut && !w.taper && lastFull) maxSum = Math.max(maxSum, w.km / lastFull.k); if (!w.cut && !w.taper) lastFull = { t: w.target, k: w.km }; });
  const cuts = p.weeks.filter(w => w.cut).length, tapers = p.weeks.filter(w => w.taper).length;
  return `${k}: ${p.weeks.length} sem, ${p.weeks[0].sessions.length} sesiones/sem, meta ≤10%: ${ok10}, suma real máx +${Math.round((maxSum - 1) * 100)}%, descargas ${cuts}, reducción ${tapers}, km ${p.weeks.map(w => w.target == null ? '-' : Math.round(w.target)).join(' ')}`;
}).join('\n')));
// 2) Riegel: 5K in 25:00 -> 10K
console.log('riegel 5k 25:00 -> 10k:', await page.evaluate(() => durStr(riegel(1500, 5, 10))));
// 3) create plan via UI and run a guided session with coordination
await page.click('nav button[data-tab=train]'); await page.click('[data-tmode="running"]'); await page.waitForTimeout(200);
await page.screenshot({ path: 'v17-norec.png' });
await page.click('#rp-new'); await page.click('[data-rpt="10k"]'); await page.click('[data-rpd="3"]'); await page.fill('#rp-goal', '52:00'); await page.click('#rp-make'); await page.waitForTimeout(200);
// make today a quality session, seed leg strength yesterday + a recent 5K best
await page.evaluate(() => {
  const s = DB.runPlan.weeks[1].sessions[1]; s.date = todayStr(); DB.runPlan.weeks[0].sessions.forEach(x => { if (x.date >= todayStr()) x.date = addDays(todayStr(), -2); });
  const y = addDays(todayStr(), -1); for (let i = 0; i < 8; i++) DB.lifts.push({ id: 'y' + i, ex: 'Sentadilla con barra', w: 100, r: 8, rir: 2, date: y, t: Date.now() - 8.64e7 + i, sid: 'ys' });
  DB.runs.push({ id: 'r5', date: addDays(todayStr(), -10), start: Date.now() - 8.64e8, dur: 1500, km: 5, splits: [], title: '5K', source: 'gps', best: { 1: 290, 5: 1500 } });
  saveData(); renderTrain();
});
await page.waitForTimeout(200);
await page.screenshot({ path: 'v17-plan.png', fullPage: true });
console.log('plan card:', (await page.textContent('.run-plan')).replace(/\s+/g, ' ').slice(0, 420));
await page.click('#rp-start'); await page.waitForTimeout(300);
console.log('guided run segs:', await page.evaluate(() => RUN.st.segs.length), '| first seg:', await page.evaluate(() => RUN.st.segs[0].label));
await page.screenshot({ path: 'v17-guided.png' });
// simulate segment progression by time
await page.evaluate(() => { RUN.st.start -= 601000; runTick(); });
console.log('after 10 min seg index:', await page.evaluate(() => RUN.st.seg));
// finish quickly with a synthetic 6 km
await page.evaluate(() => { const st = RUN.st; st.dist = 6100; st.pts = [[19.4, -99.1, 0], [19.455, -99.1, 1900]]; st.splits = [320, 318, 316, 322, 319, 321]; });
await page.click('#rl-stop'); await page.waitForTimeout(300); await page.click('#rs-ok'); await page.waitForTimeout(500);
console.log('session done:', await page.evaluate(() => { const s = DB.runPlan.weeks[1].sessions[1]; return JSON.stringify({ done: !!s.done, missionOk: s.missionOk }); }));
// strength coordination note: yesterday hard run + leg day today
await page.evaluate(() => { DB.runs.push({ id: 'ry', date: addDays(todayStr(), -1), start: Date.now() - 8.64e7, dur: 5400, km: 16, rpe: 6, title: 'Largo', source: 'gps' }); });
console.log('strength coord note:', await page.evaluate(() => strengthCoordNote('Día 1 · Pierna')));
console.log('ERRORS', JSON.stringify(errors)); await b.close();
