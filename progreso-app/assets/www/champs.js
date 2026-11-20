'use strict';
/* =====================================================================
 *  31.0 · Entrena como los campeones de HYROX
 *  Métodos resumidos de entrevistas y reportajes públicos (fuentes en cada método y en
 *  docs/FUENTES-v31.md). Ellos entrenan 18–25 h por semana, dos veces al día: aquí se
 *  conserva la ESTRUCTURA de su semana y se escala a tus días y a tu nivel. Sin afiliación.
 * ===================================================================== */

const HARD = new Set(['tempo', 'thrHeavy', 'durability', 'strengthLegs', 'comp', 'sim', 'run', 'station']);
const CHAMPS = {
  roncevic: {
    n: 'Alexander Rončević', short: 'Rončević', tag: 'Volumen de carrera + durabilidad', who: 'Campeón mundial de HYROX · Austria',
    facts: [
      'Su entrenador es Tiago Lousa; sus entrenamientos de carrera los diseña Wilhelm Lilge, entrenador de corredores de élite.',
      'Entrena 20–25 h por semana, dos veces al día: intervalos, tiradas largas, fuerza y técnica.',
      'Corre 50–60 km por semana, pero los subió poco a poco durante años (empezó en 20–30 km).',
      'Hace tempos largos de 12–15 km cerca de su ritmo de carrera e intervalos rápidos bajo fatiga.',
      'Su entrenador usa una gran sesión de acondicionamiento para crear "durabilidad": moverse bien con las piernas cansadas.',
      'Para sumar aeróbico usa bici o natación en lugar de agregar km muy lentos.'
    ],
    // Plantilla por prioridad: con N días se toman las primeras N.
    week: ['tempo', 'durability', 'long', 'comp', 'cross', 'station'],
    sources: [['Red Bull · los secretos de Rončević, por su coach', 'https://www.redbull.com/int-en/alexander-roncevic-hyrox-training-secrets'], ['Rox Lyfe · perfil', 'https://roxlyfe.com/alex-roncevic-profile/'], ['Six Pack Snacks', 'https://sixpacksnacks.com/blog/alexander_roncevic/']]
  },
  wenisch: {
    n: 'Tim Wenisch', short: 'Wenisch', tag: 'Días altos y bajos', who: 'Campeón mundial de HYROX 2025 · Alemania',
    facts: [
      'Alterna días altos y bajos: cada día duro va seguido de uno suave.',
      'Un día alto típico: fuerza de piernas en la mañana y umbral de carrera en la tarde con las piernas cansadas (por ejemplo 10 × 1 km).',
      'Un día bajo: ergómetro suave o carrera en zona 2.',
      'Su ritmo de umbral se parece mucho a su ritmo de carrera HYROX.',
      'Entrena 18–20 h por semana, doble sesión de lunes a sábado, con tirada larga el domingo.',
      'Ha contado que entrenar de más lo llevó al sobreentrenamiento: por eso respeta los días bajos.'
    ],
    week: ['thrHeavy', 'easyErg', 'thrHeavy', 'long', 'sim', 'z2'],
    sources: [['Box Life · su plan de 10 semanas', 'https://boxlifemagazine.com/hyrox-champ-training-plan/'], ['Men’s Fitness · entrevista', 'https://mensfitness.co.uk/features/tim-wenisch/'], ['John Gets Strong', 'https://johngetstrong.substack.com/p/how-tim-wenisch-trained-to-win-the']]
  },
  mcintyre: {
    n: 'Hunter McIntyre', short: 'McIntyre', tag: 'Bloques: resistencia ↔ fuerza', who: 'Campeón mundial de HYROX · EUA',
    facts: [
      'Periodiza por bloques: alterna bloques dedicados a resistencia con bloques dedicados a fuerza.',
      'Su programa HAOS HYROX PRO usa 3 semanas duras y 1 semana de volumen bajo para recuperar.',
      'En preparación para el Mundial: pista en la mañana y sesión HYROX de fuerza en la tarde.',
      'En una buena semana reporta unas 6 h de gimnasio y 10–14 h de cardio.'
    ],
    blocks: {   // ciclo de 8 semanas: 3 resistencia, 1 descarga, 3 fuerza, 1 descarga
      E: ['run', 'long', 'comp', 'sim', 'z2', 'easyErg'],
      S: ['strengthLegs', 'station', 'thrHeavy', 'station', 'z2', 'recov'],
      D: ['z2', 'station', 'easyErg', 'recov']
    },
    sources: [['BoxRox · cómo entrena para el Mundial', 'https://www.boxrox.com/hunter-mcintyre-reveals-how-he-is-training-to-win-the-hyrox-world-championships/'], ['HAOS · HYROX Pro', 'https://haostraining.com/pages/hyrox-pro'], ['Yahoo / Men’s Health', 'https://uk.style.yahoo.com/hyrox-champion-hunter-mcintyre-trains-140400563.html']]
  },
  wietrzyk: {
    n: 'Joanna Wietrzyk', short: 'Wietrzyk', tag: 'Carrera en la mañana, HYROX 2 veces', who: 'Atleta Elite 15 · Polonia',
    facts: [
      'Mañanas de carrera: tiradas aeróbicas largas y sesiones de umbral (lunes, martes y jueves).',
      'Tardes de fuerza, core y ergómetros.',
      'Dos sesiones específicas de HYROX por semana (martes y sábado).',
      'Domingo: caminar.',
      'Fuente secundaria (resumen de un reportaje); confírmalo en la entrevista original.'
    ],
    week: ['run', 'sim', 'long', 'station', 'easyErg', 'recov'],
    sources: [['the5krunner · semanas de los pros', 'https://the5krunner.com/2026/06/16/hyrox-elite-training-schedules/']]
  }
};
const CHAMP_RULE = 'Regla que comparten los mejores: no más de 3 sesiones duras por semana; los días fáciles, fáciles.';
const SES_NAME = { tempo: 'Tempo', thrHeavy: 'Umbral pesado', durability: 'Durabilidad', strengthLegs: 'Fuerza', long: 'Tirada larga', easyErg: 'Ergómetro suave', cross: 'Bici / natación', comp: 'Running bajo fatiga', sim: 'Simulación', run: 'Umbral', z2: 'Zona 2', station: 'Estación', recov: 'Recuperación', taper: 'Activación' };

/** Plantilla de esta semana según el método y tus días disponibles. */
function hxMethodWeek() {
  const p = hx().profile, c = CHAMPS[p.method]; if (!c) return null;
  const n = Math.max(2, Math.min(6, p.days || 4));
  if (c.blocks) {
    const w = Math.max(0, Math.floor(daysBetween(p.methodStart || todayStr(), todayStr()) / 7)) % 8;
    const k = w < 3 ? 'E' : w === 3 ? 'D' : w < 7 ? 'S' : 'D';
    const tpl = c.blocks[k];
    return { types: tpl.slice(0, Math.min(n, tpl.length)), block: k, label: { E: 'Bloque de resistencia', S: 'Bloque de fuerza', D: 'Semana de descarga' }[k], weekInCycle: w + 1 };
  }
  return { types: c.week.slice(0, n) };
}
function hxWeekStart() { const t = todayStr(), dow = (parseDate(t).getDay() + 6) % 7; return addDays(t, -dow); }
/** Elige la sesión de hoy con el método: orden de la semana + cuello de botella + regla de 3 duras. */
function hxMethodPick(lib, bn, ph) {
  const p = hx().profile, c = CHAMPS[p.method], wk = hxMethodWeek();
  const from = hxWeekStart(), done = hx().sessions.filter(s => s.date >= from);
  let type = wk.types[Math.min(done.length, wk.types.length - 1)], note = null;
  if (done.length >= wk.types.length) { type = 'recov'; note = `Ya completaste tus ${wk.types.length} sesiones de esta semana: hoy solo recuperación.`; }
  const hardDone = hx().sessions.filter(s => s.date >= addDays(todayStr(), -6) && HARD.has(s.type)).length;
  if (HARD.has(type) && hardDone >= 3) { note = `Ya llevas ${hardDone} sesiones duras en 7 días. ${CHAMP_RULE}`; type = p.method === 'roncevic' ? 'cross' : 'easyErg'; }
  if (ph.k === 'perf' && (type === 'run' || type === 'tempo')) type = 'sim';
  const stK = bn && bn.main && HX_ST[bn.main.k] ? bn.main.k : (bn && bn.second && HX_ST[bn.second.k] ? bn.second.k : 'wb');
  const ses = type === 'station' ? lib.station(stK) : lib[type] || lib.z2;
  const why = `Método ${c.short}${wk.label ? ' · ' + wk.label : ''}: ${c.tag.toLowerCase()}. ${type === 'station' ? `La estación la elige tu laboratorio: ${HX_ST[stK].n}${bn && bn.main && bn.main.k === stK ? ', tu cuello de botella' : ''}.` : bn && bn.main ? `Tu cuello de botella (${bn.main.n}) se ataca en las sesiones de estación y bajo fatiga.` : ''}`;
  return { ses, type, why, note };
}

/* ---------- Pantallas ---------- */
function champMethodCard() {
  const p = hxOn() ? hx().profile : null, c = p && CHAMPS[p.method];
  if (!c) return `<button class="card keep ch-cta" id="ch-open"><div class="hx-eyebrow">ENTRENA COMO LOS CAMPEONES</div><b>Rončević · Wenisch · McIntyre · Wietrzyk</b><span class="small muted">Elige el método de un campeón; tu laboratorio lo adapta a tus días, tu nivel y tu punto débil.</span>${ico('chevron-right', 18)}</button>`;
  const wk = hxMethodWeek(), from = hxWeekStart(), done = hx().sessions.filter(s => s.date >= from).length;
  return `<div class="card keep ch-card"><div class="row spread"><div><div class="hx-eyebrow">MÉTODO ${esc(c.short.toUpperCase())}${wk.label ? ' · ' + esc(wk.label.toUpperCase()) : ''}</div><h2 style="margin:2px 0">${esc(c.tag)}</h2></div><button class="ghost" id="ch-open">Cambiar</button></div>
    <div class="ch-week">${wk.types.map((t, i) => `<span class="${i < done ? 'done' : i === done ? 'now' : ''}"><small>${i + 1}</small>${esc(SES_NAME[t] || t)}</span>`).join('')}</div>
    <p class="small muted" style="margin:6px 0 0">${done} de ${wk.types.length} esta semana · ${esc(CHAMP_RULE)}</p></div>`;
}
function openChamps(back) {
  openModal(`<div class="hx-eyebrow">ENTRENA COMO LOS CAMPEONES</div><h3 style="margin-top:4px">Elige un método</h3>
    <p class="small muted" style="margin-top:0">Ellos entrenan 18–25 h por semana, dos veces al día. Aquí tomamos la estructura de su semana y la escalamos a tus días (${hxOn() ? hx().profile.days || 4 : 4}) y a tu nivel.</p>
    <div class="kit-list">${Object.entries(CHAMPS).map(([k, c]) => `<button class="kit-item ch-item" data-champ="${k}"><span class="ch-av">${c.short.slice(0, 2).toUpperCase()}</span><span class="grow"><b>${esc(c.n)}</b><small>${esc(c.tag)} · ${esc(c.who)}</small></span>${ico('chevron-right', 16)}</button>`).join('')}</div>
    <div class="pg-rec"><b>Lo que todos comparten</b><small>${esc(CHAMP_RULE)} Mucho volumen aeróbico construido durante años; correr bajo fatiga; y fuerza para las estaciones.</small></div>
    <p class="small muted">Resumen de entrevistas y reportajes públicos. Sin afiliación con los atletas ni con HYROX.</p>
    ${hxOn() && hx().profile.method ? '<button class="ghost block" id="ch-none" style="color:var(--bad)">Quitar método (volver al plan por cuello de botella)</button>' : ''}
    <button class="ghost block" id="ch-x">${back ? '← Volver' : 'Cerrar'}</button>`, m => {
    $$('[data-champ]', m).forEach(b => b.onclick = () => openChamp(b.dataset.champ, () => openChamps(back)));
    const n = $('#ch-none', m); if (n) n.onclick = () => { delete hx().profile.method; saveData(); closeModal(); render(currentTab); };
    $('#ch-x', m).onclick = () => back ? back() : closeModal();
  });
}
function openChamp(k, back) {
  const c = CHAMPS[k], tpl = c.week || c.blocks.E, n = hxOn() ? hx().profile.days || 4 : 4;
  openModal(`<div class="hx-eyebrow">${esc(c.who.toUpperCase())}</div><h3 style="margin-top:4px">${esc(c.n)}</h3>
    <p class="small"><b>${esc(c.tag)}</b></p>
    <ul class="comp-list">${c.facts.map(f => `<li>${ico('check', 16)}<span>${esc(f)}</span></li>`).join('')}</ul>
    <div class="rir-label"><span>Tu versión (${n} días)</span></div>
    ${c.blocks ? `<p class="small">Ciclo de 8 semanas: 3 de resistencia, 1 de descarga, 3 de fuerza, 1 de descarga.</p>${['E', 'S', 'D'].map(b => `<div class="ch-week">${c.blocks[b].slice(0, n).map((t, i) => `<span><small>${i + 1}</small>${esc(SES_NAME[t])}</span>`).join('')}</div><p class="small muted" style="margin:2px 0 8px">${{ E: 'Resistencia', S: 'Fuerza', D: 'Descarga' }[b]}</p>`).join('')}`
      : `<div class="ch-week">${tpl.slice(0, n).map((t, i) => `<span><small>${i + 1}</small>${esc(SES_NAME[t])}</span>`).join('')}</div>`}
    <p class="small muted">Las sesiones se hacen en orden durante la semana. Tu laboratorio cambia la estación por tu punto débil, baja a recuperación si tu chequeo sale bajo y nunca pasa de 3 sesiones duras en 7 días.</p>
    <div class="rir-label"><span>Fuentes</span></div><div class="ev-links">${c.sources.map(([t, u]) => `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(t)} ↗</a>`).join('')}</div>
    <button class="block" id="ch-apply" style="margin-top:12px">Entrenar con este método</button><button class="ghost block" id="ch-b">← Volver</button>`, m => {
    $('#ch-apply', m).onclick = () => {
      if (!hxOn()) { openHxSetup(() => { hx().profile.method = k; hx().profile.methodStart = todayStr(); saveData(); closeModal(); showTab('hyrox'); }); return; }
      hx().profile.method = k; hx().profile.methodStart = todayStr(); saveData(); closeModal(); toast('Método ' + c.short + ' activado'); showTab('hyrox');
    };
    $('#ch-b', m).onclick = back;
  });
}
