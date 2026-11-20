'use strict';
/* ---------- 27.0 · HYROX Lab: resultados, comparación y rankings ----------
 * HYROX no publica una API oficial de resultados (ver docs/HYROX-RESULTADOS-APIS.md). La app:
 *  - guarda TUS carreras (con parciales) desde Competiciones → evento → Registrar mi resultado;
 *  - compara tus parciales contra un atleta de referencia que tú captures (de results.hyrox.com);
 *  - muestra rankings solo si el pipeline publicó data/leaderboards.json desde un proveedor autorizado.
 */
const HX_SPLITS = ['Run 1', 'SkiErg', 'Run 2', 'Sled push', 'Run 3', 'Sled pull', 'Run 4', 'Burpee broad jumps', 'Run 5', 'Row', 'Run 6', 'Farmers carry', 'Run 7', 'Sandbag lunges', 'Run 8', 'Wall balls'];
let HX_BOARDS;
async function hxLoadBoards() {
  if (HX_BOARDS !== undefined) return HX_BOARDS;
  try { const r = await fetch('data/leaderboards.json'); HX_BOARDS = r.ok ? await r.json() : null; } catch (e) { HX_BOARDS = null; }
  return HX_BOARDS;
}
async function openHxRanks(back) {
  const boards = await hxLoadBoards(), races = ((DB.ev && DB.ev.results) || []).filter(r => r.sport === 'hyrox').sort((a, b) => b.date.localeCompare(a.date));
  const refs = hx().refs || [], best = races.slice().sort((a, b) => a.sec - b.sec)[0], withSplits = races.find(r => r.splits);
  openModal(`<div class="hx-eyebrow">RESULTADOS Y RANKINGS</div><h3 style="margin-top:4px">${best ? hxT(best.sec) : 'Sin carreras'}</h3>
    <p class="small muted" style="margin-top:0">${best ? 'Tu mejor marca · ' + esc(best.name) : 'Registra una carrera desde Competiciones → evento → Registrar mi resultado.'}</p>
    ${races.length ? `<div class="rir-label"><span>Mis carreras</span></div><table class="small hx-tbl"><tbody>${races.map(r => `<tr><td>${esc(r.name)}<br><small class="muted">${shortDate(r.date)}${r.cat ? ' · ' + esc(r.cat) : ''}${r.cpos ? ' · #' + r.cpos + ' en categoría' : ''}</small></td><td><b>${hxT(r.sec)}</b>${r.pr ? '<br><small class="hx-tag medido">PR</small>' : ''}</td></tr>`).join('')}</tbody></table>` : ''}
    <div class="rir-label"><span>Comparar parciales</span></div>
    ${refs.length && withSplits ? hxCompareHtml(withSplits, refs[refs.length - 1]) : `<p class="small muted">${withSplits ? 'Agrega un atleta de referencia (por ejemplo, alguien de tu categoría en results.hyrox.com) para ver dónde ganas o pierdes tiempo.' : 'Necesitas una carrera tuya con parciales y un atleta de referencia.'}</p>`}
    <button class="secondary block" id="rk-ref">Agregar atleta de referencia</button>
    <div class="rir-label"><span>Los mejores · México y mundo</span></div>
    ${boards && boards.boards && boards.boards.length ? boards.boards.map(b => `<div class="pg-rec"><b>${esc(b.title)}</b><small>${esc(b.season || '')} · fuente: ${esc(boards.source)} · ${esc((boards.generatedAt || '').slice(0, 10))}</small><table class="small hx-tbl"><tbody>${b.rows.slice(0, 10).map(x => `<tr><td>${x.rank}. ${esc(x.name)} <small class="muted">${esc(x.country || '')}</small></td><td>${hxT(x.time)}</td></tr>`).join('')}</tbody></table></div>`).join('')
      : `<div class="status info"><b>Sin rankings conectados</b>HYROX no ofrece una API pública oficial y no muestro tablas inventadas. Para verlos aquí hay que conectar un proveedor autorizado (ver documentación). Mientras, los resultados oficiales están en su sitio.</div>
      <a class="ev-link-btn" href="https://results.hyrox.com/" target="_blank" rel="noopener">Resultados oficiales de HYROX ↗</a>`}
    <button class="ghost block" id="rk-x">← Volver</button>`, m => {
    $('#rk-ref', m).onclick = () => openHxRef(() => openHxRanks(back));
    $('#rk-x', m).onclick = back;
  });
}
function hxCompareHtml(mine, ref) {
  const rows = HX_SPLITS.map((n, i) => ({ n, a: mine.splits[i], b: ref.splits[i] })).filter(r => r.a && r.b).map(r => ({ ...r, d: r.a - r.b }));
  const worst = rows.slice().sort((x, y) => y.d - x.d).slice(0, 3).filter(r => r.d > 0);
  return `<p class="small">Tú (${esc(mine.name)}) vs <b>${esc(ref.name)}</b>${ref.sec ? ' · ' + hxT(ref.sec) : ''}</p>
    <table class="small hx-tbl"><tbody>${rows.map(r => `<tr><td>${r.n}</td><td>${hxT(r.a)}</td><td>${hxT(r.b)}</td><td class="${r.d > 0 ? 'hx-lose' : 'hx-win'}">${r.d > 0 ? '+' : '-'}${hxT(Math.abs(r.d))}</td></tr>`).join('')}</tbody></table>
    ${worst.length ? `<p class="small"><b>Dónde está la diferencia:</b> ${worst.map(r => `${r.n} (+${hxT(r.d)})`).join(', ')}.</p>` : ''}`;
}
function openHxRef(back) {
  openModal(`<h3>Atleta de referencia</h3><p class="small muted" style="margin-top:0">Copia sus tiempos de results.hyrox.com. Se guarda solo en tu teléfono.</p>
    <label>Nombre o alias<input id="rf-n" placeholder="Ej. ganador Men Open 30-34"></label><label>Tiempo final (h:mm:ss)<input id="rf-t"></label>
    <div class="ev-splits">${HX_SPLITS.map((n, i) => `<label>${n}<input data-rf="${i}" placeholder="m:ss"></label>`).join('')}</div>
    <div class="row"><button class="secondary" id="rf-c" style="flex:1">Cancelar</button><button id="rf-s" style="flex:1">Guardar</button></div>`, m => {
    $('#rf-c', m).onclick = back;
    $('#rf-s', m).onclick = () => {
      const sp = $$('[data-rf]', m).map(i => hxParse(i.value));
      if (!sp.some(Boolean)) { toast('Escribe al menos un parcial'); return; }
      hx().refs = (hx().refs || []).concat({ name: $('#rf-n', m).value.trim() || 'Referencia', sec: hxParse($('#rf-t', m).value), splits: sp });
      saveData(); back();
    };
  });
}
