import { chromium } from 'playwright';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 393, height: 851 }, deviceScaleFactor: 2 });
const page = await ctx.newPage(); const errors = [];
page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('dialog', d => d.accept());
const D = './out/';
await page.goto('http://127.0.0.1:8765/index.html');
await page.click('[data-oblook="f"]');
const ob = await page.evaluate(() => ({ look: document.documentElement.dataset.look, logo: document.querySelector('.ob-logo').src.split('/').pop(), w: document.querySelector('#ob-w').value }));
await page.screenshot({ path: D + 'v20-ob.png' });
await page.fill('#ob-name', 'Sofía'); for (let k = 0; k < 7; k++) await page.click('#ob-next'); await page.waitForTimeout(900); await page.evaluate(() => { /*__guideFix*/ /*__lvlFix*/ DB.profile.guideSeen = true; DB.profile.level = 'avanzado'; if (DB.profile.routine === 'custom') DB.profile.routine = 'pro'; saveData(); showTab(currentTab); if (document.querySelector('.guide')) closeModal(); });
await page.waitForTimeout(4000);
// seed a bit
await page.evaluate(() => { const t = todayStr(); for (let k = 20; k >= 1; k--) { const d = addDays(t, -k); day(d).weight = 65 - k * 0.05; if (k % 3 === 0) { DB.sessions.push({ id: 's' + k, routine: 'gluteo', dayId: 'g1', dayName: 'Día 1 · Glúteo y femoral', date: d, start: 1, end: 2 }); DB.lifts.push({ id: 'l' + k, ex: 'Hip thrust', w: 60 + (20 - k), r: 10, rir: 2, date: d, t: parseDate(d).getTime(), sid: 's' + k }); DB.lifts.push({ id: 'b' + k, ex: 'Press banca con barra', w: 30, r: 8, rir: 2, date: d, t: parseDate(d).getTime() + 5, sid: 's' + k }); } } saveData(); showTab(currentTab); });
const st = await page.evaluate(() => ({ prof: { look: DB.profile.look, sex: DB.profile.sex, theme: DB.profile.theme, routine: DB.profile.routine },
  bg: getComputedStyle(document.body).backgroundColor, accent: getVar('--accent'), hdr: document.querySelector('.hdr-logo').src.split('/').pop(),
  invite: !!document.querySelector('.ella-invite'), txt: femText('Estás listo 🏋️ 🏃 💪 🏋️‍♀️'), lvlCuts: strengthLevels()[0].cuts, scoreF: setScore({ ex: 'Press banca con barra', w: 30, r: 8 }, 65) }));
await page.evaluate(() => document.querySelectorAll('details.fold').forEach(d => d.open = true)); await page.waitForTimeout(600);
await page.screenshot({ path: D + 'v20-home.png', fullPage: false });
await page.evaluate(() => { window.scrollTo(0, 700); }); await page.screenshot({ path: D + 'v20-home2.png' });
await page.evaluate(() => { showTab('train'); window.scrollTo(0, 0); }); await page.waitForTimeout(200); await page.screenshot({ path: D + 'v20-train.png' });
await page.evaluate(() => { openCheckin(); }); await page.waitForTimeout(300); await page.screenshot({ path: D + 'v20-checkin.png' });
const ck = await page.evaluate(() => [...document.querySelectorAll('.ck-scale small')].map(x => x.textContent).slice(5, 6));
await page.evaluate(() => closeModal());
await page.evaluate(() => { showTab('progress'); progMode = 'strength'; renderProgress(); window.scrollTo(0, 0); }); await page.waitForTimeout(200); await page.screenshot({ path: D + 'v20-prog.png' });
const note = await page.evaluate(() => /mujeres/.test(document.querySelector('#view-progress').textContent));
await page.evaluate(() => { showTab('more'); window.scrollTo(0, 0); }); await page.waitForTimeout(200);
await page.evaluate(() => document.querySelectorAll('details.fold').forEach(d => d.open = true));
await page.locator('#ella-toggle').scrollIntoViewIfNeeded(); await page.screenshot({ path: D + 'v20-more.png' });
// dark rosa
await page.click('#view-more [data-theme="dark"]'); await page.evaluate(() => { showTab('home'); window.scrollTo(0, 0); }); await page.waitForTimeout(200); await page.screenshot({ path: D + 'v20-dark.png' });
// toggle off -> classic
await page.evaluate(() => { showTab('more'); document.querySelectorAll('details.fold').forEach(d => d.open = true); }); await page.click('#ella-toggle');
const off = await page.evaluate(() => ({ look: document.documentElement.dataset.look, hdr: document.querySelector('.hdr-logo').src.split('/').pop(), sex: DB.profile.sex }));
console.log(JSON.stringify({ ob, st, ck, note, off }, null, 1));
console.log('ERRORS', JSON.stringify(errors.slice(0, 5)));
await b.close();
