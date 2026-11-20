import { chromium } from 'playwright';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 393, height: 851 }, deviceScaleFactor: 2 });
const page = await ctx.newPage(); const errors = [];
page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
const D = './out/';
const R = {};
await page.goto('http://127.0.0.1:8765/index.html');
await page.fill('#ob-name', 'Ana');
for (let k = 0; k < 6; k++) await page.click('#ob-next');
R.obLevel = await page.evaluate(() => [...document.querySelectorAll('[data-ch^="level|"]')].map(b => b.dataset.ch + (b.classList.contains('on') ? '*' : '')));
await page.screenshot({ path: D + 'v27-ob.png' });
await page.click('#ob-next'); await page.waitForTimeout(900);
for (let i = 0; i < 4; i++) await page.click('#gd-next');
await page.waitForTimeout(2600);
await page.evaluate(() => scrollTo(0, 0));
R.beginner = await page.evaluate(() => ({ level: DB.profile.level, tabs: [...document.querySelectorAll('nav.tabs button')].filter(b => !b.hidden).map(b => b.textContent.trim()),
  first: [...document.querySelector('#view-home').children].filter(e => e.offsetParent && !e.classList.contains('more-group')).map(e => e.className.split(' ')[0] || e.tagName),
  stats: !!document.querySelector('.stats3'), qa: !!document.querySelector('.quick.qa:not([hidden])'), goal: document.querySelector('.goal-line') && document.querySelector('.goal-line').textContent, out: document.querySelector('.m-out') && document.querySelector('.m-out').textContent,
  path: document.querySelector('.pc-stages li.now') && document.querySelector('.pc-stages li.now').textContent.trim(), moreClosed: !!document.querySelector('#view-home .more-group:not([open])') }));
await page.screenshot({ path: D + 'v27-hoy.png' });
await page.evaluate(() => showTab('train')); await page.waitForTimeout(300);
R.plan = await page.evaluate(() => ({ toolRow: !!document.querySelector('#view-train .tool-row'), more: !!document.querySelector('#view-train .more-group'), routine: !!document.querySelector('.routine-card') }));
await page.screenshot({ path: D + 'v27-plan.png' });
await page.evaluate(() => showTab('progress')); await page.waitForTimeout(300);
R.prog = await page.evaluate(() => ({ tabs: [...document.querySelectorAll('#view-progress .seg button')].map(b => b.textContent.trim()), lock: !!document.querySelector('.bp-lock') }));
await page.screenshot({ path: D + 'v27-prog.png' });
await page.evaluate(() => showTab('more')); await page.waitForTimeout(300);
await page.screenshot({ path: D + 'v27-explorar.png' });
await page.click('[data-explore="food"]'); R.food = await page.evaluate(() => currentTab);
await page.evaluate(() => showTab('more'));
await page.click('[data-explore="stats"]'); await page.waitForTimeout(150); R.gate = await page.evaluate(() => !!document.querySelector('#st-adv'));
await page.evaluate(() => closeModal());
// completar 3 entrenos → hitos y récords
await page.evaluate(() => { const t = todayStr(); for (let k = 0; k < 3; k++) { const d = addDays(t, -k), sid = 'z' + k; DB.sessions.push({ id: sid, routine: 'inicio', dayId: 'i1', dayName: 'x', date: d, start: 1, end: 2 }); DB.lifts.push({ id: 'l' + k, ex: 'Sentadilla sin peso', w: 0, r: 12 + k, rir: 2, date: d, t: Date.now() - k, sid }); } saveData(); showTab('home'); });
R.after3 = await page.evaluate(() => ({ next: document.querySelector('.pc-stages li.now b').textContent, done: document.querySelectorAll('.pc-stages li.done').length }));
await page.evaluate(() => showTab('progress'));
R.prog3 = await page.evaluate(() => ({ marks: document.querySelectorAll('.bp-ex').length, tabs: [...document.querySelectorAll('#view-progress .seg button')].map(b => b.textContent.trim()) }));
// cambiar a avanzado
await page.evaluate(() => showTab('more')); await page.click('[data-level="avanzado"]'); await page.waitForTimeout(200);
R.adv = await page.evaluate(() => ({ level: DB.profile.level, tabs: [...document.querySelectorAll('nav.tabs button')].filter(b => !b.hidden).map(b => b.textContent.trim()) }));
await page.evaluate(() => showTab('home')); await page.waitForTimeout(300);
R.advHome = await page.evaluate(() => ({ path: !!document.querySelector('.path-card'), explore: !!document.querySelector('#home-explore'), fab: getComputedStyle(document.querySelector('#fab')).display }));
await page.screenshot({ path: D + 'v27-hoy-adv.png' });
await page.evaluate(() => showTab('train'));
R.planAdv = await page.evaluate(() => ({ toolRow: !!document.querySelector('#view-train .tool-row'), more: !!document.querySelector('#view-train .more-group') }));
await page.evaluate(() => showTab('progress'));
R.progAdv = await page.evaluate(() => [...document.querySelectorAll('#view-progress .seg button')].length);
console.log(JSON.stringify(R, null, 1));
console.log('ERRORS', JSON.stringify(errors.slice(0, 5)));
await b.close();
