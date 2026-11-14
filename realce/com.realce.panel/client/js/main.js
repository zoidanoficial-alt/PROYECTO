/* Realce IA - lógica del panel (CEP 8: Chromium 57 + Node 8). */
(function () {
  'use strict';

  var nodeRequire = (window.cep_node && window.cep_node.require) || window.require;
  var cp = nodeRequire('child_process');
  var fs = nodeRequire('fs');
  var os = nodeRequire('os');
  var path = nodeRequire('path');

  var IS_WIN = os.platform() === 'win32';
  var STORE_KEY = 'realce-ia-settings-v1';
  var TMP_DIR = path.join(os.tmpdir(), 'realce-ia');
  var DEFAULTS = {
    scale: 1, model: 'fast', denoise: 30, detail: 50, sharpen: 25, radius: 1.0,
    source: 'visible', focus: '0.5,0.5', python: IS_WIN ? 'python' : 'python3'
  };

  var $ = function (id) { return document.getElementById(id); };
  var state = loadSettings();
  var running = null;          // proceso de Python en curso
  var previewSrc = null;       // { key, file } entrada ya exportada para vista previa
  var previewTimer = null;

  // ------------------------------------------------------------------ CEP
  function extensionPath() {
    var p = decodeURI(window.__adobe_cep__.getSystemPath('extension'));
    return IS_WIN ? p.replace(/^file:\/\/\//, '') : p.replace(/^file:\/\//, '');
  }
  var ENGINE = path.join(extensionPath(), 'engine', 'realce_engine.py');

  function jsx(fn, args) {
    var call = fn + '(' + (args || []).map(function (a) { return JSON.stringify(String(a)); }).join(',') + ')';
    return new Promise(function (resolve, reject) {
      window.__adobe_cep__.evalScript(call, function (res) {
        if (typeof res !== 'string' || res === 'EvalScript error.') {
          return reject(new Error('Error en el script de Photoshop (' + fn + ')'));
        }
        var parts = res.split('|');
        if (parts[0] === 'ERR') return reject(new Error(parts.slice(1).join('|')));
        resolve(parts.slice(1));
      });
    });
  }

  // ------------------------------------------------------------------ ajustes
  function loadSettings() {
    var s = {};
    try { s = JSON.parse(localStorage.getItem(STORE_KEY) || '{}') || {}; } catch (e) { s = {}; }
    var out = {};
    Object.keys(DEFAULTS).forEach(function (k) { out[k] = k in s ? s[k] : DEFAULTS[k]; });
    return out;
  }
  function saveSettings() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* sin persistencia */ }
  }

  function renderControls() {
    ['denoise', 'detail', 'sharpen', 'radius'].forEach(function (id) {
      var el = $(id);
      el.value = state[id];
      el.nextElementSibling.textContent = id === 'radius' ? Number(state[id]).toFixed(1) : state[id];
    });
    ['model', 'source', 'focus'].forEach(function (id) { $(id).value = state[id]; });
    $('python').value = state.python;
    Array.prototype.forEach.call($('scale').children, function (b) {
      b.classList.toggle('on', Number(b.getAttribute('data-v')) === Number(state.scale));
    });
    $('model').disabled = Number(state.scale) === 1;
  }

  // ------------------------------------------------------------------ UI
  function setStatus(msg, isError) {
    $('status').textContent = msg || '';
    $('status').className = 'status' + (isError ? ' error' : '');
  }
  function setProgress(frac, label) {
    var box = $('progress');
    if (frac === null) { box.classList.add('hidden'); return; }
    box.classList.remove('hidden');
    $('bar').style.width = Math.round(frac * 100) + '%';
    $('stage').textContent = (label || '') + ' ' + Math.round(frac * 100) + '%';
  }
  function setBusy(busy, what) {
    $('btnPreview').disabled = busy;
    $('btnCheck').disabled = busy;
    $('btnApply').textContent = busy && what === 'apply' ? 'Cancelar' : 'Aplicar';
    $('btnApply').disabled = busy && what !== 'apply';
  }

  function refreshDocInfo() {
    return jsx('realce_docInfo').then(function (p) {
      $('docInfo').textContent = p[0] + ' · ' + p[1] + '×' + p[2] + ' · ' + p[3] + ' bits';
      return { name: p[0], w: +p[1], h: +p[2], bits: +p[3] };
    }, function () {
      $('docInfo').textContent = 'Sin documento';
      return null;
    });
  }

  // ------------------------------------------------------------------ Python
  function splitCommand(cmd) {
    var out = [], m, re = /"([^"]*)"|'([^']*)'|(\S+)/g;
    cmd = String(cmd || '').trim();
    // Una ruta existente con espacios sin comillas se toma tal cual.
    if (cmd && fs.existsSync(cmd)) return [cmd];
    while ((m = re.exec(cmd))) out.push(m[1] || m[2] || m[3]);
    return out;
  }

  function childEnv() {
    var env = Object.assign({}, process.env, { PYTHONIOENCODING: 'utf-8', PYTHONUNBUFFERED: '1' });
    if (!IS_WIN) {
      // Photoshop en macOS arranca con un PATH mínimo: añadimos rutas habituales.
      env.PATH = ['/opt/homebrew/bin', '/usr/local/bin', '/usr/bin', '/bin', env.PATH || ''].join(':');
    }
    return env;
  }

  function runEngine(args, onProgress) {
    var cmd = splitCommand(state.python);
    if (!cmd.length) return Promise.reject(new Error('Configura el comando de Python en Ajustes.'));
    return new Promise(function (resolve, reject) {
      var proc;
      try {
        proc = cp.spawn(cmd[0], cmd.slice(1).concat([ENGINE]).concat(args),
          { env: childEnv(), windowsHide: true });
      } catch (e) { return reject(e); }
      running = proc;
      var buf = '', errBuf = '', result = null;
      proc.stdout.on('data', function (d) {
        buf += d.toString('utf8');
        var lines = buf.split('\n');
        buf = lines.pop();
        lines.forEach(function (line) {
          if (!line.trim()) return;
          var msg;
          try { msg = JSON.parse(line); } catch (e) { return; }
          if ('ok' in msg) result = msg;
          else if (onProgress && 'progress' in msg) onProgress(msg.progress, msg.stage);
        });
      });
      proc.stderr.on('data', function (d) { errBuf += d.toString('utf8'); });
      proc.on('error', function (e) {
        running = null;
        reject(new Error('No se pudo ejecutar Python («' + state.python + '»): ' + e.message +
          '. Revisa el comando en Ajustes.'));
      });
      proc.on('close', function (code, signal) {
        running = null;
        if (buf.trim()) { try { var last = JSON.parse(buf); if ('ok' in last) result = last; } catch (e) { /* nada */ } }
        if (signal) return reject(new Error('Cancelado.'));
        if (result && result.ok) return resolve(result);
        if (result) return reject(new Error(result.error));
        reject(new Error('El motor terminó con código ' + code + '. ' + errBuf.trim().split('\n').slice(-3).join(' ')));
      });
    });
  }

  function engineArgs() {
    return ['--scale', state.scale, '--model', state.model, '--denoise', state.denoise,
      '--detail', state.detail, '--sharpen', state.sharpen, '--radius', state.radius].map(String);
  }

  function ensureTmp() {
    if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR);
    return TMP_DIR;
  }
  function slash(p) { return p.replace(/\\/g, '/'); }

  // ------------------------------------------------------------------ acciones
  function exportInput(name) {
    var file = path.join(ensureTmp(), name);
    return jsx('realce_export', [slash(file), state.source]).then(function () { return file; });
  }

  function dataUri(file) {
    return 'data:image/png;base64,' + fs.readFileSync(file).toString('base64');
  }

  function doPreview(forceExport) {
    if (running) return Promise.resolve();
    var compare = $('compare');
    setBusy(true, 'preview');
    setStatus('Generando vista previa…');
    compare.classList.add('loading');
    return refreshDocInfo().then(function (info) {
      if (!info) throw new Error('Abre una imagen en Photoshop.');
      var key = info.name + '|' + info.w + '|' + info.h + '|' + state.source;
      if (!forceExport && previewSrc && previewSrc.key === key && fs.existsSync(previewSrc.file)) {
        return previewSrc.file;
      }
      return exportInput('preview_src.png').then(function (f) { previewSrc = { key: key, file: f }; return f; });
    }).then(function (src) {
      var fc = String(state.focus).split(',');
      return runEngine(['-i', src, '--preview', path.join(TMP_DIR, 'preview'),
        '--cx', fc[0], '--cy', fc[1]].concat(engineArgs()));
    }).then(function (res) {
      $('imgBefore').src = dataUri(res.preview.before);
      $('imgAfter').src = dataUri(res.preview.after);
      compare.classList.remove('empty');
      sizeBefore();
      setStatus('Vista previa lista (' + res.seconds + ' s).');
    }).catch(function (e) {
      setStatus(e.message, true);
    }).then(function () {
      compare.classList.remove('loading');
      setBusy(false);
    });
  }

  function doApply() {
    if (running) { try { running.kill(); } catch (e) { /* ya terminó */ } return; }
    var docName = '';
    var started = Date.now();
    setBusy(true, 'apply');
    setStatus('Exportando desde Photoshop…');
    setProgress(0, 'Exportando');
    refreshDocInfo().then(function (info) {
      if (!info) throw new Error('Abre una imagen en Photoshop.');
      docName = info.name.replace(/\.[^.]+$/, '');
      return exportInput('input.png');
    }).then(function (src) {
      setStatus('Procesando…');
      var out = path.join(TMP_DIR, 'output_' + Date.now() + '.png');
      return runEngine(['-i', src, '-o', out].concat(engineArgs()), setProgress);
    }).then(function (res) {
      setProgress(1, 'Importando');
      var newDoc = Number(state.scale) > 1 ? '1' : '0';
      var newName = docName + (newDoc === '1' ? '_realce_x' + state.scale : '_realce');
      return jsx('realce_import', [slash(res.output), newDoc, newName]).then(function (r) {
        try { fs.unlinkSync(res.output); } catch (e) { /* temporal */ }
        var secs = ((Date.now() - started) / 1000).toFixed(1);
        setStatus((r[0] === 'doc' ? 'Abierto como documento nuevo (' : 'Añadido como capa «Realce IA» (') +
          res.width + '×' + res.height + ', ' + secs + ' s).');
      });
    }).catch(function (e) {
      setStatus(e.message, true);
    }).then(function () {
      setProgress(null);
      setBusy(false);
    });
  }

  function doCheck() {
    setBusy(true, 'check');
    $('checkOut').textContent = 'Comprobando…';
    runEngine(['--check']).then(function (res) {
      var c = res.check, m = c.models || {};
      var names = { fast: 'Rápido', balance: 'Equilibrado', quality: 'Calidad' };
      var lines = [
        'Python ' + c.python + ' · NumPy ' + c.numpy + ' · OpenCV ' + c.opencv,
        'Super-resolución IA: ' + (c.dnn_superres ? 'sí' : 'NO (instala opencv-contrib-python)')
      ];
      Object.keys(names).forEach(function (k) {
        lines.push('  ' + names[k] + ': ' + ((m[k] || []).length ? 'x' + m[k].join(', x') : 'no descargado'));
      });
      lines.push('Motor: ' + ENGINE);
      $('checkOut').textContent = lines.join('\n');
    }).catch(function (e) {
      $('checkOut').textContent = e.message + '\n\nMotor: ' + ENGINE;
    }).then(function () { setBusy(false); });
  }

  // ------------------------------------------------------------------ comparador
  function sizeBefore() {
    $('imgBefore').style.width = $('compare').clientWidth + 'px';
    $('imgBefore').style.height = $('compare').clientHeight + 'px';
  }
  function setSplit(clientX) {
    var r = $('compare').getBoundingClientRect();
    var pct = Math.max(0, Math.min(100, (clientX - r.left) / r.width * 100));
    $('beforeWrap').style.width = pct + '%';
    $('handle').style.left = pct + '%';
  }

  function schedulePreview() {
    if ($('compare').classList.contains('empty')) return;
    clearTimeout(previewTimer);
    previewTimer = setTimeout(function () { doPreview(false); }, 500);
  }

  // ------------------------------------------------------------------ eventos
  function bind() {
    ['denoise', 'detail', 'sharpen', 'radius'].forEach(function (id) {
      $(id).addEventListener('input', function (e) {
        state[id] = Number(e.target.value);
        e.target.nextElementSibling.textContent = id === 'radius' ? state[id].toFixed(1) : state[id];
      });
      $(id).addEventListener('change', function () { saveSettings(); schedulePreview(); });
    });
    ['model', 'focus'].forEach(function (id) {
      $(id).addEventListener('change', function (e) { state[id] = e.target.value; saveSettings(); schedulePreview(); });
    });
    $('source').addEventListener('change', function (e) {
      state.source = e.target.value; previewSrc = null; saveSettings(); schedulePreview();
    });
    $('python').addEventListener('change', function (e) { state.python = e.target.value.trim(); saveSettings(); });
    $('scale').addEventListener('click', function (e) {
      var v = e.target.getAttribute && e.target.getAttribute('data-v');
      if (!v) return;
      state.scale = Number(v); saveSettings(); renderControls(); schedulePreview();
    });
    $('btnPreview').addEventListener('click', function () { doPreview(true); });
    $('btnApply').addEventListener('click', doApply);
    $('btnCheck').addEventListener('click', doCheck);
    $('btnReset').addEventListener('click', function () {
      var py = state.python;
      state = Object.assign({}, DEFAULTS, { python: py });
      saveSettings(); renderControls();
    });

    var dragging = false;
    $('compare').addEventListener('mousedown', function (e) { dragging = true; setSplit(e.clientX); });
    window.addEventListener('mousemove', function (e) { if (dragging) setSplit(e.clientX); });
    window.addEventListener('mouseup', function () { dragging = false; });
    window.addEventListener('resize', sizeBefore);
    window.addEventListener('focus', refreshDocInfo);
  }

  renderControls();
  bind();
  refreshDocInfo();
})();
