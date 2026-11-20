'use strict';
/* =====================================================================
 *  34.0 · HYROX en Planet Fitness
 *  PF no tiene trineos, SkiErg, sandbags ni balones de wall ball. Cada estación se reemplaza por
 *  un ejercicio con TRABAJO FIJO contra reloj (para poder cronometrar y ver tu progreso) que copia el
 *  patrón de movimiento y la demanda: empujar con las piernas inclinado, jalar hacia atrás, bisagra
 *  con brazos rectos, sentadilla con empuje arriba.
 *  Comparables con HYROX (cuentan para tu predicción): correr, remo, farmers, zancadas, burpees.
 *  No comparables (se miden contra ti mismo): ski en polea, empuje y jalón en caminadora, thrusters.
 *  Equipo según el catálogo de pf.js (Matrix 0–15 %, remo, ergómetro de brazos, mancuernas 2–34 kg).
 * ===================================================================== */

const PF_SUB = {
  ski: { n: 'Ski en polea', d: '100 jalones con brazos rectos', how: 'Polea alta con cuerda o barra. Brazos casi rectos, bisagra de cadera y abdomen duro: baja la polea hasta los muslos como en el SkiErg. 100 reps contra reloj con el peso que te deje hacer series de 20–25.', why: 'Mismo patrón que el SkiErg: dorsales, tríceps y core con bisagra de cadera.', need: ['poleas'], alt: 'Sin poleas: ergómetro de brazos 4 min fuerte (anota los metros o calorías).', comparable: false },
  push: { n: 'Empuje en caminadora', d: '200 m a 15 % empujando el tablero', how: 'Caminadora a 15 % de inclinación y 3–4 km/h. Manos en el tablero (no en los barandales), brazos firmes, cuerpo a 45° y pasos cortos de empuje: así se siente un sled push. 200 m contra reloj; si puedes, sube la velocidad.', why: 'Inclinación máxima + cuerpo inclinado = el mismo empuje de piernas del trineo, sin trineo.', need: ['cinta'], alt: 'Si la caminadora está ocupada: prensa pesada 4 × 12 + 25 m de zancadas.', comparable: false },
  pull: { n: 'Jalón hacia atrás', d: '150 m caminando hacia atrás a 15 % + 40 remos', how: 'Caminadora a 15 % y 2–3 km/h, de espaldas al tablero, sujétate con una mano si lo necesitas y empuja con talones: 150 m. Sin descanso, 40 remos sentados pesados con tirón rápido. Contra reloj.', why: 'El sled pull es caminar hacia atrás con las piernas y jalar con la espalda: aquí van las dos partes seguidas.', need: ['cinta', 'remo'], alt: 'Sin caminadora libre: 3 × 15 remos sentados pesados + 3 × 30 s de sentadilla isométrica.', comparable: false },
  bbj: { n: 'Burpee broad jumps', d: '80 m', how: 'En la zona funcional (PF 360) o un pasillo libre. Si no hay 20 m libres, ida y vuelta en 10 m. Cae suave: sin golpes ni gritos (la Lunk Alarm es real).', why: 'Es la misma estación: solo necesitas piso.', need: [], alt: 'Sin espacio: 40 burpees + 40 saltos al frente en el lugar.', comparable: true },
  row: { n: 'Remo', d: '1,000 m', how: 'El remo de PF (ergómetro) es la misma estación. Resistencia 5–6.', why: 'Igual que en competencia.', need: ['remoerg'], alt: 'Sin remo: elíptica 4 min con resistencia alta.', comparable: true },
  farm: { n: 'Farmers carry', d: '200 m', how: 'Mancuernas de 50 lb (≈24 kg) hombres / 35 lb (≈16 kg) mujeres. Vueltas de 20 m por la zona de peso libre sin soltar: no las dejes caer al terminar.', why: 'Las mancuernas de PF llegan a 75 lb: alcanza para el peso de competencia.', need: ['manc'], alt: '', comparable: true },
  lunge: { n: 'Zancadas goblet', d: '100 m', how: 'Una mancuerna de 45 lb (≈20 kg) hombres / 25 lb (≈10 kg) mujeres pegada al pecho. Rodilla al piso en cada paso.', why: 'Misma carga que el sandbag; cambia solo dónde la sostienes.', need: ['manc'], alt: '', comparable: true },
  wb: { n: 'Thrusters con mancuernas', d: '100 reps', how: 'Dos mancuernas de 15 lb (≈6.8 kg) hombres / 10 lb (≈4.5 kg) mujeres: sentadilla completa y empuje arriba en un solo movimiento. Sets planeados con descansos de 5–10 s.', why: 'El wall ball es sentadilla + lanzamiento: el thruster mantiene la sentadilla y el empuje sin balón ni pared.', need: ['manc'], alt: '', comparable: false }
};
const PF_RULES = [
  'Hazlo en horas valle: si hay gente esperando, muchos clubes limitan el cardio a 30 min.',
  'Judgement Free Zone: no sueltes las mancuernas ni grites; la Lunk Alarm suena de verdad.',
  'Arma tu "estación" cerca de las caminadoras: lleva tus mancuernas y una toalla, y pide permiso si ocupas espacio.',
  'Ajusta las cargas en libras: el rack de PF va de 5 a 75 lb (2–34 kg).'
];
const hxIsPF = () => typeof hx === 'function' && !!hx().profile && (hx().profile.equip === 'pf' || (hx().profile.equip == null && typeof isPF === 'function' && isPF()));
const pfStName = k => hxIsPF() && PF_SUB[k] ? PF_SUB[k].n : HX_ST[k].n;
const pfStDose = k => hxIsPF() && PF_SUB[k] ? PF_SUB[k].d : HX_ST[k].d;
function pfMachineOk(id) { const m = typeof PF_MACHINES !== 'undefined' && PF_MACHINES.find(x => x.id === id); return !m || typeof pfHas !== 'function' || pfHas(m); }
function pfSubFor(k) { const s = PF_SUB[k]; const ok = s.need.every(pfMachineOk); return { ...s, ok, use: ok ? s.n : (s.alt || s.n) }; }
/** Resultados medidos con sustitutos no comparables (para tus récords PF, no para la predicción). */
function hxResultsPF(st) { return hx().results.filter(r => r.kind === 'st' && r.st === st && r.pf).sort((a, b) => a.t - b.t); }
function hxBestPF(st) { return hxResultsPF(st).reduce((a, r) => !a || r.sec < a.sec ? r : a, null); }
/** Traduce los textos de las sesiones a lo que hay en PF. */
function pfText(s) {
  return String(s).replace(/(\d+) m (de )?SkiErg/g, (m, n) => Math.round(Number(n) / 20) + ' jalones de ski en polea').replace(/SkiErg/g, 'ski en polea').replace(/sled push( pesado)?/gi, 'empuje en caminadora 15 %').replace(/sled pull/gi, 'caminata hacia atrás 15 %')
    .replace(/wall balls?/gi, 'thrusters con mancuernas').replace(/(\d+) m lunges/g, '$1 m zancadas goblet').replace(/lunges caminando/g, 'zancadas goblet').replace(/\blunges\b/g, 'zancadas goblet')
    .replace(/Sentadilla o prensa/g, 'Prensa o hack squat').replace(/farmers carry pesado/gi, 'farmers con mancuernas pesadas');
}
/** Biblioteca de sesiones adaptada a PF. */
function pfAdaptLib(lib, pace) {
  const p = f => pace ? hxT(pace * f) + '/km' : 'ritmo fuerte pero sostenible';
  const out = {};
  Object.entries(lib).forEach(([k, v]) => { out[k] = typeof v === 'function' ? v : { ...v, blocks: v.blocks.map(([a, b]) => [pfText(a), pfText(b)]), goal: pfText(v.goal), measure: pfText(v.measure) }; });
  const drills = {
    ski: ['6 × 20 jalones con brazos rectos y bisagra (polea alta) · 45 s', 'Ergómetro de brazos 4 × 1 min fuerte · 1 min suave'],
    push: ['Caminadora 15 %: 6 × 50 m empujando el tablero, cuerpo a 45° · 75 s', 'Hack squat o prensa 4 × 8 pesado'],
    pull: ['Caminata hacia atrás a 15 %: 6 × 40 m · 60 s', 'Remo sentado 4 × 12 pesado, tirón explosivo'],
    wb: ['5 × 20 thrusters con mancuernas · 45 s', 'Sentadilla goblet profunda 3 × 15 · pausa abajo']
  };
  out.station = k => {
    if (!PF_SUB[k] || PF_SUB[k].comparable) { const b = lib.station(k); return { ...b, blocks: b.blocks.map(([a, c]) => [pfText(a), pfText(c)]), n: 'Dominio de ' + pfStName(k), goal: pfText(b.goal), measure: pfText(b.measure) }; }
    const s = pfSubFor(k), d = drills[k];
    return { n: 'Dominio de ' + s.n, goal: `Construir la capacidad de ${HX_ST[k].n} con lo que hay en Planet Fitness.`, min: '40–50', st: k, blocks: [
      ['Calentamiento', '8 min de remo o caminadora + movilidad de cadera y hombro'], ['Técnica', s.how], ['Bloque principal', d[0]], ['Fuerza', d[1]], ['Enfriamiento', '5 min suave'] ],
      measure: `Prueba contra reloj: ${s.n} · ${s.d}. Repítela cada 3–4 semanas.` };
  };
  out.comp = { ...out.comp, n: 'Running bajo fatiga · PF', blocks: [
    ['Calentamiento', '10 min en caminadora (1 %) + 3 aceleraciones de 20 s'],
    ['Bloque principal ×4', `1 km en caminadora a ${p(1.12)} → estación PF (ronda 1: empuje en caminadora 100 m · 2: 20 zancadas goblet · 3: 25 thrusters · 4: farmers 100 m) → 400 m a ${p(1.12)} · 90 s`],
    ['Enfriamiento', '8 min caminando'] ] };
  out.sim = { ...out.sim, n: 'Simulación PF', blocks: [
    ['Calentamiento', '12 min suave + aceleraciones'],
    ['Simulación', `4 × (1 km en caminadora a ${p(1.10)} + estación PF): 50 jalones de ski en polea · 100 m de empuje en caminadora · 500 m de remo · 50 thrusters`],
    ['Enfriamiento', '10 min suave'] ] };
  return out;
}

/* ---------- Pantalla: tu HYROX en Planet Fitness ---------- */
function pfHyroxCard() {
  if (!hxIsPF()) return '';
  return `<button class="card keep pf-card" id="pf-open"><div class="hx-eyebrow">MODO PLANET FITNESS</div><b>Tus 8 estaciones, adaptadas a tu club</b><small class="muted">Caminadora como trineo, polea como SkiErg, thrusters como wall balls. Toca para ver cómo.</small>${ico('chevron-right', 18)}</button>`;
}
function openPfHyrox(back) {
  const rows = HX_STATIONS.map((st, i) => { const s = pfSubFor(st.k), best = s.comparable ? hxBest('st', st.k) : hxBestPF(st.k);
    return `<div class="pf-st"><div class="pf-h"><span class="hx-n">${String(i + 1).padStart(2, '0')}</span><span class="grow"><small>${esc(st.n)} · ${esc(st.d)}</small><b>${esc(s.use)}</b><em>${esc(s.ok ? s.d : 'alternativa: falta equipo en tu club')}</em></span><span class="pf-tag ${s.comparable ? 'ok' : ''}">${s.comparable ? 'comparable' : 'contra ti'}</span></div>
      <p class="small">${esc(s.how)}</p><p class="small muted">${esc(s.why)}${s.alt && s.ok ? ' · ' + esc(s.alt) : ''}</p>
      <div class="row" style="gap:8px"><span class="small grow">${best ? 'Récord: <b>' + hxT(best.sec) + '</b>' : 'Sin medir'}</span><button class="secondary" data-pft="${st.k}">Cronometrar</button></div></div>`; }).join('');
  openModal(`<div class="hx-eyebrow">HYROX · PLANET FITNESS</div><h3 style="margin-top:4px">Tu HYROX sin trineos ni SkiErg</h3>
    <p class="small muted" style="margin-top:0">Cada estación se cambia por un ejercicio de trabajo fijo contra reloj que copia su patrón de movimiento. Así puedes cronometrar y ver tu progreso.</p>
    <div class="pf-legend"><span class="pf-tag ok">comparable</span> cuenta para tu predicción HYROX · <span class="pf-tag">contra ti</span> se compara solo con tus marcas anteriores</div>
    ${rows}
    <div class="rir-label"><span>Reglas del club</span></div>
    <ul class="comp-list">${PF_RULES.map(r => `<li>${ico('check', 16)}<span>${esc(r)}</span></li>`).join('')}</ul>
    <button class="block" id="pf-sim">${ico('timer', 18, 'lead')}Simulación PF completa (8 × 1 km + estación)</button>
    <button class="secondary block" id="pf-club">Marcar qué hay en mi club</button>
    <button class="ghost block" id="pf-x">${back ? '← Volver' : 'Cerrar'}</button>`, m => {
    $$('[data-pft]', m).forEach(b => b.onclick = () => hxtCreate('station', b.dataset.pft));
    $('#pf-sim', m).onclick = () => hxtCreate('race');
    $('#pf-club', m).onclick = () => { if (typeof openPfMachines === 'function') openPfMachines(); else if (typeof openPfSheet === 'function') openPfSheet(); else toast('Ve a Más → Mi gimnasio'); };
    $('#pf-x', m).onclick = () => back ? back() : closeModal();
  });
}
