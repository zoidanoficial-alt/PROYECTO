/* ENTERGALACTIC móvil — interfaz. El procesado ocurre en worker.js. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var STORE = 'eg-mobile-v1';
  var SCHEMA, FILTERS = {}, worker, file = null, loaded = false;
  var state = { module: 'cine', stacks: {}, chosen: {}, intensity: 100, exportSize: 4096 };
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
  function stack() { return state.stacks[state.module]; }
  function presetsOf(mod) { return SCHEMA.presets.filter(function (p) { return p.module === mod; }); }

  // ------------------------------------------------------------------ arranque
  fetch('schema.json').then(function (r) { return r.json(); }).then(function (s) {
    SCHEMA = s;
    s.filters.forEach(function (f) { FILTERS[f.id] = f; });
    load();
    s.modules.forEach(function (m) {
      if (!state.stacks[m.id]) {
        var first = presetsOf(m.id)[0];
        state.stacks[m.id] = first ? clone(first.stack) : [];
        state.chosen[m.id] = first ? first.name : '';
      }
    });
    if (!s.modules.some(function (m) { return m.id === state.module; })) state.module = s.modules[0].id;
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
      recipe: { stack: stack() }, intensity: state.intensity });
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
    if (items.length) worker.postMessage({ type: 'thumbs', items: items });
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
    worker.postMessage({ type: 'export', recipe: { stack: stack() }, intensity: state.intensity, quality: 0.95 });
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
    SCHEMA.modules.forEach(function (m) {
      t.appendChild(el('button', { cls: m.id === state.module ? 'on' : '', text: m.name, onclick: function () {
        state.module = m.id; save(); renderAll(); requestPreview(false); requestThumbs();
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
    renderTabs(); renderPresets(); renderStack();
    $('intensity').value = state.intensity; $('intOut').textContent = state.intensity;
    $('exportSize').value = String(state.exportSize);
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
