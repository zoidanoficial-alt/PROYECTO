// Revela SL3 — interfaz principal.

import { Engine, flipRows } from './engine.js';
import {
  inspect, decodeFull, decodeThumb, downscale, isSupported, withExif, fileKind, rotateQuarter,
} from './loader.js';
import {
  defaultParams, SLIDERS, PRESETS, HSL_RANGES, clone, applyPatch, presetParams, clampToSliders,
} from './params.js';
import { analyze, histogram, wbFromNeutral, autoTone } from './analysis.js';
import { advise, speechText, SUBJECTS } from './advisor.js';
import { aiReview, aiAsk } from './claude.js';
import { CurveEditor } from './curve-editor.js';
import { CropOverlay, ASPECTS, aspectRatio, fitCrop, withAspect, maxCrop } from './crop.js';
import { isSL3, formatShutter, PROGRAMS, detectSize } from './sl3.js';
import { isNative, saveNative, shareFiles, nativeSpeech } from './platform.js';

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const PREVIEW_MAX = 2560;
const ANALYSIS_MAX = 1200;
const LS = 'revela:v1:';

const state = {
  images: [],
  cur: -1,
  full: null,
  preview: null,
  fullMode: false,
  before: false,
  cropMode: false,
  picking: false,
  showMask: false,
  clipboard: null,
  hslTab: 'hslHue',
  advice: null,
  aiResult: null,
  view: 'develop',
  anchor: -1,
};

let engine;
try {
  engine = new Engine($('#view'));
} catch (e) {
  document.body.innerHTML = `<p style="padding:30px">${e.message}</p>`;
  throw e;
}

// ---------------------------------------------------------------- utilidades
const store = {
  get(k, d = null) {
    try { const v = localStorage.getItem(LS + k); return v === null ? d : JSON.parse(v); } catch { return d; }
  },
  set(k, v) {
    try { localStorage.setItem(LS + k, JSON.stringify(v)); } catch { /* sin espacio o modo privado */ }
  },
  del(k) { try { localStorage.removeItem(LS + k); } catch { /* nada */ } },
};

let toastTimer = 0;
function toast(msg, ms = 2600) {
  const t = $('#toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, ms);
}

function setStatus(s) { $('#status').textContent = s; }
const cur = () => state.images[state.cur];
const imgKey = (im) => `img:${im.name}:${im.file.size}`;

function saveImage(im) {
  store.set(imgKey(im), { params: im.params, rating: im.rating, flag: im.flag });
}

function isEdited(p) {
  return JSON.stringify(p) !== JSON.stringify(defaultParams());
}

// ---------------------------------------------------------------- importar
async function importFiles(fileList) {
  const files = [...fileList].filter(isSupported).sort((a, b) => a.name.localeCompare(b.name));
  if (!files.length) { toast('No encontré fotos compatibles (CR3, JPEG, PNG, WebP).'); return; }
  const start = state.images.length;
  for (const file of files) {
    if (state.images.some((im) => im.name === file.name && im.file.size === file.size)) continue;
    const im = {
      id: crypto.randomUUID ? crypto.randomUUID() : String(Math.random()),
      file, name: file.name, kind: fileKind(file), info: null, exif: {}, thumb: null,
      params: defaultParams(), rating: 0, flag: 0, selected: false,
      history: null, hIndex: 0, analysis: null, width: 0, height: 0,
    };
    const saved = store.get(imgKey(im));
    if (saved) {
      im.params = applyPatch(defaultParams(), saved.params);
      im.rating = saved.rating || 0;
      im.flag = saved.flag || 0;
    }
    state.images.push(im);
  }
  document.body.classList.toggle('has-images', state.images.length > 0);
  renderStrip();
  if (state.cur < 0 && state.images.length) open(start < state.images.length ? start : 0);
  toast(`${state.images.length - start} foto(s) importada(s)`);
  // Miniaturas y metadatos en segundo plano.
  for (const im of state.images.slice(start)) {
    try {
      if (!im.info) im.info = await inspect(im.file);
      im.exif = im.info.exif || {};
      im.thumb = await decodeThumb(im.file, im.info);
    } catch (e) {
      im.error = e.message;
    }
    updateThumb(im);
  }
}

// ---------------------------------------------------------------- abrir foto
let openToken = 0;
async function open(i) {
  const im = state.images[i];
  if (!im) return;
  const token = ++openToken;
  state.cur = i;
  exitCrop(false);
  renderStrip();
  renderGrid();
  setStatus(`Cargando ${im.name}…`);
  try {
    if (!im.info) im.info = await inspect(im.file);
    im.exif = im.info.exif || {};
    let full = await decodeFull(im.file, im.info);
    full = await rotateQuarter(full, im.params.rotate || 0);
    if (token !== openToken) { full.close(); return; }
    setFull(full);
    im.width = full.width;
    im.height = full.height;
    await loadEngineSource();
    if (token !== openToken) return;
    if (!im.history) {
      im.history = [{ label: isEdited(im.params) ? 'Ajustes guardados' : 'Importar', params: clone(im.params) }];
      im.hIndex = 0;
    }
    $('#exportBtn').disabled = false;
    syncUI();
    renderNow();
    analyzeOriginal(im);
    runAdvisor();
    renderMeta();
    renderHistory();
    setStatus(`${im.name} · ${im.width}×${im.height}`);
  } catch (e) {
    console.error(e);
    setStatus('');
    toast(`No se pudo abrir ${im.name}: ${e.message}`, 5000);
  }
}

function setFull(full) {
  if (state.preview && state.preview !== state.full) state.preview.close();
  if (state.full) state.full.close();
  state.full = full;
  state.preview = null;
}

async function loadEngineSource() {
  const full = state.full;
  if (!state.preview) state.preview = await downscale(full, Math.min(PREVIEW_MAX, engine.maxTex));
  let src = state.preview;
  if (state.fullMode) src = Math.max(full.width, full.height) > engine.maxTex ? await downscale(full, engine.maxTex) : full;
  engine.setSource(src, full.width);
  if (src !== state.preview && src !== full) src.close();
}

function analyzeOriginal(im) {
  const s = Math.min(1, ANALYSIS_MAX / Math.max(engine.src.w, engine.src.h));
  const w = Math.round(engine.src.w * s);
  const h = Math.round(engine.src.h * s);
  const px = engine.render(defaultParams(), { target: 'pixels', width: w, height: h, before: true, noCrop: true });
  const img = flipRows(px);
  im.analysis = analyze(img);
  im.sample = img; // para el gotero de balance de blancos
}

// ---------------------------------------------------------------- render
let raf = 0;
function scheduleRender() {
  if (!raf) raf = requestAnimationFrame(renderNow);
}

function renderNow() {
  raf = 0;
  const im = cur();
  if (!im || !engine.src) return;
  const p = im.params;
  if (state.cropMode) {
    engine.render(p, { noCrop: true, width: engine.src.w, height: engine.src.h, before: state.before });
  } else {
    const { width, height } = engine.outputSize(p);
    engine.render(p, { width, height, before: state.before, showMask: state.showMask });
  }
  $('#beforeTag').hidden = !state.before;
  scheduleHisto();
}

let histoTimer = 0;
function scheduleHisto() {
  clearTimeout(histoTimer);
  histoTimer = setTimeout(drawHisto, 90);
}

function drawHisto() {
  const im = cur();
  if (!im || !engine.src) return;
  const { width, height } = engine.outputSize(im.params);
  const s = Math.min(1, 420 / Math.max(width, height));
  const px = engine.render(im.params, {
    target: 'pixels', width: Math.max(1, Math.round(width * s)), height: Math.max(1, Math.round(height * s)),
  });
  const h = histogram(px);
  state.lastHist = h;
  const c = $('#histo');
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, c.width, c.height);
  let max = 1;
  for (const ch of [h.r, h.g, h.b]) for (let i = 3; i < 253; i++) max = Math.max(max, ch[i]);
  ctx.globalCompositeOperation = 'lighter';
  const cols = { r: '#c0392b', g: '#27ae60', b: '#2f6fd6' };
  for (const k of ['r', 'g', 'b']) {
    ctx.fillStyle = cols[k];
    ctx.beginPath();
    ctx.moveTo(0, c.height);
    for (let i = 0; i < 256; i++) ctx.lineTo((i / 255) * c.width, c.height - Math.min(1, h[k][i] / max) * c.height * 0.95);
    ctx.lineTo(c.width, c.height);
    ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';
  const low = (h.l[0] + h.l[1] + h.l[2]) / h.total;
  const high = (h.r[255] + h.g[255] + h.b[255]) / 3 / h.total;
  const exif = im.exif;
  $('#histoInfo').innerHTML =
    `<span class="${low > 0.01 ? 'warn' : ''}">◣ ${(low * 100).toFixed(1)}%</span>` +
    `<span>${exif.iso ? `ISO ${exif.iso}` : ''} ${exif.focalLength ? `${Math.round(exif.focalLength)} mm` : ''} ` +
    `${exif.fNumber ? `f/${exif.fNumber}` : ''} ${exif.exposureTime ? formatShutter(exif.exposureTime) : ''}</span>` +
    `<span class="${high > 0.005 ? 'warn' : ''}">${(high * 100).toFixed(1)}% ◥</span>`;
  if (curveEditor) curveEditor.set(im.params.curve, h);
}

// ---------------------------------------------------------------- historial
function commit(label) {
  const im = cur();
  if (!im) return;
  im.history = im.history.slice(0, im.hIndex + 1);
  im.history.push({ label, params: clone(im.params) });
  if (im.history.length > 200) im.history.shift();
  im.hIndex = im.history.length - 1;
  saveImage(im);
  renderHistory();
  updateThumb(im);
}

function goHistory(i) {
  const im = cur();
  if (!im || i < 0 || i >= im.history.length) return;
  const prevRotate = im.params.rotate || 0;
  im.hIndex = i;
  im.params = clone(im.history[i].params);
  saveImage(im);
  afterParamsReplaced(prevRotate);
  renderHistory();
}

async function afterParamsReplaced(prevRotate) {
  const im = cur();
  if ((im.params.rotate || 0) !== prevRotate) await applyRotation(im, im.params.rotate - prevRotate);
  syncUI();
  scheduleRender();
  updateThumb(im);
}

function renderHistory() {
  const im = cur();
  const ol = $('#history');
  ol.innerHTML = '';
  if (!im || !im.history) return;
  im.history.forEach((h, i) => {
    const li = document.createElement('li');
    li.textContent = h.label;
    if (i === im.hIndex) li.className = 'on';
    li.onclick = () => goHistory(i);
    ol.appendChild(li);
  });
  ol.scrollTop = ol.scrollHeight;
}

// ---------------------------------------------------------------- controles
const sliderRefs = [];
let hslRefs = [];

function makeSlider(container, def, get, set, label = def.label, refs = sliderRefs) {
  const div = document.createElement('div');
  div.className = `sl ${def.cls || ''}`;
  const id = `s-${Math.random().toString(36).slice(2)}`;
  div.innerHTML = `<label for="${id}">${label}</label><input type="text" inputmode="decimal" spellcheck="false">` +
    `<input id="${id}" type="range" min="${def.min}" max="${def.max}" step="${def.step}">`;
  const [lab, num, range] = [div.children[0], div.children[1], div.children[2]];
  const fmt = def.fmt || ((v) => String(Math.round(v * 100) / 100));
  const dflt = def.default ?? 0;
  const show = (v) => {
    range.value = v;
    num.value = fmt(v);
    div.classList.toggle('changed', Math.abs(v - dflt) > 1e-9);
  };
  const change = (v, final) => {
    if (!cur()) return;
    v = Math.min(def.max, Math.max(def.min, parseFloat(String(v).replace(',', '.').replace(/[^\d.-]/g, ''))));
    if (!Number.isFinite(v)) return;
    set(v);
    show(v);
    scheduleRender();
    if (final) commit(`${label} ${fmt(v)}`);
  };
  range.addEventListener('input', () => change(range.value, false));
  range.addEventListener('change', () => change(range.value, true));
  num.addEventListener('change', () => change(num.value, true));
  const reset = () => change(dflt, true);
  lab.addEventListener('dblclick', reset);
  range.addEventListener('dblclick', reset);
  if (def.key === 'sharpenMasking' || def.key === 'sharpenAmount') {
    range.addEventListener('pointerdown', (e) => { if (e.altKey) { state.showMask = true; scheduleRender(); } });
    range.addEventListener('pointerup', () => { if (state.showMask) { state.showMask = false; scheduleRender(); } });
  }
  container.appendChild(div);
  const ref = { refresh: () => { if (cur()) show(get()); } };
  refs.push(ref);
  return ref;
}

function buildControls() {
  for (const [panel, defs] of Object.entries(SLIDERS)) {
    const box = $(`#sl-${panel}`);
    for (const def of defs) {
      const d = { ...def, default: defaultParams()[def.key] };
      makeSlider(box, d, () => cur().params[def.key], (v) => { cur().params[def.key] = v; });
    }
  }
  buildHsl();

  // Enderezar
  makeSlider($('#sl-angle'), { key: 'angle', min: -45, max: 45, step: 0.1, fmt: (v) => `${v.toFixed(1)}°` },
    () => cur().params.crop.angle,
    (v) => {
      const im = cur();
      const ratio = currentRatio();
      im.params.crop = { ...maxCrop(v, ratio, engine.src.w, engine.src.h), aspect: im.params.crop.aspect };
      if (state.cropMode) cropOverlay.show(im.params.crop, engine.src.w, engine.src.h, ratio);
    }, 'Enderezar');

  // Proporciones
  const sel = $('#aspect');
  for (const [k, a] of Object.entries(ASPECTS)) sel.add(new Option(a.label, k));
  sel.onchange = () => {
    const im = cur();
    if (!im) return;
    im.params.crop.aspect = sel.value;
    const ratio = currentRatio();
    if (ratio) im.params.crop = { ...withAspect(im.params.crop, ratio, engine.src.w, engine.src.h), aspect: sel.value };
    if (state.cropMode) cropOverlay.show(im.params.crop, engine.src.w, engine.src.h, ratio);
    commit(`Proporción ${ASPECTS[sel.value].label}`);
    scheduleRender();
  };

  // Tema del asistente
  const subj = $('#subject');
  for (const [k, v] of Object.entries(SUBJECTS)) subj.add(new Option(v, k));
  subj.value = store.get('subject', 'blanco');
  subj.onchange = () => { store.set('subject', subj.value); runAdvisor(); };
}

function buildHsl() {
  const box = $('#sl-hsl');
  box.innerHTML = '';
  hslRefs = [];
  const tab = state.hslTab;
  HSL_RANGES.forEach((r, i) => {
    makeSlider(box, { key: tab, min: -100, max: 100, step: 1 },
      () => cur().params[tab][i], (v) => { cur().params[tab][i] = v; },
      r.label, hslRefs);
  });
  hslRefs.forEach((s) => s.refresh());
}

function currentRatio() {
  const im = cur();
  return aspectRatio(im.params.crop.aspect, engine.src.w, engine.src.h);
}

function syncUI() {
  const im = cur();
  if (!im) return;
  sliderRefs.forEach((s) => s.refresh());
  hslRefs.forEach((s) => s.refresh());
  $('#tColor').classList.toggle('on', !im.params.monochrome);
  $('#tBw').classList.toggle('on', im.params.monochrome);
  $('#aspect').value = im.params.crop.aspect || 'free';
  curveEditor.set(im.params.curve, state.lastHist);
}

// ---------------------------------------------------------------- curva
const curveEditor = new CurveEditor($('#curve'), (final) => {
  scheduleRender();
  if (final) commit('Curva de tonos');
});
$$('.chans button').forEach((b) => {
  b.onclick = () => {
    $$('.chans button').forEach((x) => x.classList.toggle('on', x === b));
    curveEditor.channel = b.dataset.ch;
    curveEditor.draw();
  };
});
$('#curveReset').onclick = () => {
  const im = cur();
  if (!im) return;
  im.params.curve = defaultParams().curve;
  curveEditor.set(im.params.curve);
  scheduleRender();
  commit('Curva restablecida');
};
$$('.hsl-tabs button').forEach((b) => {
  b.onclick = () => {
    $$('.hsl-tabs button').forEach((x) => x.classList.toggle('on', x === b));
    state.hslTab = b.dataset.t;
    buildHsl();
  };
});

// ---------------------------------------------------------------- presets
function renderPresets() {
  const box = $('#presets');
  box.innerHTML = '';
  const user = store.get('presets', []);
  const groups = {};
  for (const p of [...PRESETS, ...user.map((u) => ({ ...u, group: 'Mis ajustes', user: true }))]) {
    (groups[p.group] ||= []).push(p);
  }
  for (const [g, list] of Object.entries(groups)) {
    const h = document.createElement('h5');
    h.textContent = g;
    box.appendChild(h);
    for (const p of list) {
      const b = document.createElement('button');
      b.innerHTML = `<span>${escapeHtml(p.name)}</span>${p.user ? '<span class="del" title="Borrar">✕</span>' : ''}`;
      b.onclick = (e) => {
        if (e.target.classList.contains('del')) {
          store.set('presets', store.get('presets', []).filter((u) => u.name !== p.name));
          renderPresets();
          return;
        }
        const im = cur();
        if (!im) return;
        im.params = presetParams(im.params, p);
        syncUI();
        scheduleRender();
        commit(`Ajuste: ${p.name}`);
      };
      box.appendChild(b);
    }
  }
}

$('#savePreset').onclick = () => {
  const im = cur();
  if (!im) return;
  const name = prompt('Nombre del ajuste preestablecido:', 'Mis huevos');
  if (!name) return;
  const d = defaultParams();
  const patch = {};
  for (const k of Object.keys(im.params)) {
    if (k === 'crop' || k === 'rotate') continue;
    if (JSON.stringify(im.params[k]) !== JSON.stringify(d[k])) patch[k] = clone(im.params[k]);
  }
  const user = store.get('presets', []).filter((u) => u.name !== name);
  user.push({ name, patch });
  store.set('presets', user);
  renderPresets();
  toast(`Ajuste "${name}" guardado`);
};

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ---------------------------------------------------------------- metadatos
function renderMeta() {
  const im = cur();
  const e = im.exif || {};
  const rows = [];
  const add = (k, v) => { if (v !== undefined && v !== null && v !== '') rows.push(`<dt>${k}</dt><dd>${v}</dd>`); };
  add('Archivo', escapeHtml(im.name));
  add('Tipo', im.kind === 'cr3' ? 'RAW Canon (CR3)' : im.kind.toUpperCase());
  add('Cámara', e.model ? `${escapeHtml(e.model)}${isSL3(e) ? ' <span class="sl3">✔ SL3</span>' : ''}` : '—');
  add('Lente', e.lensModel && escapeHtml(e.lensModel));
  add('Focal', e.focalLength && `${Math.round(e.focalLength)} mm (${Math.round(e.focalLength * 1.6)} mm equiv.)`);
  add('Abertura', e.fNumber && `f/${e.fNumber}`);
  add('Velocidad', e.exposureTime && formatShutter(e.exposureTime));
  add('ISO', e.iso);
  add('Comp. exp.', e.exposureBias !== undefined ? `${e.exposureBias > 0 ? '+' : ''}${Number(e.exposureBias).toFixed(1)} EV` : undefined);
  add('Modo', PROGRAMS[e.exposureProgram]);
  add('Flash', e.flash !== undefined ? (e.flash & 1 ? 'Disparó' : 'No') : undefined);
  add('Fecha', e.dateTimeOriginal || e.dateTime);
  const size = detectSize(im.width, im.height);
  add('Tamaño', `${im.width}×${im.height}${size ? ` (${size})` : ''} · ${((im.width * im.height) / 1e6).toFixed(1)} MP`);
  add('Peso', `${(im.file.size / 1048576).toFixed(1)} MB`);
  $('#meta').innerHTML = rows.join('');
}

// ---------------------------------------------------------------- asistente
function runAdvisor() {
  const im = cur();
  if (!im || !im.analysis) return;
  state.advice = advise({
    exif: im.exif, analysis: im.analysis, subject: $('#subject').value,
    fileSize: im.file.size, fileType: im.kind, width: im.width, height: im.height,
  });
  const r = state.advice;
  $('#score').innerHTML = `<span class="num">${r.score}</span><span class="bar"><i style="width:${r.score}%"></i></span>` +
    `<span class="muted small">${escapeHtml(r.camera)}</span>`;
  const order = { alerta: 0, mejora: 1, bien: 2 };
  const ul = $('#advice');
  ul.innerHTML = '';
  [...r.items].sort((a, b) => order[a.level] - order[b.level]).forEach((it) => {
    const li = document.createElement('li');
    li.className = it.level;
    li.innerHTML = `<span class="area">${it.area}</span><b>${escapeHtml(it.title)}</b><p>${escapeHtml(it.text)}</p>`;
    ul.appendChild(li);
  });
  $('#applyAdvice').disabled = false;
  $('#speakBtn').disabled = false;
  $('#aiBtn').disabled = false;
  $('#askBtn').disabled = false;
}

$('#applyAdvice').onclick = () => {
  const im = cur();
  if (!im || !state.advice) return;
  im.params = applyPatch(im.params, clampToSliders(state.advice.patch));
  syncUI();
  scheduleRender();
  commit('Sugerencias del asistente');
  toast('Sugerencias aplicadas. Compara con Antes/Después (\\).');
};

// Dictado por voz (Web Speech API).
let nativeSpeaking = false;
function speak(lines) {
  if (nativeSpeech) {
    if (nativeSpeaking) { nativeSpeech.stop(); return; }
    nativeSpeaking = true;
    nativeSpeech.cancelled = false;
    $('#speakBtn').textContent = '⏹ Detener';
    nativeSpeech.speak(lines.filter(Boolean), () => {
      nativeSpeaking = false;
      $('#speakBtn').textContent = '🔊 Dictar consejos';
    }).catch(() => {
      nativeSpeaking = false;
      $('#speakBtn').textContent = '🔊 Dictar consejos';
      toast('No se pudo usar la voz del teléfono. Revisa que tengas instalada la voz en español.');
    });
    return;
  }
  const synth = window.speechSynthesis;
  if (!synth) { toast('Tu navegador no tiene síntesis de voz.'); return; }
  if (synth.speaking) { synth.cancel(); $('#speakBtn').textContent = '🔊 Dictar consejos'; return; }
  const voices = synth.getVoices();
  const voice = voices.find((v) => v.lang === 'es-MX') || voices.find((v) => v.lang.startsWith('es-US')) ||
    voices.find((v) => v.lang.startsWith('es'));
  $('#speakBtn').textContent = '⏹ Detener';
  lines.forEach((line, i) => {
    const u = new SpeechSynthesisUtterance(line);
    u.lang = voice ? voice.lang : 'es-MX';
    if (voice) u.voice = voice;
    u.rate = 1.02;
    if (i === lines.length - 1) u.onend = () => { $('#speakBtn').textContent = '🔊 Dictar consejos'; };
    synth.speak(u);
  });
}
$('#speakBtn').onclick = () => {
  if (state.advice) speak(speechText(state.advice).split('\n'));
};

// ---- Claude
function apiKey() { return store.get('anthropicKey', ''); }

function askKey() {
  const dlg = $('#keyDlg');
  $('#keyInput').value = apiKey();
  dlg.showModal();
  return new Promise((resolve) => {
    dlg.onclose = () => {
      if (dlg.returnValue === 'save') store.set('anthropicKey', $('#keyInput').value.trim());
      if (dlg.returnValue === 'clear') store.del('anthropicKey');
      resolve(apiKey());
    };
  });
}
$('#keyBtn').onclick = () => askKey();

async function snapshotBase64(maxSide = 1568) {
  const im = cur();
  const { width, height } = engine.outputSize(im.params);
  const s = Math.min(1, maxSide / Math.max(width, height));
  const px = flipRows(engine.render(im.params, {
    target: 'pixels', width: Math.round(width * s), height: Math.round(height * s),
  }));
  const c = document.createElement('canvas');
  c.width = px.width;
  c.height = px.height;
  c.getContext('2d').putImageData(new ImageData(px.data, px.width, px.height), 0, 0);
  return c.toDataURL('image/jpeg', 0.88).split(',')[1];
}

function aiContext() {
  const im = cur();
  return {
    exif: im.exif, analysis: im.analysis, subject: SUBJECTS[$('#subject').value], params: im.params,
    width: im.width, height: im.height, fileType: im.kind,
  };
}

function aiError(e) {
  console.error(e);
  const status = e && e.status;
  if (status === 401) return 'Clave de API inválida. Revísala en "Clave de API".';
  if (status === 429) return 'Límite de uso alcanzado. Intenta en un momento.';
  if (status === 529 || status >= 500) return 'El servicio de Claude está saturado. Intenta de nuevo.';
  if (e instanceof TypeError) return 'Sin conexión con la API (¿estás en línea?).';
  return e.message || String(e);
}

$('#aiBtn').onclick = async () => {
  const im = cur();
  if (!im) return;
  let key = apiKey();
  if (!key) key = await askKey();
  if (!key) return;
  const out = $('#aiOut');
  out.innerHTML = '<p class="loading">Claude está revisando tu foto…</p>';
  $('#aiBtn').disabled = true;
  try {
    const r = await aiReview(key, await snapshotBase64(), aiContext());
    state.aiResult = r;
    const li = (arr) => `<ol>${arr.map((s) => `<li>${escapeHtml(s)}</li>`).join('')}</ol>`;
    out.innerHTML = `<p><b>${r.calificacion}/100</b> · ${escapeHtml(r.resumen)}</p>` +
      `<h5>En la cámara (próxima toma)</h5>${li(r.pasos_camara)}` +
      `<h5>En la edición</h5>${li(r.pasos_edicion)}` +
      '<div class="row wrap"><button id="aiApply" class="btn small primary">Aplicar ajustes de Claude</button>' +
      '<button id="aiSpeak" class="btn small">🔊 Dictar</button></div>';
    $('#aiApply').onclick = () => {
      const c = cur();
      c.params = applyPatch(c.params, clampToSliders(r.ajustes));
      syncUI();
      scheduleRender();
      commit('Ajustes de Claude');
    };
    $('#aiSpeak').onclick = () => speak([r.resumen, 'En la cámara.', ...r.pasos_camara, 'En la edición.', ...r.pasos_edicion]);
  } catch (e) {
    out.innerHTML = `<p class="muted">${escapeHtml(aiError(e))}</p>`;
  } finally {
    $('#aiBtn').disabled = false;
  }
};

async function ask() {
  const q = $('#askInput').value.trim();
  if (!q || !cur()) return;
  let key = apiKey();
  if (!key) key = await askKey();
  if (!key) return;
  const out = $('#aiOut');
  out.innerHTML = '<p class="loading">Pensando…</p>';
  try {
    const text = await aiAsk(key, await snapshotBase64(1024), aiContext(), q);
    out.innerHTML = `<p><b>${escapeHtml(q)}</b></p><p>${escapeHtml(text)}</p>`;
  } catch (e) {
    out.innerHTML = `<p class="muted">${escapeHtml(aiError(e))}</p>`;
  }
}
$('#askBtn').onclick = ask;
$('#askInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') ask(); });

// ---------------------------------------------------------------- herramientas
function autoToneNow() {
  const im = cur();
  if (!im || !im.analysis) return;
  im.params = applyPatch(im.params, autoTone(im.analysis.tone));
  syncUI();
  scheduleRender();
  commit('Tono automático');
}
$('#autoBtn').onclick = autoToneNow;
$('#autoBtn2').onclick = autoToneNow;

$('#wbAuto').onclick = () => {
  const im = cur();
  if (!im || !im.analysis) return;
  im.params.temperature = im.analysis.cast.temperature;
  im.params.tint = im.analysis.cast.tint;
  syncUI();
  scheduleRender();
  commit('Balance de blancos automático');
};

function togglePicking(on = !state.picking) {
  state.picking = on;
  $('#stage').classList.toggle('picking', on);
  $('#wbPick').classList.toggle('primary', on);
  if (on) toast('Haz clic en algo blanco o gris neutro (el fondo o un huevo blanco).');
}
$('#wbPick').onclick = () => togglePicking();

$('#view').addEventListener('click', (e) => {
  const im = cur();
  if (!state.picking || !im || !im.sample) return;
  const r = e.target.getBoundingClientRect();
  const u = (e.clientX - r.left) / r.width;
  const v = (e.clientY - r.top) / r.height;
  const c = state.cropMode ? { x: 0, y: 0, w: 1, h: 1, angle: im.params.crop.angle } : im.params.crop;
  // Espacio enderezado -> foto original (misma fórmula que el shader).
  const { width: W, height: H, data } = im.sample;
  const qx = (c.x + u * c.w) * W - W / 2;
  const qy = (c.y + v * c.h) * H - H / 2;
  const t = (c.angle * Math.PI) / 180;
  const sx = Math.round(Math.cos(t) * qx + Math.sin(t) * qy + W / 2);
  const sy = Math.round(-Math.sin(t) * qx + Math.cos(t) * qy + H / 2);
  let R = 0; let G = 0; let B = 0; let n = 0;
  for (let y = sy - 2; y <= sy + 2; y++) {
    for (let x = sx - 2; x <= sx + 2; x++) {
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      const i = (y * W + x) * 4;
      R += data[i]; G += data[i + 1]; B += data[i + 2]; n++;
    }
  }
  if (!n) return;
  const wb = wbFromNeutral(R / n, G / n, B / n);
  im.params.temperature = wb.temperature;
  im.params.tint = wb.tint;
  togglePicking(false);
  syncUI();
  scheduleRender();
  commit('Balance de blancos (gotero)');
});

$('#tColor').onclick = () => { const im = cur(); if (!im) return; im.params.monochrome = false; syncUI(); scheduleRender(); commit('Color'); };
$('#tBw').onclick = () => { const im = cur(); if (!im) return; im.params.monochrome = true; syncUI(); scheduleRender(); commit('Blanco y negro'); };

// Antes / después
function setBefore(on) {
  if (state.before === on) return;
  state.before = on;
  $('#beforeBtn').classList.toggle('on', on);
  scheduleRender();
}
const bb = $('#beforeBtn');
bb.addEventListener('pointerdown', () => setBefore(true));
['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => bb.addEventListener(ev, () => setBefore(false)));

// Vista 1:1
async function toggleZoom() {
  if (!state.full) return;
  state.fullMode = !state.fullMode;
  $('#zoomBtn').classList.toggle('on', state.fullMode);
  $('#stage').classList.toggle('full', state.fullMode);
  setStatus(state.fullMode ? 'Cargando resolución completa…' : '');
  await loadEngineSource();
  renderNow();
  const im = cur();
  setStatus(`${im.name} · ${im.width}×${im.height}${state.fullMode ? ' · 100%' : ''}`);
}
$('#zoomBtn').onclick = toggleZoom;

// Recorte
const cropOverlay = new CropOverlay($('#cropLayer'), (c, final) => {
  const im = cur();
  im.params.crop = { ...im.params.crop, x: c.x, y: c.y, w: c.w, h: c.h };
  if (final) commit('Recorte');
});

function enterCrop() {
  const im = cur();
  if (!im || !engine.src) return;
  state.cropMode = true;
  $('#cropBtn').classList.add('on');
  $('#cropPanel').open = true;
  cropOverlay.show(im.params.crop, engine.src.w, engine.src.h, currentRatio());
  scheduleRender();
}
function exitCrop(render = true) {
  if (!state.cropMode) return;
  state.cropMode = false;
  $('#cropBtn').classList.remove('on');
  cropOverlay.hide();
  if (render) scheduleRender();
}
$('#cropBtn').onclick = () => (state.cropMode ? exitCrop() : enterCrop());
$('#cropDone').onclick = () => exitCrop();
$('#cropReset').onclick = () => {
  const im = cur();
  if (!im) return;
  im.params.crop = defaultParams().crop;
  syncUI();
  if (state.cropMode) cropOverlay.show(im.params.crop, engine.src.w, engine.src.h, null);
  scheduleRender();
  commit('Recorte restablecido');
};

async function applyRotation(im, delta) {
  const full = await rotateQuarter(state.full, delta);
  state.full = full;
  if (state.preview) state.preview.close();
  state.preview = null;
  im.width = full.width;
  im.height = full.height;
  await loadEngineSource();
  analyzeOriginal(im);
  if (state.cropMode) cropOverlay.show(im.params.crop, engine.src.w, engine.src.h, currentRatio());
}

async function rotate(delta) {
  const im = cur();
  if (!im || !state.full) return;
  im.params.rotate = (((im.params.rotate || 0) + delta) % 4 + 4) % 4;
  im.params.crop = { ...defaultParams().crop, aspect: im.params.crop.aspect };
  await applyRotation(im, delta);
  syncUI();
  scheduleRender();
  commit(delta > 0 ? 'Girar 90° derecha' : 'Girar 90° izquierda');
  renderMeta();
}
$('#rotL').onclick = () => rotate(-1);
$('#rotR').onclick = () => rotate(1);

// Copiar / pegar / sincronizar / restablecer
function settingsOnly(p) {
  const c = clone(p);
  delete c.crop;
  delete c.rotate;
  return c;
}
function copySettings() {
  const im = cur();
  if (!im) return;
  state.clipboard = settingsOnly(im.params);
  toast('Ajustes copiados (sin recorte).');
}
function pasteSettings() {
  const im = cur();
  if (!im || !state.clipboard) return;
  im.params = applyPatch(im.params, state.clipboard);
  syncUI();
  scheduleRender();
  commit('Pegar ajustes');
}
$('#copyBtn').onclick = copySettings;
$('#pasteBtn').onclick = pasteSettings;
$('#syncBtn').onclick = () => {
  const im = cur();
  const targets = state.images.filter((x) => x.selected && x !== im);
  if (!im || !targets.length) {
    toast('Selecciona otras fotos en la tira (Ctrl/Cmd + clic o Shift + clic) para sincronizar.');
    return;
  }
  const s = settingsOnly(im.params);
  for (const t of targets) {
    t.params = applyPatch(t.params, s);
    if (t.history) {
      t.history = t.history.slice(0, t.hIndex + 1);
      t.history.push({ label: `Sincronizado desde ${im.name}`, params: clone(t.params) });
      t.hIndex = t.history.length - 1;
    }
    saveImage(t);
    updateThumb(t);
  }
  toast(`Ajustes sincronizados con ${targets.length} foto(s).`);
};
$('#resetBtn').onclick = () => {
  const im = cur();
  if (!im) return;
  const prevRotate = im.params.rotate || 0;
  im.params = defaultParams();
  commit('Restablecer');
  afterParamsReplaced(prevRotate);
};
$('#undoBtn').onclick = () => { const im = cur(); if (im) goHistory(im.hIndex - 1); };
$('#redoBtn').onclick = () => { const im = cur(); if (im) goHistory(im.hIndex + 1); };

// ---------------------------------------------------------------- tira y biblioteca
const stars = (n) => (n ? '★'.repeat(n) : '');
const flagIcon = (f) => (f === 1 ? '⚑' : f === -1 ? '✕' : '');

function passesFilter(im) {
  const f = $('#filter').value;
  if (f === 'all') return true;
  if (f === 'picks') return im.flag === 1;
  if (f === 'norej') return im.flag !== -1;
  return im.rating >= Number(f);
}

function renderStrip() {
  const strip = $('#filmstrip');
  strip.innerHTML = '';
  state.images.forEach((im, i) => {
    const d = document.createElement('div');
    d.className = 'thumb';
    d.dataset.i = i;
    d.title = im.name;
    d.onclick = (e) => onThumbClick(i, e);
    strip.appendChild(d);
    updateThumb(im);
  });
  const c = strip.querySelector('.current');
  if (c) c.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}

function updateThumb(im) {
  const i = state.images.indexOf(im);
  const d = document.querySelector(`#filmstrip .thumb[data-i="${i}"]`);
  if (d) {
    d.className = `thumb${i === state.cur ? ' current' : ''}${im.selected ? ' selected' : ''}${im.flag === -1 ? ' rejected' : ''}`;
    d.innerHTML = (im.thumb ? `<img src="${im.thumb}" alt="">` : `<span class="muted small">${im.error ? '⚠' : '…'}</span>`) +
      `<span class="badge">${stars(im.rating)}</span><span class="flag">${flagIcon(im.flag)}</span>` +
      (isEdited(im.params) ? '<span class="edited"></span>' : '');
  }
  if (state.view === 'library') renderGrid();
}

function onThumbClick(i, e) {
  const im = state.images[i];
  if (e.metaKey || e.ctrlKey) {
    im.selected = !im.selected;
    state.anchor = i;
    updateThumb(im);
    return;
  }
  if (e.shiftKey && state.anchor >= 0) {
    const [a, b] = [Math.min(state.anchor, i), Math.max(state.anchor, i)];
    state.images.forEach((x, j) => { x.selected = j >= a && j <= b; });
    renderStrip();
    return;
  }
  state.images.forEach((x) => { x.selected = false; });
  im.selected = true;
  state.anchor = i;
  open(i);
}

function renderGrid() {
  if (state.view !== 'library') return;
  const grid = $('#grid');
  grid.innerHTML = '';
  const shown = state.images.filter(passesFilter);
  $('#libCount').textContent = `${shown.length} de ${state.images.length} fotos`;
  for (const im of shown) {
    const i = state.images.indexOf(im);
    const d = document.createElement('div');
    d.className = `cell${i === state.cur ? ' current' : ''}${im.flag === -1 ? ' rejected' : ''}`;
    const e = im.exif || {};
    d.innerHTML = `<div class="img">${im.thumb ? `<img src="${im.thumb}" alt="">` : '…'}</div>` +
      `<div class="stars">${stars(im.rating) || '<span class="muted">☆☆☆☆☆</span>'} ${flagIcon(im.flag)}</div>` +
      `<div class="name">${escapeHtml(im.name)}${e.iso ? ` · ISO ${e.iso}` : ''}${e.fNumber ? ` · f/${e.fNumber}` : ''}</div>`;
    d.onclick = () => { state.cur = i; renderGrid(); renderStrip(); };
    d.ondblclick = () => { setView('develop'); open(i); };
    grid.appendChild(d);
  }
}
$('#filter').onchange = renderGrid;

function setView(v) {
  state.view = v;
  $$('.modules button').forEach((b) => b.classList.toggle('on', b.dataset.view === v));
  $('#library').hidden = v !== 'library';
  $('#stage').hidden = v === 'library';
  $('#toolbar').hidden = v === 'library';
  if (v === 'library') renderGrid();
  else if (state.cur >= 0 && !engine.src) open(state.cur);
}
$$('.modules button').forEach((b) => { b.onclick = () => setView(b.dataset.view); });

function rate(n) {
  const im = cur();
  if (!im) return;
  im.rating = n;
  saveImage(im);
  updateThumb(im);
  toast(n ? `Calificación: ${stars(n)}` : 'Sin calificación', 900);
}
function flag(f) {
  const im = cur();
  if (!im) return;
  im.flag = f;
  saveImage(im);
  updateThumb(im);
  toast(f === 1 ? 'Marcada como elegida' : f === -1 ? 'Marcada como rechazada' : 'Sin marca', 900);
}

// ---------------------------------------------------------------- exportar
$('#exQuality').oninput = () => { $('#exQualityOut').value = $('#exQuality').value; };
function exportScopeList() {
  const scope = $('#exScope').value;
  if (scope === 'current') return cur() ? [cur()] : [];
  if (scope === 'selected') {
    const sel = state.images.filter((x) => x.selected);
    return sel.length ? sel : [cur()].filter(Boolean);
  }
  return state.images.filter(passesFilter);
}
function updateExportInfo() {
  const im = cur();
  if (!im) return;
  const list = exportScopeList();
  const long = Number($('#exSize').value) || Math.round(Math.max(im.params.crop.w * im.width, im.params.crop.h * im.height));
  const out = Math.round(long * Number($('#exSuper').value));
  $('#exInfo').textContent = `${list.length} foto(s). Foto actual: ~${out} px de lado largo.` +
    (Number($('#exSuper').value) > 1 ? ' La súper resolución multiplica el tamaño elegido.' : '');
}
['#exScope', '#exSize', '#exSuper'].forEach((s) => { $(s).onchange = updateExportInfo; });

function openExport() {
  if (!cur()) return;
  updateExportInfo();
  $('#exProgress').hidden = true;
  $('#exportDlg').showModal();
}
$('#exportBtn').onclick = openExport;

$('#exGo').onclick = async (e) => {
  e.preventDefault();
  const list = exportScopeList();
  const opts = {
    type: $('#exFormat').value,
    quality: Number($('#exQuality').value) / 100,
    longEdge: Number($('#exSize').value),
    superRes: Number($('#exSuper').value),
    sharp: $('#exSharp').value,
    exif: $('#exExif').checked,
    suffix: $('#exSuffix').value,
  };
  const prog = $('#exProgress');
  prog.hidden = false;
  prog.max = list.length;
  prog.value = 0;
  $('#exGo').disabled = true;
  try {
    const saved = await exportImages(list, opts, (n) => { prog.value = n; });
    $('#exportDlg').close();
    if (isNative) {
      const where = saved.find((x) => x.where)?.where;
      toast(where ? `Guardadas en ${where}. Elige dónde compartirlas…` : 'Listas. Elige dónde guardarlas…', 4000);
      await shareFiles(saved.map((x) => x.uri));
    } else {
      toast(`Exportadas ${list.length} foto(s).`);
    }
  } catch (err) {
    console.error(err);
    toast(`Error al exportar: ${err.message}. Prueba un tamaño menor.`, 6000);
  } finally {
    $('#exGo').disabled = false;
  }
};

async function exportImages(list, opts, onProgress) {
  const canvas = document.createElement('canvas');
  const eng = new Engine(canvas, { preserve: true });
  const ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[opts.type];
  const saved = [];
  try {
    for (let n = 0; n < list.length; n++) {
      const im = list[n];
      const info = im.info || (im.info = await inspect(im.file));
      let bmp;
      if (im === cur() && state.full) {
        bmp = await createImageBitmap(state.full);
      } else {
        bmp = await rotateQuarter(await decodeFull(im.file, info), im.params.rotate || 0);
      }
      const fullW = bmp.width;
      const fullH = bmp.height;
      const p = clone(im.params);
      if (opts.sharp !== 'keep') p.outputSharpen = Number(opts.sharp);
      const cropLong = Math.max(p.crop.w * fullW, p.crop.h * fullH);
      const targetLong = (opts.longEdge && opts.longEdge < cropLong ? opts.longEdge : cropLong) * opts.superRes;
      // Si la salida es mucho menor, reducimos antes con buena calidad (evita aliasing).
      const srcScale = targetLong / cropLong;
      if (srcScale < 0.75) {
        const r = await downscale(bmp, Math.max(fullW, fullH) * srcScale);
        if (r !== bmp) bmp.close();
        bmp = r;
      } else if (Math.max(fullW, fullH) > eng.maxTex) {
        const r = await downscale(bmp, eng.maxTex);
        bmp.close();
        bmp = r;
      }
      eng.setSource(bmp, fullW);
      bmp.close();
      const base = eng.outputSize(p);
      let s = targetLong / Math.max(base.width, base.height);
      s = Math.min(s, eng.maxTex / Math.max(base.width, base.height));
      const width = Math.max(1, Math.round(base.width * s));
      const height = Math.max(1, Math.round(base.height * s));
      canvas.width = width;
      canvas.height = height;
      eng.render(p, { width, height });
      let blob = await new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('sin memoria'))), opts.type, opts.quality));
      if (opts.exif && info.app1) blob = await withExif(blob, info.app1);
      const fname = `${im.name.replace(/\.[^.]+$/, '')}${opts.suffix || ''}.${ext}`;
      if (isNative) saved.push(await saveNative(blob, fname));
      else download(blob, fname);
      onProgress(n + 1);
      await new Promise((r) => setTimeout(r, 250)); // deja respirar al navegador entre descargas
    }
  } finally {
    eng.dispose();
  }
  return saved;
}

function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
}

// ---------------------------------------------------------------- entrada
$('#fileInput').onchange = (e) => { importFiles(e.target.files); e.target.value = ''; };
$('#fileInput2').onchange = (e) => { importFiles(e.target.files); e.target.value = ''; };
$('#dirInput').onchange = (e) => { importFiles(e.target.files); e.target.value = ''; };
$('#helpBtn').onclick = () => $('#helpDlg').showModal();

const drop = $('#drop');
window.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('hover'); });
window.addEventListener('dragleave', (e) => { if (!e.relatedTarget) drop.classList.remove('hover'); });
window.addEventListener('drop', (e) => {
  e.preventDefault();
  drop.classList.remove('hover');
  if (e.dataTransfer.files.length) importFiles(e.dataTransfer.files);
});

window.addEventListener('keydown', (e) => {
  if (e.target.matches('input[type=text], input[type=password], textarea') || $('dialog[open]')) return;
  const mod = e.ctrlKey || e.metaKey;
  const k = e.key.toLowerCase();
  if (mod && k === 'z') { e.preventDefault(); (e.shiftKey ? $('#redoBtn') : $('#undoBtn')).click(); return; }
  if (mod && k === 'y') { e.preventDefault(); $('#redoBtn').click(); return; }
  if (mod && k === 'c') { e.preventDefault(); copySettings(); return; }
  if (mod && k === 'v') { e.preventDefault(); pasteSettings(); return; }
  if (mod && k === 'e') { e.preventDefault(); openExport(); return; }
  if (mod) return;
  if (e.key === 'ArrowRight' && state.cur < state.images.length - 1) open(state.cur + 1);
  else if (e.key === 'ArrowLeft' && state.cur > 0) open(state.cur - 1);
  else if (/^[0-5]$/.test(e.key)) rate(Number(e.key));
  else if (k === 'p') flag(1);
  else if (k === 'x') flag(-1);
  else if (k === 'u') flag(0);
  else if (e.key === '\\') setBefore(true);
  else if (k === 'r') (state.cropMode ? exitCrop() : enterCrop());
  else if (k === 'z') toggleZoom();
  else if (k === 'w') togglePicking();
  else if (k === 'a' && e.shiftKey) autoToneNow();
  else if (k === 'g') setView('library');
  else if (k === 'd') setView('develop');
  else if (e.key === 'Escape') { exitCrop(); togglePicking(false); }
  else return;
  e.preventDefault();
});
window.addEventListener('keyup', (e) => { if (e.key === '\\') setBefore(false); });

// ---------------------------------------------------------------- arranque
if (isNative) {
  document.body.classList.add('native');
  // Android no reconoce la extensión .cr3: sin filtro el selector muestra todo.
  ['#fileInput', '#fileInput2'].forEach((s) => $(s).removeAttribute('accept'));
}
buildControls();
renderPresets();

if (!isNative && 'serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

// Para pruebas automatizadas.
window.__revela = { state, engine, importFiles, open };
