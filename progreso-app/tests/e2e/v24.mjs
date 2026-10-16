import { chromium } from 'playwright';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 393, height: 851 }, deviceScaleFactor: 2 });
await ctx.addInitScript(() => {
  const o = { setReminders(j) { window.__calls = (window.__calls || 0) + 1; window.__rem = JSON.parse(j); return window.__rem.length; }, notifStatus() { return window.__ns || 'on'; },
    requestNotifications() { window.__req = (window.__req || 0) + 1; }, notifyNow(t, x) { window.__test = [t, x]; }, takeLaunchTab() { const t = localStorage.getItem('__launch') || ''; localStorage.removeItem('__launch'); return t; }, openNotifSettings() { window.__opened = 1; } };
  window.AndroidBridge = new Proxy(o, { get: (t, k) => k in t ? t[k] : () => false });
});
const page = await ctx.newPage(); const errors = [];
page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('dialog', d => d.accept());
await page.clock.install({ time: new Date('2026-10-14T06:00:00') });
const D = './out/';
await page.goto('http://127.0.0.1:8765/index.html');
await page.fill('#ob-name', 'Dan'); for (let k = 0; k < 7; k++) await page.click('#ob-next'); await page.waitForTimeout(900); await page.evaluate(() => { /*__guideFix*/ /*__lvlFix*/ DB.profile.guideSeen = true; DB.profile.level = 'avanzado'; if (DB.profile.routine === 'custom') DB.profile.routine = 'pro'; saveData(); showTab(currentTab); if (document.querySelector('.guide')) closeModal(); });
await page.clock.runFor(4000);
await page.evaluate(() => { /*__s1*/ const d = todayStr(); DB.sessions.push({ id: 'sx', routine: 'pro', dayId: 'd1', dayName: 'Seed', date: d, start: Date.now() - 4e6, end: Date.now() - 1e6, extra: [], swaps: {} }); saveData(); showTab('home'); }); await page.clock.runFor(500);
const prompt = await page.evaluate(() => !!document.querySelector('.notif-prompt'));
await page.evaluate(() => document.querySelector('.notif-prompt').scrollIntoView()); await page.screenshot({ path: D + 'v24-prompt.png' });
await page.click('#np-yes'); await page.clock.runFor(300);
const sum = rem => { const byDay = {}; rem.forEach(r => { const d = new Date(r.at); const k = d.toDateString(); (byDay[k] = byDay[k] || []).push(d.getHours() + ':' + String(d.getMinutes()).padStart(2, '0') + ' ' + r.title); }); return byDay; };
const a = await page.evaluate(() => ({ on: DB.profile.notif.on, req: window.__req, rem: window.__rem, quiet: window.__rem.filter(r => { const h = new Date(r.at).getHours(); return h < 7 || h >= 22; }).length }));
const perDay = Object.values(sum(a.rem)).map(x => x.length);
console.log('A on', a.on, 'req', a.req, 'n', a.rem.length, 'quiet', a.quiet, 'maxPerDay', Math.max(...perDay));
console.log('TODAY', JSON.stringify(Object.values(sum(a.rem))[0]));
// log weight, water, protein; finish a session -> today's reminders disappear
const b1 = await page.evaluate(() => { const t = todayStr(); day(t).weight = 87.5; day(t).water = 3500; day(t).meals = [{ name: 'x', p: 250, c: 100, f: 30 }]; DB.days[t].rec = { sleepH: 8, sleepQ: 4, energy: 4, soreness: 1, stress: 1 };
  DB.sessions.push({ id: 'sx', routine: 'pro', dayId: 'd1', dayName: 'x', date: t, start: Date.now() - 3e6, end: Date.now() }); saveData(); syncReminders(); const t0 = new Date(); t0.setHours(23, 59); return window.__rem.filter(r => r.at < t0.getTime()).map(r => r.title); });
console.log('TODAY after doing everything', JSON.stringify(b1));
// run plan session today replaces train
const c = await page.evaluate(() => { DB.sessions = DB.sessions.filter(s => s.id !== 'sx'); const t = todayStr(); DB.runPlan = { type: '5k', weeks: [{ w: 1, sessions: [{ id: 'r1', date: t, type: 'suave', km: 5, label: '5 km suaves' }] }] }; saveData(); syncReminders(); const t0 = new Date(); t0.setHours(23, 59); const td = window.__rem.filter(r => r.at < t0.getTime()).map(r => r.title); DB.runPlan = null; saveData(); return td; });
console.log('TODAY with run', JSON.stringify(c));
// comeback: one notice, kept across syncs, not repeated after it passed
const d = await page.evaluate(() => { const t = todayStr(); DB.sessions = []; DB.activities = [{ id: 'a', date: addDays(t, -6), type: 'caminar', min: 30, t: 1 }]; saveData(); syncReminders(); const c1 = window.__rem.filter(r => r.title.includes('Retomamos')); syncReminders(); const c2 = window.__rem.filter(r => r.title.includes('Retomamos')); return { n1: c1.length, n2: c2.length, same: c1[0] && c2[0] && c1[0].at === c2[0].at, when: c1[0] && new Date(c1[0].at).toString().slice(0, 21) }; });
console.log('COMEBACK', JSON.stringify(d));
await page.clock.fastForward(36 * 3600 * 1000);   // pasa el aviso
const d2 = await page.evaluate(() => { syncReminders(); return window.__rem.filter(r => r.title.includes('Retomamos')).length; });
console.log('COMEBACK after it fired', d2);
// settings card
await page.evaluate(() => { showTab('more'); document.querySelectorAll('details.fold').forEach(x => x.open = true); });
await page.locator('#nt-on').scrollIntoViewIfNeeded(); await page.clock.runFor(300); await page.screenshot({ path: D + 'v24-settings.png' });
await page.uncheck('[data-nt="water"]'); 
const w = await page.evaluate(() => window.__rem.some(r => r.title.includes('agua') || r.title.includes('L')));
const opts = await page.evaluate(() => { const o = [...document.querySelector('[data-ntt="train"]').options].map(x => x.value); return [o[0], o[o.length - 1], o.length]; }); console.log('OPTIONS', JSON.stringify(opts));
const bad = await page.evaluate(() => DB.profile.notif.types.train.time);
await page.selectOption('[data-ntt="weigh"]', '09:15');
const wt = await page.evaluate(() => window.__rem.filter(r => r.title.includes('pesas')).map(r => new Date(r.at).getHours() + ':' + new Date(r.at).getMinutes())[0]);
await page.click('#nt-test'); const test = await page.evaluate(() => window.__test);
await page.evaluate(() => { window.__ns = 'off'; renderMore(); document.querySelectorAll('details.fold').forEach(x => x.open = true); });
await page.click('#nt-settings'); const opened = await page.evaluate(() => window.__opened);
// visibility hidden triggers sync
const calls0 = await page.evaluate(() => window.__calls);
await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); });
const calls1 = await page.evaluate(() => window.__calls);
// open from notification
await page.evaluate(() => window.onNotifOpen('food')); const tab1 = await page.evaluate(() => currentTab);
await page.evaluate(() => localStorage.setItem('__launch', 'progress')); await page.reload(); await page.clock.runFor(2000);
const tab2 = await page.evaluate(() => currentTab);
// master off -> empty agenda
await page.evaluate(() => { showTab('more'); document.querySelectorAll('details.fold').forEach(x => x.open = true); }); await page.uncheck('#nt-on');
const off = await page.evaluate(() => ({ n: window.__rem.length, on: DB.profile.notif.on }));
console.log(JSON.stringify({ prompt, water: w, badTimeKept: bad, weighAt: wt, test: !!test, opened, sync: calls1 > calls0, tab1, tab2, off }));
console.log('ERRORS', JSON.stringify(errors.slice(0, 5)));
await b.close();
