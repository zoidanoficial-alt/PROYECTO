'use strict';
/* Mi Progreso 17.0 · Notificaciones (recordatorios locales).
   La app calcula la agenda de los próximos 7 días con tus datos y Android la dispara aunque la
   app esté cerrada (y la vuelve a programar si reinicias el teléfono). Cada vez que sales de la
   app la agenda se recalcula: si ya entrenaste, te pesaste o llegaste a tu meta de agua, ese aviso
   desaparece. Reglas: nada entre 22:00 y 7:00, máximo 4 avisos al día, tono amable y sin culpas. */

const NOTIF_TYPES = {
  train: { ico: '🏋️', name: 'Entreno del día', desc: 'Los días que te toca, si aún no entrenas', time: '18:00' },
  run: { ico: '🏃', name: 'Sesión de running', desc: 'Los días con sesión de tu plan', time: '07:00' },
  checkin: { ico: '⚡', name: 'Chequeo de recuperación', desc: 'Los días de entreno, si no lo has hecho', time: '08:00' },
  weigh: { ico: '⚖️', name: 'Pesarte', desc: 'Cada mañana, si aún no registras tu peso', time: '07:30' },
  water: { ico: '💧', name: 'Agua', desc: '3 avisos al día solo si vas por debajo de tu meta', time: null },
  food: { ico: '🍗', name: 'Proteína del día', desc: 'En la noche, si te falta proteína', time: '20:30' },
  commits: { ico: '🤝', name: 'Mis compromisos', desc: 'Si tienes uno pendiente hoy', time: '20:00' },
  comeback: { ico: '👋', name: 'Regreso amable', desc: 'Un solo aviso si llevas 4+ días sin moverte', time: '18:00' },
  weekly: { ico: '📊', name: 'Resumen semanal', desc: 'Domingo en la tarde', time: '19:00' },
  cycle: { ico: '🌸', name: 'Ciclo (texto discreto)', desc: '2 días antes de la fecha estimada; no dice de qué se trata', time: '09:00' }
};
const NOTIF_ORDER = ['run', 'train', 'checkin', 'weigh', 'food', 'water', 'commits', 'comeback', 'weekly', 'cycle'];
const NOTIF_IDS = { train: 101, run: 102, checkin: 103, weigh: 104, water: 105, food: 106, commits: 107, comeback: 108, weekly: 109, cycle: 110 };
const QUIET = [7, 22];   // solo entre 7:00 y 22:00
const PER_DAY = 4;

function notifCfg() {
  const p = DB.profile;
  if (!p.notif) p.notif = { on: false, asked: false, types: {} };
  NOTIF_ORDER.forEach(k => { if (!p.notif.types[k]) p.notif.types[k] = { on: k !== 'cycle', time: NOTIF_TYPES[k].time }; });
  return p.notif;
}
const notifBridge = () => !!(bridge && bridge.setReminders);
function notifStatus() { try { return bridge && bridge.notifStatus ? bridge.notifStatus() : 'web'; } catch (e) { return 'web'; } }

function atTime(date, hhmm) { const [h, m] = (hhmm || '09:00').split(':').map(Number); const d = parseDate(date); d.setHours(h, m || 0, 0, 0); return d.getTime(); }
function inQuiet(ms) { const h = new Date(ms).getHours(); return h < QUIET[0] || h >= QUIET[1]; }
function trainPlannedOn(date) {
  if (weekKey(date) === weekKey(todayStr()) && typeof weekAgenda === 'function') return weekAgenda().some(a => a.date === date);
  if (typeof isHardWeek === 'function' && isHardWeek(weekKey(date))) return false;
  return plannedDays().includes((parseDate(date).getDay() + 6) % 7);
}
const trainedOn = date => DB.sessions.some(s => s.end && s.date === date) || (typeof activeDates === 'function' && activeDates().has(date));

/** Agenda de los próximos 7 días: [{at, nid, title, text, tab, type}] ordenada por hora. */
function buildReminders(now) {
  const N = notifCfg(), T = N.types, out = [], t = todayStr();
  now = now || Date.now();
  if (!N.on) return out;
  const on = k => T[k] && T[k].on;
  const tg = targets(), runs = typeof planSessions === 'function' ? planSessions() : [];
  for (let i = 0; i < 7; i++) {
    const date = addDays(t, i), isToday = i === 0, dayOut = [];
    const add = (type, hhmm, title, text, tab) => { const at = atTime(date, hhmm); if (at > now + 60000 && !inQuiet(at)) dayOut.push({ at, nid: NOTIF_IDS[type], type, title, text, tab }); };
    const tot = isToday ? dayTotals(date) : null, rec = DB.days[date] && DB.days[date].rec;
    // Running del plan
    const rs = runs.find(s => s.date === date && !s.done);
    if (on('run') && rs) add('run', T.run.time, '🏃 Hoy: ' + rs.label, 'Sesión de tu plan de running. Si hoy no se puede, no se acumula.', 'train');
    // Entreno de fuerza
    const plan = trainPlannedOn(date) && !(isToday && trainedOn(date));
    if (on('train') && plan && !rs) {
      const nd = isToday ? nextDay(DB.profile.routine) : null;
      add('train', T.train.time, nd && !nd.rest ? '🏋️ Hoy toca: ' + nd.name.split('·').pop().trim() : '🏋️ Hoy toca entrenar',
        (nd && !nd.rest ? nd.ex.length + ' ejercicios. ' : '') + '¿No te da tiempo? La versión de 15 min también cuenta.', 'train');
    }
    if (on('checkin') && (plan || rs) && !(isToday && rec)) add('checkin', T.checkin.time, '⚡ ¿Cómo llegas hoy?', '30 segundos y te digo si mantener, reducir o descargar.', 'home');
    // Peso
    if (on('weigh') && !(isToday && DB.days[date] && DB.days[date].weight != null)) add('weigh', T.weigh.time, '⚖️ Buenos días: ¿te pesas?', 'Antes de desayunar, misma báscula. Lo que cuenta es la media de 7 días.', 'home');
    // Agua: solo si vas por debajo de lo esperado a esa hora
    if (on('water') && tg.water) [['11:00', 0.3], ['15:00', 0.6], ['19:00', 0.85]].forEach(([h, f]) => {
      const have = isToday ? tot.water : 0;
      if (have < tg.water * f) add('water', h, isToday ? `💧 Llevas ${fmt(have / 1000, 1)} de ${fmt(tg.water / 1000, 1)} L` : '💧 ¿Un vaso de agua?', 'Tómate uno ahora y regístralo con +250 ml.', 'home');
    });
    // Proteína
    if (on('food') && tg.protein) {
      const left = isToday ? Math.round(tg.protein - tot.p) : null;
      if (!isToday || left > tg.protein * 0.3) add('food', T.food.time, isToday ? `🍗 Te faltan ~${left} g de proteína` : '🍽️ ¿Registraste tus comidas?', isToday ? 'Una cena con proteína o un batido y cierras el día.' : 'Registrarlas es lo que hace que tus metas funcionen.', 'food');
    }
    // Compromisos
    const pend = (DB.commits || []).find(c => !commitDone(c, date));
    if (on('commits') && pend) add('commits', T.commits.time, '🤝 Tu compromiso de hoy', pend.title + '. Si hoy no sale, mañana sigue igual.', 'home');
    // Resumen semanal (domingo)
    if (on('weekly') && parseDate(date).getDay() === 0) add('weekly', T.weekly.time, '📊 Tu semana en Mi Progreso', 'Mira lo que lograste esta semana y elige el plan de la siguiente.', 'progress');
    // Ciclo: discreto por privacidad (se ve en la pantalla bloqueada)
    if (on('cycle') && DB.profile.cycleOn && DB.profile.cycleConsent && typeof cycStats === 'function') {
      const st = cycStats();
      if (st.next && addDays(st.next, -2) === date) add('cycle', T.cycle.time, '🌸 Recordatorio de tu calendario', 'Abre la app para ver los detalles.', 'home');
    }
    dayOut.sort((a, b) => NOTIF_ORDER.indexOf(a.type) - NOTIF_ORDER.indexOf(b.type));
    out.push(...dayOut.slice(0, PER_DAY));
  }
  // Regreso amable: un solo aviso por pausa (4+ días sin actividad)
  const last = typeof lastActiveDate === 'function' ? lastActiveDate() : null;
  if (T.comeback.on && last && daysBetween(last, t) >= 3 && !(N.comebackFor === last && N.comebackAt <= now)) {
    let at;
    if (N.comebackFor === last) at = N.comebackAt;   // ya programado para esta pausa: se conserva
    else { let date = addDays(last, 4); if (date < t) date = t; at = atTime(date, T.comeback.time); if (at <= now + 60000) at = atTime(addDays(date, 1), T.comeback.time); }
    if (!inQuiet(at)) out.push({ at, nid: NOTIF_IDS.comeback, type: 'comeback', title: '👋 ¿Retomamos con algo corto?', text: 'Sin presión: 15 minutos cuentan, y la app te arma un regreso suave.', tab: 'home', last });
  }
  return out.sort((a, b) => a.at - b.at).slice(0, 40);
}

/** Envía la agenda a Android. Se llama al salir de la app, al abrirla y al cambiar ajustes. */
function syncReminders() {
  if (!notifBridge()) return 0;
  const list = buildReminders();
  const cb = list.find(r => r.type === 'comeback'), N = notifCfg();
  if (cb && N.comebackFor !== cb.last) { N.comebackFor = cb.last; N.comebackAt = cb.at; saveData(); }   // un solo aviso por pausa
  try { return bridge.setReminders(JSON.stringify(list.map(r => ({ at: r.at, nid: r.nid, title: r.title, text: r.text, tab: r.tab })))); } catch (e) { return 0; }
}

/** Activa las notificaciones con la configuración recomendada y pide el permiso de Android. */
function enableNotifs() {
  const N = notifCfg(); N.on = true; N.asked = true;
  saveData(); requestNotifications(); syncReminders();
}
window.onNotifPermission = ok => { toast(ok ? '🔔 Notificaciones activadas' : 'Sin permiso: puedes activarlas en Ajustes de Android'); render(currentTab); syncReminders(); };
window.onNotifOpen = tab => { if (['home', 'train', 'food', 'progress', 'more'].includes(tab)) { closeModal(); showTab(tab); } };

/** Tarjeta de Inicio para activarlas (una sola vez). */
function notifPromptCard() {
  const N = notifCfg();
  if (N.on || N.asked) return '';
  return `<div class="card keep notif-prompt">
    <h2 style="margin:0 0 4px">🔔 ¿Te aviso a tiempo?</h2>
    <p class="small" style="margin:0 0 10px">Te recuerdo tu entreno, el chequeo, pesarte, el agua y la proteína, solo cuando haga falta: si ya lo hiciste, no hay aviso. Nada de noche y máximo 4 al día.</p>
    <div class="row"><button id="np-yes" style="flex:2">Activar notificaciones</button><button class="secondary" id="np-no" style="flex:1">Ahora no</button></div>
  </div>`;
}
function bindNotifPrompt(root, rerender) {
  const y = $('#np-yes', root), n = $('#np-no', root);
  if (y) y.onclick = () => { enableNotifs(); rerender(); toast('🔔 Recordatorios listos'); };
  if (n) n.onclick = () => { notifCfg().asked = true; saveData(); rerender(); };
}

/** Tarjeta de ajustes en Más. */
function notifSettingsCard() {
  const N = notifCfg(), st = notifStatus(), next = buildReminders().slice(0, 4);
  const when = ms => { const d = new Date(ms), t = todayStr(), ds = dateStr(d); return (ds === t ? 'Hoy' : ds === addDays(t, 1) ? 'Mañana' : shortDate(ds)) + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
  return `<div class="card" data-fold-title="Notificaciones" data-fold-sum="${N.on ? (st === 'off' ? 'Bloqueadas en Android' : 'Activadas · ' + NOTIF_ORDER.filter(k => N.types[k].on).length + ' tipos') : 'Apagadas'}" data-fold-ico="🔔">
    <h2>Notificaciones</h2>
    <label class="habit"><input type="checkbox" id="nt-on" ${N.on ? 'checked' : ''}> <b>Recordatorios activados</b></label>
    ${N.on && st === 'off' ? `<div class="status warn"><b>Android las tiene bloqueadas</b>Actívalas en los ajustes del teléfono para que lleguen.<button class="small-btn" id="nt-settings" style="margin-top:8px">Abrir ajustes</button></div>` : ''}
    ${st === 'web' ? '<p class="small muted">Los avisos con la app cerrada funcionan en la app de Android.</p>' : ''}
    ${N.on ? `<div class="nt-list">${NOTIF_ORDER.filter(k => k !== 'cycle' || DB.profile.cycleOn).map(k => { const x = NOTIF_TYPES[k], c = N.types[k]; return `<div class="nt-row"><label class="nt-main"><input type="checkbox" data-nt="${k}" ${c.on ? 'checked' : ''}><span><b>${x.ico} ${x.name}</b><small>${x.desc}</small></span></label>${x.time ? `<input type="time" class="nt-time" data-ntt="${k}" value="${c.time}" min="07:00" max="21:59" aria-label="Hora de ${x.name}">` : ''}</div>`; }).join('')}</div>
      <div class="small muted" style="font-weight:600;margin:12px 0 4px">Próximos avisos</div>
      ${next.length ? next.map(r => `<div class="nt-next"><span>${when(r.at)}</span><b>${esc(r.title)}</b></div>`).join('') : '<p class="small muted" style="margin:0">Nada pendiente: vas al día. ✨</p>'}
      <div class="row" style="margin-top:10px"><button class="secondary" id="nt-test" style="flex:1">Enviar una de prueba</button></div>
      <p class="small muted" style="margin:8px 0 0">Nada entre 22:00 y 7:00 · máximo ${PER_DAY} al día · se recalculan cada vez que sales de la app. Todo se queda en tu teléfono.</p>` : '<p class="small muted" style="margin:0">Actívalos para que la app te avise solo cuando haga falta.</p>'}
  </div>`;
}
function bindNotifSettings(root, rerender) {
  const N = notifCfg(), re = () => { saveData(); syncReminders(); keepScroll(rerender); };
  const on = $('#nt-on', root); if (!on) return;
  on.onchange = e => { if (e.target.checked) enableNotifs(); else { N.on = false; N.asked = true; } re(); };
  $$('[data-nt]', root).forEach(cb => cb.onchange = () => { N.types[cb.dataset.nt].on = cb.checked; re(); });
  $$('[data-ntt]', root).forEach(inp => inp.onchange = () => {
    const v = inp.value, h = Number((v || '').split(':')[0]);
    if (!v || h < QUIET[0] || h >= QUIET[1]) { toast('Elige una hora entre 7:00 y 21:59'); inp.value = N.types[inp.dataset.ntt].time; return; }
    N.types[inp.dataset.ntt].time = v; re();
  });
  const s = $('#nt-settings', root); if (s) s.onclick = () => { try { bridge.openNotifSettings(); } catch (e) {} };
  const t = $('#nt-test', root); if (t) t.onclick = () => {
    if (bridge && bridge.notifyNow) { bridge.notifyNow('🔔 Así se ven tus recordatorios', 'Llegan aunque la app esté cerrada. Tócalo para abrirla.'); toast('Revisa tu barra de notificaciones'); }
    else toast('La prueba funciona en la app de Android');
  };
}

// Recalcular al salir de la app (es cuando ya sabemos qué hiciste hoy) y al volver.
document.addEventListener('visibilitychange', () => { if (document.hidden) syncReminders(); });
window.addEventListener('pagehide', syncReminders);
