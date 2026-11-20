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
// --- running view with toggle
await page.evaluate(() => { showTab('train'); DB.profile.trainMode = 'running'; renderTrain(); });
await page.click('[data-where="cinta"]'); await page.waitForTimeout(150);
const btn = await page.textContent('#rn-free');
await page.evaluate(() => document.querySelectorAll('details.fold').forEach(d => d.open = false));
await page.screenshot({ path: D + 'v21-running.png' });
await page.click('#rn-free'); await page.waitForTimeout(250); await page.screenshot({ path: D + 'v21-picker.png' });
// controlled clock
await page.evaluate(() => { window.__now = Date.now(); Date.now = () => window.__now; });
await page.click('[data-tm="int"]'); await page.waitForTimeout(150);
const s0 = await page.evaluate(() => ({ cinta: RUN.st.cinta, watch: RUN.watch, kmh: RUN.st.kmh, inc: RUN.st.inc, segs: RUN.st.segs.length, expect: RUN.st.segs.reduce((a, s) => a + s.kmh * s.sec / 3.6, 0), total: RUN.st.segs.reduce((a, s) => a + s.sec, 0) }));
const track = await page.evaluate(n => { const out = []; for (let i = 0; i < n; i++) { window.__now += 1000; runTick(); if (i === 310) out.push({ seg: RUN.st.seg, kmh: RUN.st.kmh }); if (i === 380) out.push({ seg: RUN.st.seg, kmh: RUN.st.kmh }); } return { out, dist: RUN.st.dist, splits: RUN.st.splits.slice(), seg: RUN.st.seg, climb: RUN.st.climb }; }, s0.total);
await page.screenshot({ path: D + 'v21-live.png' });
// manual speed change + pause doesn't add distance
const man = await page.evaluate(() => { const d0 = RUN.st.dist; pauseRun(); for (let i = 0; i < 60; i++) { window.__now += 1000; runTick(); } const dPaused = RUN.st.dist - d0; pauseRun(); tmSet(0.5, 1); const k = RUN.st.kmh, inc = RUN.st.inc; for (let i = 0; i < 60; i++) { window.__now += 1000; runTick(); } return { dPaused, k, inc, d60: RUN.st.dist - d0 }; });
// restore after reload (app killed): state persists, gap not invented
const beforeReload = await page.evaluate(() => RUN.st.dist);
await page.evaluate(() => saveRunState());
await page.reload(); await page.waitForTimeout(700);
const rest = await page.evaluate(() => { const st = RUN.st; window.__now = Date.now() + 600000; const real = Date.now; Date.now = () => window.__now; const d0 = st.dist; runTick(); return { cinta: st && st.cinta, tab: currentTab, d0, jump: st.dist - d0, watch: RUN.watch }; });
// finish with console correction
await page.click('#rl-stop'); await page.waitForTimeout(200); await page.screenshot({ path: D + 'v21-finish.png' });
const est = await page.inputValue('#tf-km');
await page.fill('#tf-km', '6.10'); await page.click('#tf-ok'); await page.waitForTimeout(300);
await page.click('#rs-ok'); await page.waitForTimeout(200);
const saved = await page.evaluate(() => { const r = DB.runs[DB.runs.length - 1]; return { source: r.source, km: r.km, dur: r.dur, climb: r.climb, best: r.best, splits: r.splits.length, records: Object.keys(runRecords().rec).length, hist: document.querySelector('.run-row .rr-ico') && document.querySelector('.run-row .rr-ico').textContent }; });
// plan session on treadmill: tempo speed from easy
const plan = await page.evaluate(() => { const s = mkSession(todayStr(), 'tempo', 7); startRun({ title: s.label, segs: s.segs }); const a = { cinta: RUN.st.cinta, kmh0: RUN.st.kmh }; tmOnSeg(RUN.st, s.segs[1]); a.kmhTempo = RUN.st.kmh; a.easy = tmEasy(); discardRun(); return a; });
// street mode untouched
const street = await page.evaluate(() => { DB.profile.runIndoor = false; startRun({ title: 'x' }); const r = { cinta: !!RUN.st.cinta }; discardRun(); return r; });
// --- PF
const pf = await page.evaluate(() => {
  DB.profile.gym = 'pf'; DB.profile.equip = GYM_PRESETS.pf.equip.slice(); saveData();
  const before = { prensa: okForMe('Prensa 45°'), smith: okForMe('Sentadilla en Smith') };
  DB.profile.pfMachines = { prensa: 'no' }; const after = { prensa: okForMe('Prensa 45°'), prensaMaq: okForMe('Prensa de piernas (máquina)'), subs: smartSubs('Prensa 45°').slice(0, 3) };
  DB.profile.gym = 'completo'; const otherGym = okForMe('Prensa 45°'); DB.profile.gym = 'pf'; DB.profile.equip = GYM_PRESETS.pf.equip.slice();
  return { before, after, otherGym };
});
await page.evaluate(() => { showTab('more'); document.querySelectorAll('details.fold').forEach(d => d.open = true); });
await page.click('#mo-pf'); await page.waitForTimeout(200);
await page.click('[data-pfm="black"]'); await page.fill('#pf-club', 'Plaza Satélite');
await page.click('[data-pf="smith"][data-v="no"]');
const sheet = await page.evaluate(() => ({ spa: document.querySelectorAll('.pf-sec').length, items: document.querySelectorAll('.pf-item').length, equipSmith: DB.profile.equip.includes('smith'), club: DB.profile.pfClub, ovf: document.querySelector('.modal').scrollWidth - document.querySelector('.modal').clientWidth }));
await page.click('[data-pf="smith"][data-v="no"]');   // quitar la marca
await page.screenshot({ path: D + 'v21-pf.png' });
await page.click('#pf-ok'); await page.waitForTimeout(200);
const sm = await page.evaluate(() => ({ equipSmith: DB.profile.equip.includes('smith'), btn: document.querySelector('#mo-pf small').textContent }));
const spa = await page.evaluate(() => { DB.days[todayStr()] = Object.assign(DB.days[todayStr()] || {}, { rec: { sleepH: 4, sleepQ: 1, energy: 1, soreness: 5, stress: 5 } }); DB.profile.trainMode = 'fuerza'; saveData(); const nd = nextDay(DB.profile.routine); return todayMissions().map(m => m.why).join(' | ') + ' ##rest:' + (nd && nd.rest); });
const acts = await page.evaluate(() => { openActivityForm(); const t = [...document.querySelectorAll('[data-at]')].map(b => b.dataset.at); closeModal(); return t; });
console.log(JSON.stringify({ btn, s0, track: { ...track, splits: track.splits }, man, beforeReload, rest, est, saved, plan, street, pf, sheet, sm, spa, acts }, null, 0));
console.log('ERRORS', JSON.stringify(errors.slice(0, 5)));
await b.close();
