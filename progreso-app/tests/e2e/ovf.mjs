import { chromium } from 'playwright';
const W = Number(process.argv[2] || 300);
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: W, height: 760 }, deviceScaleFactor: 2 });
const page = await ctx.newPage(); const errors = [];
page.on('pageerror', e => errors.push(e.message)); page.on('dialog', d => d.accept());
await page.goto('http://127.0.0.1:8765/index.html');
await page.fill('#ob-name', 'Daniel'); for (let k = 0; k < 7; k++) await page.click('#ob-next'); await page.waitForTimeout(900); await page.evaluate(() => { /*__guideFix*/ /*__lvlFix*/ DB.profile.guideSeen = true; DB.profile.level = 'avanzado'; if (DB.profile.routine === 'custom') DB.profile.routine = 'pro'; saveData(); showTab(currentTab); if (document.querySelector('.guide')) closeModal(); });
await page.waitForTimeout(300);
if (process.argv[3]) await page.evaluate(t => { setElla(t === 'rosa'); render(currentTab); }, process.argv[3]);
const Z = Number(process.argv[4] || 1);
const probe = async label => {
  const r = await page.evaluate(Z => {
    document.querySelectorAll('details').forEach(d => d.open = true);
    if (Z !== 1) { const els = [...document.querySelectorAll('body *')].filter(e => !e.dataset.zz); const fs = els.map(e => parseFloat(getComputedStyle(e).fontSize)); els.forEach((e, i) => { e.style.fontSize = fs[i] * Z + 'px'; e.dataset.zz = 1; }); }
    const vw = document.documentElement.clientWidth, bad = [];
    const roots = [document.querySelector('.modal-bg.open .modal'), document.querySelector('section.view.active')].filter(Boolean);
    const lim = roots[0] && roots[0].classList.contains('modal') ? roots[0].getBoundingClientRect().right : vw;
    for (const el of roots[0].querySelectorAll('*')) { const rc = el.getBoundingClientRect(); if (rc.width && rc.right > lim + 1 && !el.closest('.seg.scroll,.scroll-x,[data-hscroll],.rd-strip,.wz-focus,.p2-chips,.cp-strip,.we-fcards')) { const cs = getComputedStyle(el); bad.push((el.id ? '#' + el.id : el.tagName.toLowerCase() + '.' + [...el.classList].join('.')) + ' +' + Math.round(rc.right - lim) + (el.textContent || '').trim().slice(0, 25)); } }
    return { doc: document.documentElement.scrollWidth - vw, modal: roots[0].classList.contains('modal') ? roots[0].scrollWidth - roots[0].clientWidth : null, bad: bad.slice(0, 6) };
  }, Z);
  if (r.doc > 0 || r.modal > 0 || r.bad.length) console.log('OVF', label, JSON.stringify(r));
};
for (const tab of ['home', 'train', 'food', 'progress', 'more']) {
  await page.evaluate(t => showTab(t), tab); await page.waitForTimeout(150); await probe(tab);
}
for (const m of ['fuerza', 'analysis', 'historia', 'weight', 'measures', 'strength', 'photos', 'logros']) { await page.evaluate(m => { showTab('progress'); progMode = m; renderProgress(); }, m); await probe('prog-' + m); }
await page.evaluate(() => { showTab('train'); DB.profile.trainMode = 'running'; renderTrain(); }); await probe('running');
await page.evaluate(() => { DB.profile.trainMode = 'fuerza'; startSession('libre'); const s = activeSession(); s.adjustDone = true; renderTrain(); }); await probe('session');
const modals = { checkin: 'openCheckin()', quick: "document.querySelector('.fab').click()", tech: "techniqueSheet(Object.keys(EX)[0])", cycle: 'openCycleConsent()', runsetup: "openRunPlanSetup && openRunPlanSetup()", treadmill: 'openTreadmillPicker()', pf: "DB.profile.gym='pf'; DB.profile.pfMember='black'; openPfSheet()", act: 'openActivityForm()', retoset: "openRetoSetup('escalera')", retoinfo: 'openHollandInfo()', retolive: "closeModal(); runReto('escalera', 10, 'remo')", tmlive: "closeModal(); DB.profile.runIndoor=true; startRun({title:'t', segs: tmWorkouts().int.segs}); showTab('train')" };
for (const [k, js] of Object.entries(modals)) { try { await page.evaluate(js => { closeModal && closeModal(); eval(js); }, js); await page.waitForTimeout(200); await probe('modal-' + k); } catch (e) { console.log('skip', k, e.message.slice(0, 80)); } }
await page.evaluate(() => { closeModal(); openCheckin(); }); await page.waitForTimeout(250); await probe('final');
await page.screenshot({ path: './out/' + `ovf-${W}${process.argv[3] || ''}${Z}.png` });
console.log('done', W, 'errors', JSON.stringify(errors.slice(0, 4)));
await b.close();
