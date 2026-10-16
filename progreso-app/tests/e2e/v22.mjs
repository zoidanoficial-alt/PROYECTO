import { chromium } from 'playwright';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 393, height: 851 }, deviceScaleFactor: 2 });
const page = await ctx.newPage(); const errors = [];
page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('dialog', d => d.accept());
const D = './out/';
await page.goto('http://127.0.0.1:8765/index.html');
await page.fill('#ob-name', 'Dan'); for (let k = 0; k < 7; k++) await page.click('#ob-next'); await page.waitForTimeout(900); await page.evaluate(() => { /*__guideFix*/ /*__lvlFix*/ DB.profile.guideSeen = true; DB.profile.level = 'avanzado'; if (DB.profile.routine === 'custom') DB.profile.routine = 'pro'; saveData(); showTab(currentTab); if (document.querySelector('.guide')) closeModal(); });
await page.waitForTimeout(3500);
await page.evaluate(() => { window.__now = Date.now(); Date.now = () => window.__now; showTab('train'); document.querySelectorAll('details.fold').forEach(d => d.open = true); });
await page.locator('[data-reto="cindy"]').scrollIntoViewIfNeeded(); await page.waitForTimeout(400);
await page.screenshot({ path: D + 'v22-card.png' });
await page.click('[data-reto="cindy"]'); await page.waitForTimeout(200);
await page.click('[data-sz="10"]'); await page.screenshot({ path: D + 'v22-setup.png' });
await page.click('#rt-go'); await page.waitForTimeout(200);
for (let i = 0; i < 12; i++) { await page.evaluate(() => { window.__now += 45000; }); await page.click('#rt-plus'); }
await page.click('#rt-plus'); await page.click('#rt-undo');   // undo works
await page.screenshot({ path: D + 'v22-live.png' });
const lockClose = await page.evaluate(() => { document.getElementById('modal-bg').click(); return !!document.querySelector('#rt-clock'); });
await page.evaluate(() => { window.__now += 300000; }); await page.waitForTimeout(800);   // pass 10 min
await page.fill('#rr-extra', '7'); await page.click('#rr-save'); await page.waitForTimeout(300);
await page.screenshot({ path: D + 'v22-result.png' });
const c1 = await page.evaluate(() => { const r = DB.retos[0]; return { rounds: r.rounds, reps: r.reps, score: r.score, pr: r.pr, sec: r.sec, complete: r.complete, act: DB.activities.filter(a => a.type === 'reto').length, ev: DB.events.filter(e => e.type === 'retopr').length }; });
await page.click('#rr-ok');
// second worse attempt: no PR
const c2 = await page.evaluate(async () => { runReto('cindy', 10, 'estricta'); for (let i = 0; i < 5; i++) document.querySelector('#rt-plus').click(); window.__now += 700000; await new Promise(r => setTimeout(r, 800)); document.querySelector('#rr-extra').value = '0'; document.querySelector('#rr-save').click(); const r = DB.retos[1]; closeModal(); return { pr: r.pr, best: retoScoreTxt(retoBest('cindy|10|estricta')) }; });
// different variant is separate key → PR
const c3 = await page.evaluate(async () => { runReto('cindy', 10, 'asistida'); document.querySelector('#rt-plus').click(); window.__now += 700000; await new Promise(r => setTimeout(r, 800)); document.querySelector('#rr-save').click(); const r = DB.retos[2]; closeModal(); return { pr: r.pr }; });
// ladder top 3 complete
const l1 = await page.evaluate(async () => { runReto('escalera', 3, 'estricta'); const seen = []; for (let i = 0; i < 5; i++) { seen.push(document.querySelector('.reto-moves').textContent.match(/\d+/)[0]); window.__now += 60000; document.querySelector('#rt-next').click(); } const r = DB.retos[3]; closeModal(); return { seen, complete: r.complete, sec: r.sec, pr: r.pr, txt: retoScoreTxt(r), reps: ladderReps(10), rounds10: ladderRounds(10).length }; });
// ladder partial
const l2 = await page.evaluate(async () => { runReto('escalera', 3, 'estricta'); document.querySelector('#rt-next').click(); document.querySelector('#rt-next').click(); window.__now += 30000; document.querySelector('#rt-stop').click(); await new Promise(r => setTimeout(r, 50)); const r = DB.retos[4]; closeModal(); return { complete: r.complete, pr: r.pr, txt: retoScoreTxt(r), best: retoScoreTxt(retoBest('escalera|3|estricta')) }; });
// routine and info
const rt = await page.evaluate(() => { const bad = ROUTINES.heroe.days.flatMap(d => d.ex.map(e => e[0])).filter(n => !EX[n]); DB.profile.routine = 'heroe'; saveData(); renderTrain(); return { bad, nd: nextDay('heroe').name, inSelect: !!document.querySelector('#rt-sel option[value="heroe"]') }; });
await page.evaluate(() => { document.querySelectorAll('details.fold').forEach(d => d.open = true); }); await page.click('#reto-info'); await page.waitForTimeout(200);
await page.screenshot({ path: D + 'v22-info.png' });
const info = await page.evaluate(() => document.querySelector('.modal').scrollWidth - document.querySelector('.modal').clientWidth);
console.log(JSON.stringify({ lockClose, c1, c2, c3, l1, l2, rt, info }));
console.log('ERRORS', JSON.stringify(errors.slice(0, 5)));
await b.close();
