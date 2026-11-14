/* ENTERGALACTIC - lógica del panel (CEP 8: Chromium 57 + Node 8). Sin dependencias. */
(function () {
  'use strict';

  var nodeRequire = (window.cep_node && window.cep_node.require) || window.require;
  var cp = nodeRequire('child_process');
  var fs = nodeRequire('fs');
  var os = nodeRequire('os');
  var path = nodeRequire('path');

  var IS_WIN = os.platform() === 'win32';
  var STORE_KEY = 'entergalactic-state-v1';
  var TMP_DIR = path.join(os.tmpdir(), 'entergalactic');
  var USER_DIR = path.join(os.homedir(), 'Documents', 'ENTERGALACTIC');
  var RECIPES_DIR = path.join(USER_DIR, 'recetas');
  var PROFILES_DIR = path.join(USER_DIR, 'perfiles');
  var LAYER_NAMES = { chroma: 'EG Chroma', plata: 'EG Plata', analog: 'EG Analógico', clean: 'EG Clean', realce: 'EG Realce IA' };

  var $ = function (id) { return document.getElementById(id); };
  function el(tag, attrs, children) {
    var e = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'text') e.textContent = attrs[k];
      else if (k === 'cls') e.className = attrs[k];
      else if (k.indexOf('on') === 0) e.addEventListener(k.slice(2), attrs[k]);
      else e.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) { if (c) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return e;
  }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function mkdirp(dir) {
    if (fs.existsSync(dir)) return;
    mkdirp(path.dirname(dir));
    fs.mkdirSync(dir);
  }

  // ------------------------------------------------------------------ CEP
  function extensionPath() {
    var p = decodeURI(window.__adobe_cep__.getSystemPath('extension'));
    return IS_WIN ? p.replace(/^file:\/\/\//, '') : p.replace(/^file:\/\//, '');
  }
  var EXT = extensionPath();
  var ENGINE = path.join(EXT, 'engine', 'eg_engine.py');

  function jsx(fn, args) {
    var call = fn + '(' + (args || []).map(function (a) { return JSON.stringify(String(a)); }).join(',') + ')';
    return new Promise(function (resolve, reject) {
      window.__adobe_cep__.evalScript(call, function (res) {
        if (typeof res !== 'string' || res === 'EvalScript error.') return reject(new Error('Error en el script de Photoshop (' + fn + ')'));
        var parts = res.split('|');
        if (parts[0] === 'ERR') return reject(new Error(parts.slice(1).join('|')));
        resolve(parts.slice(1));
      });
    });
  }

  // ------------------------------------------------------------------ esquema
  var SCHEMA = JSON.parse(fs.readFileSync(path.join(EXT, 'client', 'schema.json'), 'utf8'));
  var FILTERS = {};
  SCHEMA.filters.forEach(function (f) { FILTERS[f.id] = f; });

  // ------------------------------------------------------------------ estado
  var DEFAULT_STATE = {
    module: 'chroma', stacks: {}, previewMode: 'fit', focus: '0.5,0.5',
    source: 'visible', target: 'layer', useMask: true, python: IS_WIN ? 'python' : 'python3'
  };
  var state = loadState();
  var uidSeq = 1;
  var openCards = {};
  var running = null;
  var previewTimer = null;
  var previewSrc = null;
  var lastDoc = null;

  function loadState() {
    var s = {};
    try { s = JSON.parse(localStorage.getItem(STORE_KEY) || '{}') || {}; } catch (e) { s = {}; }
    var out = clone(DEFAULT_STATE);
    Object.keys(s).forEach(function (k) { out[k] = s[k]; });
    SCHEMA.modules.forEach(function (m) {
      if (!out.stacks[m.id]) {
        var first = SCHEMA.presets.filter(function (p) { return p.module === m.id; })[0];
        out.stacks[m.id] = first ? clone(first.stack) : [];
      }
    });
    return out;
  }
  function saveState() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* sin persistencia */ }
  }
  function stack() { return state.stacks[state.module]; }
  function uid(item) {
    if (!item._uid) Object.defineProperty(item, '_uid', { value: 'c' + (uidSeq++), enumerable: false, writable: true });
    return item._uid;
  }
  function newItem(fid) {
    var f = FILTERS[fid], params = {};
    f.params.forEach(function (p) { params[p.id] = p.default; });
    return { id: fid, enabled: true, opacity: 100, blend: 'normal', mask: { type: 'all' }, params: params };
  }

  // ------------------------------------------------------------------ recetas propias y perfiles
  function userRecipes() {
    try {
      if (!fs.existsSync(RECIPES_DIR)) return [];
      return fs.readdirSync(RECIPES_DIR).filter(function (f) { return /\.json$/i.test(f); }).map(function (f) {
        try {
          var r = JSON.parse(fs.readFileSync(path.join(RECIPES_DIR, f), 'utf8'));
          r.file = f;
          return r;
        } catch (e) { return null; }
      }).filter(function (r) { return r && r.module === state.module && r.stack; });
    } catch (e) { return []; }
  }
  function profiles() {
    try {
      if (!fs.existsSync(PROFILES_DIR)) return [];
      return fs.readdirSync(PROFILES_DIR).filter(function (f) { return /\.json$/i.test(f); })
        .map(function (f) { return f.replace(/\.json$/i, ''); });
    } catch (e) { return []; }
  }

  // ------------------------------------------------------------------ render
  function renderTabs() {
    var tabs = $('tabs');
    tabs.innerHTML = '';
    SCHEMA.modules.forEach(function (m) {
      tabs.appendChild(el('button', {
        cls: m.id === state.module ? 'on' : '', text: m.name, title: m.desc,
        onclick: function () { state.module = m.id; saveState(); renderAll(); schedulePreview(); }
      }));
    });
    var mod = SCHEMA.modules.filter(function (m) { return m.id === state.module; })[0];
    $('moduleDesc').textContent = mod ? mod.desc : '';
    $('cleanTools').classList.toggle('hidden', state.module !== 'clean');
  }

  function renderPresets() {
    var sel = $('presetSelect');
    sel.innerHTML = '';
    sel.appendChild(el('option', { value: '', text: '— Recetas —' }));
    var g1 = el('optgroup', { label: 'ENTERGALACTIC' });
    SCHEMA.presets.forEach(function (p, i) {
      if (p.module === state.module) g1.appendChild(el('option', { value: 'b:' + i, text: p.name }));
    });
    sel.appendChild(g1);
    var mine = userRecipes();
    if (mine.length) {
      var g2 = el('optgroup', { label: 'Mis recetas' });
      mine.forEach(function (r) { g2.appendChild(el('option', { value: 'u:' + r.file, text: r.name })); });
      sel.appendChild(g2);
    }
  }

  function renderAddFilter() {
    var sel = $('addFilter');
    sel.innerHTML = '';
    var own = SCHEMA.filters.filter(function (f) { return f.modules.indexOf(state.module) >= 0; });
    var others = SCHEMA.filters.filter(function (f) { return f.modules.indexOf(state.module) < 0; });
    var g1 = el('optgroup', { label: 'Filtros de este módulo' });
    own.forEach(function (f) { g1.appendChild(el('option', { value: f.id, text: f.name })); });
    var g2 = el('optgroup', { label: 'De otros módulos' });
    others.forEach(function (f) { g2.appendChild(el('option', { value: f.id, text: f.name })); });
    sel.appendChild(g1);
    sel.appendChild(g2);
  }

  function fmt(p, v) {
    if (p.type === 'hue') return Math.round(v) + '°';
    var s = (p.step && p.step < 1) ? Number(v).toFixed(1) : String(Math.round(v));
    return s + (p.unit === '%' ? '%' : p.unit === '°' ? '°' : '');
  }

  function rangeControl(p, value, onChange) {
    var out = el('output', { text: fmt(p, value) });
    var input = el('input', { type: 'range', min: p.min, max: p.max, step: p.step || 1, value: value });
    if (p.type === 'hue') input.className = 'hue';
    input.addEventListener('input', function () { out.textContent = fmt(p, Number(input.value)); onChange(Number(input.value), false); });
    input.addEventListener('change', function () { onChange(Number(input.value), true); });
    input.addEventListener('dblclick', function () { input.value = p.default; out.textContent = fmt(p, p.default); onChange(p.default, true); });
    return el('div', { cls: 'param' }, [el('span', { cls: 'lbl', text: p.label, title: p.label + ' (doble clic: restablecer)' }), input, out]);
  }

  function selectControl(label, options, value, onChange) {
    var s = el('select');
    options.forEach(function (o) { s.appendChild(el('option', { value: o[0], text: o[1] })); });
    s.value = value;
    s.addEventListener('change', function () { onChange(s.value, true); });
    return el('div', { cls: 'param' }, [el('span', { cls: 'lbl', text: label }), s]);
  }

  function paramControl(item, p) {
    var set = function (v, commit) { item.params[p.id] = v; if (commit) { saveState(); schedulePreview(); } };
    var v = item.params[p.id] !== undefined ? item.params[p.id] : p.default;
    if (p.type === 'range' || p.type === 'hue') return rangeControl(p, v, set);
    if (p.type === 'select') return selectControl(p.label, p.options, v, set);
    if (p.type === 'profile') {
      var opts = p.options.concat(profiles().map(function (n) { return [n, 'Cámara: ' + n]; }));
      return selectControl(p.label, opts, v, set);
    }
    if (p.type === 'check') {
      var cb = el('input', { type: 'checkbox' });
      cb.checked = !!v;
      cb.addEventListener('change', function () { set(cb.checked, true); });
      return el('label', { cls: 'check' }, [cb, p.label]);
    }
    return null;
  }

  function renderCard(item, idx, total) {
    var f = FILTERS[item.id];
    var id = uid(item);
    var card = el('div', { cls: 'card' + (item.enabled === false ? ' off' : '') + (openCards[id] ? ' open' : '') });
    var en = el('input', { type: 'checkbox', title: 'Activar / desactivar' });
    en.checked = item.enabled !== false;
    en.addEventListener('click', function (e) { e.stopPropagation(); });
    en.addEventListener('change', function () { item.enabled = en.checked; saveState(); renderStack(); schedulePreview(); });
    var act = function (label, title, fn, disabled) {
      var b = el('button', { text: label, title: title });
      b.disabled = !!disabled;
      b.addEventListener('click', function (e) { e.stopPropagation(); fn(); });
      return b;
    };
    var head = el('div', { cls: 'card-head' }, [
      el('span', { cls: 'caret', text: '▸' }), el('span', { cls: 'num', text: String(idx + 1) }), en,
      el('span', { cls: 'name', text: f ? f.name : item.id }),
      el('span', { cls: 'op', text: Math.round(item.opacity) + '%' }),
      act('▲', 'Subir', function () { move(idx, -1); }, idx === 0),
      act('▼', 'Bajar', function () { move(idx, 1); }, idx === total - 1),
      act('⧉', 'Duplicar', function () { duplicate(idx); }, total >= SCHEMA.max_stack),
      act('✕', 'Quitar', function () { removeAt(idx); })
    ]);
    head.addEventListener('click', function () { openCards[id] = !openCards[id]; card.classList.toggle('open'); });
    card.appendChild(head);
    if (!f) { card.appendChild(el('div', { cls: 'card-body' }, [el('p', { cls: 'desc', text: 'Filtro desconocido.' })])); return card; }

    var body = el('div', { cls: 'card-body' }, [el('p', { cls: 'desc', text: f.desc })]);
    f.params.forEach(function (p) { var c = paramControl(item, p); if (c) body.appendChild(c); });

    // Fusión, opacidad y máscara
    var sub = el('div', { cls: 'sub' });
    sub.appendChild(rangeControl({ label: 'Opacidad', min: 0, max: 100, step: 1, default: 100, unit: '%' }, item.opacity,
      function (v, commit) { item.opacity = v; head.querySelector('.op').textContent = Math.round(v) + '%'; if (commit) { saveState(); schedulePreview(); } }));
    if (!f.resizes) {
      sub.appendChild(selectControl('Fusión', SCHEMA.blend_modes.map(function (b) { return [b.id, b.name]; }), item.blend || 'normal',
        function (v) { item.blend = v; saveState(); schedulePreview(); }));
      item.mask = item.mask || { type: 'all' };
      var mask = item.mask;
      sub.appendChild(selectControl('Aplicar a', SCHEMA.mask_types.map(function (m) { return [m.id, m.name]; }), mask.type || 'all',
        function (v) { mask.type = v; saveState(); renderStack(); schedulePreview(); }));
      var mset = function (k) { return function (v, commit) { mask[k] = v; if (commit) { saveState(); schedulePreview(); } }; };
      if (mask.type === 'color') {
        sub.appendChild(rangeControl({ label: 'Color', type: 'hue', min: 0, max: 360, default: 30 }, mask.hue !== undefined ? mask.hue : 30, mset('hue')));
        sub.appendChild(rangeControl({ label: 'Amplitud', min: 10, max: 120, step: 1, default: 40, unit: '°' }, mask.width !== undefined ? mask.width : 40, mset('width')));
      }
      if (mask.type && mask.type !== 'all') {
        sub.appendChild(rangeControl({ label: 'Suavidad', min: 0, max: 100, step: 1, default: 50 }, mask.softness !== undefined ? mask.softness : 50, mset('softness')));
        var inv = el('input', { type: 'checkbox' });
        inv.checked = !!mask.invert;
        inv.addEventListener('change', function () { mask.invert = inv.checked; saveState(); schedulePreview(); });
        sub.appendChild(el('label', { cls: 'check' }, [inv, 'Invertir máscara']));
      }
    }
    body.appendChild(sub);
    card.appendChild(body);
    return card;
  }

  function renderStack() {
    var st = stack();
    var box = $('stack');
    box.innerHTML = '';
    st.forEach(function (item, i) { box.appendChild(renderCard(item, i, st.length)); });
    $('stackCount').textContent = st.length + ' / ' + SCHEMA.max_stack;
    $('btnAdd').disabled = st.length >= SCHEMA.max_stack;
  }

  function renderAll() {
    renderTabs();
    renderPresets();
    renderAddFilter();
    renderStack();
    $('previewMode').value = state.previewMode;
    $('focus').value = state.focus;
    $('focus').style.display = state.previewMode === 'crop' ? '' : 'none';
    $('source').value = state.source;
    $('target').value = state.target;
    $('useMask').checked = !!state.useMask;
    $('python').value = state.python;
  }

  // ------------------------------------------------------------------ edición de la pila
  function move(i, d) {
    var st = stack(), j = i + d;
    if (j < 0 || j >= st.length) return;
    var t = st[i]; st[i] = st[j]; st[j] = t;
    saveState(); renderStack(); schedulePreview();
  }
  function duplicate(i) {
    var st = stack();
    if (st.length >= SCHEMA.max_stack) return;
    st.splice(i + 1, 0, clone(st[i]));
    saveState(); renderStack(); schedulePreview();
  }
  function removeAt(i) {
    stack().splice(i, 1);
    saveState(); renderStack(); schedulePreview();
  }

  // ------------------------------------------------------------------ UI de estado
  function setStatus(msg, kind) {
    $('status').textContent = msg || '';
    $('status').className = 'status' + (kind ? ' ' + kind : '');
  }
  function setProgress(frac, label) {
    if (frac === null) { $('progress').classList.add('hidden'); return; }
    $('progress').classList.remove('hidden');
    $('bar').style.width = Math.round(frac * 100) + '%';
    $('stage').textContent = (label || '') + ' ' + Math.round(frac * 100) + '%';
  }
  function setBusy(busy, what) {
    ['btnPreview', 'btnCheck', 'btnMeasure'].forEach(function (id) { $(id).disabled = busy; });
    $('btnApply').textContent = busy && what === 'apply' ? 'Cancelar' : 'Aplicar';
    $('btnApply').disabled = busy && what !== 'apply';
  }

  function refreshDocInfo() {
    return jsx('eg_docInfo').then(function (p) {
      lastDoc = { name: p[0], w: +p[1], h: +p[2], bits: +p[3], sel: p[4] === '1' };
      $('docInfo').textContent = p[0] + ' · ' + p[1] + '×' + p[2] + ' · ' + p[3] + ' bits' + (lastDoc.sel ? ' · selección' : '');
      return lastDoc;
    }, function () { lastDoc = null; $('docInfo').textContent = 'Sin documento'; return null; });
  }

  // ------------------------------------------------------------------ Python
  function splitCommand(cmd) {
    var out = [], m, re = /"([^"]*)"|'([^']*)'|(\S+)/g;
    cmd = String(cmd || '').trim();
    if (cmd && fs.existsSync(cmd)) return [cmd];
    while ((m = re.exec(cmd))) out.push(m[1] || m[2] || m[3]);
    return out;
  }
  function childEnv() {
    var env = Object.assign({}, process.env, { PYTHONIOENCODING: 'utf-8', PYTHONUNBUFFERED: '1' });
    if (!IS_WIN) env.PATH = ['/opt/homebrew/bin', '/usr/local/bin', '/usr/bin', '/bin', env.PATH || ''].join(':');
    return env;
  }
  function runEngine(args, onProgress) {
    var cmd = splitCommand(state.python);
    if (!cmd.length) return Promise.reject(new Error('Configura el comando de Python en Ajustes.'));
    args = args.concat(['--profiles-dir', PROFILES_DIR]);
    return new Promise(function (resolve, reject) {
      var proc;
      try { proc = cp.spawn(cmd[0], cmd.slice(1).concat([ENGINE]).concat(args), { env: childEnv(), windowsHide: true }); }
      catch (e) { return reject(e); }
      running = proc;
      var buf = '', errBuf = '', result = null;
      var handle = function (line) {
        if (!line.trim()) return;
        var msg;
        try { msg = JSON.parse(line); } catch (e) { return; }
        if ('ok' in msg) result = msg;
        else if (onProgress && 'progress' in msg) onProgress(msg.progress, msg.stage);
      };
      proc.stdout.on('data', function (d) {
        buf += d.toString('utf8');
        var lines = buf.split('\n');
        buf = lines.pop();
        lines.forEach(handle);
      });
      proc.stderr.on('data', function (d) { errBuf += d.toString('utf8'); });
      proc.on('error', function (e) {
        running = null;
        reject(new Error('No se pudo ejecutar Python («' + state.python + '»): ' + e.message + '. Revisa Ajustes.'));
      });
      proc.on('close', function (code, signal) {
        running = null;
        handle(buf);
        if (signal) return reject(new Error('Cancelado.'));
        if (result && result.ok) return resolve(result);
        if (result) return reject(new Error(result.error));
        reject(new Error('El motor terminó con código ' + code + '. ' + errBuf.trim().split('\n').slice(-3).join(' ')));
      });
    });
  }

  function recipeFile() {
    mkdirp(TMP_DIR);
    var file = path.join(TMP_DIR, 'recipe.json');
    fs.writeFileSync(file, JSON.stringify({ module: state.module, stack: stack() }), 'utf8');
    return file;
  }
  function exportInput(name) {
    mkdirp(TMP_DIR);
    var file = path.join(TMP_DIR, name);
    return jsx('eg_export', [file.replace(/\\/g, '/'), state.source]).then(function () { return file; });
  }
  function dataUri(file) { return 'data:image/png;base64,' + fs.readFileSync(file).toString('base64'); }

  // ------------------------------------------------------------------ vista previa
  function doPreview(forceExport) {
    if (running) return;
    var compare = $('compare');
    setBusy(true, 'preview');
    compare.classList.add('loading');
    setStatus('Generando vista previa…');
    refreshDocInfo().then(function (info) {
      if (!info) throw new Error('Abre una imagen en Photoshop.');
      var key = [info.name, info.w, info.h, state.source].join('|');
      if (!forceExport && previewSrc && previewSrc.key === key && fs.existsSync(previewSrc.file)) return previewSrc.file;
      return exportInput('preview_src.png').then(function (f) { previewSrc = { key: key, file: f }; return f; });
    }).then(function (src) {
      var fc = String(state.focus).split(',');
      var size = state.previewMode === 'crop' ? 480 : Math.max(480, Math.min(900, Math.round($('compare').clientWidth * 2)));
      return runEngine(['-i', src, '--recipe', recipeFile(), '--preview', path.join(TMP_DIR, 'preview'),
        '--preview-mode', state.previewMode, '--preview-size', String(size), '--cx', fc[0], '--cy', fc[1]]);
    }).then(function (res) {
      $('imgBefore').src = dataUri(res.preview.before);
      $('imgAfter').src = dataUri(res.preview.after);
      compare.classList.remove('empty');
      sizeBefore();
      setStatus('Vista previa (' + res.seconds + ' s).');
    }).catch(function (e) {
      setStatus(e.message, 'error');
    }).then(function () {
      compare.classList.remove('loading');
      setBusy(false);
    });
  }
  function schedulePreview() {
    if ($('compare').classList.contains('empty')) return;
    clearTimeout(previewTimer);
    previewTimer = setTimeout(function () { if (!running) doPreview(false); else schedulePreview(); }, 450);
  }
  function sizeBefore() {
    var inner = $('compare').querySelector('.compare-inner');
    $('imgBefore').style.width = inner.clientWidth + 'px';
    $('imgBefore').style.height = inner.clientHeight + 'px';
  }
  function setSplit(x) {
    var r = $('compare').getBoundingClientRect();
    var pct = Math.max(0, Math.min(100, (x - r.left) / r.width * 100));
    $('beforeWrap').style.width = pct + '%';
    $('handle').style.left = pct + '%';
  }

  // ------------------------------------------------------------------ aplicar
  function doApply() {
    if (running) { try { running.kill(); } catch (e) { /* ya terminó */ } return; }
    if (!stack().some(function (it) { return it.enabled !== false; })) { setStatus('Añade al menos un filtro.', 'error'); return; }
    var started = Date.now(), docName = '', modName = state.module;
    setBusy(true, 'apply');
    setProgress(0, 'Exportando');
    setStatus('Exportando desde Photoshop…');
    refreshDocInfo().then(function (info) {
      if (!info) throw new Error('Abre una imagen en Photoshop.');
      docName = info.name.replace(/\.[^.]+$/, '');
      return exportInput('input.png');
    }).then(function (src) {
      setStatus('Procesando…');
      var out = path.join(TMP_DIR, 'output_' + Date.now() + '.png');
      return runEngine(['-i', src, '-o', out, '--recipe', recipeFile()], setProgress);
    }).then(function (res) {
      setProgress(1, 'Importando');
      var asDoc = (res.resized || state.target === 'doc') ? '1' : '0';
      var layerName = LAYER_NAMES[modName] || 'ENTERGALACTIC';
      return jsx('eg_import', [res.output.replace(/\\/g, '/'), asDoc, docName + '_' + modName, layerName, state.useMask ? '1' : '0'])
        .then(function (r) {
          try { fs.unlinkSync(res.output); } catch (e) { /* temporal */ }
          var secs = ((Date.now() - started) / 1000).toFixed(1);
          var msg = r[0] === 'doc' ? 'Abierto como documento nuevo' : ('Capa «' + layerName + '» añadida' + (r[1] === '1' ? ' con máscara de la selección' : ''));
          setStatus(msg + ' (' + res.width + '×' + res.height + ', ' + secs + ' s).', 'ok');
        });
    }).catch(function (e) {
      setStatus(e.message, 'error');
    }).then(function () { setProgress(null); setBusy(false); });
  }

  // ------------------------------------------------------------------ recetas
  function loadPreset(value) {
    if (!value) return;
    var st;
    if (value.indexOf('b:') === 0) st = clone(SCHEMA.presets[Number(value.slice(2))].stack);
    else {
      var r = JSON.parse(fs.readFileSync(path.join(RECIPES_DIR, value.slice(2)), 'utf8'));
      st = r.stack;
    }
    state.stacks[state.module] = st.slice(0, SCHEMA.max_stack);
    openCards = {};
    saveState(); renderStack(); schedulePreview();
  }
  function saveRecipe() {
    var name = $('recipeName').value.trim();
    if (!name) { setStatus('Escribe un nombre para la receta.', 'error'); return; }
    var safe = name.replace(/[\\/:*?"<>|]/g, '_');
    mkdirp(RECIPES_DIR);
    fs.writeFileSync(path.join(RECIPES_DIR, state.module + ' - ' + safe + '.json'),
      JSON.stringify({ module: state.module, name: name, stack: stack() }, null, 2), 'utf8');
    $('saveRow').classList.add('hidden');
    $('recipeName').value = '';
    renderPresets();
    setStatus('Receta «' + name + '» guardada en ' + RECIPES_DIR, 'ok');
  }
  function deleteRecipe() {
    var v = $('presetSelect').value;
    if (v.indexOf('u:') !== 0) { setStatus('Elige una de «Mis recetas» para borrarla.', 'error'); return; }
    try { fs.unlinkSync(path.join(RECIPES_DIR, v.slice(2))); } catch (e) { /* ya no existe */ }
    renderPresets();
    setStatus('Receta borrada.');
  }

  // ------------------------------------------------------------------ perfiles de ruido
  function measureProfile() {
    var name = $('profileName').value.trim();
    if (!name) { setStatus('Escribe un nombre para el perfil (cámara e ISO).', 'error'); return; }
    setBusy(true, 'measure');
    $('profileOut').textContent = 'Midiendo…';
    mkdirp(PROFILES_DIR);
    refreshDocInfo().then(function (info) {
      if (!info) throw new Error('Abre una foto de esa cámara.');
      return exportInput('profile_src.png');
    }).then(function (src) {
      return runEngine(['-i', src, '--measure-noise', '--save-profile', name]);
    }).then(function (res) {
      var p = res.profile, f = function (a) { return a.map(function (x) { return (x * 100).toFixed(2); }).join(' / '); };
      $('profileOut').textContent = 'Perfil «' + res.saved + '» guardado.\nRuido luminancia (sombras/medios/luces): ' + f(p.luma) +
        ' %\nRuido de color: ' + f(p.chroma) + ' %\nElígelo en «Perfil de ruido» del filtro Reducción de ruido.';
      renderStack();
    }).catch(function (e) {
      $('profileOut').textContent = e.message;
    }).then(function () { setBusy(false); });
  }

  function doCheck() {
    setBusy(true, 'check');
    $('checkOut').textContent = 'Comprobando…';
    runEngine(['--check']).then(function (res) {
      var c = res.check, m = c.models || {};
      var names = { fast: 'IA rápida', balance: 'IA equilibrada', quality: 'IA calidad' };
      var lines = ['ENTERGALACTIC ' + c.version + ' · ' + c.filters + ' filtros',
        'Python ' + c.python + ' · NumPy ' + c.numpy + ' · OpenCV ' + c.opencv,
        'Super-resolución IA: ' + (c.dnn_superres ? 'sí' : 'NO (instala opencv-contrib-python)')];
      Object.keys(names).forEach(function (k) { lines.push('  ' + names[k] + ': ' + ((m[k] || []).length ? 'x' + m[k].join(', x') : 'no descargado')); });
      lines.push('Perfiles de cámara: ' + (c.profiles.length ? c.profiles.join(', ') : 'ninguno'));
      lines.push('Recetas y perfiles: ' + USER_DIR);
      $('checkOut').textContent = lines.join('\n');
    }).catch(function (e) {
      $('checkOut').textContent = e.message + '\n\nMotor: ' + ENGINE;
    }).then(function () { setBusy(false); });
  }

  function openFolder() {
    mkdirp(RECIPES_DIR);
    cp.exec((IS_WIN ? 'explorer "' : 'open "') + USER_DIR + '"');
  }

  // ------------------------------------------------------------------ eventos
  function bind() {
    $('btnPreview').addEventListener('click', function () { doPreview(true); });
    $('btnApply').addEventListener('click', doApply);
    $('btnCheck').addEventListener('click', doCheck);
    $('btnMeasure').addEventListener('click', measureProfile);
    $('btnOpenFolder').addEventListener('click', openFolder);
    $('btnSaveRecipe').addEventListener('click', function () { $('saveRow').classList.remove('hidden'); $('recipeName').focus(); });
    $('btnSaveOk').addEventListener('click', saveRecipe);
    $('recipeName').addEventListener('keydown', function (e) { if (e.keyCode === 13) saveRecipe(); });
    $('btnSaveCancel').addEventListener('click', function () { $('saveRow').classList.add('hidden'); });
    $('btnDeleteRecipe').addEventListener('click', deleteRecipe);
    $('presetSelect').addEventListener('change', function (e) { loadPreset(e.target.value); });
    $('btnAdd').addEventListener('click', function () {
      if (stack().length >= SCHEMA.max_stack) return;
      var item = newItem($('addFilter').value);
      stack().push(item);
      openCards[uid(item)] = true;
      saveState(); renderStack(); schedulePreview();
    });
    $('btnClear').addEventListener('click', function () { state.stacks[state.module] = []; saveState(); renderStack(); schedulePreview(); });
    $('previewMode').addEventListener('change', function (e) {
      state.previewMode = e.target.value;
      $('focus').style.display = state.previewMode === 'crop' ? '' : 'none';
      saveState(); schedulePreview();
    });
    $('focus').addEventListener('change', function (e) { state.focus = e.target.value; saveState(); schedulePreview(); });
    $('source').addEventListener('change', function (e) { state.source = e.target.value; previewSrc = null; saveState(); schedulePreview(); });
    $('target').addEventListener('change', function (e) { state.target = e.target.value; saveState(); });
    $('useMask').addEventListener('change', function (e) { state.useMask = e.target.checked; saveState(); });
    $('python').addEventListener('change', function (e) { state.python = e.target.value.trim(); saveState(); });
    $('btnReset').addEventListener('click', function () {
      var py = state.python;
      try { localStorage.removeItem(STORE_KEY); } catch (e) { /* nada */ }
      state = loadState();
      state.python = py;
      saveState(); renderAll();
    });
    var dragging = false;
    $('compare').addEventListener('mousedown', function (e) { dragging = true; setSplit(e.clientX); });
    window.addEventListener('mousemove', function (e) { if (dragging) setSplit(e.clientX); });
    window.addEventListener('mouseup', function () { dragging = false; });
    window.addEventListener('resize', sizeBefore);
    window.addEventListener('focus', function () { refreshDocInfo(); });
  }

  renderAll();
  bind();
  refreshDocInfo();
})();
