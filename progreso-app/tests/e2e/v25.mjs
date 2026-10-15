import { chromium } from 'playwright';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 393, height: 851 }, deviceScaleFactor: 2 });
const page = await ctx.newPage(); const errors = [];
page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('dialog', d => { errors.push('DIALOG ' + d.message()); d.accept(); });
const D = './out/';
const R = {};
await page.goto('http://127.0.0.1:8765/index.html');
await page.fill('#ob-name', 'Ana'); for (let k = 0; k < 7; k++) await page.click('#ob-next');
await page.waitForTimeout(1200);
R.guide = await page.evaluate(() => !!document.querySelector('.guide'));
await page.screenshot({ path: D + 'v25-guide.png' });
for (let i = 0; i < 4; i++) await page.click('#gd-next');
R.guideSeen = await page.evaluate(() => DB.profile.guideSeen);
await page.waitForTimeout(2600);
// Inicio
R.home = await page.evaluate(() => ({ ellaBtn: !document.querySelector('#hdr-ella').hidden, topFolds: document.querySelectorAll('#view-home > details.fold:not(.more-group)').length, moreGroup: !!document.querySelector('#view-home > .more-group:not([open])'), inMore: document.querySelectorAll('.more-group > details.fold').length, dots: document.querySelectorAll('.wd-dots i').length, chequeoFold: [...document.querySelectorAll('#view-home details.fold > summary b')].filter(x => x.textContent.includes('Chequeo')).length }));
await page.screenshot({ path: D + 'v25-home.png' });
await page.click('#hdr-ella'); await page.waitForTimeout(300);
R.ellaOn = await page.evaluate(() => ({ look: DB.profile.look, sex: DB.profile.sex, btn: document.querySelector('#hdr-ella').textContent.trim(), pressed: document.querySelector('#hdr-ella').getAttribute('aria-pressed'), routine: DB.profile.routine }));
await page.screenshot({ path: D + 'v25-home-ella.png' });
await page.evaluate(() => showTab('train')); R.btnHiddenOnTrain = await page.evaluate(() => document.querySelector('#hdr-ella').hidden);
await page.evaluate(() => showTab('home')); await page.click('#hdr-ella'); await page.waitForTimeout(200);
R.ellaOff = await page.evaluate(() => ({ look: DB.profile.look, sex: DB.profile.sex }));
// Entreno: tarjeta de rutina
await page.evaluate(() => { DB.profile.routine = 'pro'; saveData(); showTab('train'); });
R.train = await page.evaluate(() => ({ card: !!document.querySelector('.routine-card'), chips: document.querySelectorAll('.rd-chip').length, oldSelect: !!document.querySelector('#rt-sel') }));
await page.screenshot({ path: D + 'v25-train.png' });
await page.click('.rd-chip.work >> nth=0'); await page.waitForTimeout(200);
await page.screenshot({ path: D + 'v25-day.png' });
await page.click('#rdy-go'); await page.waitForTimeout(200);
R.started = await page.evaluate(() => !!activeSession() && activeSession().dayName);
// sesión: añadir 2 ejercicios con el selector nuevo
await page.evaluate(() => { activeSession().adjustDone = true; renderTrain(); });
await page.click('#ss-add'); await page.waitForTimeout(200);
await page.click('[data-p2g="pecholibre"]'); await page.click('#p2-mine');   // ver todos los de pecho peso libre
R.pecList = await page.evaluate(() => document.querySelectorAll('.p2-row').length);
await page.screenshot({ path: D + 'v25-picker.png' });
await page.click('[data-p2="Press Svend con disco"]'); await page.click('[data-p2="Aperturas inclinadas con mancuernas"]');
R.doneLbl = await page.textContent('#p2-done');
await page.click('#p2-done'); await page.waitForTimeout(200);
R.extra = await page.evaluate(() => activeSession().extra.map(e => e.join(' / ')));
await page.click('#ss-back'); await page.waitForTimeout(200);
// ficha de técnica con datos del Excel
await page.evaluate(() => techniqueSheet('Press de banca declinado con barra')); await page.waitForTimeout(200);
R.sheet = await page.evaluate(() => ({ meta: document.querySelectorAll('.tq-meta span').length, tip: /Consejo clave/.test(document.querySelector('.tq-body').textContent), photo: !!document.querySelector('.tq-media img') }));
await page.screenshot({ path: D + 'v25-tech.png' });
await page.evaluate(() => closeModal());
// Galería → vista previa → usar
await page.click('#rc-change'); await page.waitForTimeout(200); await page.screenshot({ path: D + 'v25-gallery.png' });
await page.click('[data-rg="gluteo"]'); await page.waitForTimeout(150); await page.click('#rp-use'); await page.waitForTimeout(200);
R.used = await page.evaluate(() => DB.profile.routine);
// Personalizar
await page.click('#rc-edit'); await page.waitForTimeout(200);
R.personal = await page.evaluate(() => ({ routine: DB.profile.routine, workouts: DB.workouts.length, planned: DB.plan.filter(Boolean).length, days: DB.profile.trainDays }));
// Asistente de 3 pasos
await page.click('#rc-change'); await page.click('#rg-wizard'); await page.waitForTimeout(150);
await page.evaluate(() => { document.querySelectorAll('[data-wzd].on').forEach(b => b.click()); });
for (const k of [0, 2, 4]) await page.click(`[data-wzd="${k}"]`);
await page.click('#wz-next'); await page.waitForTimeout(150);
await page.screenshot({ path: D + 'v25-wizard2.png' });
R.wzFocus = await page.evaluate(() => [...document.querySelectorAll('.wz-focus button.on')].map(b => b.textContent.trim()));
await page.click('#wz-next'); await page.waitForTimeout(150);
await page.screenshot({ path: D + 'v25-wizard3.png' });
await page.click('#wz-save'); await page.waitForTimeout(300);
R.wizard = await page.evaluate(() => { const ws = DB.plan.map(id => workoutById(id)).filter(Boolean); return { routine: DB.profile.routine, days: DB.profile.trainDays, names: ws.map(w => w.name + ':' + w.ex.length), allOk: ws.every(w => w.ex.every(e => okForMe(e[0]))), adv: ws.some(w => w.ex.some(e => EX_META[e[0]] && EX_META[e[0]].level === 'Avanzado')) }; });
await page.screenshot({ path: D + 'v25-train-custom.png' });
// Editor de la semana: martes descanso → nuevo entreno
await page.click('#rc-edit'); await page.waitForTimeout(150);
await page.selectOption('[data-wep="0"]', ''); R.monRest = await page.evaluate(() => DB.plan[0]);
await page.selectOption('[data-wep="1"]', '__new'); await page.waitForTimeout(150);
await page.fill('#wo-name', 'Abdomen exprés'); await page.click('#wo-add'); await page.waitForTimeout(150);
await page.click('[data-p2g="abdomen"]'); await page.click('.p2-main >> nth=0'); await page.click('.p2-main >> nth=1'); await page.click('#p2-done'); await page.waitForTimeout(150);
await page.click('[data-wos="0|1"]'); R.setsAfter = await page.evaluate(() => document.querySelector('.wo-ex .mini-step b').textContent);
await page.screenshot({ path: D + 'v25-editor.png' });
await page.click('#wo-save'); await page.waitForTimeout(200);
R.tue = await page.evaluate(() => { const w = workoutById(DB.plan[1]); return w && w.name + ':' + w.ex.length + ':' + w.ex[0][1]; });
R.counts = await page.evaluate(() => ({ meta: Object.keys(EX_META).length, newEx: PEC_LIST.filter(x => !x.existing).length, inEX: PEC_LIST.every(x => EX[x.name]) }));
R.foot = await page.evaluate(() => { showTab('more'); return document.querySelector('#more-foot').textContent.slice(0, 30); });
console.log(JSON.stringify(R, null, 1));
console.log('ERRORS', JSON.stringify(errors.slice(0, 6)));
await b.close();
