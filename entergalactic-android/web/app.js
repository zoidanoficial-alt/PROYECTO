/* ENTERGALACTIC móvil — interfaz. El procesado ocurre en worker.js. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var STORE = 'eg-mobile-v1';
  var SCHEMA, FILTERS = {}, worker, file = null, loaded = false;
  var D = window.EGDevelop;
  var state = { module: 'develop', stacks: {}, chosen: {}, intensity: 100, exportSize: 4096, dev: null, devOpen: { basic: true } };
  var devUI = { channel: 'rgb', hslColor: 'orange' };
  var pv = { inflight: false, pending: null, seq: 0 };
  var thumbs = {}, openCards = {}, saving = false;

  function el(tag, attrs, kids) {
    var e = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === 'text') e.textContent = attrs[k];
      else if (k === 'cls') e.className = attrs[k];
      else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), attrs[k]);
      else e.setAttribute(k, attrs[k]);
    });
    (kids || []).forEach(function (c) { if (c) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return e;
  }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function save() { try { localStorage.setItem(STORE, JSON.stringify(state)); } catch (e) { /* sin almacenamiento */ } }
  function load() {
    try { var s = JSON.parse(localStorage.getItem(STORE) || 'null'); if (s) Object.keys(s).forEach(function (k) { state[k] = s[k]; }); } catch (e) { /* nada */ }
  }
  function status(msg, err) { $('status').textContent = msg || ''; $('status').className = 'status' + (err ? ' error' : ''); }
  function stack() { return state.stacks[state.module] || []; }
  // El look activo es el del último módulo de looks visitado (el revelado va siempre antes).
  function lookStack() {
    var m = state.module === 'develop' ? state.lastLook : state.module;
    if (!m || state.lookOff) return [];
    return state.stacks[m] || [];
  }
  function presetsOf(mod) { return SCHEMA.presets.filter(function (p) { return p.module === mod; }); }

  // ------------------------------------------------------------------ arranque
  fetch('schema.json').then(function (r) { return r.json(); }).then(function (s) {
    SCHEMA = s;
    s.filters.forEach(function (f) { FILTERS[f.id] = f; });
    load();
    var dd = D.defaults();
    state.dev = state.dev ? Object.assign(dd, state.dev) : dd;
    s.modules.forEach(function (m) {
      if (!state.stacks[m.id]) {
        var first = presetsOf(m.id)[0];
        state.stacks[m.id] = first ? clone(first.stack) : [];
        state.chosen[m.id] = first ? first.name : '';
      }
    });
    if (state.module !== 'develop' && !s.modules.some(function (m) { return m.id === state.module; })) state.module = 'develop';
    worker = new Worker('worker.js');
    worker.onmessage = onWorker;
    worker.postMessage({ type: 'init', schema: s });
    renderAll();
    bind();
  }).catch(function (e) { status('No se pudo iniciar: ' + e.message, true); });

  // ------------------------------------------------------------------ mensajes del worker
  function paint(canvas, m) {
    canvas.width = m.w; canvas.height = m.h;
    canvas.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(m.rgba), m.w, m.h), 0, 0);
  }
  function onWorker(ev) {
    var m = ev.data;
    if (m.type === 'loaded') {
      loaded = true; thumbs = {};
      $('viewer').classList.remove('empty');
      $('btnSave').disabled = false;
      worker.postMessage({ type: 'original', size: previewSize() });
      requestPreview(false);
      requestThumbs();
      status(m.w + ' × ' + m.h + ' px');
    } else if (m.type === 'original') {
      paint($('orig'), m);
    } else if (m.type === 'preview') {
      paint($('canvas'), m);
      if (m.hist) drawHisto(m.hist);
      pv.inflight = false;
      $('busy').classList.toggle('hidden', !pv.pending);
      if (!saving) status((m.draft ? 'Vista rápida' : 'Vista previa') + ' · ' + m.ms + ' ms');
      pump();
    } else if (m.type === 'thumb') {
      var c = document.createElement('canvas');
      paint(c, m);
      thumbs[m.key] = c.toDataURL('image/jpeg', 0.8);
      var chip = document.querySelector('.chip[data-key="' + CSS.escape(m.key) + '"] .th');
      if (chip) chip.style.backgroundImage = 'url(' + thumbs[m.key] + ')';
    } else if (m.type === 'auto') {
      ['exposure', 'contrast', 'highlights', 'shadows', 'whites', 'blacks', 'vibrance'].forEach(function (k) { state.dev[k] = m.settings[k]; });
      renderDevelop(); devCommit();
      status('Ajuste automático aplicado');
    } else if (m.type === 'progress') {
      status('Guardando… ' + Math.round(m.f * 100) + '% · ' + m.label);
    } else if (m.type === 'exported') {
      deliver(m.blob, m.w, m.h);
    } else if (m.type === 'error') {
      pv.inflight = false; saving = false;
      $('busy').classList.add('hidden');
      $('btnSave').disabled = !loaded;
      status(m.message, true);
      pump();
    }
  }

  // ------------------------------------------------------------------ vista previa
  function previewSize() {
    var w = $('viewer').clientWidth * (window.devicePixelRatio || 1);
    return Math.max(480, Math.min(900, Math.round(w)));
  }
  function requestPreview(draft) {
    if (!loaded) return;
    var prev = pv.pending;
    pv.pending = { draft: draft && !(prev && !prev.draft) };
    pump();
  }
  function pump() {
    if (pv.inflight || !pv.pending) return;
    var o = pv.pending;
    pv.pending = null; pv.inflight = true;
    $('busy').classList.remove('hidden');
    var size = previewSize();
    worker.postMessage({ type: 'preview', id: ++pv.seq, draft: o.draft, size: o.draft ? Math.round(size * 0.45) : size,
      recipe: { stack: lookStack() }, intensity: state.intensity, dev: state.dev });
  }
  var liveTimer = null, lastLive = 0;
  function live() {
    var now = Date.now();
    clearTimeout(liveTimer);
    if (now - lastLive > 50) { lastLive = now; requestPreview(true); }
    liveTimer = setTimeout(function () { requestPreview(true); }, 60);
  }
  // Al confirmar un cambio: primero una vista rápida (respuesta inmediata) y después la definitiva.
  function commit() { clearTimeout(liveTimer); save(); requestPreview(true); requestPreview(false); }
  function requestThumbs() {
    if (!loaded) return;
    var items = presetsOf(state.module).filter(function (p) { return !thumbs[p.name]; })
      .map(function (p) { return { key: p.name, recipe: { stack: p.stack } }; });
    if (items.length) worker.postMessage({ type: 'thumbs', items: items, dev: state.dev });
  }

  // ------------------------------------------------------------------ abrir y guardar
  function openFile(f) {
    if (!f) return;
    file = f;
    status('Abriendo…');
    decode(f).then(function (bmp) {
      worker.postMessage({ type: 'load', bitmap: bmp }, [bmp]);
    }).catch(function (e) { status('No se pudo abrir la foto: ' + e.message, true); });
  }
  function decode(f) {
    var maxSide = Number(state.exportSize) || 0;
    return createImageBitmap(f, { imageOrientation: 'from-image' }).catch(function () { return createImageBitmap(f); })
      .then(function (bmp) {
        var s = maxSide ? Math.min(1, maxSide / Math.max(bmp.width, bmp.height)) : 1;
        if (s >= 1) return bmp;
        return createImageBitmap(bmp, { resizeWidth: Math.round(bmp.width * s), resizeHeight: Math.round(bmp.height * s), resizeQuality: 'high' })
          .then(function (b2) { bmp.close && bmp.close(); return b2; });
      });
  }
  function doSave() {
    if (!loaded || saving) return;
    saving = true;
    $('btnSave').disabled = true;
    status('Guardando…');
    worker.postMessage({ type: 'export', recipe: { stack: lookStack() }, intensity: state.intensity, dev: state.dev, quality: 0.95 });
  }
  function deliver(blob, w, h) {
    var name = 'ENTERGALACTIC_' + new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14) + '.jpg';
    var done = function (msg, err) { saving = false; $('btnSave').disabled = false; status(msg, err); };
    if (!window.Android) {   // navegador: descarga normal
      var a = el('a', { href: URL.createObjectURL(blob), download: name });
      document.body.appendChild(a); a.click(); a.remove();
      return done('Descargada ' + name + ' (' + w + '×' + h + ')');
    }
    // Android: se envía en trozos (múltiplos de 3 bytes para que el base64 encaje) al puente nativo.
    var CH = 3 * 262144, off = 0;
    var r0 = Android.saveBegin(name);
    if (r0 !== 'OK') return done(r0.replace(/^ERR\|/, ''), true);
    (function next() {
      if (off >= blob.size) {
        var r = Android.saveEnd();
        return r.indexOf('OK') === 0 ? done('Guardada en Galería › ENTERGALACTIC (' + w + '×' + h + ')') : done(r.replace(/^ERR\|/, ''), true);
      }
      var fr = new FileReader();
      fr.onload = function () {
        Android.saveChunk(String(fr.result).split(',')[1]);
        off += CH;
        status('Guardando… ' + Math.min(100, Math.round(off / blob.size * 100)) + '%');
        setTimeout(next, 0);
      };
      fr.onerror = function () { Android.saveAbort(); done('No se pudo leer la imagen', true); };
      fr.readAsDataURL(blob.slice(off, off + CH));
    })();
  }

  // ------------------------------------------------------------------ interfaz
  function renderTabs() {
    var t = $('tabs');
    t.innerHTML = '';
    var devBtn = el('button', { cls: state.module === 'develop' ? 'on' : '', onclick: function () {
      state.module = 'develop'; save(); renderAll();
    } }, ['Revelado']);
    if (!D.isNeutral(state.dev)) devBtn.appendChild(el('span', { cls: 'live', title: 'Revelado activo' }));
    t.appendChild(devBtn);
    SCHEMA.modules.forEach(function (m) {
      t.appendChild(el('button', { cls: m.id === state.module ? 'on' : '', text: m.name, onclick: function () {
        state.module = m.id; state.lastLook = m.id; state.lookOff = false; save(); renderAll(); requestPreview(false); requestThumbs();
      } }));
    });
  }
  function renderPresets() {
    var strip = $('presetStrip');
    strip.innerHTML = '';
    presetsOf(state.module).forEach(function (p) {
      var th = el('span', { cls: 'th' });
      if (thumbs[p.name]) th.style.backgroundImage = 'url(' + thumbs[p.name] + ')';
      strip.appendChild(el('button', { cls: 'chip' + (state.chosen[state.module] === p.name ? ' on' : ''), 'data-key': p.name, onclick: function () {
        state.stacks[state.module] = clone(p.stack);
        state.chosen[state.module] = p.name;
        openCards = {};
        save(); renderPresets(); renderStack(); requestPreview(true); requestPreview(false);
      } }, [th, el('span', { cls: 'nm', text: p.name })]));
    });
    var cur = presetsOf(state.module).filter(function (p) { return p.name === state.chosen[state.module]; })[0];
    $('presetDesc').textContent = cur && cur.desc ? cur.desc : '';
    $('presetDesc').classList.toggle('hidden', !(cur && cur.desc));
  }
  function fmt(p, v) {
    if (p.type === 'hue') return Math.round(v) + '°';
    return (p.step && p.step < 1 ? Number(v).toFixed(1) : Math.round(v)) + (p.unit === '%' ? '%' : p.unit === '°' ? '°' : '');
  }
  function rangeCtl(p, v, set) {
    var out = el('span', { text: fmt(p, v) });
    var inp = el('input', { type: 'range', min: p.min, max: p.max, step: p.step || 1, value: v });
    if (p.type === 'hue') inp.className = 'hue';
    inp.addEventListener('input', function () { out.textContent = fmt(p, +inp.value); set(+inp.value); live(); });
    inp.addEventListener('change', commit);
    return el('div', { cls: 'param' }, [el('div', { cls: 'lbl' }, [el('span', { text: p.label }), out]), inp]);
  }
  function selectCtl(label, opts, v, set) {
    var s = el('select');
    opts.forEach(function (o) { s.appendChild(el('option', { value: o[0], text: o[1] })); });
    s.value = v;
    s.addEventListener('change', function () { set(s.value); commit(); });
    return el('div', { cls: 'param' }, [el('div', { cls: 'lbl' }, [el('span', { text: label })]), s]);
  }
  function checkCtl(label, v, set) {
    var c = el('input', { type: 'checkbox' });
    c.checked = !!v;
    c.addEventListener('change', function () { set(c.checked); commit(); });
    return el('label', { cls: 'param chk' }, [c, label]);
  }
  function card(item, i, n) {
    var f = FILTERS[item.id], key = i + ':' + item.id;
    var cd = el('div', { cls: 'card' + (item.enabled === false ? ' off' : '') + (openCards[key] ? ' open' : '') });
    var en = el('input', { type: 'checkbox' });
    en.checked = item.enabled !== false;
    en.addEventListener('click', function (e) { e.stopPropagation(); });
    en.addEventListener('change', function () { item.enabled = en.checked; state.chosen[state.module] = ''; renderStack(); commit(); });
    var act = function (t, fn, dis) {
      var b = el('button', { text: t });
      b.disabled = !!dis;
      b.addEventListener('click', function (e) { e.stopPropagation(); fn(); });
      return b;
    };
    var st = stack();
    var head = el('div', { cls: 'card-head' }, [en, el('span', { cls: 'name', text: f ? f.name : item.id }),
      act('▲', function () { var t = st[i]; st[i] = st[i - 1]; st[i - 1] = t; renderStack(); commit(); }, i === 0),
      act('▼', function () { var t = st[i]; st[i] = st[i + 1]; st[i + 1] = t; renderStack(); commit(); }, i === n - 1),
      act('✕', function () { st.splice(i, 1); renderStack(); commit(); })]);
    head.addEventListener('click', function () { openCards[key] = !openCards[key]; cd.classList.toggle('open'); });
    cd.appendChild(head);
    if (!f) return cd;
    var body = el('div', { cls: 'card-body' }, [el('p', { cls: 'muted small', text: f.desc })]);
    item.params = item.params || {};
    f.params.forEach(function (p) {
      var v = item.params[p.id] !== undefined ? item.params[p.id] : p['default'];
      var set = function (x) { item.params[p.id] = x; state.chosen[state.module] = ''; };
      if (p.type === 'range' || p.type === 'hue') body.appendChild(rangeCtl(p, v, set));
      else if (p.type === 'select') body.appendChild(selectCtl(p.label, p.options, v, set));
      else if (p.type === 'check') body.appendChild(checkCtl(p.label, v, set));
    });
    body.appendChild(rangeCtl({ label: 'Opacidad', min: 0, max: 100, step: 1, unit: '%' }, item.opacity === undefined ? 100 : item.opacity,
      function (x) { item.opacity = x; }));
    if (!f.resizes) {
      body.appendChild(selectCtl('Fusión', SCHEMA.blend_modes.map(function (b) { return [b.id, b.name]; }), item.blend || 'normal',
        function (x) { item.blend = x; }));
      item.mask = item.mask || { type: 'all' };
      var mk = item.mask;
      body.appendChild(selectCtl('Aplicar a', SCHEMA.mask_types.map(function (m) { return [m.id, m.name]; }), mk.type || 'all',
        function (x) { mk.type = x; setTimeout(renderStack, 0); }));
      if (mk.type === 'color') {
        body.appendChild(rangeCtl({ label: 'Color', type: 'hue', min: 0, max: 360 }, mk.hue === undefined ? 30 : mk.hue, function (x) { mk.hue = x; }));
        body.appendChild(rangeCtl({ label: 'Amplitud', min: 10, max: 120, step: 1, unit: '°' }, mk.width === undefined ? 40 : mk.width, function (x) { mk.width = x; }));
      }
      if (mk.type && mk.type !== 'all') {
        body.appendChild(rangeCtl({ label: 'Suavidad', min: 0, max: 100, step: 1 }, mk.softness === undefined ? 50 : mk.softness, function (x) { mk.softness = x; }));
        body.appendChild(checkCtl('Invertir máscara', mk.invert, function (x) { mk.invert = x; }));
      }
    }
    cd.appendChild(body);
    return cd;
  }
  function renderStack() {
    var st = stack(), box = $('stack');
    box.innerHTML = '';
    st.forEach(function (it, i) { box.appendChild(card(it, i, st.length)); });
    $('stackCount').textContent = '(' + st.length + '/' + SCHEMA.max_stack + ')';
    $('btnAdd').disabled = st.length >= SCHEMA.max_stack;
    var sel = $('addFilter');
    sel.innerHTML = '';
    SCHEMA.filters.filter(function (f) { return f.modules.indexOf(state.module) >= 0; })
      .forEach(function (f) { sel.appendChild(el('option', { value: f.id, text: f.name })); });
  }
  function renderAll() {
    var isDev = state.module === 'develop';
    Array.prototype.forEach.call(document.querySelectorAll('.looks-only'), function (e) { e.classList.toggle('hidden', isDev); });
    $('develop').classList.toggle('hidden', !isDev);
    renderTabs();
    if (isDev) renderDevelop(); else { renderPresets(); renderStack(); }
    $('intensity').value = state.intensity; $('intOut').textContent = state.intensity;
    $('exportSize').value = String(state.exportSize);
  }

  // ------------------------------------------------------------------ Revelado
  function fmtDev(p, v) {
    if (p.unit === 'EV') return (v > 0 ? '+' : '') + Number(v).toFixed(2);
    if (p.track === 'hue') return Math.round(v) + '°';
    if (p.step && p.step < 1) return (v > 0 && p.min < 0 ? '+' : '') + Number(v).toFixed(1) + (p.unit || '');
    return (v > 0 && p.min < 0 ? '+' : '') + Math.round(v) + (p.unit === '%' ? '%' : '');
  }
  function devSlider(p, get, set) {
    var v = get(), out = el('b', { text: fmtDev(p, v), cls: v !== p.def ? 'changed' : '' });
    var inp = el('input', { type: 'range', min: p.min, max: p.max, step: p.step || 1, value: v });
    if (p.track) inp.className = p.track;
    var upd = function (x) { set(x); out.textContent = fmtDev(p, x); out.className = x !== p.def ? 'changed' : ''; };
    inp.addEventListener('input', function () { upd(+inp.value); live(); });
    inp.addEventListener('change', devCommit);
    // doble toque: valor por defecto
    inp.addEventListener('dblclick', function () { inp.value = p.def; upd(p.def); devCommit(); });
    return el('div', { cls: 'dslider' }, [el('div', { cls: 'lbl' }, [el('span', { text: p.label }), out]), inp]);
  }
  function devCommit() {
    thumbs = {};
    save(); renderTabs(); commit();
  }
  function resetSection(sec) {
    var d = D.defaults();
    if (sec.custom === 'curve') state.dev.curve = d.curve;
    else if (sec.custom === 'hsl') state.dev.hsl = d.hsl;
    else sec.params.forEach(function (p) { state.dev[p.id] = d[p.id]; });
    renderDevelop(); devCommit();
  }
  function renderDevelop() {
    var box = $('develop');
    box.innerHTML = '';
    var hc = el('canvas', { id: 'histo' });
    box.appendChild(el('div', { cls: 'histo' }, [hc, el('span', { cls: 'info', id: 'histoInfo', text: '' })]));
    box.appendChild(el('div', { cls: 'dev-bar' }, [
      el('button', { cls: 'btn ghost', text: '✦ Auto', onclick: function () { if (loaded) worker.postMessage({ type: 'auto' }); } }),
      el('button', { cls: 'btn', text: 'Restablecer todo', onclick: function () { state.dev = D.defaults(); renderDevelop(); devCommit(); } })]));
    D.SECTIONS.forEach(function (sec) {
      var det = el('details', { cls: 'dsec' });
      if (state.devOpen[sec.id]) det.open = true;
      det.addEventListener('toggle', function () { state.devOpen[sec.id] = det.open; save(); if (det.open && sec.custom === 'curve') drawCurve(); });
      var reset = el('span', { cls: 'reset', text: 'Restablecer' });
      reset.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); resetSection(sec); });
      det.appendChild(el('summary', {}, [el('span', { text: sec.name }), reset]));
      if (sec.custom === 'curve') det.appendChild(curveEditor());
      else if (sec.custom === 'hsl') det.appendChild(hslEditor());
      else sec.params.forEach(function (p) {
        if (p.type === 'select') {
          var sel = el('select');
          p.options.forEach(function (o) { sel.appendChild(el('option', { value: o[0], text: o[1] })); });
          sel.value = state.dev[p.id];
          sel.addEventListener('change', function () { state.dev[p.id] = sel.value; devCommit(); });
          det.appendChild(el('div', { cls: 'param' }, [el('div', { cls: 'lbl' }, [el('span', { text: p.label })]), sel]));
        } else det.appendChild(devSlider(p, function () { return state.dev[p.id]; }, function (x) { state.dev[p.id] = x; }));
      });
      box.appendChild(det);
    });
    var lk = lookStack().filter(function (it) { return it.enabled !== false; });
    if (lk.length) {
      var mod = SCHEMA.modules.filter(function (m) { return m.id === state.lastLook; })[0];
      var nm = state.chosen[state.lastLook] || (lk.length + ' filtros');
      box.insertBefore(el('div', { cls: 'desc' }, ['Look aplicado encima: ' + (mod ? mod.name : '') + ' · ' + nm + '  ',
        el('button', { cls: 'link', text: 'Quitar', onclick: function () { state.lookOff = true; save(); renderDevelop(); commit(); } })]), box.children[2]);
    }
    box.appendChild(el('p', { cls: 'dev-note', text: 'El revelado se aplica antes del look que elijas en Cine, Pop, Chroma, Plata o Analógico. Admite JPEG, PNG y HEIC; los archivos RAW (DNG) todavía no se pueden abrir.' }));
    if (lastHist) drawHisto(lastHist);
    setTimeout(drawCurve, 0);
  }
  var lastHist = null;
  function drawHisto(h) {
    lastHist = h;
    var c = $('histo');
    if (!c) return;
    var dpr = window.devicePixelRatio || 1, W = c.clientWidth * dpr, H = c.clientHeight * dpr;
    if (!W) return;
    c.width = W; c.height = H;
    var g = c.getContext('2d'), mx = 1;
    ['r', 'g', 'b'].forEach(function (k) { h[k].forEach(function (v, i) { if (i > 0 && i < 63 && v > mx) mx = v; }); });
    g.globalCompositeOperation = 'lighter';
    [['r', 'rgba(255,70,70,.75)'], ['g', 'rgba(70,255,110,.75)'], ['b', 'rgba(80,140,255,.75)']].forEach(function (cv) {
      g.fillStyle = cv[1]; g.beginPath(); g.moveTo(0, H);
      h[cv[0]].forEach(function (v, i) { g.lineTo(i / 63 * W, H - Math.min(1, v / mx) * H * 0.95); });
      g.lineTo(W, H); g.closePath(); g.fill();
    });
    var lo = h.r[0] + h.g[0] + h.b[0], hi = h.r[63] + h.g[63] + h.b[63], tot = h.r.reduce(function (a, b) { return a + b; }, 0) * 3;
    var info = $('histoInfo');
    if (info) info.textContent = (hi / tot > 0.01 ? '⚠ luces quemadas  ' : '') + (lo / tot > 0.02 ? '⚠ sombras empastadas' : '');
  }

  // Curva de tonos: tocar para añadir un punto, arrastrar para moverlo, sacarlo del recuadro para quitarlo.
  var curveCanvas = null, dragPt = -1;
  function curvePts() { return state.dev.curve[devUI.channel]; }
  function curveEditor() {
    var wrap = el('div', { cls: 'curve-wrap' });
    var chips = el('div', { cls: 'chips' });
    [['rgb', 'RGB'], ['r', 'Rojo'], ['g', 'Verde'], ['b', 'Azul']].forEach(function (c) {
      chips.appendChild(el('button', { cls: devUI.channel === c[0] ? 'on' : '', text: c[1], onclick: function () { devUI.channel = c[0]; renderDevelop(); } }));
    });
    curveCanvas = el('canvas');
    var pos = function (e) {
      var r = curveCanvas.getBoundingClientRect();
      return [(e.clientX - r.left) / r.width, 1 - (e.clientY - r.top) / r.height];
    };
    curveCanvas.addEventListener('pointerdown', function (e) {
      var p = pos(e), pts = curvePts(), best = -1, bd = 0.06;
      pts.forEach(function (q, i) { var d = Math.hypot(q[0] - p[0], q[1] - p[1]); if (d < bd) { bd = d; best = i; } });
      if (best < 0) {
        var lut = D.curveLUT(pts), y = lut ? lut[Math.round(Math.min(1, Math.max(0, p[0])) * 1024)] : p[0];
        pts.push([Math.min(0.99, Math.max(0.01, p[0])), y]);
        pts.sort(function (a, b) { return a[0] - b[0]; });
        best = pts.findIndex(function (q) { return q[1] === y; });
      }
      dragPt = best;
      curveCanvas.setPointerCapture(e.pointerId);
      e.preventDefault(); drawCurve(); live();
    });
    curveCanvas.addEventListener('pointermove', function (e) {
      if (dragPt < 0) return;
      var p = pos(e), pts = curvePts(), last = pts.length - 1, q = pts[dragPt];
      if (dragPt === 0) q[0] = 0; else if (dragPt === last) q[0] = 1;
      else q[0] = Math.min(pts[dragPt + 1][0] - 0.01, Math.max(pts[dragPt - 1][0] + 0.01, p[0]));
      q[1] = Math.min(1, Math.max(0, p[1]));
      q.out = dragPt > 0 && dragPt < last && (p[1] < -0.08 || p[1] > 1.08);
      drawCurve(); live();
    });
    var end = function () {
      if (dragPt < 0) return;
      var pts = curvePts();
      if (pts[dragPt] && pts[dragPt].out) pts.splice(dragPt, 1);
      pts.forEach(function (q) { delete q.out; });
      dragPt = -1; drawCurve(); devCommit();
    };
    curveCanvas.addEventListener('pointerup', end);
    curveCanvas.addEventListener('pointercancel', end);
    wrap.appendChild(chips); wrap.appendChild(curveCanvas);
    wrap.appendChild(el('p', { cls: 'dev-note', text: 'Toca la curva para añadir un punto, arrástralo para moverlo y sácalo del recuadro para quitarlo.' }));
    return wrap;
  }
  function drawCurve() {
    var c = curveCanvas;
    if (!c || !c.isConnected) return;
    var dpr = window.devicePixelRatio || 1, W = c.clientWidth * dpr;
    if (!W) return;
    c.width = W; c.height = W;
    var g = c.getContext('2d'), col = { rgb: '#ffffff', r: '#ff5a5a', g: '#4ade80', b: '#5a9bff' }[devUI.channel];
    g.strokeStyle = 'rgba(255,255,255,.08)'; g.lineWidth = dpr;
    for (var i = 1; i < 4; i++) { g.beginPath(); g.moveTo(i * W / 4, 0); g.lineTo(i * W / 4, W); g.moveTo(0, i * W / 4); g.lineTo(W, i * W / 4); g.stroke(); }
    if (lastHist) {
      var hh = lastHist.r.map(function (v, k) { return v + lastHist.g[k] + lastHist.b[k]; }), mx = Math.max.apply(null, hh.slice(1, 63)) || 1;
      g.fillStyle = 'rgba(139,92,246,.18)'; g.beginPath(); g.moveTo(0, W);
      hh.forEach(function (v, k) { g.lineTo(k / 63 * W, W - Math.min(1, v / mx) * W * 0.6); });
      g.lineTo(W, W); g.fill();
    }
    g.strokeStyle = 'rgba(255,255,255,.2)'; g.beginPath(); g.moveTo(0, W); g.lineTo(W, 0); g.stroke();
    var pts = curvePts(), lut = D.curveLUT(pts.filter(function (q) { return !q.out; }));
    g.strokeStyle = col; g.lineWidth = 2.5 * dpr; g.beginPath();
    for (var x = 0; x <= 256; x++) { var y = lut ? lut[x * 4] : x / 256; if (x === 0) g.moveTo(0, W - y * W); else g.lineTo(x / 256 * W, W - y * W); }
    g.stroke();
    pts.forEach(function (q, k) {
      g.fillStyle = q.out ? '#ff6b81' : (k === dragPt ? col : '#13121a'); g.strokeStyle = col; g.lineWidth = 2 * dpr;
      g.beginPath(); g.arc(q[0] * W, W - q[1] * W, 7 * dpr, 0, Math.PI * 2); g.fill(); g.stroke();
    });
  }

  function hslEditor() {
    var wrap = el('div');
    var chips = el('div', { cls: 'chips' });
    var hex = { red: '#ff3b3b', orange: '#ff8c1a', yellow: '#ffd21a', green: '#3ccf4e', aqua: '#26d6d0', blue: '#2f6bff', purple: '#8b4dff', magenta: '#e83fc8' };
    D.HSL_COLORS.forEach(function (c) {
      var b = el('button', { cls: 'dot' + (devUI.hslColor === c[0] ? ' on' : ''), title: c[1], onclick: function () { devUI.hslColor = c[0]; renderDevelop(); } });
      b.style.background = hex[c[0]];
      chips.appendChild(b);
    });
    wrap.appendChild(chips);
    var name = D.HSL_COLORS.filter(function (c) { return c[0] === devUI.hslColor; })[0][1];
    wrap.appendChild(el('p', { cls: 'dev-note', text: 'Color: ' + name }));
    var v = state.dev.hsl[devUI.hslColor];
    [['h', 'Tono'], ['s', 'Saturación'], ['l', 'Luminancia']].forEach(function (k) {
      wrap.appendChild(devSlider({ id: k[0], label: k[1], min: -100, max: 100, def: 0, step: 1 },
        function () { return v[k[0]]; }, function (x) { v[k[0]] = x; }));
    });
    return wrap;
  }

  function bind() {
    $('file').addEventListener('change', function (e) { openFile(e.target.files[0]); e.target.value = ''; });
    $('file2').addEventListener('change', function (e) { openFile(e.target.files[0]); e.target.value = ''; });
    $('btnSave').addEventListener('click', doSave);
    $('intensity').addEventListener('input', function (e) { state.intensity = +e.target.value; $('intOut').textContent = state.intensity; live(); });
    $('intensity').addEventListener('change', commit);
    $('exportSize').addEventListener('change', function (e) {
      state.exportSize = +e.target.value; save();
      if (file) openFile(file);
    });
    $('btnAdd').addEventListener('click', function () {
      var f = FILTERS[$('addFilter').value], params = {};
      f.params.forEach(function (p) { params[p.id] = p['default']; });
      stack().push({ id: f.id, enabled: true, opacity: 100, blend: 'normal', mask: { type: 'all' }, params: params });
      openCards[(stack().length - 1) + ':' + f.id] = true;
      state.chosen[state.module] = '';
      renderStack(); renderPresets(); commit();
    });
    $('btnClear').addEventListener('click', function () { state.stacks[state.module] = []; state.chosen[state.module] = ''; renderStack(); renderPresets(); commit(); });
    // Mantener pulsado para ver el original
    var v = $('viewer');
    var on = function (e) { if (loaded) { v.classList.add('holding'); e.preventDefault(); } };
    var off = function () { v.classList.remove('holding'); };
    v.addEventListener('pointerdown', on);
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (t) { v.addEventListener(t, off); });
    window.addEventListener('resize', function () { if (loaded) { worker.postMessage({ type: 'original', size: previewSize() }); requestPreview(false); } });
  }
})();
