import { chromium } from 'playwright';
// 38.0 · Nutrición inteligente: estrategia, motor, registro rápido, plan, adaptación, fases y datos compartidos
const D = './';
const b = await chromium.launch(); const page = await (await b.newContext({ viewport: { width: 393, height: 851 }, deviceScaleFactor: 2 })).newPage();
const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
page.on('dialog', d => d.accept('Desayuno de siempre'));
const pause = ms => new Promise(r => setTimeout(r, ms));
const shot = async n => { await pause(700); await page.screenshot({ path: D + n }); };
await page.clock.install({ time: new Date('2026-11-20T09:00:00') });
await page.goto('http://127.0.0.1:8765/index.html');
const R = {};
await page.fill('#ob-name', 'Daniel'); for (let k = 0; k < 6; k++) await page.click('#ob-next');
await page.click('[data-ch="level|avanzado"]'); await page.click('#ob-next');
await page.clock.runFor(900); for (let i = 0; i < 4; i++) await page.click('#gd-next'); await page.clock.runFor(2600);
await page.evaluate(() => { DB.profile.age = 32; DB.profile.height = 178; DB.profile.sex = 'm'; for (let i = 0; i < 7; i++) DB.days[addDays(todayStr(), -i)] = Object.assign(DB.days[addDays(todayStr(), -i)] || {}, { weight: 80 }); saveData(); });
R.before = await page.evaluate(() => ({ on: nOn(), kcal: targets().kcal }));

// Nutrición: invita a elegir estrategia
await page.click('#tabs [data-tab=more]'); await page.click('#pf-food'); await page.clock.runFor(300);
R.tabs = await page.$$eval('[data-nut]', x => x.map(y => y.textContent));
R.cta = await page.evaluate(() => !!document.getElementById('nu-start'));
await page.click('#nu-start'); await page.clock.runFor(200);
R.modes = await page.$$eval('#modal [data-mode]', x => x.map(y => y.dataset.mode));
await shot('v44-estrategias.png');
await page.click('[data-mode=definicion]'); await page.clock.runFor(300);
R.after = await page.evaluate(() => { const t = targets(), n = nTargets(); return { mode: DB.nutri.mode, phase: DB.profile.phase, kcal: t.kcal, p: t.protein, c: t.carbs, f: t.fat, bmr: n.bmr, tdee: n.tdee, delta: n.delta, same: t.kcal === n.kcal }; });
await shot('v44-estrategia-detalle.png');

// Registro rápido: buscar, cantidades, unidades familiares, plato con varios ingredientes
await page.click('[data-nut=hoy]'); await page.clock.runFor(300);
await shot('v44-hoy.png');
await page.click('[data-slot=des]'); await page.clock.runFor(200);
await page.fill('#fl-q', 'huevo'); await page.clock.runFor(100);
await page.click('[data-fid=huevo]'); await page.selectOption('#fl-u', 'pieza'); await page.click('#fl-p'); await page.click('#fl-p'); await page.click('#fl-fav');
R.huevoPrev = await page.evaluate(() => document.querySelector('.fl-prev').textContent);
await page.click('#fl-add');
await page.fill('#fl-q', 'tortilla maiz'); await page.click('[data-fid=tortilla]'); await page.selectOption('#fl-u', 'pieza'); await page.click('#fl-p'); await page.click('#fl-add');
await page.fill('#fl-q', 'aguacate'); await page.click('[data-fid=aguacate]'); await page.selectOption('#fl-u', '⅓ pieza'); await page.click('#fl-add');
await shot('v44-registro-plato.png');
await page.click('#fl-keep');
await page.click('#fl-save'); await page.clock.runFor(300);
R.logged = await page.evaluate(() => DB.days[todayStr()].meals.map(m => `${m.slot}:${m.name}:${m.kcal}`));
R.favs = await page.evaluate(() => DB.nutri.favs);
R.saved = await page.evaluate(() => DB.nutri.saved.map(s => s.name + ' ' + s.items.length));
// Rápido: reciente con un toque
await page.click('[data-slot=sna]'); await page.clock.runFor(200);
R.recents = await page.$$eval('.fl-row .fl-pick b', x => x.map(y => y.textContent).slice(0, 3));
await page.click('[data-qadd=huevo]'); await page.click('#fl-save'); await page.clock.runFor(300);
R.snack = await page.evaluate(() => DB.days[todayStr()].meals.filter(m => m.slot === 'sna').length);
await page.click('[data-nut=reg]'); await page.clock.runFor(300);
R.reg = await page.$$eval('.nu-slot h2', x => x.map(y => y.textContent));
await shot('v44-registro.png');

// Plan de alimentación: respeta macros, se puede cambiar y registrar
await page.click('[data-nut=plan]'); await page.clock.runFor(300);
R.planSum = await page.evaluate(() => document.querySelector('.nu-sum').textContent);
R.planFirst = await page.evaluate(() => document.querySelector('.nu-pmeal .nu-pi b').textContent);
await page.click('.nu-pmeal [data-swap]'); await page.clock.runFor(200);
R.planSwapped = await page.evaluate(() => document.querySelector('.nu-pmeal .nu-pi b').textContent);
await page.click('[data-pp=veg]'); await page.clock.runFor(200);
R.vegMeat = await page.evaluate(() => [...document.querySelectorAll('.nu-pi b')].some(b => /pollo|de res|atún|tilapia|cerdo|arrachera|bistec/i.test(b.textContent)));
await page.click('[data-pp=veg]'); await page.click('[data-pn="3"]'); await page.clock.runFor(200);
R.plan3 = await page.$$eval('.nu-pmeal h2', x => x.map(y => y.textContent));
await shot('v44-plan.png');
const nBefore = await page.evaluate(() => DB.days[todayStr()].meals.length);
await page.click('[data-plog="1"]'); await page.clock.runFor(300);
R.planLogged = await page.evaluate(n => DB.days[todayStr()].meals.length - n, nBefore);

// 3 semanas reales: el motor calibra y propone (no aplica solo)
await page.evaluate(() => {
  const t = todayStr(); DB.nutri.phases[0].start = addDays(t, -24);
  for (let i = 1; i <= 21; i++) { const d = addDays(t, -i); DB.days[d] = DB.days[d] || {}; DB.days[d].weight = 80 - (21 - i) * 0.005; DB.days[d].meals = [{ name: 'Registro', p: 175, c: 230, f: 70, s: 0, kcal: 2250, slot: 'com' }]; }
  DB.nutri.af = 'mod';
  for (let k = 0; k < 4; k++) { const kc = targets().kcal; for (let i = 1; i <= 21; i++) DB.days[addDays(t, -i)].meals[0].kcal = kc; }   // cumple su objetivo
  DB.measures.push({ id: 'w1', date: addDays(t, -24), waist: 90 }, { id: 'w2', date: addDays(t, -2), waist: 89.5 });
  saveData();
});
R.obs = await page.evaluate(() => { const o = nObserved(); return { ok: o.ok, logged: o.logged, v: Math.round(o.v || 0) }; });
R.advice = await page.evaluate(() => { const a = nAdvice(); return { st: a.st, title: a.title, delta: a.delta, why: a.why.length }; });
R.kcalBeforeApply = await page.evaluate(() => targets().kcal);
await page.click('[data-nut=estr]'); await page.clock.runFor(300);
await shot('v44-adaptacion.png');
R.adviceFloorText = await page.evaluate(() => /mínimo seguro/.test(nAdvice().text));
// Caso 2: baja demasiado rápido → propone subir; solo cambia si el usuario acepta
await page.evaluate(() => { const t = todayStr(); for (let i = 1; i <= 21; i++) DB.days[addDays(t, -i)].weight = 78 + i * 0.17; saveData(); renderFood(); });
await page.clock.runFor(200);
R.adviceFast = await page.evaluate(() => { const a = nAdvice(); return { st: a.st, delta: a.delta, title: a.title }; });
R.kcalBeforeApply = await page.evaluate(() => targets().kcal);
await shot('v44-adaptacion-rapida.png');
await page.click('#ns-apply'); await page.clock.runFor(200);
R.kcalAfterApply = await page.evaluate(() => ({ kcal: targets().kcal, log: DB.nutri.log.map(l => l.delta) }));

// Historial, progreso y ajustes
await page.click('[data-nut=hist]'); await page.clock.runFor(300);
R.hist = await page.$$eval('.nu-day', x => x.length);
await page.click('[data-nut=prog]'); await page.clock.runFor(400);
await shot('v44-progreso.png');
await page.click('[data-nut=aj]'); await page.clock.runFor(300);
R.kbTopics = await page.$$eval('.nu-kb details', x => x.length);
R.kbTypes = await page.evaluate(() => [...new Set(NUTRI_KB.map(k => k.ty))]);
await page.click('[data-af=alt]'); await page.clock.runFor(100);
R.afChange = await page.evaluate(() => nTargets().af);
await page.evaluate(() => document.querySelector('.nu-kb details').open = true);
await shot('v44-conocimiento.png');

// Fases: revisión por resultados, nunca por fecha sola
await page.evaluate(() => { DB.nutri.phases[0].start = addDays(todayStr(), -17 * 7); saveData(); });
R.review = await page.evaluate(() => { const r = nPhaseReview(); return { due: r.due, sig: r.sig, next: r.next, modeStill: DB.nutri.mode }; });

// Datos compartidos (Campamento / misiones) y entrenamiento
R.snapshot = await page.evaluate(() => { const s = NutriAPI.snapshot(); return { mode: s.mode, target: s.target.kcal, intakeKcal: s.intake.kcal, adh: s.adherence.pct, w7: s.weightAvg7, trend: s.weightTrendPctWeek, waist: s.waist && s.waist.delta }; });
R.mission = await page.evaluate(() => todayMissions().filter(m => m.kind === 'nut').map(m => m.goal));
R.focus = await page.evaluate(() => nTodayFocus().k);
R.homeFood = await page.evaluate(() => { showTab('home'); return document.querySelector('#td-food') && document.querySelector('#td-food').innerText.replace(/\s+/g, ' ').slice(0, 80); });
// Seguridad: el piso nunca se rompe aunque se acumulen ajustes
R.floor = await page.evaluate(() => { DB.nutri.adj = -5000; const n = nTargets(); DB.nutri.adj = 0; return { kcal: n.kcal, bmr: n.bmr, floored: n.floored }; });
R.persist = await page.evaluate(() => { flushSave(); const d = JSON.parse(localStorage.getItem(KEY)); return { mode: d.nutri.mode, phases: d.nutri.phases.length, saved: d.nutri.saved.length, recents: d.nutri.recents.length }; });
console.log(JSON.stringify(R, null, 1));
console.log('ERRORS', JSON.stringify(errors));
await b.close();
