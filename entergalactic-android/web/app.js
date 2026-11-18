/* CINELAB — laboratorio de dirección de fotografía (Android).
 *
 * Proyecto no destructivo:  { dev: revelado base, layers: [capas], look, intensity }
 *   dev     → motor de Color (eg-develop.js): balance, tono, curvas, HSL, ruedas de color…
 *   layers  → pila de capas (filtros de Film, Optics, Mono, Color) con opacidad, fusión y máscara
 * El procesado ocurre en worker.js; la foto original nunca se modifica.
 */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var D = window.EGDevelop, STORE = 'cinelab-v1';
  var SCHEMA, FILTERS = {}, worker, file = null, loaded = false;
  var LABS = [
    { id: 'film', name: 'Film', ico: '🎞', modules: ['film', 'cine', 'analog'], extra: [],
      desc: 'Perfiles de película, looks de cine, grano, halación, daños y cámaras antiguas.' },
    { id: 'color', name: 'Color', ico: '◑', modules: ['chroma', 'pop'], extra: ['color_correction'], dev: true,
      desc: 'Ruedas de color, HSL, curvas RGB, balance de blancos, split toning, contraste y saturación.' },
    { id: 'optics', name: 'Optics', ico: '✦', modules: ['optics'],
      extra: ['glow', 'light_leak', 'chromatic_aberration', 'anamorphic_flare', 'light_beam', 'lens_blur', 'vignette'],
      desc: 'Destellos, fugas de luz, glow, rayos, aberración cromática, difusión y efectos de cristal.' },
    { id: 'retouch', name: 'Retouch', ico: '✎', soon: 'Fase 2', modules: [],
      desc: 'Llegará en la fase 2: eliminación de imperfecciones con un toque, dodge & burn con pincel, selección de personas y de piel con IA (MediaPipe, sin conexión), corrección de piel, borrado de objetos y ajustes selectivos con pincel.' },
    { id: 'mono', name: 'Mono', ico: '◐', modules: ['plata'], extra: ['vignette'],
      desc: 'Blanco y negro analógico: películas, filtros de color, contraste tonal, grano, texturas, negros profundos y papel fotográfico.' },
    { id: 'ai', name: 'AI', ico: '✺', soon: 'Fase 3', modules: [],
      desc: 'Llegará en la fase 3: reducción de ruido, superresolución, recuperación de detalle, desenfoque de fondo, restauración y segmentación inteligente.' }
  ];
  var GROUP_NAMES = { film: 'Perfiles y efectos de película', cine: 'Looks cinematográficos (directores de fotografía)',
    analog: 'Analógico y cámaras antiguas', chroma: 'Color', pop: 'Arte pop', optics: 'Óptica y luz', plata: 'Blanco y negro' };
  var state = { mode: 'director', lab: 'film', exportSize: 4096, devOpen: { basic: true }, sel: null, project: null, recipes: [] };
  var hist = [], future = [], lastSnap = null, pv = { inflight: false, pending: null, seq: 0 }, thumbs = {}, lastHist = null;
  var devUI = { channel: 'rgb', hsl: 'orange' };

  // ------------------------------------------------------------------ utilidades
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
  function lab() { return LABS.filter(function (l) { return l.id === state.lab; })[0] || LABS[0]; }
  function status(m, err) { $('status').textContent = m || ''; $('status').className = 'status' + (err ? ' error' : ''); }
  function newProject() { return { dev: D.defaults(), layers: [], look: null, intensity: 100 }; }
  function save() {
    try {
      localStorage.setItem(STORE, JSON.stringify({ mode: state.mode, lab: state.lab, exportSize: state.exportSize,
        devOpen: state.devOpen, project: state.project, recipes: state.recipes }));
    } catch (e) { /* sin almacenamiento */ }
  }
  function load() {
    try {
      var s = JSON.parse(localStorage.getItem(STORE) || 'null');
      if (s) Object.keys(s).forEach(function (k) { state[k] = s[k]; });
    } catch (e) { /* nada */ }
    if (!state.project) state.project = newProject();
    state.project.dev = Object.assign(D.defaults(), state.project.dev || {});
    state.project.layers = (state.project.layers || []).filter(function (l) { return FILTERS[l.id]; });
  }
  function labTools(l) {
    return SCHEMA.filters.filter(function (f) {
      return f.modules.some(function (m) { return l.modules.indexOf(m) >= 0; }) || (l.extra || []).indexOf(f.id) >= 0;
    });
  }
  function labOfFilter(fid) {
    var f = FILTERS[fid];
    for (var i = 0; i < LABS.length; i++) {
      var l = LABS[i];
      if ((l.extra || []).indexOf(fid) >= 0 || (f && f.modules.some(function (m) { return l.modules.indexOf(m) >= 0; }))) return l;
    }
    return LABS[0];
  }
  function newLayer(fid) {
    var f = FILTERS[fid], params = {};
    f.params.forEach(function (p) { params[p.id] = p['default']; });
    return { id: fid, enabled: true, opacity: 100, blend: 'normal', mask: { type: 'all' }, params: params, origin: 'user' };
  }

  // ------------------------------------------------------------------ historial (deshacer / rehacer)
  function snapshot() { return JSON.stringify(state.project); }
  function commit() {
    var s = snapshot();
    if (s !== lastSnap) {
      if (lastSnap !== null) { hist.push(lastSnap); if (hist.length > 60) hist.shift(); future = []; }
      lastSnap = s;
    }
    thumbs = {};
    save(); updateUndo(); requestPreview(true); requestPreview(false);
  }
  function undo() { if (!hist.length) return; future.push(lastSnap); lastSnap = hist.pop(); state.project = JSON.parse(lastSnap); afterHistory(); }
  function redo() { if (!future.length) return; hist.push(lastSnap); lastSnap = future.pop(); state.project = JSON.parse(lastSnap); afterHistory(); }
  function afterHistory() { thumbs = {}; state.sel = null; save(); updateUndo(); renderPanel(); requestPreview(false); }
  function updateUndo() { $('btnUndo').disabled = !hist.length; $('btnRedo').disabled = !future.length; }

  // ------------------------------------------------------------------ arranque
  fetch('schema.json').then(function (r) { return r.json(); }).then(function (s) {
    SCHEMA = s;
    s.filters.forEach(function (f) { FILTERS[f.id] = f; });
    load();
    lastSnap = snapshot();
    worker = new Worker('worker.js');
    worker.onmessage = onWorker;
    worker.postMessage({ type: 'init', schema: s });
    bind(); renderModes(); renderLabs(); renderPanel(); updateUndo();
  }).catch(function (e) { status('No se pudo iniciar: ' + e.message, true); });

  // ------------------------------------------------------------------ worker
  function paint(c, m) {
    c.width = m.w; c.height = m.h;
    c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(m.rgba), m.w, m.h), 0, 0);
  }
  function onWorker(ev) {
    var m = ev.data;
    if (m.type === 'loaded') {
      loaded = true; thumbs = {};
      $('viewer').classList.remove('empty');
      $('btnExport').disabled = false;
      $('info').textContent = 'ORIGINAL · ' + m.w + ' × ' + m.h;
      worker.postMessage({ type: 'original', size: previewSize() });
      requestPreview(false); requestThumbs();
    } else if (m.type === 'original') paint($('orig'), m);
    else if (m.type === 'preview') {
      paint($('canvas'), m);
      if (m.hist) { lastHist = m.hist; drawHisto(); }
      pv.inflight = false;
      $('busy').classList.toggle('hidden', !pv.pending);
      $('editing').textContent = isEdited() ? 'EDITANDO' : '';
      status((m.draft ? 'Vista rápida' : 'Vista previa') + ' · ' + m.ms + ' ms');
      pump();
    } else if (m.type === 'thumb') {
      var c = document.createElement('canvas'); paint(c, m);
      thumbs[m.key] = c.toDataURL('image/jpeg', 0.8);
      var th = document.querySelector('.chip[data-key="' + CSS.escape(m.key) + '"] .th');
      if (th) th.style.backgroundImage = 'url(' + thumbs[m.key] + ')';
    } else if (m.type === 'auto') {
      ['exposure', 'contrast', 'highlights', 'shadows', 'whites', 'blacks', 'vibrance'].forEach(function (k) { state.project.dev[k] = m.settings[k]; });
      renderPanel(); commit(); status('Ajuste inteligente aplicado');
    } else if (m.type === 'progress') status('Exportando… ' + Math.round(m.f * 100) + '% · ' + m.label);
    else if (m.type === 'exported') deliver(m.blob, m.w, m.h);
    else if (m.type === 'error') { pv.inflight = false; status(m.message, true); $('btnExport').disabled = !loaded; pump(); }
  }
  function isEdited() { return !D.isNeutral(state.project.dev) || state.project.layers.some(function (l) { return l.enabled !== false; }); }
  function previewSize() { return Math.max(480, Math.min(900, Math.round($('viewer').clientWidth * (window.devicePixelRatio || 1)))); }
  function recipe() { return { stack: state.project.layers }; }
  function requestPreview(draft) {
    if (!loaded) return;
    var prev = pv.pending;
    pv.pending = { draft: draft && !(prev && !prev.draft) };
    pump();
  }
  function pump() {
    if (pv.inflight || !pv.pending) return;
    var o = pv.pending; pv.pending = null; pv.inflight = true;
    $('busy').classList.remove('hidden');
    var size = previewSize();
    worker.postMessage({ type: 'preview', id: ++pv.seq, draft: o.draft, size: o.draft ? Math.round(size * 0.45) : size,
      recipe: recipe(), intensity: state.project.intensity, dev: state.project.dev });
  }
  var liveT = null, lastLive = 0;
  function live() {
    var now = Date.now(); clearTimeout(liveT);
    if (now - lastLive > 50) { lastLive = now; requestPreview(true); }
    liveT = setTimeout(function () { requestPreview(true); }, 60);
  }
  function requestThumbs() {
    if (!loaded || state.mode !== 'director') return;
    var items = presetsForLab(lab()).filter(function (p) { return !thumbs[p.name]; })
      .map(function (p) { return { key: p.name, recipe: { stack: p.stack } }; });
    if (items.length) worker.postMessage({ type: 'thumbs', items: items, dev: state.project.dev });
  }

  // ------------------------------------------------------------------ abrir / exportar
  function openFile(f) {
    if (!f) return;
    file = f; status('Abriendo…');
    var maxSide = Number(state.exportSize) || 0;
    createImageBitmap(f, { imageOrientation: 'from-image' }).catch(function () { return createImageBitmap(f); }).then(function (bmp) {
      var s = maxSide ? Math.min(1, maxSide / Math.max(bmp.width, bmp.height)) : 1;
      if (s >= 1) return bmp;
      return createImageBitmap(bmp, { resizeWidth: Math.round(bmp.width * s), resizeHeight: Math.round(bmp.height * s), resizeQuality: 'high' });
    }).then(function (bmp) { worker.postMessage({ type: 'load', bitmap: bmp }, [bmp]); })
      .catch(function (e) { status('No se pudo abrir la foto: ' + e.message, true); });
  }
  function exportSheet() {
    var sh = $('sheet'); sh.innerHTML = '';
    var sel = el('select');
    [['4096', 'Alta (hasta 4096 px)'], ['0', 'Original (más lento)'], ['2048', 'Media (2048 px)']].forEach(function (o) { sel.appendChild(el('option', { value: o[0], text: o[1] })); });
    sel.value = String(state.exportSize);
    sel.addEventListener('change', function () { state.exportSize = +sel.value; save(); if (file) openFile(file); });
    sh.appendChild(el('h3', { text: 'Exportar' }));
    sh.appendChild(el('div', { cls: 'param' }, [el('div', { cls: 'lbl', text: 'Tamaño' }), sel]));
    sh.appendChild(el('div', { cls: 'row' }, [
      el('button', { cls: 'btn', text: 'Cancelar', onclick: function () { sh.classList.add('hidden'); } }),
      el('button', { cls: 'btn primary', text: 'Guardar en galería', onclick: function () { sh.classList.add('hidden'); doExport(); } })]));
    sh.appendChild(el('p', { cls: 'note', text: 'Se guarda en Imágenes › CINELAB como JPEG de alta calidad. La foto original no se modifica.' }));
    sh.classList.remove('hidden');
  }
  function doExport() {
    if (!loaded) return;
    $('btnExport').disabled = true; status('Exportando…');
    worker.postMessage({ type: 'export', recipe: recipe(), intensity: state.project.intensity, dev: state.project.dev, quality: 0.95 });
  }
  function deliver(blob, w, h) {
    var name = 'CINELAB_' + new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14) + '.jpg';
    var done = function (msg, err) { $('btnExport').disabled = false; status(msg, err); };
    if (!window.Android) {
      var a = el('a', { href: URL.createObjectURL(blob), download: name }); document.body.appendChild(a); a.click(); a.remove();
      return done('Descargada ' + name + ' (' + w + '×' + h + ')');
    }
    var CH = 3 * 262144, off = 0, r0 = Android.saveBegin(name);
    if (r0 !== 'OK') return done(r0.replace(/^ERR\|/, ''), true);
    (function next() {
      if (off >= blob.size) {
        var r = Android.saveEnd();
        return r.indexOf('OK') === 0 ? done('Guardada en Imágenes › CINELAB (' + w + '×' + h + ')') : done(r.replace(/^ERR\|/, ''), true);
      }
      var fr = new FileReader();
      fr.onload = function () { Android.saveChunk(String(fr.result).split(',')[1]); off += CH; status('Guardando… ' + Math.min(100, Math.round(off / blob.size * 100)) + '%'); setTimeout(next, 0); };
      fr.onerror = function () { Android.saveAbort(); done('No se pudo leer la imagen', true); };
      fr.readAsDataURL(blob.slice(off, off + CH));
    })();
  }

  // ------------------------------------------------------------------ modos y laboratorios
  function renderModes() {
    Array.prototype.forEach.call(document.querySelectorAll('.modes button'), function (b) { b.classList.toggle('on', b.getAttribute('data-mode') === state.mode); });
  }
  function renderLabs() {
    var nav = $('labs'); nav.innerHTML = '';
    LABS.forEach(function (l) {
      nav.appendChild(el('button', { cls: 'lab' + (l.id === state.lab ? ' on' : ''), onclick: function () {
        state.lab = l.id; state.sel = null; save(); renderLabs(); renderPanel(); requestThumbs();
      } }, [el('span', { cls: 'ico', text: l.ico }), el('span', { cls: 'nm', text: l.name }), l.soon ? el('span', { cls: 'soon', text: l.soon }) : null]));
    });
  }
  function renderPanel() {
    var p = $('panel'); p.innerHTML = '';
    var l = lab();
    if (l.soon) { p.appendChild(el('div', { cls: 'soonbox', text: l.desc })); return; }
    if (state.mode === 'director') renderDirector(p, l); else renderPro(p, l);
  }

  // ------------------------------------------------------------------ MODO DIRECTOR
  function presetsForLab(l) { return SCHEMA.presets.filter(function (pr) { return l.modules.indexOf(pr.module) >= 0; }); }
  function applyLook(pr) {
    state.project.layers = state.project.layers.filter(function (x) { return x.origin !== 'look'; })
      .concat(clone(pr.stack).map(function (it) { it.origin = 'look'; return it; }));
    state.project.look = pr.name;
    renderPanel(); commit();
  }
  function renderDirector(p, l) {
    p.appendChild(el('div', { cls: 'row' }, [
      el('button', { cls: 'btn ghost', text: '✦ Ajuste inteligente', onclick: function () { if (loaded) worker.postMessage({ type: 'auto' }); } }),
      el('button', { cls: 'btn', text: '♥ Recetas', onclick: recipesSheet })]));
    l.modules.forEach(function (mid) {
      var ps = SCHEMA.presets.filter(function (pr) { return pr.module === mid; });
      if (!ps.length) return;
      p.appendChild(el('div', { cls: 'group-title', text: GROUP_NAMES[mid] || mid }));
      var strip = el('div', { cls: 'strip' });
      ps.forEach(function (pr) {
        var th = el('span', { cls: 'th' });
        if (thumbs[pr.name]) th.style.backgroundImage = 'url(' + thumbs[pr.name] + ')';
        strip.appendChild(el('button', { cls: 'chip' + (state.project.look === pr.name ? ' on' : ''), 'data-key': pr.name, onclick: function () { applyLook(pr); } },
          [th, el('span', { cls: 'nm', text: pr.name })]));
      });
      p.appendChild(strip);
    });
    var cur = SCHEMA.presets.filter(function (pr) { return pr.name === state.project.look; })[0];
    if (cur && cur.desc) p.appendChild(el('p', { cls: 'desc', text: cur.desc }));
    p.appendChild(devSlider({ label: 'Intensidad del look', min: 0, max: 100, def: 100, step: 1 },
      function () { return state.project.intensity; }, function (v) { state.project.intensity = v; }));
    if (state.project.look) p.appendChild(el('button', { cls: 'link', text: 'Quitar el look', onclick: function () {
      state.project.layers = state.project.layers.filter(function (x) { return x.origin !== 'look'; });
      state.project.look = null; renderPanel(); commit();
    } }));
    p.appendChild(el('p', { cls: 'note', text: 'Mantén pulsada la foto (o toca ◐) para comparar antes y después. En Modo Profesional cada capa del look se puede abrir y ajustar.' }));
  }
  function recipesSheet() {
    var sh = $('sheet'); sh.innerHTML = '';
    sh.appendChild(el('h3', { text: 'Recetas de color' }));
    var name = el('input', { type: 'text', placeholder: 'Nombre de la receta', cls: 'txt' });
    sh.appendChild(name);
    sh.appendChild(el('div', { cls: 'row' }, [el('button', { cls: 'btn primary', text: 'Guardar la edición actual', onclick: function () {
      var n = name.value.trim() || ('Receta ' + (state.recipes.length + 1));
      state.recipes.push({ name: n, project: clone(state.project) }); save(); recipesSheet(); status('Receta «' + n + '» guardada');
    } })]));
    if (!state.recipes.length) sh.appendChild(el('p', { cls: 'note', text: 'Aún no tienes recetas. Guarda una edición (revelado y capas) para aplicarla a otras fotos con un toque.' }));
    state.recipes.forEach(function (r, i) {
      sh.appendChild(el('div', { cls: 'row' }, [
        el('button', { cls: 'btn', text: r.name, onclick: function () { state.project = clone(r.project); sh.classList.add('hidden'); renderPanel(); commit(); } }),
        el('button', { cls: 'btn narrow', text: '✕', onclick: function () { state.recipes.splice(i, 1); save(); recipesSheet(); } })]));
    });
    sh.appendChild(el('button', { cls: 'btn wide', text: 'Cerrar', onclick: function () { sh.classList.add('hidden'); } }));
    sh.classList.remove('hidden');
  }

  // ------------------------------------------------------------------ MODO PROFESIONAL
  function renderPro(p, l) {
    if (l.dev) renderColorLab(p);
    p.appendChild(el('div', { cls: 'ph' }, [el('h2', { text: 'Capas' }), el('span', { cls: 'muted small', text: state.project.layers.length + ' / ' + SCHEMA.max_stack })]));
    var box = el('div', { cls: 'layers' });
    box.appendChild(el('div', { cls: 'layer' }, [el('div', { cls: 'lh' }, [el('span', { cls: 'eye', text: '◑' }),
      el('span', { cls: 'ln', text: 'Revelado base' }), el('span', { cls: 'badge', text: 'Color' }),
      el('button', { cls: 'x', text: '✎', onclick: function () { state.lab = 'color'; renderLabs(); renderPanel(); } })])]));
    state.project.layers.forEach(function (it, i) { box.appendChild(layerCard(it, i)); });
    p.appendChild(box);
    var sel = el('select');
    labTools(l).forEach(function (f) { sel.appendChild(el('option', { value: f.id, text: f.name })); });
    p.appendChild(el('div', { cls: 'row' }, [sel, el('button', { cls: 'btn ghost narrow2', text: '＋ Capa', onclick: function () {
      if (state.project.layers.length >= SCHEMA.max_stack) return status('Máximo ' + SCHEMA.max_stack + ' capas', true);
      state.project.layers.push(newLayer(sel.value)); state.sel = state.project.layers.length - 1; renderPanel(); commit();
    } })]));
    p.appendChild(el('p', { cls: 'note', text: l.desc + ' Las capas se aplican de arriba abajo sobre el revelado base. Toca una capa para editarla.' }));
  }
  function layerCard(it, i) {
    var f = FILTERS[it.id], L = state.project.layers, open = state.sel === i;
    var card = el('div', { cls: 'layer' + (open ? ' sel' : '') + (it.enabled === false ? ' off' : '') });
    var head = el('div', { cls: 'lh' }, [
      el('button', { cls: 'eye', text: it.enabled === false ? '○' : '●', onclick: function (e) { e.stopPropagation(); it.enabled = it.enabled === false; renderPanel(); commit(); } }),
      el('span', { cls: 'ln', text: f ? f.name : it.id }), el('span', { cls: 'badge', text: labOfFilter(it.id).name }),
      el('span', { cls: 'op', text: Math.round(it.opacity === undefined ? 100 : it.opacity) + '%' }),
      el('button', { cls: 'x', text: '▲', onclick: function (e) { e.stopPropagation(); if (i > 0) { L.splice(i - 1, 0, L.splice(i, 1)[0]); state.sel = i - 1; renderPanel(); commit(); } } }),
      el('button', { cls: 'x', text: '▼', onclick: function (e) { e.stopPropagation(); if (i < L.length - 1) { L.splice(i + 1, 0, L.splice(i, 1)[0]); state.sel = i + 1; renderPanel(); commit(); } } }),
      el('button', { cls: 'x', text: '✕', onclick: function (e) { e.stopPropagation(); L.splice(i, 1); state.sel = null; renderPanel(); commit(); } })]);
    head.addEventListener('click', function () { state.sel = open ? null : i; renderPanel(); });
    card.appendChild(head);
    if (!open || !f) return card;
    var body = el('div', { cls: 'lbody' }, [el('p', { cls: 'note', text: f.desc })]);
    it.params = it.params || {};
    f.params.forEach(function (q) { body.appendChild(paramCtl(q, it)); });
    body.appendChild(devSlider({ label: 'Opacidad', min: 0, max: 100, def: 100, step: 1, unit: '%' }, function () { return it.opacity === undefined ? 100 : it.opacity; }, function (v) { it.opacity = v; }));
    if (!f.resizes) {
      body.appendChild(selectCtl('Modo de fusión', SCHEMA.blend_modes.map(function (b) { return [b.id, b.name]; }), it.blend || 'normal', function (v) { it.blend = v; }));
      it.mask = it.mask || { type: 'all' };
      var mk = it.mask;
      body.appendChild(selectCtl('Máscara (aplicar a)', SCHEMA.mask_types.map(function (m) { return [m.id, m.name]; }), mk.type || 'all', function (v) { mk.type = v; setTimeout(renderPanel, 0); }));
      if (mk.type === 'color') {
        body.appendChild(devSlider({ label: 'Color de la máscara', min: 0, max: 360, def: 30, step: 1, track: 'hue' }, function () { return mk.hue === undefined ? 30 : mk.hue; }, function (v) { mk.hue = v; }));
        body.appendChild(devSlider({ label: 'Amplitud', min: 10, max: 120, def: 40, step: 1 }, function () { return mk.width === undefined ? 40 : mk.width; }, function (v) { mk.width = v; }));
      }
      if (mk.type && mk.type !== 'all') {
        body.appendChild(devSlider({ label: 'Suavidad', min: 0, max: 100, def: 50, step: 1 }, function () { return mk.softness === undefined ? 50 : mk.softness; }, function (v) { mk.softness = v; }));
        body.appendChild(checkCtl('Invertir máscara', mk.invert, function (v) { mk.invert = v; }));
      }
    }
    card.appendChild(body);
    return card;
  }
  function paramCtl(q, it) {
    var get = function () { return it.params[q.id] !== undefined ? it.params[q.id] : q['default']; };
    var set = function (v) { it.params[q.id] = v; if (it.origin === 'look') it.origin = 'user'; };
    if (q.type === 'range' || q.type === 'hue') return devSlider({ label: q.label, min: q.min, max: q.max, step: q.step || 1, def: q['default'], unit: q.unit, track: q.type === 'hue' ? 'hue' : null }, get, set);
    if (q.type === 'select') return selectCtl(q.label, q.options, get(), set);
    if (q.type === 'check') return checkCtl(q.label, get(), set);
    return el('span');
  }

  // ------------------------------------------------------------------ COLOR LAB (revelado base)
  function renderColorLab(p) {
    p.appendChild(el('div', { cls: 'histo' }, [el('canvas', { id: 'histo' }), el('span', { cls: 'hi', id: 'histoInfo' })]));
    p.appendChild(el('div', { cls: 'row' }, [
      el('button', { cls: 'btn ghost', text: '✦ Auto', onclick: function () { if (loaded) worker.postMessage({ type: 'auto' }); } }),
      el('button', { cls: 'btn', text: 'Restablecer color', onclick: function () { state.project.dev = D.defaults(); renderPanel(); commit(); } })]));
    var dev = state.project.dev, all = {};
    D.SECTIONS.forEach(function (s) { (s.params || []).forEach(function (q) { all[q.id] = q; }); });
    var secs = [
      { id: 'wb', name: 'Balance de blancos', ids: ['temp', 'tint'] },
      { id: 'basic', name: 'Contraste, luz y saturación', ids: ['exposure', 'contrast', 'highlights', 'shadows', 'whites', 'blacks', 'texture', 'clarity', 'dehaze', 'vibrance', 'saturation'] },
      { id: 'wheels', name: 'Ruedas de color', custom: wheelsEditor },
      { id: 'split', name: 'Split toning', custom: splitEditor },
      { id: 'curve', name: 'Curvas RGB', custom: curveEditor },
      { id: 'hsl', name: 'HSL', custom: hslEditor },
      { id: 'detail', name: 'Detalle y ruido', sec: 'detail' },
      { id: 'effects', name: 'Viñeta y grano', sec: 'effects' },
      { id: 'geometry', name: 'Recortar y enderezar', sec: 'geometry' }];
    secs.forEach(function (s) {
      var det = el('details', { cls: 'sec' });
      if (state.devOpen[s.id]) det.open = true;
      det.addEventListener('toggle', function () { state.devOpen[s.id] = det.open; save(); if (det.open) setTimeout(drawAllCanvases, 0); });
      det.appendChild(el('summary', {}, [el('span', { text: s.name })]));
      var ids = s.ids || (s.sec ? D.SECTIONS.filter(function (x) { return x.id === s.sec; })[0].params.map(function (q) { return q.id; }) : null);
      if (s.custom) det.appendChild(s.custom());
      else ids.forEach(function (id) {
        var q = all[id];
        if (q.type === 'select') det.appendChild(selectCtl(q.label, q.options, dev[id], function (v) { dev[id] = v; }));
        else det.appendChild(devSlider(q, function () { return dev[id]; }, function (v) { dev[id] = v; }));
      });
      p.appendChild(det);
    });
    setTimeout(function () { drawHisto(); drawAllCanvases(); }, 0);
  }
  function drawAllCanvases() { drawCurve(); drawWheels(); }

  // ---- ruedas de color: arrastra el punto (tono e intensidad) y ajusta la luminancia debajo
  var wheelEls = [];
  function wheelsEditor() {
    var dev = state.project.dev, wrap = el('div', { cls: 'wheels' });
    wheelEls = [];
    [['gs', 'Sombras'], ['gm', 'Medios'], ['gh', 'Luces']].forEach(function (z) {
      var c = el('canvas'), lum = el('input', { type: 'range', min: -100, max: 100, step: 1, value: dev[z[0] + '_lum'] });
      lum.addEventListener('input', function () { dev[z[0] + '_lum'] = +lum.value; live(); });
      lum.addEventListener('change', commit);
      var drag = false, setFrom = function (e) {
        var r = c.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * 2 - 1, y = (e.clientY - r.top) / r.height * 2 - 1;
        dev[z[0] + '_hue'] = Math.round((Math.atan2(-y, x) * 180 / Math.PI + 360) % 360);
        dev[z[0] + '_sat'] = Math.round(Math.min(1, Math.sqrt(x * x + y * y)) * 100);
        drawWheels(); live();
      };
      c.addEventListener('pointerdown', function (e) { drag = true; c.setPointerCapture(e.pointerId); setFrom(e); e.preventDefault(); });
      c.addEventListener('pointermove', function (e) { if (drag) setFrom(e); });
      c.addEventListener('pointerup', function () { if (drag) { drag = false; commit(); } });
      c.addEventListener('dblclick', function () { dev[z[0] + '_sat'] = 0; dev[z[0] + '_lum'] = 0; lum.value = 0; drawWheels(); commit(); });
      wheelEls.push([c, z[0]]);
      wrap.appendChild(el('div', { cls: 'wheel' }, [c, el('div', { cls: 'wl', text: z[1] }), lum]));
    });
    var box = el('div', {}, [wrap]);
    box.appendChild(devSlider({ label: 'Fusión', min: 0, max: 100, def: 50, step: 1 }, function () { return dev.g_blend; }, function (v) { dev.g_blend = v; }));
    box.appendChild(devSlider({ label: 'Equilibrio', min: -100, max: 100, def: 0, step: 1 }, function () { return dev.g_balance; }, function (v) { dev.g_balance = v; }));
    box.appendChild(el('p', { cls: 'note', text: 'Arrastra el punto hacia un color: la distancia al centro es la intensidad. La barra de debajo cambia la luminancia de esa zona. Doble toque: restablecer.' }));
    return box;
  }
  function drawWheels() {
    var dev = state.project.dev;
    wheelEls.forEach(function (we) {
      var c = we[0], z = we[1];
      if (!c.isConnected) return;
      var dpr = window.devicePixelRatio || 1, W = c.clientWidth * dpr;
      if (!W) return;
      c.width = W; c.height = W;
      var g = c.getContext('2d'), R = W / 2 - 4 * dpr;
      for (var a = 0; a < 360; a += 3) {
        var grad = g.createRadialGradient(W / 2, W / 2, 0, W / 2, W / 2, R);
        grad.addColorStop(0, '#7f7f7f'); grad.addColorStop(1, 'hsl(' + a + ',90%,55%)');
        g.fillStyle = grad; g.beginPath(); g.moveTo(W / 2, W / 2);
        g.arc(W / 2, W / 2, R, -(a + 3.5) * Math.PI / 180, -a * Math.PI / 180); g.closePath(); g.fill();
      }
      var hue = dev[z + '_hue'] * Math.PI / 180, rr = dev[z + '_sat'] / 100 * R;
      g.strokeStyle = '#fff'; g.lineWidth = 2.5 * dpr; g.beginPath();
      g.arc(W / 2 + Math.cos(hue) * rr, W / 2 - Math.sin(hue) * rr, 7 * dpr, 0, Math.PI * 2); g.stroke();
    });
  }
  function splitEditor() {
    var dev = state.project.dev, box = el('div');
    box.appendChild(el('p', { cls: 'note', text: 'Tiñe sombras y luces con colores distintos (son las mismas zonas que las ruedas).' }));
    [['gs', 'Sombras', 220], ['gh', 'Luces', 45]].forEach(function (z) {
      box.appendChild(devSlider({ label: z[1] + ' · tono', min: 0, max: 360, def: z[2], step: 1, track: 'hue' }, function () { return dev[z[0] + '_hue']; }, function (v) { dev[z[0] + '_hue'] = v; }));
      box.appendChild(devSlider({ label: z[1] + ' · saturación', min: 0, max: 100, def: 0, step: 1 }, function () { return dev[z[0] + '_sat']; }, function (v) { dev[z[0] + '_sat'] = v; }));
    });
    box.appendChild(devSlider({ label: 'Equilibrio', min: -100, max: 100, def: 0, step: 1 }, function () { return dev.g_balance; }, function (v) { dev.g_balance = v; }));
    return box;
  }

  // ---- curva de tonos
  var curveCanvas = null, dragPt = -1;
  function curvePts() { return state.project.dev.curve[devUI.channel]; }
  function curveEditor() {
    var wrap = el('div', { cls: 'curve' }), chips = el('div', { cls: 'chips' });
    [['rgb', 'RGB'], ['r', 'Rojo'], ['g', 'Verde'], ['b', 'Azul']].forEach(function (c) {
      chips.appendChild(el('button', { cls: devUI.channel === c[0] ? 'on' : '', text: c[1], onclick: function () { devUI.channel = c[0]; renderPanel(); } }));
    });
    curveCanvas = el('canvas');
    var pos = function (e) { var r = curveCanvas.getBoundingClientRect(); return [(e.clientX - r.left) / r.width, 1 - (e.clientY - r.top) / r.height]; };
    curveCanvas.addEventListener('pointerdown', function (e) {
      var q = pos(e), pts = curvePts(), best = -1, bd = 0.06;
      pts.forEach(function (pt, i) { var d = Math.hypot(pt[0] - q[0], pt[1] - q[1]); if (d < bd) { bd = d; best = i; } });
      if (best < 0) {
        var lut = D.curveLUT(pts), y = lut ? lut[Math.round(Math.min(1, Math.max(0, q[0])) * 1024)] : q[0], np = [Math.min(0.99, Math.max(0.01, q[0])), y];
        pts.push(np); pts.sort(function (a, b) { return a[0] - b[0]; }); best = pts.indexOf(np);
      }
      dragPt = best; curveCanvas.setPointerCapture(e.pointerId); e.preventDefault(); drawCurve(); live();
    });
    curveCanvas.addEventListener('pointermove', function (e) {
      if (dragPt < 0) return;
      var q = pos(e), pts = curvePts(), last = pts.length - 1, pt = pts[dragPt];
      if (dragPt === 0) pt[0] = 0; else if (dragPt === last) pt[0] = 1;
      else pt[0] = Math.min(pts[dragPt + 1][0] - 0.01, Math.max(pts[dragPt - 1][0] + 0.01, q[0]));
      pt[1] = Math.min(1, Math.max(0, q[1])); pt.out = dragPt > 0 && dragPt < last && (q[1] < -0.08 || q[1] > 1.08);
      drawCurve(); live();
    });
    var end = function () {
      if (dragPt < 0) return;
      var pts = curvePts(); if (pts[dragPt] && pts[dragPt].out) pts.splice(dragPt, 1);
      pts.forEach(function (pt) { delete pt.out; }); dragPt = -1; drawCurve(); commit();
    };
    curveCanvas.addEventListener('pointerup', end); curveCanvas.addEventListener('pointercancel', end);
    wrap.appendChild(chips); wrap.appendChild(curveCanvas);
    wrap.appendChild(el('p', { cls: 'note', text: 'Toca para añadir un punto, arrástralo para moverlo y sácalo del recuadro para quitarlo.' }));
    return wrap;
  }
  function drawCurve() {
    var c = curveCanvas; if (!c || !c.isConnected) return;
    var dpr = window.devicePixelRatio || 1, W = c.clientWidth * dpr; if (!W) return;
    c.width = W; c.height = W;
    var g = c.getContext('2d'), col = { rgb: '#ffffff', r: '#ff5a5a', g: '#4ade80', b: '#5a9bff' }[devUI.channel];
    g.strokeStyle = 'rgba(255,255,255,.08)'; g.lineWidth = dpr;
    for (var i = 1; i < 4; i++) { g.beginPath(); g.moveTo(i * W / 4, 0); g.lineTo(i * W / 4, W); g.moveTo(0, i * W / 4); g.lineTo(W, i * W / 4); g.stroke(); }
    if (lastHist) {
      var hh = lastHist.r.map(function (v, k) { return v + lastHist.g[k] + lastHist.b[k]; }), mx = Math.max.apply(null, hh.slice(1, 63)) || 1;
      g.fillStyle = 'rgba(47,210,197,.15)'; g.beginPath(); g.moveTo(0, W);
      hh.forEach(function (v, k) { g.lineTo(k / 63 * W, W - Math.min(1, v / mx) * W * 0.6); }); g.lineTo(W, W); g.fill();
    }
    g.strokeStyle = 'rgba(255,255,255,.2)'; g.beginPath(); g.moveTo(0, W); g.lineTo(W, 0); g.stroke();
    var pts = curvePts(), lut = D.curveLUT(pts.filter(function (q) { return !q.out; }));
    g.strokeStyle = col; g.lineWidth = 2.5 * dpr; g.beginPath();
    for (var x = 0; x <= 256; x++) { var y = lut ? lut[x * 4] : x / 256; if (x === 0) g.moveTo(0, W - y * W); else g.lineTo(x / 256 * W, W - y * W); }
    g.stroke();
    pts.forEach(function (q, k) {
      g.fillStyle = q.out ? '#ff6b81' : (k === dragPt ? col : '#0b0b10'); g.strokeStyle = col; g.lineWidth = 2 * dpr;
      g.beginPath(); g.arc(q[0] * W, W - q[1] * W, 7 * dpr, 0, Math.PI * 2); g.fill(); g.stroke();
    });
  }
  function hslEditor() {
    var wrap = el('div'), chips = el('div', { cls: 'chips' }), dev = state.project.dev;
    var hex = { red: '#ff3b3b', orange: '#ff8c1a', yellow: '#ffd21a', green: '#3ccf4e', aqua: '#26d6d0', blue: '#2f6bff', purple: '#8b4dff', magenta: '#e83fc8' };
    D.HSL_COLORS.forEach(function (c) {
      var b = el('button', { cls: 'dot' + (devUI.hsl === c[0] ? ' on' : ''), title: c[1], onclick: function () { devUI.hsl = c[0]; renderPanel(); } });
      b.style.background = hex[c[0]]; chips.appendChild(b);
    });
    wrap.appendChild(chips);
    var v = dev.hsl[devUI.hsl];
    wrap.appendChild(el('p', { cls: 'note', text: 'Color: ' + D.HSL_COLORS.filter(function (c) { return c[0] === devUI.hsl; })[0][1] }));
    [['h', 'Tono'], ['s', 'Saturación'], ['l', 'Luminancia']].forEach(function (k) {
      wrap.appendChild(devSlider({ label: k[1], min: -100, max: 100, def: 0, step: 1 }, function () { return v[k[0]]; }, function (x) { v[k[0]] = x; }));
    });
    return wrap;
  }
  function drawHisto() {
    var c = $('histo'); if (!c || !lastHist) return;
    var dpr = window.devicePixelRatio || 1, W = c.clientWidth * dpr, H = c.clientHeight * dpr; if (!W) return;
    c.width = W; c.height = H;
    var g = c.getContext('2d'), h = lastHist, mx = 1;
    ['r', 'g', 'b'].forEach(function (k) { h[k].forEach(function (v, i) { if (i > 0 && i < 63 && v > mx) mx = v; }); });
    g.globalCompositeOperation = 'lighter';
    [['r', 'rgba(255,70,70,.75)'], ['g', 'rgba(70,255,110,.75)'], ['b', 'rgba(80,140,255,.75)']].forEach(function (cv) {
      g.fillStyle = cv[1]; g.beginPath(); g.moveTo(0, H);
      h[cv[0]].forEach(function (v, i) { g.lineTo(i / 63 * W, H - Math.min(1, v / mx) * H * 0.95); }); g.lineTo(W, H); g.closePath(); g.fill();
    });
    var tot = h.r.reduce(function (a, b) { return a + b; }, 0) * 3, info = $('histoInfo');
    if (info) info.textContent = ((h.r[63] + h.g[63] + h.b[63]) / tot > 0.01 ? '⚠ luces quemadas  ' : '') + ((h.r[0] + h.g[0] + h.b[0]) / tot > 0.02 ? '⚠ sombras empastadas' : '');
  }

  // ------------------------------------------------------------------ controles
  function fmt(p, v) {
    if (p.unit === 'EV') return (v > 0 ? '+' : '') + Number(v).toFixed(2);
    if (p.track === 'hue') return Math.round(v) + '°';
    var s = (p.step && p.step < 1) ? Number(v).toFixed(1) : String(Math.round(v));
    return (v > 0 && p.min < 0 ? '+' : '') + s + (p.unit === '%' ? '%' : p.unit === '°' ? '°' : '');
  }
  function devSlider(p, get, set) {
    var v = get(), out = el('b', { text: fmt(p, v), cls: v !== p.def ? 'changed' : '' });
    var inp = el('input', { type: 'range', min: p.min, max: p.max, step: p.step || 1, value: v });
    if (p.track) inp.className = p.track;
    var upd = function (x) { set(x); out.textContent = fmt(p, x); out.className = x !== p.def ? 'changed' : ''; };
    inp.addEventListener('input', function () { upd(+inp.value); live(); });
    inp.addEventListener('change', commit);
    inp.addEventListener('dblclick', function () { if (p.def === undefined) return; inp.value = p.def; upd(p.def); commit(); });
    return el('div', { cls: 'dslider' }, [el('div', { cls: 'lbl' }, [el('span', { text: p.label }), out]), inp]);
  }
  function selectCtl(label, opts, v, set) {
    var s = el('select');
    opts.forEach(function (o) { s.appendChild(el('option', { value: o[0], text: o[1] })); });
    s.value = v; s.addEventListener('change', function () { set(s.value); commit(); });
    return el('div', { cls: 'param' }, [el('div', { cls: 'lbl', text: label }), s]);
  }
  function checkCtl(label, v, set) {
    var c = el('input', { type: 'checkbox' }); c.checked = !!v;
    c.addEventListener('change', function () { set(c.checked); commit(); });
    return el('label', { cls: 'chk' }, [c, label]);
  }

  // ------------------------------------------------------------------ eventos
  function bind() {
    $('file').addEventListener('change', function (e) { openFile(e.target.files[0]); e.target.value = ''; });
    $('file2').addEventListener('change', function (e) { openFile(e.target.files[0]); e.target.value = ''; });
    $('btnUndo').addEventListener('click', undo);
    $('btnRedo').addEventListener('click', redo);
    $('btnExport').addEventListener('click', exportSheet);
    var v = $('viewer'), cmp = $('btnCompare'), locked = false;
    cmp.addEventListener('click', function () { locked = !locked; cmp.classList.toggle('on', locked); v.classList.toggle('before', locked); });
    v.addEventListener('pointerdown', function (e) { if (loaded) { v.classList.add('before'); e.preventDefault(); } });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (t) { v.addEventListener(t, function () { if (!locked) v.classList.remove('before'); }); });
    Array.prototype.forEach.call(document.querySelectorAll('.modes button'), function (b) {
      b.addEventListener('click', function () { state.mode = b.getAttribute('data-mode'); state.sel = null; save(); renderModes(); renderPanel(); requestThumbs(); });
    });
    window.addEventListener('resize', function () { if (loaded) { worker.postMessage({ type: 'original', size: previewSize() }); requestPreview(false); } });
  }
})();
