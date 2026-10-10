'use strict';
/*
 * Exportar el progreso a Excel (.xlsx) y PDF, con tablas planas y nombres de columna
 * claros para que cualquier IA (ChatGPT, Claude, Gemini…) pueda analizarlas.
 * El .xlsx se arma a mano (zip sin compresión); el PDF usa jsPDF + AutoTable (vendor/).
 */

/* ------------------------------------------------------------------ *
 *  Datos tabulares
 * ------------------------------------------------------------------ */
function exportRange(period) {
  const t = todayStr();
  const all = Object.keys(DB.days).concat(DB.lifts.map(l => l.date)).sort();
  const first = all[0] || t;
  const from = period === 'all' ? first : addDays(t, -(Number(period) - 1));
  return { from: from < first ? first : from, to: t };
}
const inRange = (d, R) => d >= R.from && d <= R.to;
const yn = b => b ? 'sí' : 'no';
const r1 = v => v == null || !isFinite(v) ? '' : Math.round(v * 10) / 10;

function aiPrompt(R) {
  const p = DB.profile;
  return `Eres un entrenador y nutriólogo experto. Analiza mis datos de entrenamiento y nutrición del ${R.from} al ${R.to}. ` +
    `Perfil: hombre de ${p.age} años, ${p.height} cm, objetivo "${phaseName(p.phase)}" de ${p.startWeight} kg a ${p.goalWeight} kg, somatotipo ${SOMATOTYPES[p.somatotype].name}. ` +
    'Dime: 1) si el ritmo de cambio de peso (media de 7 días) es adecuado, 2) si las calorías y la proteína reales coinciden con el objetivo, ' +
    '3) qué ejercicios progresan o están estancados (1RM estimado y RIR), 4) el volumen semanal por grupo muscular y si hay riesgo de sobreentrenamiento, ' +
    '5) qué ajustar la próxima semana (calorías, volumen, ejercicios) con números concretos.';
}
function phaseName(ph) { return ph === 'definicion' ? 'definición' : ph === 'volumen' ? 'volumen' : 'mantenimiento'; }

function buildSheets(R) {
  const p = DB.profile, tg = targets();
  const dates = [];
  for (let d = R.from; d <= R.to; d = addDays(d, 1)) dates.push(d);

  const diario = [['fecha', 'peso_kg', 'peso_media_7d_kg', 'kcal', 'proteina_g', 'carbohidratos_g', 'grasa_g', 'azucar_g', 'agua_ml', 'comidas', 'pasos', 'sueno_h', 'entreno', 'hrv_ms', 'fc_reposo', 'calidad_sueno_1a5', 'fatiga_1a5', 'nota']];
  dates.forEach(d => {
    const e = DB.days[d];
    const hasLift = DB.lifts.some(l => l.date === d);
    if (!e && !hasLift) return;
    const x = e || {}, tt = dayTotals(d), avg = weekAvg(d), rec = x.rec || {};
    diario.push([d, x.weight != null ? x.weight : '', avg ? r1(avg.avg) : '', tt.kcal || '', r1(tt.p) || '', r1(tt.c) || '', r1(tt.f) || '', r1(tt.s) || '',
      tt.water || '', tt.meals || '', x.steps || '', x.sleep || '', yn(x.trained || hasLift), rec.hrv || '', rec.rhr || '', rec.sleepQ || '', rec.soreness || '', x.note || '']);
  });

  const comidas = [['fecha', 'hora', 'comida', 'kcal', 'proteina_g', 'carbohidratos_g', 'grasa_g', 'azucar_g', 'macros_completos']];
  dates.forEach(d => ((DB.days[d] && DB.days[d].meals) || []).forEach(m => {
    const k = m.kcal != null ? m.kcal : (m.p || 0) * 4 + (m.c || 0) * 4 + (m.f || 0) * 9;
    comidas.push([d, m.t ? new Date(m.t).toTimeString().slice(0, 5) : '', m.name, Math.round(k), r1(m.p), r1(m.c), r1(m.f), r1(m.s), yn(!m.partial)]);
  }));

  const sessName = id => { const s = DB.sessions.find(x => x.id === id); return s ? s.dayName : 'Serie suelta'; };
  const series = [['fecha', 'sesion', 'ejercicio', 'grupo_muscular', 'tipo', 'equipo', 'planet_fitness', 'serie_n', 'peso_kg', 'peso_en_maquina', 'unidad_maquina', 'reps', 'rir', 'rpe', 'tecnica', '1rm_estimado_kg', 'volumen_kg']];
  const lifts = DB.lifts.filter(l => inRange(l.date, R)).sort((a, b) => (a.t || 0) - (b.t || 0));
  const counter = {};
  lifts.forEach(l => {
    const info = exInfo(l.ex), u = unitFor(l.ex), key = (l.sid || l.date) + l.ex;
    counter[key] = (counter[key] || 0) + 1;
    series.push([l.date, sessName(l.sid), l.ex, GROUPS[info.g] || info.g, info.t === 'c' ? 'compuesto' : 'aislamiento', EQUIP[info.e] || '', yn(info.pf), counter[key],
      r1(l.w), r1(fromKg(l.w, u)), u, l.r, l.rir != null ? l.rir : '', l.rir != null ? 10 - l.rir : '', (TECHNIQUES[l.tech] || TECHNIQUES.normal).name, r1(e1rm(l.w, l.r)), Math.round(l.w * l.r)]);
  });

  const sesiones = [['fecha', 'rutina', 'dia', 'duracion_min', 'series', 'volumen_kg', 'ejercicios']];
  DB.sessions.filter(s => s.end && inRange(s.date, R)).sort((a, b) => a.start - b.start).forEach(s => {
    const ls = DB.lifts.filter(l => l.sid === s.id);
    sesiones.push([s.date, s.routine === 'libre' ? 'Libre' : getRoutine(s.routine).name, s.dayName, Math.round((s.end - s.start) / 60000), ls.length, Math.round(sessionVolume(s.id)), Array.from(new Set(ls.map(l => l.ex))).join('; ')]);
  });

  // Progreso por ejercicio: primera y última mejor marca del periodo
  const progreso = [['ejercicio', 'grupo_muscular', 'sesiones', 'series', 'primer_1rm_kg', 'ultimo_1rm_kg', 'mejor_1rm_kg', 'cambio_pct', 'rir_medio']];
  Array.from(new Set(lifts.map(l => l.ex))).forEach(ex => {
    const ls = lifts.filter(l => l.ex === ex), byDate = {};
    ls.forEach(l => { const v = e1rm(l.w, l.r); byDate[l.date] = Math.max(byDate[l.date] || 0, v); });
    const ds = Object.keys(byDate).sort(), firstV = byDate[ds[0]], lastV = byDate[ds[ds.length - 1]];
    const rirs = ls.filter(l => l.rir != null).map(l => l.rir);
    progreso.push([ex, GROUPS[exInfo(ex).g] || '', ds.length, ls.length, r1(firstV), r1(lastV), r1(Math.max(...Object.values(byDate))), ds.length > 1 ? r1((lastV / firstV - 1) * 100) : '', rirs.length ? r1(rirs.reduce((a, b) => a + b, 0) / rirs.length) : '']);
  });

  // Volumen semanal por grupo (series efectivas)
  const weeks = [];
  for (let w = weekKey(R.from); w <= R.to; w = addDays(w, 7)) weeks.push(w);
  const volumen = [['semana_inicio'].concat(Object.keys(GROUPS).map(g => 'series_' + GROUPS[g].toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''))).concat(['total_series', 'pct_compuestos'])];
  weeks.forEach(w => {
    const ls = lifts.filter(l => l.date >= w && l.date <= addDays(w, 6) && (l.rir == null || l.rir <= 3));
    if (!ls.length) return;
    const row = [w].concat(Object.keys(GROUPS).map(g => ls.filter(l => exInfo(l.ex).g === g).length));
    row.push(ls.length, Math.round(ls.filter(l => exInfo(l.ex).t === 'c').length / ls.length * 100));
    volumen.push(row);
  });

  const medidas = [['fecha', 'cintura_cm', 'pecho_cm', 'brazo_cm', 'cadera_cm']];
  DB.measures.filter(m => inRange(m.date, R)).sort((a, b) => a.date < b.date ? -1 : 1).forEach(m => medidas.push([m.date, m.waist || '', m.chest || '', m.arm || '', m.hip || '']));

  const logros = [['fecha', 'tipo', 'logro', 'detalle']];
  DB.achievements.filter(a => inRange(a.date, R)).forEach(a => logros.push([a.date, a.pr ? 'récord personal' : 'logro', a.title, a.detail || '']));

  // Resumen clave-valor
  const cur = currentWeight(), rates = weeklyRates(), wts = weightEntries().filter(e => inRange(e.date, R));
  const days = diario.slice(1), avgOf = col => { const v = days.map(r => Number(r[col])).filter(x => x > 0); return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : ''; };
  const lv = strengthLevels(), vol = weekVolume();
  const resumen = [['dato', 'valor'],
    ['periodo', R.from + ' a ' + R.to], ['generado', new Date().toISOString().slice(0, 16).replace('T', ' ')],
    ['nombre', p.name || ''], ['edad', p.age], ['altura_cm', p.height], ['objetivo', phaseName(p.phase)], ['somatotipo', SOMATOTYPES[p.somatotype].name],
    ['peso_inicial_kg', p.startWeight], ['fecha_inicio', p.startDate], ['peso_meta_kg', p.goalWeight],
    ['peso_actual_media_7d_kg', r1(cur)], ['cambio_desde_inicio_kg', r1(cur - p.startWeight)],
    ['cambio_ultima_semana_kg', r1(rates.r1)], ['peso_primer_registro_periodo_kg', wts.length ? wts[0].w : ''], ['peso_ultimo_registro_periodo_kg', wts.length ? wts[wts.length - 1].w : ''],
    ['kcal_objetivo', tg.kcal], ['proteina_objetivo_g', tg.protein], ['carbohidratos_objetivo_g', tg.carbs], ['grasa_objetivo_g', tg.fat],
    ['kcal_promedio_dias_registrados', avgOf(3)], ['proteina_promedio_g', avgOf(4)], ['agua_promedio_ml', avgOf(8)], ['pasos_promedio', avgOf(10)],
    ['sesiones_en_periodo', sesiones.length - 1], ['series_en_periodo', series.length - 1], ['series_efectivas_ultimos_7d', vol.total],
    ['pct_compuestos_ultimos_7d', vol.total ? Math.round(vol.comp / vol.total * 100) : ''], ['racha_semanas_3_entrenos', trainingStreakWeeks()],
    ['ejercicios_con_fuerza_a_la_baja', strengthAlerts().join('; ')]]
    .concat(lv.map(l => ['nivel_' + l.name.toLowerCase().replace(' ', '_'), l.ratio == null ? 'sin datos' : STRENGTH_LEVELS[l.level] + ' (' + r1(l.ratio) + '× peso corporal, 1RM ' + r1(l.best) + ' kg)']))
    .concat([['prompt_sugerido_para_ia', aiPrompt(R)]]);

  return [
    { name: 'Resumen', rows: resumen, widths: [34, 90] },
    { name: 'Diario', rows: diario },
    { name: 'Comidas', rows: comidas },
    { name: 'Series', rows: series },
    { name: 'Sesiones', rows: sesiones },
    { name: 'Progreso por ejercicio', rows: progreso },
    { name: 'Volumen semanal', rows: volumen },
    { name: 'Medidas', rows: medidas },
    { name: 'Logros', rows: logros }
  ];
}

/* ------------------------------------------------------------------ *
 *  XLSX mínimo (Office Open XML en un zip sin compresión)
 * ------------------------------------------------------------------ */
const CRC_TABLE = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(bytes) { let c = 0xFFFFFFFF; for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }

function zipStore(files) {
  const enc = new TextEncoder(), parts = [], central = [];
  let offset = 0;
  const u16 = v => [v & 0xFF, (v >>> 8) & 0xFF], u32 = v => [v & 0xFF, (v >>> 8) & 0xFF, (v >>> 16) & 0xFF, (v >>> 24) & 0xFF];
  files.forEach(f => {
    const name = enc.encode(f.name), data = typeof f.data === 'string' ? enc.encode(f.data) : f.data, crc = crc32(data);
    const local = new Uint8Array([].concat([0x50, 0x4B, 0x03, 0x04], u16(20), u16(0x0800), u16(0), u16(0), u16(0x21), u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0)));
    parts.push(local, name, data);
    central.push(new Uint8Array([].concat([0x50, 0x4B, 0x01, 0x02], u16(20), u16(20), u16(0x0800), u16(0), u16(0), u16(0x21), u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset))), name);
    offset += local.length + name.length + data.length;
  });
  const cdSize = central.reduce((a, b) => a + b.length, 0);
  const end = new Uint8Array([].concat([0x50, 0x4B, 0x05, 0x06], u16(0), u16(0), u16(files.length), u16(files.length), u32(cdSize), u32(offset), u16(0)));
  const all = parts.concat(central, [end]), out = new Uint8Array(all.reduce((a, b) => a + b.length, 0));
  let pos = 0; all.forEach(b => { out.set(b, pos); pos += b.length; });
  return out;
}

const xmlEsc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
function colName(i) { let s = ''; i++; while (i) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; }

function makeXlsx(sheets) {
  const sheetXml = sh => {
    const cols = sh.rows[0].length;
    const widths = sh.widths || Array.from({ length: cols }, (_, c) => Math.min(48, Math.max(10, ...sh.rows.slice(0, 200).map(r => String(r[c] == null ? '' : r[c]).length + 2))));
    const rows = sh.rows.map((r, ri) => `<row r="${ri + 1}">${r.map((v, ci) => {
      const ref = colName(ci) + (ri + 1), style = ri === 0 ? ' s="1"' : '';
      if (typeof v === 'number' && isFinite(v)) return `<c r="${ref}"${style}><v>${v}</v></c>`;
      if (v === '' || v == null) return '';
      return `<c r="${ref}" t="inlineStr"${style}><is><t xml:space="preserve">${xmlEsc(v)}</t></is></c>`;
    }).join('')}</row>`).join('');
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
<cols>${widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols><sheetData>${rows}</sheetData>
${sh.rows.length > 1 ? `<autoFilter ref="A1:${colName(cols - 1)}${sh.rows.length}"/>` : ''}</worksheet>`;
  };
  const files = [
    { name: '[Content_Types].xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>` },
    { name: '_rels/.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>' },
    { name: 'xl/workbook.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((s, i) => `<sheet name="${xmlEsc(s.name.slice(0, 31))}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>` },
    { name: 'xl/_rels/workbook.xml.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>` },
    { name: 'xl/styles.xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF26B2A"/></patternFill></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>' }
  ].concat(sheets.map((s, i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, data: sheetXml(s) })));
  return zipStore(files);
}

/* ------------------------------------------------------------------ *
 *  PDF
 * ------------------------------------------------------------------ */
function loadScript(src) {
  return new Promise((res, rej) => {
    if ($(`script[src="${src}"]`)) return res();
    const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('No se pudo cargar ' + src));
    document.head.appendChild(s);
  });
}
async function makePdf(R, opts) {
  await loadScript('vendor/jspdf.umd.min.js');
  await loadScript('vendor/jspdf.plugin.autotable.min.js');
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  // La fuente estándar de PDF solo trae Latin-1: se cambian símbolos que no existen en ella.
  const safe = v => typeof v === 'string' ? v.replace(/≤/g, '<=').replace(/≥/g, '>=').replace(/[−–]/g, '-').replace(/→/g, '->').replace(/[^\u0000-\u00FF\u2013\u2014\u2018\u2019\u201C\u201D\u2022\u2026\u20AC]/g, '') : v;
  const rawText = doc.text.bind(doc);
  doc.text = (t, ...rest) => rawText(Array.isArray(t) ? t.map(safe) : safe(t), ...rest);
  const sheets = buildSheets(R), S = name => sheets.find(s => s.name === name).rows;
  const W = 210, M = 14, ORANGE = [242, 107, 42], GRAY = [107, 114, 128];
  let y = 0;
  const p = DB.profile;

  // Portada / encabezado
  doc.setFillColor(...ORANGE); doc.rect(0, 0, W, 34, 'F');
  doc.setTextColor(255); doc.setFont('helvetica', 'bold'); doc.setFontSize(20);
  doc.text('Reporte de progreso', M, 16);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(11);
  doc.text(`${p.name ? p.name + ' · ' : ''}${longDate(R.from)} a ${longDate(R.to)} · Mi Progreso`, M, 25);
  doc.setTextColor(17); y = 44;

  const h2 = txt => {
    if (y > 255) { doc.addPage(); y = 18; } else if (y > 50) y += 4;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(...ORANGE); doc.text(txt, M, y);
    doc.setTextColor(17); doc.setFont('helvetica', 'normal'); y += 5;
  };
  const para = txt => {
    doc.setFontSize(9.5); doc.setTextColor(...GRAY);
    const lines = doc.splitTextToSize(txt, W - 2 * M);
    if (y + lines.length * 4.2 > 285) { doc.addPage(); y = 18; }
    doc.text(lines, M, y + 3); y += lines.length * 4.2 + 3; doc.setTextColor(17);
  };
  const table = (head, body, extra) => {
    if (!body.length) { para('Sin datos en este periodo.'); return; }
    doc.autoTable(Object.assign({
      head: [head], body, startY: y, margin: { left: M, right: M }, theme: 'grid',
      styles: { fontSize: 8.5, cellPadding: 1.8, lineColor: [229, 231, 235], lineWidth: 0.2 },
      headStyles: { fillColor: ORANGE, textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 249, 251] }
    }, extra || {}));
    y = doc.lastAutoTable.finalY + 8;
  };
  const chart = (pts, goal, label) => {
    if (pts.length < 2) return;
    if (y > 225) { doc.addPage(); y = 18; }
    y += 5;
    const x0 = M + 10, x1 = W - M, h = 45, top = y, bot = y + h;
    const ys = pts.map(q => q.y).concat(goal != null ? [goal] : []);
    let lo = Math.min(...ys), hi = Math.max(...ys); const pad = Math.max((hi - lo) * 0.1, 0.5); lo -= pad; hi += pad;
    const t0 = parseDate(pts[0].date).getTime(), t1 = parseDate(pts[pts.length - 1].date).getTime() || t0 + 1;
    const px = d => x0 + (parseDate(d).getTime() - t0) / Math.max(1, t1 - t0) * (x1 - x0), py = v => bot - (v - lo) / (hi - lo) * h;
    doc.setDrawColor(229, 231, 235); doc.setLineWidth(0.2); doc.setFontSize(7); doc.setTextColor(...GRAY);
    for (let i = 0; i <= 3; i++) { const v = lo + (hi - lo) * i / 3; doc.line(x0, py(v), x1, py(v)); doc.text(v.toFixed(1), M, py(v) + 1); }
    doc.text(shortDate(pts[0].date), x0, bot + 4); doc.text(shortDate(pts[pts.length - 1].date), x1, bot + 4, { align: 'right' });
    if (goal != null) { doc.setDrawColor(22, 163, 74); doc.setLineDashPattern([1.5, 1.2], 0); doc.line(x0, py(goal), x1, py(goal)); doc.setLineDashPattern([], 0); doc.setTextColor(22, 163, 74); doc.text('Meta ' + goal, x1, py(goal) - 1, { align: 'right' }); }
    doc.setDrawColor(...ORANGE); doc.setLineWidth(0.7);
    for (let i = 1; i < pts.length; i++) doc.line(px(pts[i - 1].date), py(pts[i - 1].y), px(pts[i].date), py(pts[i].y));
    doc.setFontSize(8); doc.setTextColor(...GRAY); doc.text(label, x0, top - 1);
    doc.setTextColor(17); y = bot + 10;
  };

  // 1. Resumen
  h2('1. Resumen');
  const res = S('Resumen').slice(1).filter(r => r[0] !== 'prompt_sugerido_para_ia');
  const nice = k => k.replace(/_/g, ' ').replace(/^./, c => c.toUpperCase());
  table(['Dato', 'Valor'], res.map(r => [nice(r[0]), String(r[1])]), { columnStyles: { 0: { cellWidth: 70, fontStyle: 'bold' } } });
  const adv = weightAdvice();
  para('Estado actual: ' + adv.title + '. ' + adv.text);

  // 2. Peso
  h2('2. Peso corporal');
  const wts = weightEntries().filter(e => inRange(e.date, R));
  chart(movingAvg(wts), p.goalWeight, 'Media de 7 días (kg)');
  const weekly = [];
  for (let w = weekKey(R.from); w <= R.to; w = addDays(w, 7)) {
    const v = wts.filter(e => e.date >= w && e.date <= addDays(w, 6)).map(e => e.w);
    if (v.length) weekly.push([w, v.length, (v.reduce((a, b) => a + b, 0) / v.length).toFixed(1), Math.min(...v).toFixed(1), Math.max(...v).toFixed(1)]);
  }
  weekly.forEach((r, i) => r.push(i ? (r[2] - weekly[i - 1][2]).toFixed(2) : ''));
  table(['Semana', 'Registros', 'Media kg', 'Mín', 'Máx', 'Cambio'], weekly);

  // 3. Nutrición
  h2('3. Nutrición');
  const tg = targets();
  para(`Objetivo diario: ${tg.kcal} kcal · proteína ${tg.protein} g · carbohidratos ${tg.carbs} g · grasa ${tg.fat} g · agua ${tg.water} ml · azúcar máx. ${tg.sugar} g (fórmula de Marc McLean: peso en lb × ${tg.factor}, reparto ${tg.soma.name}).`);
  const di = S('Diario').slice(1).filter(r => r[3] || r[8]);
  table(['Fecha', 'Kcal', 'Prot', 'Carb', 'Grasa', 'Azúcar', 'Agua ml', 'Comidas'], di.slice(-31).map(r => [r[0], r[3], r[4], r[5], r[6], r[7], r[8], r[9]]));

  // 4. Entrenamiento
  h2('4. Entrenamiento');
  table(['Fecha', 'Día', 'Min', 'Series', 'Volumen kg'], S('Sesiones').slice(1).slice(-20).map(r => [r[0], r[2], r[3], r[4], r[5]]));
  h2('Progreso por ejercicio (1RM estimado, Epley)');
  table(['Ejercicio', 'Ses.', 'Series', '1RM inicial', '1RM final', 'Mejor', 'Cambio %', 'RIR medio'], S('Progreso por ejercicio').slice(1).map(r => [r[0], r[2], r[3], r[4], r[5], r[6], r[7], r[8]]));
  h2('Volumen semanal por grupo (series efectivas, RIR 3 o menos)');
  const vh = S('Volumen semanal');
  if (vh.length > 1) table(['Semana'].concat(Object.values(GROUPS).map(g => g.slice(0, 5))).concat(['Total', '% comp.']), vh.slice(1), { styles: { fontSize: 7.5, cellPadding: 1.4 } });
  else para('Sin series en este periodo.');
  h2('Nivel de fuerza relativo');
  table(['Ejercicio', '1RM estimado', '× peso corporal', 'Nivel'], strengthLevels().map(l => [l.name, l.best ? l.best.toFixed(0) + ' kg' : '—', l.ratio ? l.ratio.toFixed(2) : '—', l.ratio == null ? 'sin datos' : STRENGTH_LEVELS[l.level]]));

  if (opts.detail) {
    h2('Detalle de series');
    table(['Fecha', 'Ejercicio', '#', 'Peso kg', 'Reps', 'RIR', 'Técnica', '1RM'], S('Series').slice(1).map(r => [r[0], r[2], r[7], r[8], r[11], r[12], r[14], r[15]]), { styles: { fontSize: 7.5, cellPadding: 1.3 } });
  }

  // 5. Medidas, recuperación, logros
  h2('5. Medidas');
  table(['Fecha', 'Cintura', 'Pecho', 'Brazo', 'Cadera'], S('Medidas').slice(1));
  const recRows = S('Diario').slice(1).filter(r => r[13] || r[11] || r[16]).map(r => [r[0], r[11], r[13], r[14], r[15], r[16]]);
  if (recRows.length) { h2('6. Recuperación'); table(['Fecha', 'Sueño h', 'HRV ms', 'FC reposo', 'Calidad', 'Fatiga'], recRows.slice(-31)); }
  h2(recRows.length ? '7. Récords y logros' : '6. Récords y logros');
  table(['Fecha', 'Tipo', 'Logro', 'Detalle'], S('Logros').slice(1).slice(0, 40));

  // Fotos (opcional)
  if (opts.photos) {
    const ph = (await photoStore.all()).filter(x => inRange(x.date, R) && x.pose === 'frente');
    if (ph.length) {
      doc.addPage(); y = 18; h2('Fotos de progreso (frente)');
      const pick = ph.length > 1 ? [ph[ph.length - 1], ph[0]] : [ph[0]];
      pick.forEach((x, i) => {
        const w = 85, hgt = w * 4 / 3, xx = M + i * (w + 12);
        try { doc.addImage(x.data, 'JPEG', xx, y, w, hgt); } catch (e) {}
        doc.setFontSize(9); doc.setTextColor(...GRAY); doc.text(longDate(x.date) + photoWeight(x), xx, y + hgt + 5);
      });
      y += 125;
    }
  }

  // Guía para IA
  doc.addPage(); y = 18;
  h2('Cómo analizar este reporte con una IA');
  para('Sube este PDF (o el Excel, que trae los datos crudos en hojas separadas) a ChatGPT, Claude o Gemini y pega este mensaje:');
  doc.setFillColor(255, 241, 232); const pl = doc.splitTextToSize(aiPrompt(R), W - 2 * M - 8);
  doc.roundedRect(M, y, W - 2 * M, pl.length * 4.6 + 8, 3, 3, 'F'); doc.setFontSize(10); doc.setTextColor(17); doc.text(pl, M + 4, y + 7); y += pl.length * 4.6 + 14;
  para('Glosario: RIR = repeticiones en reserva (0 = fallo). RPE = 10 - RIR. 1RM estimado = peso × (1 + reps/30). Serie efectiva = serie de trabajo con RIR de 3 o menos. Media de 7 días = promedio del peso de los últimos 7 días.');

  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) { doc.setPage(i); doc.setFontSize(8); doc.setTextColor(...GRAY); doc.text(`Mi Progreso · página ${i} de ${pages}`, W / 2, 292, { align: 'center' }); }
  return new Uint8Array(doc.output('arraybuffer'));
}

/* ------------------------------------------------------------------ *
 *  Guardar y compartir
 * ------------------------------------------------------------------ */
function toBase64(bytes) {
  let s = ''; const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) s += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  return btoa(s);
}
/** Devuelve la URI (content://) en Android, o null en el navegador (allí se descarga). */
function saveBinary(name, mime, bytes) {
  if (bridge && bridge.saveBase64) {
    const uri = bridge.saveBase64(name, mime, toBase64(bytes));
    if (!uri) throw new Error('No se pudo guardar el archivo');
    return uri;
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([bytes], { type: mime }));
  a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  return null;
}

let exportPeriod = '30';
function openExport() {
  openModal(`
    <h3>Exportar mi progreso</h3>
    <p class="small muted" style="margin-top:0">Genera un archivo para guardarlo o mandárselo a una IA (ChatGPT, Claude, Gemini) y que te dé un análisis.</p>
    <label>Periodo<div class="seg" style="margin:6px 0 0">${[['7', '7 días'], ['30', '30 días'], ['90', '90 días'], ['all', 'Todo']].map(([v, l]) => `<button data-per="${v}" class="${exportPeriod === v ? 'on' : ''}">${l}</button>`).join('')}</div></label>
    <button class="choice" id="ex-pdf"><span class="c-ico">📄</span><span><b>PDF · reporte</b><small>Resumen, gráfica de peso, nutrición, progreso por ejercicio, volumen y guía para la IA.</small></span></button>
    <label class="check" style="margin:-4px 0 10px 4px"><input type="checkbox" id="ex-photos"> Incluir fotos de frente (primera y última)</label>
    <label class="check" style="margin:-6px 0 12px 4px"><input type="checkbox" id="ex-detail"> Incluir cada serie en el PDF</label>
    <button class="choice" id="ex-xlsx"><span class="c-ico">📊</span><span><b>Excel · datos completos</b><small>9 hojas: resumen, diario, comidas, series, sesiones, progreso, volumen, medidas y logros.</small></span></button>
    <button class="choice" id="ex-csv"><span class="c-ico">🔁</span><span><b>CSV · formato Strong</b><small>Todas tus series en el formato estándar que importan Strong, Hevy y otras apps. Para llevarte tus datos a donde quieras.</small></span></button>
    <button class="secondary block" id="ex-prompt">Copiar mensaje para la IA</button>
    <button class="ghost block" id="ex-import" style="margin-top:6px">Importar entrenos desde Strong o Hevy (CSV)</button>
    <input type="file" id="ex-file" accept=".csv,text/csv,text/comma-separated-values" style="display:none">
    <div id="ex-result"></div>`, m => {
    $$('[data-per]', m).forEach(b => b.onclick = () => { exportPeriod = b.dataset.per; $$('[data-per]', m).forEach(x => x.classList.toggle('on', x === b)); });
    const done = (uri, name, mime) => {
      $('#ex-result', m).innerHTML = `<div class="status good"><b>Listo: ${esc(name)}</b>${uri ? 'Guardado en Descargas/MiProgreso.' : 'Descargado.'}</div>${uri ? '<button class="block" id="ex-share" style="margin-top:10px">Compartir (ChatGPT, Claude, WhatsApp…)</button>' : ''}`;
      const sh = $('#ex-share', m); if (sh) sh.onclick = () => bridge.shareFile(uri, mime, 'Analiza mi progreso');
    };
    const run = async (btn, fn) => {
      const old = btn.innerHTML; btn.disabled = true; $('#ex-result', m).innerHTML = '<div class="empty">Generando…</div>';
      try { await fn(); } catch (e) { $('#ex-result', m).innerHTML = `<div class="status bad"><b>Error</b>${esc(e.message)}</div>`; }
      btn.disabled = false; btn.innerHTML = old;
    };
    $('#ex-xlsx', m).onclick = e => run(e.currentTarget, async () => {
      const R = exportRange(exportPeriod), name = `miprogreso_${R.from}_a_${R.to}.xlsx`, mime = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      done(saveBinary(name, mime, makeXlsx(buildSheets(R))), name, mime);
    });
    $('#ex-pdf', m).onclick = e => run(e.currentTarget, async () => {
      const R = exportRange(exportPeriod), name = `miprogreso_${R.from}_a_${R.to}.pdf`;
      const bytes = await makePdf(R, { photos: $('#ex-photos', m).checked, detail: $('#ex-detail', m).checked });
      done(saveBinary(name, 'application/pdf', bytes), name, 'application/pdf');
    });
    $('#ex-csv', m).onclick = e => run(e.currentTarget, async () => {
      const R = exportRange(exportPeriod), name = `miprogreso_strong_${R.from}_a_${R.to}.csv`;
      done(saveBinary(name, 'text/csv', new TextEncoder().encode(strongCsv(R))), name, 'text/csv');
    });
    $('#ex-import', m).onclick = () => $('#ex-file', m).click();
    $('#ex-file', m).onchange = ev => {
      const f = ev.target.files && ev.target.files[0]; ev.target.value = '';
      if (!f) return;
      const rd = new FileReader();
      rd.onload = () => {
        try {
          const res = importWorkoutCsv(String(rd.result));
          $('#ex-result', m).innerHTML = `<div class="status good"><b>Importado desde ${res.source}</b>${res.sessions} sesiones y ${res.sets} series${res.newEx ? `, ${res.newEx} ejercicios nuevos creados` : ''}.</div>`;
        } catch (e) { $('#ex-result', m).innerHTML = `<div class="status bad"><b>No se pudo importar</b>${esc(e.message)}</div>`; }
      };
      rd.readAsText(f);
    };
    $('#ex-prompt', m).onclick = async () => {
      const txt = aiPrompt(exportRange(exportPeriod));
      try { await navigator.clipboard.writeText(txt); toast('Mensaje copiado: pégalo junto con el archivo'); }
      catch (e) { if (bridge && bridge.copyText) { bridge.copyText(txt); toast('Mensaje copiado'); } else toast('No se pudo copiar'); }
    };
  });
}

/* ------------------------------------------------------------------ *
 *  CSV compatible con Strong / Hevy (exportar e importar)
 * ------------------------------------------------------------------ */
function csvCell(v) { const t = v == null ? '' : String(v); return /[",\n;]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t; }
/** Formato de exportación de Strong (lo importan Hevy y otras apps): una fila por serie, peso en kg. */
function strongCsv(R) {
  const rows = [['Date', 'Workout Name', 'Duration', 'Exercise Name', 'Set Order', 'Weight', 'Reps', 'Distance', 'Seconds', 'Notes', 'Workout Notes', 'RPE']];
  const sessions = DB.sessions.filter(x => x.end && inRange(x.date, R)).sort((a, b) => a.start - b.start);
  const loose = DB.lifts.filter(l => !l.sid && inRange(l.date, R));
  const emit = (date, start, title, mins, sets) => {
    const order = {};
    sets.sort((a, b) => (a.t || 0) - (b.t || 0)).forEach(l => {
      order[l.ex] = (order[l.ex] || 0) + 1;
      const ts = new Date(start || l.t || parseDate(date).getTime());
      const stamp = date + ' ' + String(ts.getHours()).padStart(2, '0') + ':' + String(ts.getMinutes()).padStart(2, '0') + ':00';
      rows.push([stamp, title, mins + 'm', l.ex, order[l.ex], r1(l.w), l.r, '', '', l.tech && l.tech !== 'normal' ? TECHNIQUES[l.tech].name : '', '', l.rir != null ? 10 - l.rir : '']);
    });
  };
  sessions.forEach(x => emit(x.date, x.start, x.dayName, Math.round((x.end - x.start) / 60000), DB.lifts.filter(l => l.sid === x.id)));
  if (loose.length) emit(loose[0].date, null, 'Series sueltas', 0, loose);
  return rows.map(r => r.map(csvCell).join(',')).join('\n');
}

function parseCsv(text) {
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
    else if (c === '"') q = true;
    else if (c === ',' || c === ';') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter(r => r.some(x => x.trim()));
}

/**
 * Importa el CSV de Strong o de Hevy. Los ejercicios que no existen en el catálogo se crean como
 * ejercicios propios (puedes renombrarlos luego); las series quedan agrupadas en sesiones por fecha y nombre.
 */
function importWorkoutCsv(text) {
  const rows = parseCsv(text.replace(/^\uFEFF/, ''));
  if (rows.length < 2) throw new Error('El archivo está vacío.');
  const h = rows[0].map(x => x.trim().toLowerCase());
  const col = (...names) => names.map(n => h.indexOf(n)).find(i => i >= 0);
  let source, get;
  if (h.includes('exercise_title')) {          // Hevy
    source = 'Hevy';
    const c = { date: col('start_time'), end: col('end_time'), title: col('title'), ex: col('exercise_title'), w: col('weight_kg'), r: col('reps'), rpe: col('rpe'), type: col('set_type') };
    get = r => ({ when: r[c.date], end: r[c.end], title: r[c.title], ex: r[c.ex], w: num(r[c.w]), reps: num(r[c.r]), rpe: num(r[c.rpe]), warm: /warm/i.test(r[c.type] || '') });
  } else if (h.includes('exercise name')) {    // Strong
    source = 'Strong';
    const c = { date: col('date'), title: col('workout name'), dur: col('duration'), ex: col('exercise name'), w: col('weight'), r: col('reps'), rpe: col('rpe') };
    get = r => ({ when: r[c.date], dur: r[c.dur], title: r[c.title], ex: r[c.ex], w: num(r[c.w]), reps: num(r[c.r]), rpe: num(r[c.rpe]), warm: false });
  } else throw new Error('No reconozco el formato. Exporta desde Strong o Hevy en CSV.');

  const toDate = s => { const d = new Date(String(s).replace(' ', 'T')); return isNaN(d) ? null : d; };
  const groups = {}; let newEx = 0, sets = 0;
  rows.slice(1).forEach(r => {
    const x = get(r);
    if (!x.ex || !x.reps || x.warm) return;
    const d = toDate(x.when); if (!d) return;
    const key = dateStr(d) + '|' + (x.title || 'Entreno');
    (groups[key] = groups[key] || { d, x, sets: [] }).sets.push(x);
  });
  Object.values(groups).forEach(g => {
    const date = dateStr(g.d), start = g.d.getTime();
    let mins = 60;
    if (g.x.end && toDate(g.x.end)) mins = Math.max(1, Math.round((toDate(g.x.end) - g.d) / 60000));
    else if (g.x.dur) { const m = String(g.x.dur).match(/(?:(\d+)h)?\s*(\d+)m/); if (m) mins = (Number(m[1]) || 0) * 60 + Number(m[2]); }
    if (DB.sessions.some(s => s.date === date && s.imported === g.x.title + '@' + start)) return;   // no duplicar
    const sid = uid();
    DB.sessions.push({ id: sid, routine: 'libre', dayId: null, dayName: g.x.title || 'Entreno importado', date, start, end: start + mins * 60000, extra: [], swaps: {}, imported: g.x.title + '@' + start });
    g.sets.forEach((x, k) => {
      const exName = IMPORT_ALIASES[x.ex.toLowerCase()] || x.ex;
      if (!EX[exName]) { DB.customEx.push(guessExercise(exName)); registerCustomExercises(); newEx++; }
      DB.lifts.push({ id: uid(), ex: exName, w: x.w || 0, r: Math.round(x.reps), rir: x.rpe ? Math.max(0, Math.min(4, Math.round(10 - x.rpe))) : null, date, t: start + k * 1000, sid, tech: 'normal' });
      sets++;
    });
  });
  saveData();
  return { source, sessions: Object.keys(groups).length, sets, newEx };
}

/** Nombres habituales de Strong/Hevy → ejercicios del catálogo. */
const IMPORT_ALIASES = {
  'bench press (barbell)': 'Press banca con barra', 'bench press (dumbbell)': 'Press banca con mancuernas', 'bench press (smith machine)': 'Press banca en Smith',
  'incline bench press (barbell)': 'Press inclinado con barra', 'incline bench press (dumbbell)': 'Press inclinado con mancuernas', 'chest press (machine)': 'Chest press (máquina)',
  'chest fly (machine)': 'Pec deck (aperturas en máquina)', 'butterfly (pec deck)': 'Pec deck (aperturas en máquina)', 'cable crossover': 'Cruces en polea', 'chest dip': 'Fondos en paralelas (con lastre)',
  'push up': 'Lagartijas', 'squat (barbell)': 'Sentadilla con barra', 'squat (smith machine)': 'Sentadilla en Smith', 'goblet squat (kettlebell)': 'Sentadilla goblet con mancuerna',
  'goblet squat': 'Sentadilla goblet con mancuerna', 'leg press': 'Prensa de piernas (máquina)', 'leg press (machine)': 'Prensa de piernas (máquina)', 'hack squat': 'Hack squat', 'hack squat (machine)': 'Hack squat',
  'leg extension (machine)': 'Extensión de cuádriceps', 'lying leg curl (machine)': 'Curl femoral tumbado', 'seated leg curl (machine)': 'Curl femoral sentado',
  'bulgarian split squat': 'Zancadas / split squat búlgaro', 'lunge (dumbbell)': 'Zancadas / split squat búlgaro', 'deadlift (barbell)': 'Peso muerto',
  'romanian deadlift (barbell)': 'Peso muerto rumano con barra', 'romanian deadlift (dumbbell)': 'Peso muerto rumano', 'hip thrust (barbell)': 'Hip thrust', 'glute bridge': 'Puente de glúteo',
  'hip abductor (machine)': 'Abductor (máquina)', 'hip adductor (machine)': 'Aductor (máquina)', 'calf raise (machine)': 'Elevación de talones sentado', 'standing calf raise (smith machine)': 'Elevación de talones de pie',
  'seated calf raise (machine)': 'Elevación de talones sentado', 'lat pulldown (cable)': 'Jalón al pecho', 'lat pulldown (machine)': 'Jalón al pecho', 'pull up': 'Dominadas / chin-ups', 'chin up': 'Dominadas / chin-ups',
  'pull up (assisted)': 'Dominadas asistidas (máquina)', 'seated row (cable)': 'Remo en polea agarre estrecho', 'seated row (machine)': 'Remo sentado (máquina)', 'bent over row (barbell)': 'Remo con barra',
  'bent over row (dumbbell)': 'Remo con mancuerna', 'dumbbell row': 'Remo con mancuerna', 'face pull (cable)': 'Face pull', 'face pull': 'Face pull', 'back extension': 'Hiperextensiones',
  'overhead press (barbell)': 'Press militar con barra', 'shoulder press (dumbbell)': 'Press militar con mancuernas', 'seated overhead press (dumbbell)': 'Press militar con mancuernas', 'shoulder press (machine)': 'Shoulder press (máquina)',
  'lateral raise (dumbbell)': 'Elevaciones laterales', 'lateral raise (cable)': 'Elevaciones laterales en polea', 'front raise (dumbbell)': 'Elevaciones frontales', 'reverse fly (machine)': 'Pájaro posterior (reverse pec deck)',
  'rear delt reverse fly (machine)': 'Pájaro posterior (reverse pec deck)', 'upright row (dumbbell)': 'Remo al cuello', 'bicep curl (barbell)': 'Curl con barra de pie', 'bicep curl (dumbbell)': 'Curl martillo',
  'hammer curl (dumbbell)': 'Curl martillo', 'preacher curl (barbell)': 'Curl predicador', 'bicep curl (machine)': 'Curl de bíceps (máquina)', 'bicep curl (cable)': 'Curl en polea',
  'incline curl (dumbbell)': 'Curl inclinado con mancuernas', 'triceps pushdown (cable - straight bar)': 'Extensión de tríceps en polea', 'triceps pushdown': 'Extensión de tríceps en polea', 'triceps rope pushdown': 'Extensión de tríceps en polea',
  'skullcrusher (barbell)': 'Press francés', 'skull crusher (barbell)': 'Press francés', 'triceps extension (machine)': 'Extensión de tríceps (máquina)', 'bench press - close grip (barbell)': 'Press banca agarre cerrado',
  'triceps dip': 'Fondos en banco', 'crunch (machine)': 'Crunch abdominal (máquina)', 'cable crunch': 'Crunch en polea', 'crunch': 'Crunch en el suelo', 'plank': 'Plancha', 'hanging leg raise': 'Elevaciones de piernas colgado'
};
/** Para un ejercicio desconocido, adivina músculo, equipo y tipo por su nombre (inglés o español). */
function guessExercise(name) {
  const n = name.toLowerCase(), has = re => re.test(n);
  const g = has(/leg extension|extensión de cuád/) ? 'pierna' : has(/curl femoral|leg curl|hamstring|romanian|rumano/) ? 'femoral' : has(/glute|hip thrust|glúteo|abduct/) ? 'gluteo'
    : has(/calf|pantorr|talones/) ? 'pantorrilla' : has(/squat|sentadilla|leg press|prensa|lunge|zancada|step/) ? 'pierna' : has(/crunch|plank|plancha|abs|abdom|leg raise/) ? 'abdomen'
    : has(/tricep|tríceps|pushdown|skull|francés|dip/) ? 'triceps' : has(/curl|bicep|bíceps/) ? 'biceps' : has(/shoulder|lateral|overhead|military|hombro|militar|delt|face pull/) ? 'hombro'
    : has(/row|pulldown|pull up|chin|lat |remo|jalón|dominada|deadlift|peso muerto|back/) ? 'espalda' : 'pecho';
  const e = has(/smith/) ? 'smith' : has(/barbell|barra/) ? 'barra' : has(/dumbbell|mancuern|kettlebell/) ? 'manc' : has(/cable|polea/) ? 'polea' : has(/machine|máquina|lever/) ? 'maq' : has(/bodyweight|push up|pull up|chin|dip|plank|crunch/) ? 'corporal' : 'maq';
  const t = has(/curl|raise|extension|fly|crossover|pushdown|kickback|crunch|elevaci|apertura|pec deck/) ? 'a' : 'c';
  return { name, g, e, t };
}
