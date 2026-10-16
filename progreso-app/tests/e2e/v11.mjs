import { chromium } from 'playwright';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 393, height: 851 }, deviceScaleFactor: 2 });
const page = await ctx.newPage(); const errors = [];
page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('dialog', d => d.accept());
await page.goto('http://127.0.0.1:8765/index.html');
await page.fill('#ob-name', 'Ana'); await page.click('#ob-next');
await page.click('[data-ch="stage|1"]'); await page.click('[data-ch="minutes|15"]'); await page.click('[data-ch="days|2"]');
await page.screenshot({ path: 'v11-ob1.png', fullPage: true });
await page.click('#ob-next');
await page.click('[data-multi="enjoy|caminar"]'); await page.click('[data-multi="enjoy|yoga"]'); await page.click('[data-multi="barriers|verguenza"]'); await page.click('[data-multi="barriers|tiempo"]');
await page.screenshot({ path: 'v11-ob2.png', fullPage: true });
for (let k = 0; k < 5; k++) await page.click('#ob-next');
await page.waitForTimeout(900); await page.evaluate(() => { /*__lvlFix*/ DB.profile.guideSeen = true; DB.profile.level = 'avanzado'; if (DB.profile.routine === 'custom') DB.profile.routine = 'pro'; saveData(); if (document.querySelector('.guide')) closeModal(); render(currentTab); document.querySelectorAll('.more-group').forEach(g => g.open = true); });
console.log('profile:', await page.evaluate(() => JSON.stringify({ st: DB.profile.stage, r: DB.profile.routine, d: DB.profile.trainDays, e: DB.profile.enjoy })));
await page.screenshot({ path: 'v11-home1.png', fullPage: true });
await page.evaluate(() => document.querySelectorAll('.more-group').forEach(g => g.open = true)); await page.click('#st-mini').catch(async () => { await page.click('#st-home'); });
await page.waitForTimeout(300);
// commitments
await page.click('nav button[data-tab=home]'); await page.evaluate(() => document.querySelectorAll('details.fold').forEach(d => d.open = true)); await page.click('#cm-add'); await page.locator('[data-ci]').first().click(); await page.waitForTimeout(150);
await page.evaluate(() => document.querySelectorAll('details.fold').forEach(d => d.open = true)); // OPENFOLDS
await page.locator('#view-home [data-cm]').first().check(); await page.waitForTimeout(150);
// switch to stage 2 via Más
await page.evaluate(() => { DB.profile.stage = 2; DB.profile.routine = 'tp4'; saveData(); renderHome(); });
await page.evaluate(() => document.querySelectorAll('details.fold').forEach(d => d.open = true)); // OPENFOLDS
await page.screenshot({ path: 'v11-home2.png', fullPage: true });
await page.evaluate(() => document.querySelectorAll('details.fold').forEach(d => d.open = true)); await page.locator('#view-home [data-ag-move]').first().click(); await page.waitForTimeout(150);
const mv = page.locator('[data-mv]'); if (await mv.count()) await mv.first().click(); else await page.click('#mv-cancel');
await page.evaluate(() => document.querySelectorAll('details.fold').forEach(d => d.open = true)); await page.click('#ag-hard'); await page.waitForTimeout(150);
console.log('hard week target:', await page.evaluate(() => weekTarget()), 'moves:', await page.evaluate(() => JSON.stringify(DB.moves)));
// activity
await page.evaluate(() => openQuickSheet()); await page.click('[data-qs="activity"]'); await page.click('[data-at="correr"]'); await page.fill('#ac-min', '30'); await page.fill('#ac-km', '5'); await page.click('#ac-save'); await page.waitForTimeout(200);
// session with env + mission + pain
await page.click('nav button[data-tab=train]');
await page.evaluate(() => document.querySelectorAll('details.fold').forEach(d => d.open = true)); // OPENFOLDS
await page.evaluate(() => { startSession(DB.profile.routine, nextDay(DB.profile.routine).id); DB.active && (activeSession().adjustDone = true); renderTrain(); });
await page.evaluate(() => document.querySelectorAll('details.fold').forEach(d => d.open = true)); // OPENFOLDS
await page.waitForTimeout(200);
console.log('before env:', (await page.locator('.ex-card h4').allTextContents()).slice(0, 3));
await page.click('[data-env="hotel"]'); await page.waitForTimeout(200);
console.log('hotel:', (await page.locator('.ex-card h4').allTextContents()).slice(0, 3));
console.log('mission:', await page.locator('.mission').first().textContent());
await page.screenshot({ path: 'v11-session.png', fullPage: true });
await page.click('#view-train [data-pain="0"]'); await page.click('[data-pn="light"]'); await page.waitForTimeout(200);
console.log('mission after pain:', await page.locator('.mission').first().textContent());
await page.fill('#w-0', '0'); await page.fill('#r-0', '12'); await page.click('#save-0'); await page.waitForTimeout(200);
await page.click('#ss-finish'); await page.waitForTimeout(400);
await page.locator('[data-help="musica"]').click(); await page.click('#sum-ok');
await page.click('nav button[data-tab=progress]'); await page.click('[data-mode="historia"]'); await page.waitForTimeout(200);
await page.evaluate(() => document.querySelectorAll('details.fold').forEach(d => d.open = true)); // OPENFOLDS
await page.screenshot({ path: 'v11-history.png', fullPage: true });
await page.click('nav button[data-tab=more]'); await page.waitForTimeout(200);
await page.evaluate(() => document.querySelectorAll('details.fold').forEach(d => d.open = true)); // OPENFOLDS
await page.screenshot({ path: 'v11-more.png', fullPage: true });
console.log('ERRORS', JSON.stringify(errors)); await b.close();
