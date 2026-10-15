import { chromium } from 'playwright';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 393, height: 851 }, deviceScaleFactor: 2 });
const page = await ctx.newPage(); const errors = [];
page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('dialog', d => d.accept());
await page.goto('http://127.0.0.1:8765/index.html');
await page.fill('#ob-name', 'Dan'); for (let k = 0; k < 7; k++) await page.click('#ob-next'); await page.waitForTimeout(900); await page.evaluate(() => { /*__guideFix*/ /*__lvlFix*/ DB.profile.guideSeen = true; DB.profile.level = 'avanzado'; if (DB.profile.routine === 'custom') DB.profile.routine = 'pro'; saveData(); showTab(currentTab); if (document.querySelector('.guide')) closeModal(); }); await page.mouse.click(200, 120);
await page.waitForTimeout(300);
await page.evaluate(() => {
  const t = todayStr(), exs = [['Press banca con barra', 100, 1.5], ['Sentadilla con barra', 120, 1.8], ['Remo con mancuerna', 30, 0.5], ['Press militar con mancuernas', 22, 0.3], ['Curl femoral tumbado', 40, 0.4], ['Jalón al pecho', 60, 0.8], ['Extensión de tríceps en polea', 25, 0.3]];
  for (let k = 60; k >= 1; k -= 3) {
    const d = addDays(t, -k), sid = 's' + k;
    DB.sessions.push({ id: sid, routine: 'pro', dayId: 'x', dayName: 'Seed', date: d, start: parseDate(d).getTime() + 6.48e7, end: parseDate(d).getTime() + 6.84e7 });
    exs.forEach(([ex, w0, inc]) => { const w = w0 + inc * (60 - k) / 3; for (let n = 0; n < 3; n++) DB.lifts.push({ id: uid(), ex, w, r: 8, rir: 2, date: d, t: parseDate(d).getTime() + n, sid, tech: 'normal' }); });
    day(d).weight = 88;
  }
  saveData();
});
await page.reload(); await page.waitForTimeout(300);
await page.click('nav button[data-tab=progress]'); await page.waitForTimeout(300);
console.log('scores:', await page.evaluate(() => JSON.stringify(strengthScores())));
await page.screenshot({ path: 'v14-fuerza.png', fullPage: true });
await page.evaluate(() => techniqueSheet('Press inclinado con mancuernas')); await page.waitForTimeout(300);
await page.screenshot({ path: 'v14-tech.png' });
await page.click('[data-tq="obj"]'); await page.click('#tq-spd'); await page.waitForTimeout(150);
await page.screenshot({ path: 'v14-tech-obj.png' });
await page.click('[data-tq="eq"]'); await page.click('#tq-back');
// PR celebration through a session
await page.click('nav button[data-tab=train]'); await page.evaluate(() => { startSession('libre'); activeSession().adjustDone = true; const s = activeSession(); s.extra = [['Press banca con barra', 3, '8–12', 120]]; saveData(); renderTrain(); });
await page.waitForTimeout(200);
await page.fill('#w-0', '140'); await page.fill('#r-0', '6'); await page.click('#save-0'); await page.waitForTimeout(900);
console.log('pr modal:', await page.isVisible('.pr-cel'));
await page.screenshot({ path: 'v14-pr.png' });
await page.click('#pr-ok');
await page.click('#ss-finish'); await page.waitForTimeout(400); await page.click('#sum-ok');
await page.click('nav button[data-tab=train]'); await page.evaluate(() => document.querySelectorAll('details.fold').forEach(d => d.open = true)); await page.waitForTimeout(200);
await page.locator('#view-train .sets-card').scrollIntoViewIfNeeded(); await page.screenshot({ path: 'v14-sets.png' });
console.log('ERRORS', JSON.stringify(errors)); await b.close();
