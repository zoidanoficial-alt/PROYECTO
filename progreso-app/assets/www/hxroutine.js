'use strict';
/* =====================================================================
 *  43.6 · Rutina HYROX por pesos (Gimnasio con trineos y Planet Fitness)
 *  Cargas oficiales por categoría (los trineos incluyen su propio peso):
 *    Men Open: push 152 · pull 103 · farmers 2×24 · lunges 20 · wall ball 6
 *    Men Pro:  push 202 · pull 153 · farmers 2×32 · lunges 30 · wall ball 9
 *    Women Open: 102 · 78 · 2×16 · 10 · 4   |   Women Pro: 152 · 103 · 2×24 · 20 · 6
 *  Bloque de 8 semanas: base (80–90 %), sobrecarga (100–120 %), específica (100 %) y descarga (70 %).
 *  Entrenar un poco por encima del peso de carrera hace que el día de la carrera se sienta ligero;
 *  la descarga final llega fresco. En Planet Fitness no hay trineos ni balones: se usa la caminadora
 *  a 15 % y mancuernas en libras que existen en el club (hasta 75 lb).
 * ===================================================================== */
const HR_RACE = {
  open: { m: { push: 152, pull: 103, farm: 24, lunge: 20, wb: 6 }, f: { push: 102, pull: 78, farm: 16, lunge: 10, wb: 4 } },
  pro: { m: { push: 202, pull: 153, farm: 32, lunge: 30, wb: 9 }, f: { push: 152, pull: 103, farm: 24, lunge: 20, wb: 6 } }
};
const HR_WEEKS = [
  { f: 0.8, n: 'Base', d: 'Técnica y volumen con cargas cómodas' }, { f: 0.85, n: 'Base', d: 'Sube un poco: mismas distancias' }, { f: 0.9, n: 'Base', d: 'Casi peso de carrera' },
  { f: 1.0, n: 'Sobrecarga', d: 'Peso de carrera' }, { f: 1.1, n: 'Sobrecarga', d: '10 % más pesado que la carrera' }, { f: 1.2, n: 'Sobrecarga', d: '20 % más: la carrera se sentirá ligera' },
  { f: 1.0, n: 'Específica', d: 'Peso y distancias de carrera, sin descansos largos' }, { f: 0.7, n: 'Descarga', d: 'Menos carga para llegar fresco' }
];
const HR_LB = 0.45359237;
const r5 = v => Math.round(v / 5) * 5, r2 = v => Math.round(v / 2) * 2;
/** Mancuerna de Planet Fitness más cercana (pasos de 5 lb, máximo 75 lb). */
function pfLb(kg) { return Math.min(75, Math.max(5, Math.round(kg / HR_LB / 5) * 5)); }
const lbKg = lb => Math.round(lb * HR_LB);
function hrCfg() {
  const p = (DB.hyrox && DB.hyrox.profile) || {}, h = hx();
  if (!h.routine) h.routine = { start: todayStr(), pf: typeof hxIsPF === 'function' ? hxIsPF() : false };
  return { cat: p.cat === 'pro' ? 'pro' : 'open', sex: p.sex === 'f' ? 'f' : 'm', R: h.routine };
}
function hrWeekNow(R) { return Math.max(0, Math.min(7, Math.floor(daysBetween(R.start, todayStr()) / 7))); }
let hrWeekSel = null;

/** Cargas de la semana para cada estación, en la versión elegida. */
function hrLoads(cat, sex, w, pf) {
  const L = HR_RACE[cat][sex], f = HR_WEEKS[w].f;
  if (!pf) return {
    push: `${r5(L.push * f)} kg con trineo`, pull: `${r5(L.pull * f)} kg con trineo`, farm: `2 × ${r2(L.farm * f)} kg`, lunge: `${Math.max(5, r5(L.lunge * f))} kg (sandbag)`,
    wb: `${f >= 1.1 ? [4, 6, 9, 12].find(b => b > L.wb) || L.wb : L.wb} kg (balón)`
  };
  const fl = pfLb(L.farm * f), ll = pfLb(L.lunge * f), tl = pfLb(L.wb * 1.1 * (f >= 1.1 ? 1.35 : f >= 1 ? 1 : 0.85));
  return {
    push: `caminadora a 15 %${f >= 1.1 ? ' · 4 km/h' : ' · 3 km/h'}`, pull: `caminadora a 15 % hacia atrás + remo sentado pesado`, farm: `2 × ${fl} lb (≈ ${lbKg(fl)} kg)`,
    lunge: `1 × ${ll} lb goblet (≈ ${lbKg(ll)} kg)`, wb: `2 × ${tl} lb (thrusters)`
  };
}
/** Las dos sesiones de fuerza específica de la semana (lunes y jueves). */
function hrSessions(w, pf) {
  const { cat, sex } = hrCfg(), L = hrLoads(cat, sex, w, pf), wk = HR_WEEKS[w], dl = w === 7, sp = w === 6;
  const sets = (base) => dl ? Math.max(2, base - 2) : base;
  const A = pf ? [
    ['Sentadilla en Smith', `${sets(5)} × 5`, 'pesado: te quedan 2–3 reps'],
    ['Empuje en caminadora', `${sets(6)} × ${sp ? 50 : 40} m`, L.push],
    ['Jalón hacia atrás en caminadora', `${sets(6)} × 30 m + 10 remos`, L.pull],
    ['Zancadas goblet', `${sets(3)} × ${sp ? 50 : 25} m`, L.lunge],
    ['Peso muerto rumano con mancuernas', `${sets(3)} × 8`, 'controlado, espalda neutra']
  ] : [
    ['Sentadilla con barra', `${sets(5)} × 5`, 'pesado: te quedan 2–3 reps'],
    ['Sled push', `${sets(6)} × ${sp ? 50 : 25} m`, L.push],
    ['Sled pull', `${sets(6)} × ${sp ? 50 : 25} m`, L.pull],
    ['Sandbag lunges', `${sets(3)} × ${sp ? 50 : 25} m`, L.lunge],
    ['Peso muerto rumano', `${sets(3)} × 8`, 'controlado, espalda neutra']
  ];
  const B = pf ? [
    ['Ski en polea', `${sets(5)} × 30 jalones`, 'pesado pero continuo'],
    ['Shoulder press en máquina', `${sets(4)} × 6`, 'pesado'],
    ['Jalón al pecho', `${sets(4)} × 8`, 'agarre neutro'],
    ['Farmers carry', `${sets(4)} × ${sp ? 100 : 50} m`, L.farm],
    ['Thrusters con mancuernas', `${sets(5)} × ${sp ? 25 : 20}`, L.wb],
    ['Remo', `${sets(4)} × 250 m`, 'resistencia 5–6, fuerte']
  ] : [
    ['SkiErg', `${sets(5)} × 250 m`, 'ritmo de carrera'],
    ['Press militar con barra', `${sets(4)} × 6`, 'pesado'],
    ['Dominadas o jalón', `${sets(4)} × 8`, 'controladas'],
    ['Farmers carry', `${sets(4)} × ${sp ? 100 : 50} m`, L.farm],
    ['Wall balls', `${sets(5)} × ${sp ? 25 : 20}`, L.wb],
    ['Remo', `${sets(4)} × 250 m`, 'ritmo de carrera']
  ];
  const v = pf ? 'pf' : 'gym';
  return [
    { id: `hr-${v}-a`, n: 'Pierna + trineos', day: 'Lunes', type: 'flow', b: A, why: `${wk.n} · ${Math.round(wk.f * 100)} % del peso de carrera. ${wk.d}.` },
    { id: `hr-${v}-b`, n: 'Torso + estaciones', day: 'Jueves', type: 'flow', b: B, why: `${wk.n} · ${Math.round(wk.f * 100)} % del peso de carrera. ${wk.d}.` }
  ];
}
/** Registra las sesiones de la semana en el reproductor guiado (mismo id = mismo récord). */
function hrRegister(w, pf) {
  if (typeof WODS !== 'object') return [];
  const S = hrSessions(w, pf);
  WODS.hyrox = (WODS.hyrox || []).filter(x => !x.id.startsWith('hr-')).concat(S);
  return S;
}
function openHxRoutine(back) {
  const { cat, sex, R } = hrCfg(), now = hrWeekNow(R), w = hrWeekSel == null ? now : hrWeekSel, pf = !!R.pf, wk = HR_WEEKS[w];
  const S = hrRegister(w, pf), race = HR_RACE[cat][sex], RL = hrLoads(cat, sex, 3, pf);
  const rows = [['Sled push (50 m)', `${race.push} kg`, pf ? 'Empuje en caminadora 15 %' : null], ['Sled pull (50 m)', `${race.pull} kg`, pf ? 'Hacia atrás 15 % + remo' : null], ['Farmers carry (200 m)', `2 × ${race.farm} kg`, pf ? RL.farm : null], ['Sandbag lunges (100 m)', `${race.lunge} kg`, pf ? RL.lunge : null], ['Wall balls (100 reps)', `${race.wb} kg`, pf ? RL.wb : null]];
  openModal(`<div class="hr">
    <div class="hx-eyebrow">RUTINA HYROX POR PESOS</div>
    <h3 style="margin:4px 44px 10px 0">${HX_CATS[cat]} · ${sex === 'f' ? 'Mujeres' : 'Hombres'}</h3>
    <div class="seg hr-ver"><button data-hrv="0" class="${pf ? '' : 'on'}">Gimnasio HYROX</button><button data-hrv="1" class="${pf ? 'on' : ''}">Planet Fitness</button></div>
    <div class="pv-card"><div class="pv-head"><div><b>Pesos de competencia</b><small>Los trineos incluyen su propio peso${pf ? ' · en Planet Fitness, su equivalente' : ''}</small></div></div>
      <div class="hr-race">${rows.map(([n, k, e]) => `<div><span>${esc(n)}</span><b>${esc(k)}</b>${e ? `<small>${esc(e)}</small>` : ''}</div>`).join('')}</div></div>
    <div class="ds-h">Semana ${w + 1} de 8 <span class="ds-h-r">${esc(wk.n)} · ${Math.round(wk.f * 100)} %</span></div>
    <div class="hr-weeks">${HR_WEEKS.map((x, i) => `<button data-hrw="${i}" class="${i === w ? 'on' : ''}${i === now ? ' now' : ''} ${x.n === 'Descarga' ? 'dl' : x.f > 1 ? 'ov' : ''}"><b>${i + 1}</b><i style="height:${Math.round(x.f * 26)}px"></i></button>`).join('')}</div>
    <p class="small muted hr-wd">${esc(wk.d)}${w === now ? ' · esta semana' : ''}</p>
    ${S.map(s => `<div class="pn-hero hr-day"><small>${esc(s.day.toUpperCase())} · ${esc(s.n.toUpperCase())}</small>
      <ol class="pn-steps">${s.b.map(([n, a, l]) => `<li><b>${esc(n)}</b><span>${esc(a)}<br><em class="${/\d\s?(kg|lb)/.test(l) ? 'ld' : ''}">${esc(l)}</em></span></li>`).join('')}</ol>
      <div class="pn-rec">${ico('trophy', 16)}${(() => { const best = Object.keys(wodDB().best).filter(k => k.startsWith('hyrox|') && s.b.some(e => k === 'hyrox|' + e[0])); return best.length ? `${best.length} récords de peso en esta sesión` : 'Elige "Por ejercicio" en Plan y guarda los kilos que usas'; })()}</div>
      <button class="block" data-hrgo="${s.id}">${ico('play', 18, 'lead')}Empezar</button></div>`).join('')}
    <div class="pg-rec"><b>Cómo progresar</b><small>Si terminas todas las series sin soltar el implemento ni parar más de 10 s, la siguiente semana sube como marca el plan. Si no, repite la semana. Miércoles zona 2, martes intervalos, viernes umbral y sábado compromised running (en tu Proyecto).</small></div>
    <button class="secondary block" id="hr-restart">Empezar el bloque hoy (semana 1)</button>
    <button class="ghost block" id="hr-x">← Volver</button></div>`, m => {
    $$('[data-hrv]', m).forEach(b => b.onclick = () => { hrCfg().R.pf = b.dataset.hrv === '1'; saveData(); openHxRoutine(back); });
    $$('[data-hrw]', m).forEach(b => b.onclick = () => { hrWeekSel = Number(b.dataset.hrw); openHxRoutine(back); });
    $$('[data-hrgo]', m).forEach(b => b.onclick = () => { closeModal(true); startWod(b.dataset.hrgo); });
    $('#hr-restart', m).onclick = () => { if (!confirm('¿Reiniciar el bloque de 8 semanas desde hoy?')) return; hrCfg().R.start = todayStr(); hrWeekSel = null; saveData(); openHxRoutine(back); };
    $('#hr-x', m).onclick = back || (() => closeModal());
  });
}
// Las sesiones de la semana existen desde el arranque (para el historial y los récords).
window.addEventListener('load', () => { try { if (DB.hyrox && DB.hyrox.profile) { const { R } = hrCfg(); hrRegister(hrWeekNow(R), !!R.pf); } } catch (e) { console.error(e); } });
