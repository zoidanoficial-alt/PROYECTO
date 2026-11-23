import { chromium } from 'playwright';
// 43.0 · Plan minimalista (disciplina → cómo competir → Coach IA / programa guiado),
// HYROX dividido (entrenar en Plan, resultados en la pestaña HYROX), Progreso por disciplina,
// chequeo y retos en Perfil, y la escena de medalla.
const D = './';
const b = await chromium.launch(); const page = await (await b.newContext({ viewport: { width: 393, height: 851 }, deviceScaleFactor: 2 })).newPage();
const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
page.on('dialog', d => d.accept());
const pause = ms => new Promise(r => setTimeout(r, ms));
const shot = async n => { await pause(450); await page.screenshot({ path: D + n }); };
await page.clock.install({ time: new Date('2026-11-20T10:00:00') });
await page.goto('http://127.0.0.1:8765/index.html');
const R = {};
await page.fill('#ob-name', 'Daniel'); for (let k = 0; k < 6; k++) await page.click('#ob-next');
await page.click('[data-ch="level|avanzado"]'); await page.click('#ob-next');
await page.clock.runFor(900); for (let i = 0; i < 4; i++) await page.click('#gd-next'); await page.clock.runFor(2600);
await page.clock.runFor(6000);

// 1 · Plan: asistente
await page.click('#tabs [data-tab=train]'); await page.clock.runFor(300);
R.nav = await page.$$eval('#tabs button:not([hidden]) .tl', x => x.map(y => y.textContent));
R.step0 = await page.$$eval('[data-pdisc]', x => x.map(y => y.querySelector('b').textContent));
await shot('v48-1-disciplina.png');
await page.click('[data-pdisc=gym]'); await page.clock.runFor(200);
await shot('v48-2-competir.png');
await page.click('[data-pcomp=ex]'); await page.clock.runFor(200);
R.goals = await page.$$eval('[data-pgoal] b', x => x.map(y => y.textContent));
await shot('v48-3-objetivo.png');
await page.click('[data-pgoal=masa]'); await page.clock.runFor(200);
await page.click('[data-pdays="4"]'); await page.click('[data-pmin="60"]'); await page.click('[data-pgym=completo]');
await shot('v48-4-datos.png');
await page.click('#pn-go'); await page.clock.runFor(400);
await shot('v48-5-ia.png');
await page.clock.runFor(1600);
R.gym = await page.evaluate(() => ({
  head: document.querySelector('.pn-head').innerText.replace(/\s+/g, ' '),
  ai: document.querySelector('.pn-ai-card b').textContent,
  workouts: DB.workouts.filter(w => w.ai).map(w => w.name + ': ' + w.ex.map(e => e[0] + ' ' + e[1] + '×' + e[2]).join(', ')),
  plan: DB.plan.map(x => !!x), why: DB.profile.planWhy.length,
  noCheck: !document.querySelector('#view-train #ck-open') && !document.querySelector('#view-train [data-reto]'), noMode: !document.querySelector('#view-train .mode-seg')
}));
await shot('v48-6-gym.png');

// 2 · Cambiar a CrossFit por tiempo
await page.click('#pn-change'); await page.clock.runFor(200);
await page.click('[data-pdisc=crossfit]'); await page.click('[data-pcomp=time]'); await page.clock.runFor(200);
await page.click('[data-pdays="3"]'); await page.click('[data-plevel=intermedio]'); await page.click('#pn-go'); await page.clock.runFor(300);
R.wod = await page.evaluate(() => ({ head: document.querySelector('.pn-head').innerText.replace(/\s+/g, ' '), hero: document.querySelector('.pn-hero h2').textContent, steps: document.querySelectorAll('.pn-steps li').length }));
await shot('v48-7-crossfit.png');
// Sesión por tiempo: 21-15-9
const runWod = async (perStepMs) => {
  await page.click('#pn-start'); await page.clock.runFor(300);
  for (let i = 0; i < 12; i++) { const go = await page.$('#wp-go'); if (!go) break; await page.clock.runFor(perStepMs); await page.click('#wp-go'); await page.clock.runFor(100); }
};
await runWod(400);
await page.clock.runFor(200);
R.player = 'ok';
await page.click('#pn-start').catch(() => {});
await page.evaluate(() => closeModal(true));
// Repetimos de forma controlada midiendo pantallas
await page.evaluate(() => startWod('cf1')); await page.clock.runFor(30000);
R.playerScreen = await page.evaluate(() => ({ name: document.querySelector('.wp-name').textContent, amt: document.querySelector('.wp-amt').textContent, clock: document.querySelector('#wp-clock').textContent }));
await shot('v48-8-reproductor.png');
for (let i = 0; i < 6; i++) { await page.clock.runFor(60000); await page.click('#wp-go'); await page.clock.runFor(100); }
R.summary = await page.evaluate(() => document.querySelector('.wp-score b').textContent);
await shot('v48-9-resumen.png');
await page.click('#wp-save'); await page.clock.runFor(800);
R.toast1 = await page.evaluate(() => (document.querySelector('.hype') || {}).innerText);
await page.clock.runFor(6000);
// Segunda vez más rápida → récord
await page.evaluate(() => startWod('cf1'));
for (let i = 0; i < 6; i++) { await page.clock.runFor(45000); await page.click('#wp-go'); await page.clock.runFor(100); }
await page.click('#wp-save'); await page.clock.runFor(800);
R.toast2 = await page.evaluate(() => (document.querySelector('.hype') || {}).innerText);
await shot('v48-10-record.png');
await page.clock.runFor(6000);
// EMOM: esperar al siguiente minuto
await page.evaluate(() => startWod('cf3')); await page.clock.runFor(20000); await page.click('#wp-go'); await page.clock.runFor(500);
R.emom = await page.evaluate(() => ({ amt: document.querySelector('.wp-amt').textContent, dis: document.querySelector('#wp-go').disabled }));
await page.clock.runFor(41000);
R.emom2 = await page.evaluate(() => document.querySelector('.wp-name').textContent);
await page.click('#wp-end'); await page.clock.runFor(200); await page.click('#wp-save'); await page.clock.runFor(7000);

// 3 · Yoga por ejercicio: postura de aguante máximo
await page.evaluate(() => { DB.profile.plan = { disc: 'yoga', comp: 'ex', days: 3, level: 'intermedio' }; saveData(); render('train'); });
await page.clock.runFor(200);
await shot('v48-11-yoga.png');
await page.evaluate(() => startWod('yg3'));
R.yogaHold = null;
for (let i = 0; i < 12; i++) {
  const s = await page.evaluate(() => WP ? { n: document.querySelector('.wp-name').textContent, max: wpCur().max, t: wpCur().t } : null);
  if (!s) break;
  if (s.max) { await page.clock.runFor(72000); R.yogaHold = await page.evaluate(() => document.querySelector('.wp-amt').textContent); await page.click('#wp-go'); }
  else if (s.t) await page.clock.runFor(s.t * 1000 + 600);
  else await page.click('#wp-go');
  await page.clock.runFor(200);
}
R.yogaSum = await page.evaluate(() => document.querySelector('.wp-sum') && document.querySelector('.wp-sum').innerText.replace(/\s+/g, ' ').slice(0, 160));
await page.click('#wp-save'); await page.clock.runFor(7000);

// 4 · HYROX: entrenar en Plan, resultados en la pestaña
await page.evaluate(() => { DB.profile.plan = { disc: 'hyrox', comp: 'time', days: 4, level: 'intermedio' }; saveData(); });
await page.click('#tabs [data-tab=hyrox]'); await page.clock.runFor(300);
R.hyroxTab = await page.evaluate(() => ({ eyebrow: document.querySelector('#view-hyrox .hx-eyebrow').textContent, items: [...document.querySelectorAll('#view-hyrox .kit-item b')].map(x => x.textContent), grid: document.querySelectorAll('#view-hyrox .hxs-cell').length }));
await shot('v48-12-hyrox-resultados.png');
await page.click('#view-hyrox [data-hxp=toplan]'); await page.clock.runFor(300);
R.hyroxPlan = await page.evaluate(() => ({ tab: currentTab, head: document.querySelector('.pn-head b').textContent, setup: !!document.querySelector('#view-train #hxp-setup') }));
await page.evaluate(() => { hx().profile = { cat: 'open', sex: 'm', date: '2027-03-19', equip: 'gym', days: 4, exp: 'medio' }; saveData(); render('train'); });
await page.clock.runFor(300);
R.hyroxTrain = await page.evaluate(() => ({ prep: !!document.querySelector('#view-train .cp-hero'), quick: document.querySelectorAll('#view-train .hxp-quick button').length, lab: !!document.querySelector('#view-train [data-hxp=lab]'), pred: !!document.querySelector('#view-train .cp-pred') }));
await shot('v48-13-hyrox-plan.png');
await page.click('#tabs [data-tab=hyrox]'); await page.clock.runFor(300);
R.hyroxRes = await page.evaluate(() => ({ lab: !!document.querySelector('#view-hyrox [data-hxp=lab]'), quick: document.querySelectorAll('#view-hyrox .hxp-quick').length, hxlab: [...document.querySelectorAll('#view-hyrox .ds-h')].map(x => x.childNodes[0].textContent.trim()) }));

// 5 · Progreso: todo minimizado
await page.click('#tabs [data-tab=progress]'); await page.clock.runFor(300);
R.prog = await page.evaluate(() => ({ secs: [...document.querySelectorAll('.ps-head b')].map(x => x.textContent), open: document.querySelectorAll('.ps.open').length }));
await shot('v48-14-progreso.png');
await page.click('[data-pshead=crossfit]'); await page.clock.runFor(300);
R.progCF = await page.evaluate(() => ({ open: document.querySelector('.ps.open b').textContent, hero: document.querySelector('#prog-body .pl-hero b').textContent, rows: document.querySelectorAll('#prog-body tr').length }));
await shot('v48-15-progreso-crossfit.png');
await page.click('[data-pshead=gym]'); await page.clock.runFor(300);
R.progGym = await page.evaluate(() => ({ open: document.querySelector('.ps.open b').textContent, views: [...document.querySelectorAll('.ps-body .seg button')].map(x => x.textContent) }));
await page.click('[data-pshead=gym]'); await page.clock.runFor(200);
R.progClosed = await page.evaluate(() => document.querySelectorAll('.ps.open').length);

// 6 · Perfil: chequeo y retos
await page.click('#tabs [data-tab=more]'); await page.clock.runFor(300);
R.perfil = await page.evaluate(() => ({ check: !!document.querySelector('#pf-check'), retos: !!document.querySelector('#pf-retos') }));
await page.click('#pf-retos'); await page.clock.runFor(200);
R.retosModal = await page.evaluate(() => document.querySelectorAll('#modal [data-reto]').length);
await page.evaluate(() => closeModal(true));

// 7 · Medalla estilo aventura
await page.evaluate(() => { const m = mdCatalog().find(x => x.tier === 4); mdCelebrate([m]); });
await page.clock.runFor(2600);
R.medal = await page.evaluate(() => ({ cls: document.getElementById('md-pop').className, txt: document.getElementById('md-pop').innerText.replace(/\s+/g, ' ') }));
await pause(2600); await shot('v48-16-medalla.png');
await page.click('#md-pop'); await page.clock.runFor(100); await page.click('#md-pop'); await page.clock.runFor(600); await pause(600);
R.medalGone = await page.evaluate(() => !document.getElementById('md-pop'));
R.overflow = await page.evaluate(() => [...document.querySelectorAll('#view-train *, #view-progress *')].filter(e => e.getBoundingClientRect().right > innerWidth + 1 && e.offsetParent).map(e => e.className || e.tagName).slice(0, 5));
console.log(JSON.stringify(R, null, 1));
console.log('ERRORS', JSON.stringify(errors));
await b.close();
