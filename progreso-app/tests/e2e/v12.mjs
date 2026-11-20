import { chromium } from 'playwright';
import fs from 'fs';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 393, height: 851 }, deviceScaleFactor: 2, acceptDownloads: true });
const page = await ctx.newPage(); const errors = [];
page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('dialog', d => d.accept());
await page.goto('http://127.0.0.1:8765/index.html');
await page.fill('#ob-name', 'Sofía'); await page.check('#ob-cyc'); for (let k = 0; k < 7; k++) await page.click('#ob-next'); await page.waitForTimeout(900); await page.evaluate(() => { /*__guideFix*/ /*__lvlFix*/ DB.profile.guideSeen = true; DB.profile.level = 'avanzado'; if (DB.profile.routine === 'custom') DB.profile.routine = 'pro'; saveData(); showTab(currentTab); if (document.querySelector('.guide')) closeModal(); }); await page.waitForTimeout(300); await page.evaluate(() => document.querySelectorAll('details.fold').forEach(d => d.open = true));
await page.waitForTimeout(300);
await page.waitForTimeout(500); await page.check('#cc-home'); await page.click('#cc-yes'); await page.waitForTimeout(200);
console.log('cycleOn:', await page.evaluate(() => DB.profile.cycleOn));
await page.screenshot({ path: 'v12-home0.png' });
// seed 3 full cycles of 28-30 days ending with a new period 25 days ago
await page.evaluate(() => {
  const t = todayStr(), lens = [29, 28, 30];
  let start = addDays(t, -(25 + lens.reduce((a, b) => a + b, 0)));
  const starts = [];
  lens.forEach(L => { starts.push(start); start = addDays(start, L); }); starts.push(start);
  starts.forEach((s, ci) => {
    const L = ci < lens.length ? lens[ci] : 26;
    for (let k = 0; k < L; k++) {
      const d = addDays(s, k); if (d > t) break;
      const rel = L - k, pre = ci < lens.length && rel <= 3;
      const c = { flow: k < 5 ? (k < 2 ? 4 : 2) : 0, pain: k < 2 ? 2 : 0, sym: pre ? ['fatiga', 'hinchazon'] : [], energy: pre ? 2 : 4, sleepQ: pre ? 2 : 4, mood: pre ? 2 : 4 };
      day(d).cyc = c; day(d).rec = { energy: c.energy, sleepQ: c.sleepQ };
      if (k % 3 === 0) { const fol = k >= 5 && k < L - 16, w = fol ? 52 : 48; const sid = 's' + d; DB.sessions.push({ id: sid, routine: 'pro', dayId: 'x', dayName: 'Seed', date: d, start: parseDate(d).getTime() + 6.48e7, end: parseDate(d).getTime() + 6.84e7 }); for (let n = 0; n < 3; n++) DB.lifts.push({ id: uid(), ex: 'Sentadilla con barra', w, r: 8, rir: 2, date: d, t: parseDate(d).getTime() + n, sid, tech: 'normal' }); }
    }
  });
  saveData();
});
await page.reload(); await page.waitForTimeout(400);
await page.evaluate(() => document.querySelectorAll('details.fold').forEach(d => d.open = true)); // OPENFOLDS
console.log('stats:', await page.evaluate(() => { const s = cycStats(); return JSON.stringify({ avg: s.avg, sd: s.sd, next: s.next, margin: s.margin, P: s.P, today: phaseOn(todayStr()) }); }));
console.log('patterns:', await page.evaluate(() => cyclePatterns().notes.map(n => n.text)));
await page.screenshot({ path: 'v12-home.png', fullPage: true });
await page.click('#view-home #cy-cal'); await page.waitForTimeout(300);
await page.screenshot({ path: 'v12-cycle.png', fullPage: true });
// log cramps today and check readiness
await page.evaluate(() => { day(todayStr()).cyc = { flow: 0, pain: 2, sym: ['fatiga'], energy: 3, mood: 3, sleepQ: 3 }; day(todayStr()).rec = { energy: 3, sleepQ: 3, sleepH: 7 }; saveData(); });
console.log('readiness:', await page.evaluate(() => JSON.stringify({ s: readiness().score, p: readiness().recommended, why: readiness().why.map(w => w.text) })));
// no cramps, menstruating, feels good -> no reduction
await page.evaluate(() => { day(todayStr()).cyc = { flow: 3, pain: 0, sym: [], energy: 5, mood: 4, sleepQ: 4 }; day(todayStr()).rec = { energy: 5, sleepQ: 4, sleepH: 8 }; saveData(); });
console.log('menstruating feeling good:', await page.evaluate(() => JSON.stringify({ s: readiness().score, p: readiness().recommended })));
await page.locator('[data-cday]').first().click(); await page.waitForTimeout(200);
await page.screenshot({ path: 'v12-day.png', fullPage: true });
await page.click('[data-pain="3"]'); await page.click('#cy-save'); await page.waitForTimeout(200);
console.log('alerts:', await page.evaluate(() => cycleAlerts().map(a => a.short)));
await page.click('#fab'); await page.click('[data-qs="export"]'); await page.click('[data-per="all"]');
const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#ex-xlsx')]);
console.log('xlsx', fs.statSync(await dl.path()).size);
console.log('ERRORS', JSON.stringify(errors)); await b.close();
