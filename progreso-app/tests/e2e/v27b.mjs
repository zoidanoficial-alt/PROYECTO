import { chromium } from 'playwright';
const b = await chromium.launch(); const page = await (await b.newContext({ viewport: { width: 393, height: 851 }, deviceScaleFactor: 2 })).newPage();
const errors = []; page.on('pageerror', e => errors.push(e.message));
const D = './out/';
await page.goto('http://127.0.0.1:8765/index.html');
await page.fill('#ob-name', 'Ana'); for (let k = 0; k < 6; k++) await page.click('#ob-next');
await page.screenshot({ path: D + 'v27b-ob.png' });
await page.click('#ob-next'); await page.waitForTimeout(900); for (let i = 0; i < 4; i++) await page.click('#gd-next'); await page.waitForTimeout(2600);
const r = await page.evaluate(() => ({ routine: DB.profile.routine, days: DB.profile.trainDays, plan: DB.plan.map(id => { const w = workoutById(id); return w ? w.name + ':' + w.ex.map(e => e[0] + ' ' + e[1] + 'x').join(', ') : '-'; }), notif: !!document.querySelector('.notif-prompt') }));
await page.evaluate(() => scrollTo(0, 0)); await page.screenshot({ path: D + 'v27b-hoy.png' });
// avanzado sigue eligiendo rutina
const page2 = await (await b.newContext({ viewport: { width: 393, height: 851 } })).newPage(); await page2.goto('http://127.0.0.1:8765/index.html');
await page2.fill('#ob-name', 'Leo'); for (let k = 0; k < 6; k++) await page2.click('#ob-next');
await page2.click('[data-ch="level|avanzado"]'); const advChoices = await page2.evaluate(() => document.querySelectorAll('[data-ch^="routine|"]').length);
await page2.click('[data-ch="routine|tp4"]'); await page2.click('#ob-next'); await page2.waitForTimeout(500);
const adv = await page2.evaluate(() => ({ level: DB.profile.level, routine: DB.profile.routine }));
console.log(JSON.stringify({ r, advChoices, adv }, null, 1), errors);
await b.close();
