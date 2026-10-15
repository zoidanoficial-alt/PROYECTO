import { chromium } from 'playwright';
const b = await chromium.launch(); const page = await b.newPage(); const errors = [];
page.on('pageerror', e => errors.push(e.message));
await page.goto('http://127.0.0.1:8765/index.html');
await page.fill('#ob-name', 'Dan'); for (let k = 0; k < 7; k++) await page.click('#ob-next'); await page.waitForTimeout(900); await page.evaluate(() => { /*__guideFix*/ /*__lvlFix*/ DB.profile.guideSeen = true; DB.profile.level = 'avanzado'; if (DB.profile.routine === 'custom') DB.profile.routine = 'pro'; saveData(); showTab(currentTab); if (document.querySelector('.guide')) closeModal(); });
await page.evaluate(() => { const t = todayStr(); for (let k = 0; k < 3000; k++) DB.lifts.push({ id: 'l' + k, ex: 'Press banca con barra', w: 22.6796185, r: 8, rir: 2, date: addDays(t, -k % 300), t: k, sid: 'x', tech: k % 50 ? 'normal' : 'dropset' }); flushSave(); });
const before = await page.evaluate(() => localStorage.getItem('miprogreso.v1').length);
await page.reload(); await page.waitForTimeout(300);
await page.evaluate(() => flushSave());
const after = await page.evaluate(() => localStorage.getItem('miprogreso.v1').length);
const kept = await page.evaluate(() => DB.lifts.filter(l => l.tech === 'dropset').length);
// action then immediate reload: the pagehide flush must persist it
await page.evaluate(() => { day(todayStr()).weight = 77.7; saveData(); });
await page.reload(); await page.waitForTimeout(300);
const w = await page.evaluate(() => DB.days[todayStr()].weight);
console.log('size before', before, 'after', after, 'reduction %', Math.round((1 - after / before) * 100), '| dropsets kept', kept, '/60 | weight persisted', w, '| errors', JSON.stringify(errors));
await b.close();
