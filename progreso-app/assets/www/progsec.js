'use strict';
/* =====================================================================
 *  43.0 · Progreso por disciplina
 *  Todo llega minimizado: Gimnasio, HYROX, CrossFit, Spartan, Yoga, Pilates (y Running,
 *  Cardio, Cuerpo y Evolución general). Tú abres lo que quieres ver; se abre una sección a la vez.
 * ===================================================================== */
const PROG_SECS = [
  { k: 'gym', n: 'Gimnasio', ico: 'dumbbell', views: [['fuerza', 'Fuerza'], ['gymlab', 'Récords'], ['strength', 'Ejercicios'], ['analysis', 'Análisis']] },
  { k: 'hyrox', n: 'HYROX', ico: 'timer', views: [['hxsum', 'Resumen']] },
  { k: 'crossfit', n: 'CrossFit', ico: 'flame', views: [['wod:crossfit', 'Resumen']] },
  { k: 'spartan', n: 'Spartan', ico: 'mountain', views: [['wod:spartan', 'Resumen']] },
  { k: 'yoga', n: 'Yoga', ico: 'flower-2', views: [['wod:yoga', 'Resumen']] },
  { k: 'pilates', n: 'Pilates', ico: 'person-standing', views: [['wod:pilates', 'Resumen']] },
  { k: 'run', n: 'Running', ico: 'footprints', views: [['runsum', 'Resumen']] },
  { k: 'cardio', n: 'Cardio', ico: 'heart-pulse', views: [['wod:cardio', 'Resumen']] },
  { k: 'cuerpo', n: 'Cuerpo', ico: 'ruler', views: [['weight', 'Peso'], ['measures', 'Medidas'], ['photos', 'Fotos']] },
  { k: 'general', n: 'Evolución general', ico: 'trending-up', views: [['evol', 'Evolución'], ['historia', 'Historia']] }
];
let progSec = null, progSub = {}, progLast = null;
function psViews(s) {
  let v = s.views.slice();
  if (s.k === 'gym' && typeof isBeginner === 'function' && isBeginner()) v = [['resumen', 'Resumen']].concat(v);
  if (s.k === 'cuerpo' && typeof cycleOn === 'function' && cycleOn()) v = v.concat([['ciclo', 'Ciclo']]);
  return v;
}
function psSummary(k) {
  const t = todayStr();
  if (k === 'gym') { const n = DB.sessions.filter(s => s.end).length; return n ? `${n} entreno${n > 1 ? 's' : ''} · ${new Set(DB.lifts.map(l => l.ex)).size} ejercicios` : 'Sin entrenos todavía'; }
  if (k === 'hyrox') { const me = typeof hxMyBest === 'function' && DB.hyrox ? hxMyBest() : null; return me ? `Mejor marca ${hxT(me.sec)}` : DB.hyrox && DB.hyrox.results.length ? `${DB.hyrox.results.length} tiempos` : 'Sin tiempos todavía'; }
  if (k === 'run') { const n = (DB.runs || []).length; return n ? `${n} carrera${n > 1 ? 's' : ''} · ${fmt((DB.runs || []).reduce((a, r) => a + (r.km || 0), 0), 0)} km` : 'Sin carreras todavía'; }
  if (k === 'cuerpo') { const w = currentWeight(); return w ? `${fmt(w)} kg` : 'Peso, medidas y fotos'; }
  if (k === 'general') return 'Tu disciplina, tu forma y tu historia';
  const log = typeof wodLog === 'function' ? wodLog(k) : [];
  return log.length ? `${log.length} sesión${log.length > 1 ? 'es' : ''} · ${log.filter(x => x.date >= addDays(t, -30)).length} este mes` : 'Sin sesiones todavía';
}
/** Resumen de una disciplina de sesiones guiadas. */
function renderWodProgress(el, disc) {
  const log = wodLog(disc), list = WODS[disc] || [];
  if (!log.length) {
    el.innerHTML = `<div class="cp-diag empty"><b>Aún no hay sesiones de ${esc(DISC[disc].n)}</b><p>Elige ${esc(DISC[disc].n)} en Plan y cada sesión que termines aparece aquí con tus récords.</p><button class="secondary" id="ps-go">Entrenar ${esc(DISC[disc].n)}</button></div>`;
    $('#ps-go', el).onclick = () => { planSetDisc(disc); showTab('train'); };
    return;
  }
  const weeks = []; for (let i = 7; i >= 0; i--) { const wk = weekKey(addDays(todayStr(), -7 * i)); weeks.push({ wk, min: log.filter(x => weekKey(x.date) === wk).reduce((a, x) => a + x.sec / 60, 0), d: addDays(todayStr(), -7 * i) }); }
  const mins = Math.round(log.reduce((a, x) => a + x.sec / 60, 0)), recs = Object.keys(wodDB().best).filter(k => k.startsWith(disc + '|'));
  el.innerHTML = `<div class="pl-hero"><small>${esc(DISC[disc].n)}</small><b>${log.length} sesiones</b><div class="pl-chips"><span>${mins} min en total</span><span>${recs.length} récords por ejercicio</span></div></div>
    ${pvCard('Minutos por semana', '', 'Últimas 8 semanas', '', pvBars(weeks.map(w => Math.round(w.min)), { fmt: v => String(v), dates: weeks.map(w => shortDate(w.d)) }))}
    <div class="ds-h">Récord por sesión</div><table class="small hx-tbl"><tbody>${list.map(w => { const b = wodBest(w.id), n = log.filter(x => x.wid === w.id).length; return n ? `<tr><td>${esc(w.n)}<br><small class="muted">${n} ${n > 1 ? 'veces' : 'vez'}</small></td><td><b>${esc(wodScoreTxt(w, b))}</b></td></tr>` : ''; }).join('')}</tbody></table>
    ${recs.length ? `<div class="ds-h">Récord por ejercicio</div><table class="small hx-tbl"><tbody>${recs.map(k => { const r = wodDB().best[k]; return `<tr><td>${esc(k.split('|')[1])}</td><td><b>${r.u === 's' ? hxT(r.v) : r.v + ' ' + esc(r.u || '')}</b></td><td class="muted">${shortDate(r.date)}</td></tr>`; }).join('')}</tbody></table>` : ''}`;
}
function psLab(el, fn, attr, setter) {
  el.innerHTML = fn() + `<button class="secondary block" id="ps-lab">${ico('trending-up', 18, 'lead')}Abrir laboratorio completo</button>`;
  $$(`[data-${attr}]`, el).forEach(b => b.onclick = () => { setter(b.dataset[attr]); psLab(el, fn, attr, setter); });
  $$('[data-plriv]', el).forEach(b => b.onclick = () => { plAddRival(b.dataset.plriv); psLab(el, fn, attr, setter); });
  $('#ps-lab', el).onclick = () => openPerfLab(attr === 'plf' ? 'hyrox' : attr === 'plr' ? 'run' : 'gym', () => closeModal());
}
const PS_EXTRA = {
  hxsum: el => psLab(el, plHyrox, 'plf', v => { plField = v; }),
  runsum: el => psLab(el, plRunning, 'plr', v => { plRun = Number(v); }),
  gymlab: el => psLab(el, plGym, 'pll', v => { plLift = v; })
};
window.addEventListener('load', () => {
  progLast = progMode;
  renderProgress = function () {
    if (progLast !== null && progMode !== progLast) { const s = PROG_SECS.find(x => psViews(x).some(v => v[0] === progMode)); if (s) { progSec = s.k; progSub[s.k] = progMode; } }
    const v = $('#view-progress');
    v.innerHTML = progressHero() + `<div class="ps-list">${PROG_SECS.map(s => {
      const open = progSec === s.k, vs = psViews(s), cur = open ? (vs.some(x => x[0] === progSub[s.k]) ? progSub[s.k] : vs[0][0]) : null;
      if (open) { progMode = cur; progSub[s.k] = cur; }
      return `<section class="ps${open ? ' open' : ''}" data-psec="${s.k}"><button class="ps-head" data-pshead="${s.k}" aria-expanded="${open}">${ico(s.ico, 22)}<span><b>${esc(s.n)}</b><small>${esc(psSummary(s.k))}</small></span>${ico('chevron-down', 18)}</button>
        ${open ? `<div class="ps-body">${vs.length > 1 ? `<div class="seg wrap scroll">${vs.map(([k, n]) => `<button data-mode="${k}" class="${cur === k ? 'on' : ''}">${n}</button>`).join('')}</div>` : ''}<div id="prog-body"></div></div>` : ''}</section>`;
    }).join('')}</div><button class="secondary block" id="prog-export" style="margin-top:12px">📄 Exportar PDF / Excel para analizar con IA</button>`;
    progLast = progMode;
    $('#prog-export').onclick = openExport;
    $$('[data-pshead]', v).forEach(b => b.onclick = () => { progSec = progSec === b.dataset.pshead ? null : b.dataset.pshead; redrawChart = () => {}; renderProgress(); const s = $(`[data-psec="${b.dataset.pshead}"]`); if (s && progSec) s.scrollIntoView({ block: 'start', behavior: 'smooth' }); });
    $$('#view-progress .ps-body .seg button').forEach(b => b.onclick = () => { progMode = b.dataset.mode; progSub[progSec] = progMode; progLast = progMode; redrawChart = () => {}; renderProgress(); });
    if (!progSec) return;
    const el = $('#prog-body');
    if (progMode.startsWith('wod:')) return renderWodProgress(el, progMode.slice(4));
    if (PS_EXTRA[progMode]) return PS_EXTRA[progMode](el);
    ({ evol: renderEvolution, resumen: renderBeginnerProgress, fuerza: e => { e.innerHTML = strengthScoreCard() + weeklySetsCard(); const i = $('#str-info', e); if (i) i.onclick = explainScore; }, analysis: renderAnalysis, historia: renderHistory, ciclo: renderCycle, weight: renderWeight, measures: renderMeasures, strength: renderStrength, photos: renderPhotos, logros: typeof renderLogros === 'function' ? renderLogros : renderAchievements })[progMode](el);
  };
});
