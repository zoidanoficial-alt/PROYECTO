import { chromium } from 'playwright';
import fs from 'fs';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 393, height: 851 }, deviceScaleFactor: 2, acceptDownloads: true });
const page = await ctx.newPage(); const errors = [];
page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('dialog', d => d.accept());
await page.goto('http://127.0.0.1:8765/index.html');
await page.fill('#ob-name', 'Dan'); for (let k = 0; k < 7; k++) await page.click('#ob-next'); await page.waitForTimeout(900); await page.evaluate(() => { /*__guideFix*/ /*__lvlFix*/ DB.profile.guideSeen = true; DB.profile.level = 'avanzado'; if (DB.profile.routine === 'custom') DB.profile.routine = 'pro'; saveData(); showTab(currentTab); if (document.querySelector('.guide')) closeModal(); }); await page.waitForTimeout(300); await page.evaluate(() => document.querySelectorAll('details.fold').forEach(d => d.open = true));
await page.waitForTimeout(300);
await page.click('nav button[data-tab=food]');
await page.evaluate(() => document.querySelectorAll('details.fold').forEach(d => d.open = true)); // OPENFOLDS
await page.click('#fd-hunger');
for (const [id, v] of [['any', 0], ['sudden', 1], ['hours', 0], ['trigger', 1], ['sleep', 0]]) await page.click(`[data-hq="${id}|${v}"]`);
await page.click('[data-swap-food="1"]'); await page.click('[data-trig="estres"]');
await page.screenshot({ path: 'v9-antojo.png', fullPage: true });
await page.click('#hc-save'); await page.waitForTimeout(200);
await page.click('#fd-hunger');
for (const [id, v] of [['any', 1], ['sudden', 0], ['hours', 1], ['trigger', 0], ['sleep', 0]]) await page.click(`[data-hq="${id}|${v}"]`);
console.log('real:', (await page.textContent('.status')).slice(0, 60));
await page.click('#hc-close');
await page.click('[data-q="verde"]'); await page.click('[data-q="fruta"]');
for (let k = 0; k < 3; k++) { await page.click('#fd-gut'); await page.click('[data-gs="hinchazon"]'); await page.click('[data-gx="lacteos"]'); await page.click('#gf-save'); await page.waitForTimeout(100); }
await page.screenshot({ path: 'v9-food.png', fullPage: true });
console.log('pattern:', await page.locator('.status.warn').first().textContent());
await page.click('#fab'); await page.click('[data-qs="export"]'); await page.click('[data-per="all"]');
const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#ex-xlsx')]);
console.log('xlsx size', fs.statSync(await dl.path()).size);
console.log('ERRORS', JSON.stringify(errors)); await b.close();
