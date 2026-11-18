/* ENTERGALACTIC móvil — núcleo del motor (port fiel de eg/core.py).
 * Imágenes: {w, h, c, d: Float32Array} con canales intercalados (RGB en [0,1]).
 * Funciona en navegador, Web Worker y Node (para los tests contra el motor Python).
 */
(function (root) {
  'use strict';
  var EPS = 1e-6;
  var LR = 0.2126, LG = 0.7152, LB = 0.0722;

  function img(w, h, c, d) { return { w: w, h: h, c: c, d: d || new Float32Array(w * h * c) }; }
  function clone(a) { return img(a.w, a.h, a.c, new Float32Array(a.d)); }
  function clamp(x, lo, hi) { return x < lo ? lo : (x > hi ? hi : x); }
  function clip01(x) { return x < 0 ? 0 : (x > 1 ? 1 : x); }
  function fmod(a, n) { var r = a % n; return r < 0 ? r + n : r; }
  function smooth(e0, e1, x) {
    var t = (x - e0) / Math.max(e1 - e0, EPS);
    t = t < 0 ? 0 : (t > 1 ? 1 : t);
    return t * t * (3 - 2 * t);
  }

  // ------------------------------------------------------------------ color
  function luminance(a) {
    var n = a.w * a.h, out = img(a.w, a.h, 1), d = a.d, o = out.d;
    for (var i = 0, j = 0; i < n; i++, j += 3) o[i] = d[j] * LR + d[j + 1] * LG + d[j + 2] * LB;
    return out;
  }
  // clip_preserve para un píxel: escribe en o[j..j+2]
  function clipPx(r, g, b, o, j) {
    var hi = r > g ? (r > b ? r : b) : (g > b ? g : b);
    var lo = r < g ? (r < b ? r : b) : (g < b ? g : b);
    if (hi <= 1 && lo >= 0) { o[j] = r; o[j + 1] = g; o[j + 2] = b; return; }
    var l = clip01(r * LR + g * LG + b * LB), t = 1;
    if (hi > 1) t = Math.min(t, (1 - l) / Math.max(hi - l, EPS));
    if (lo < 0) t = Math.min(t, l / Math.max(l - lo, EPS));
    t = clip01(t);
    o[j] = clip01(l + (r - l) * t); o[j + 1] = clip01(l + (g - l) * t); o[j + 2] = clip01(l + (b - l) * t);
  }
  function clipPreserve(a) {
    var out = img(a.w, a.h, 3), d = a.d, o = out.d;
    for (var j = 0; j < d.length; j += 3) clipPx(d[j], d[j + 1], d[j + 2], o, j);
    return out;
  }
  function setLuminance(a, L) {
    var out = img(a.w, a.h, 3), d = a.d, o = out.d, l = L.d;
    for (var i = 0, j = 0; i < l.length; i++, j += 3) {
      var dl = l[i] - (d[j] * LR + d[j + 1] * LG + d[j + 2] * LB);
      clipPx(d[j] + dl, d[j + 1] + dl, d[j + 2] + dl, o, j);
    }
    return out;
  }
  function saturate(a, amt) {
    var out = img(a.w, a.h, 3), d = a.d, o = out.d;
    for (var j = 0; j < d.length; j += 3) {
      var l = d[j] * LR + d[j + 1] * LG + d[j + 2] * LB;
      clipPx(l + (d[j] - l) * amt, l + (d[j + 1] - l) * amt, l + (d[j + 2] - l) * amt, o, j);
    }
    return out;
  }
  // HSV con la misma semántica que OpenCV en coma flotante (H en grados).
  function rgb2hsv(r, g, b, o, j) {
    r = clip01(r); g = clip01(g); b = clip01(b);
    var v = Math.max(r, g, b), mn = Math.min(r, g, b), diff = v - mn;
    var s = diff / (Math.abs(v) + 1.1920929e-7), h;
    var k = 60 / (diff + 1.1920929e-7);
    if (v === r) h = (g - b) * k; else if (v === g) h = (b - r) * k + 120; else h = (r - g) * k + 240;
    if (h < 0) h += 360;
    o[j] = h; o[j + 1] = s; o[j + 2] = v;
  }
  function hsv2rgb(h, s, v, o, j) {
    if (s === 0) { o[j] = o[j + 1] = o[j + 2] = v; return; }
    h = h / 60;
    while (h < 0) h += 6;
    while (h >= 6) h -= 6;
    var sec = Math.floor(h), f = h - sec;
    var p = v * (1 - s), q = v * (1 - s * f), t = v * (1 - s * (1 - f)), r, g, b;
    switch (sec) {
      case 0: r = v; g = t; b = p; break;
      case 1: r = q; g = v; b = p; break;
      case 2: r = p; g = v; b = t; break;
      case 3: r = p; g = q; b = v; break;
      case 4: r = t; g = p; b = v; break;
      default: r = v; g = p; b = q;
    }
    o[j] = r; o[j + 1] = g; o[j + 2] = b;
  }
  function toHSV(a) {
    var out = img(a.w, a.h, 3), d = a.d;
    for (var j = 0; j < d.length; j += 3) rgb2hsv(d[j], d[j + 1], d[j + 2], out.d, j);
    return out;
  }
  function fromHSV(a) {
    var out = img(a.w, a.h, 3), d = a.d;
    for (var j = 0; j < d.length; j += 3) hsv2rgb(d[j], d[j + 1], d[j + 2], out.d, j);
    return out;
  }
  function hueColor(h, s, v) {
    var o = [0, 0, 0];
    hsv2rgb(fmod(h, 360), s === undefined ? 1 : s, v === undefined ? 1 : v, o, 0);
    return o;
  }
  function hexColor(hex) {
    hex = hex.replace('#', '');
    return [parseInt(hex.substr(0, 2), 16) / 255, parseInt(hex.substr(2, 2), 16) / 255, parseInt(hex.substr(4, 2), 16) / 255];
  }
  function hueWeight(h, center, width) {
    var d = Math.abs(fmod(h - center + 180, 360) - 180);
    var t = clip01(1 - d / Math.max(width, 1));
    return Math.pow(t, 1.5);
  }

  // ------------------------------------------------------------------ remuestreo (como cv2.resize)
  function resizeArea(a, nw, nh) {
    var t = areaH(a, nw);
    return areaV(t, nh);
  }
  function areaWeights(n, nn) {
    var sc = n / nn, list = [];
    for (var i = 0; i < nn; i++) {
      var s0 = i * sc, s1 = (i + 1) * sc, ws = [], k0 = Math.floor(s0);
      for (var k = k0; k < Math.min(n, Math.ceil(s1 - 1e-9)); k++) {
        var ov = Math.min(s1, k + 1) - Math.max(s0, k);
        if (ov > 1e-9) ws.push(k, ov / sc);
      }
      list.push(ws);
    }
    return list;
  }
  function areaH(a, nw) {
    var out = img(nw, a.h, a.c), W = areaWeights(a.w, nw), c = a.c, d = a.d, o = out.d;
    for (var y = 0; y < a.h; y++) {
      var row = y * a.w * c, orow = y * nw * c;
      for (var x = 0; x < nw; x++) {
        var ws = W[x];
        for (var ch = 0; ch < c; ch++) {
          var s = 0;
          for (var q = 0; q < ws.length; q += 2) s += d[row + ws[q] * c + ch] * ws[q + 1];
          o[orow + x * c + ch] = s;
        }
      }
    }
    return out;
  }
  function areaV(a, nh) {
    var out = img(a.w, nh, a.c), W = areaWeights(a.h, nh), rl = a.w * a.c, d = a.d, o = out.d;
    for (var y = 0; y < nh; y++) {
      var ws = W[y], orow = y * rl;
      for (var q = 0; q < ws.length; q += 2) {
        var srow = ws[q] * rl, wt = ws[q + 1];
        for (var i = 0; i < rl; i++) o[orow + i] += d[srow + i] * wt;
      }
    }
    return out;
  }
  function linearWeights(n, nn) {
    var sc = n / nn, idx = new Int32Array(nn * 2), wt = new Float32Array(nn);
    for (var i = 0; i < nn; i++) {
      var s = (i + 0.5) * sc - 0.5;
      if (s < 0) s = 0;
      var k = Math.floor(s), f = s - k;
      if (k >= n - 1) { k = n - 1; f = 0; }
      idx[2 * i] = k; idx[2 * i + 1] = Math.min(k + 1, n - 1); wt[i] = f;
    }
    return { idx: idx, wt: wt };
  }
  function resizeLinear(a, nw, nh) {
    var c = a.c, d = a.d;
    var X = linearWeights(a.w, nw), t = img(nw, a.h, c), td = t.d;
    for (var y = 0; y < a.h; y++) {
      var row = y * a.w * c, orow = y * nw * c;
      for (var x = 0; x < nw; x++) {
        var k0 = row + X.idx[2 * x] * c, k1 = row + X.idx[2 * x + 1] * c, f = X.wt[x];
        for (var ch = 0; ch < c; ch++) td[orow + x * c + ch] = d[k0 + ch] * (1 - f) + d[k1 + ch] * f;
      }
    }
    var Y = linearWeights(a.h, nh), out = img(nw, nh, c), o = out.d, rl = nw * c;
    for (var yy = 0; yy < nh; yy++) {
      var r0 = Y.idx[2 * yy] * rl, r1 = Y.idx[2 * yy + 1] * rl, g = Y.wt[yy], orw = yy * rl;
      for (var i = 0; i < rl; i++) o[orw + i] = td[r0 + i] * (1 - g) + td[r1 + i] * g;
    }
    return out;
  }
  function resize(a, nw, nh, mode) {
    if (nw === a.w && nh === a.h) return clone(a);
    if (mode === 'area' && nw <= a.w && nh <= a.h) return resizeArea(a, nw, nh);
    return resizeLinear(a, nw, nh);
  }

  // ------------------------------------------------------------------ desenfoque gaussiano (como cv2.GaussianBlur)
  function gaussKernel(sigma) {
    var ks = Math.round(sigma * 8 + 1) | 1, r = (ks - 1) >> 1, k = new Float32Array(ks), s = 0;
    for (var i = 0; i < ks; i++) { var x = i - r; k[i] = Math.exp(-(x * x) / (2 * sigma * sigma)); s += k[i]; }
    for (i = 0; i < ks; i++) k[i] /= s;
    return k;
  }
  function reflect101(i, n) {
    if (n === 1) return 0;
    while (i < 0 || i >= n) { if (i < 0) i = -i; if (i >= n) i = 2 * n - 2 - i; }
    return i;
  }
  function blurDirect(a, sigmaX, sigmaY) {
    var c = a.c, w = a.w, h = a.h, d = a.d;
    var kx = gaussKernel(sigmaX), rx = (kx.length - 1) >> 1;
    var ky = gaussKernel(sigmaY === undefined ? sigmaX : sigmaY), ry = (ky.length - 1) >> 1;
    var t = new Float32Array(d.length), o = new Float32Array(d.length);
    var ix = new Int32Array(w + 2 * rx);
    for (var i = -rx; i < w + rx; i++) ix[i + rx] = reflect101(i, w);
    for (var y = 0; y < h; y++) {
      var row = y * w * c;
      for (var x = 0; x < w; x++) {
        for (var ch = 0; ch < c; ch++) {
          var s = 0;
          for (var q = 0; q < kx.length; q++) s += d[row + ix[x + q] * c + ch] * kx[q];
          t[row + x * c + ch] = s;
        }
      }
    }
    var rl = w * c;
    for (y = 0; y < h; y++) {
      var orow = y * rl;
      for (var q2 = 0; q2 < ky.length; q2++) {
        var srow = reflect101(y + q2 - ry, h) * rl, wt = ky[q2];
        for (var p = 0; p < rl; p++) o[orow + p] += t[srow + p] * wt;
      }
    }
    return img(w, h, c, o);
  }
  // Aproximación del gaussiano con 3 desenfoques de caja (sumas acumuladas): coste
  // constante por píxel sea cual sea el radio. Error < 1 % frente al gaussiano exacto.
  function boxSizes(sigma) {
    var n = 3, wIdeal = Math.sqrt(12 * sigma * sigma / n + 1), wl = Math.floor(wIdeal);
    if (wl % 2 === 0) wl--;
    var wu = wl + 2, m = Math.round((12 * sigma * sigma - n * wl * wl - 4 * n * wl - 3 * n) / (-4 * wl - 4)), out = [];
    for (var i = 0; i < n; i++) out.push(i < m ? wl : wu);
    return out;
  }
  function boxPass(src, dst, w, h, c, r, horizontal) {
    var n = horizontal ? w : h, lines = horizontal ? h : w, step = horizontal ? c : w * c, inv = 1 / (2 * r + 1);
    for (var L = 0; L < lines; L++) {
      for (var ch = 0; ch < c; ch++) {
        var base = horizontal ? L * w * c + ch : L * c + ch, acc = 0, k;
        for (k = -r; k <= r; k++) acc += src[base + reflect101(k, n) * step];
        for (var i = 0; i < n; i++) {
          dst[base + i * step] = acc * inv;
          acc += src[base + reflect101(i + r + 1, n) * step] - src[base + reflect101(i - r, n) * step];
        }
      }
    }
  }
  function blurBox(a, sigma) {
    var sizes = boxSizes(sigma), x = new Float32Array(a.d), t = new Float32Array(a.d.length);
    for (var i = 0; i < 3; i++) {
      var r = (sizes[i] - 1) >> 1;
      if (r < 1) continue;
      boxPass(x, t, a.w, a.h, a.c, r, true);
      boxPass(t, x, a.w, a.h, a.c, r, false);
    }
    return img(a.w, a.h, a.c, x);
  }
  function blur(a, sigma) {
    if (sigma <= 0.05) return a;
    var f = Math.floor(sigma / 4);
    if (f >= 2 && Math.floor(Math.min(a.w, a.h) / f) >= 8) {
      var small = resizeArea(a, Math.max(1, Math.floor(a.w / f)), Math.max(1, Math.floor(a.h / f)));
      small = blurDirect(small, sigma / f);
      return resizeLinear(small, a.w, a.h);
    }
    return sigma >= 2.5 ? blurBox(a, sigma) : blurDirect(a, sigma);
  }

  // ------------------------------------------------------------------ potencias rápidas
  // x^e con e fijo para x en [0,1]: tabla de 4097 valores + interpolación lineal.
  function powLUT(e) {
    var N = 4096, t = new Float32Array(N + 2);
    for (var i = 0; i <= N; i++) t[i] = Math.pow(i / N, e);
    t[N + 1] = t[N];
    return function (x) {
      x = x <= 0 ? 0 : (x >= 1 ? 1 : x);
      var f = x * N, k = f | 0;
      return t[k] + (t[k + 1] - t[k]) * (f - k);
    };
  }

  // ------------------------------------------------------------------ curvas
  function interp(x, xs, ys) {
    if (x <= xs[0]) return ys[0];
    var n = xs.length;
    if (x >= xs[n - 1]) return ys[n - 1];
    for (var i = 1; i < n; i++) if (x <= xs[i]) return ys[i - 1] + (ys[i] - ys[i - 1]) * (x - xs[i - 1]) / (xs[i] - xs[i - 1]);
    return ys[n - 1];
  }
  function sCurveFn(amount) {
    if (amount === 0) return null;
    var k = 1 + 4 * Math.abs(amount), s0 = 1 / (1 + Math.exp(k * 0.5)), s1 = 1 / (1 + Math.exp(-k * 0.5));
    if (amount > 0) {
      var m = Math.min(1, amount * 1.5);
      return function (x) { var s = (1 / (1 + Math.exp(-k * (x - 0.5))) - s0) / (s1 - s0); return x + (s - x) * m; };
    }
    var f = 1 - 0.6 * Math.abs(amount);
    return function (x) { return 0.5 + (x - 0.5) * f; };
  }
  function sCurve(a, amount) {
    var fn = sCurveFn(amount);
    if (!fn) return a;
    var out = img(a.w, a.h, a.c), d = a.d, o = out.d;
    for (var i = 0; i < d.length; i++) o[i] = fn(d[i]);
    return out;
  }

  // ------------------------------------------------------------------ fusiones
  var BLEND = {
    normal: function (a, b) { return b; },
    multiply: function (a, b) { return a * b; },
    screen: function (a, b) { return 1 - (1 - a) * (1 - b); },
    overlay: function (a, b) { return a < 0.5 ? 2 * a * b : 1 - 2 * (1 - a) * (1 - b); },
    soft_light: function (a, b) {
      return b < 0.5 ? a - (1 - 2 * b) * a * (1 - a) : a + (2 * b - 1) * (Math.sqrt(clip01(a)) - a);
    },
    lighten: function (a, b) { return a > b ? a : b; },
    darken: function (a, b) { return a < b ? a : b; }
  };
  function blend(base, top, mode) {
    if (mode === 'normal') return top;
    if (mode === 'luminosity') return setLuminance(base, luminance(top));
    if (mode === 'color') return setLuminance(top, luminance(base));
    var f = BLEND[mode];
    if (!f) throw new Error('Modo de fusión desconocido: ' + mode);
    var out = img(base.w, base.h, 3), a = base.d, b = top.d, o = out.d;
    for (var i = 0; i < a.length; i++) o[i] = f(a[i], b[i]);
    return out;
  }

  // ------------------------------------------------------------------ contexto geométrico
  function Context(h, w, k, rect, seed, full) {
    this.h = h; this.w = w; this.k = k === undefined ? 1 : k;
    this.rect = rect || [0, 0, 1, 1];
    this.seed = seed === undefined ? 1 : seed;
    if (!full) {
      full = [Math.round(w / (this.rect[2] - this.rect[0]) / this.k), Math.round(h / (this.rect[3] - this.rect[1]) / this.k)];
    }
    this.full_w = full[0]; this.full_h = full[1];
    this.alpha = null; this.last_scale = 1;
    this._grid = null;
  }
  Context.prototype.px = function (v) { return Math.max(0.3, v * this.k); };
  Object.defineProperty(Context.prototype, 'aspect', { get: function () { return this.full_w / Math.max(1, this.full_h); } });
  Context.prototype.grid = function () {
    if (!this._grid || this._grid.w !== this.w || this._grid.h !== this.h) {
      var r = this.rect, U = new Float32Array(this.w), V = new Float32Array(this.h);
      for (var x = 0; x < this.w; x++) U[x] = r[0] + (x + 0.5) / this.w * (r[2] - r[0]);
      for (var y = 0; y < this.h; y++) V[y] = r[1] + (y + 0.5) / this.h * (r[3] - r[1]);
      this._grid = { w: this.w, h: this.h, u: U, v: V };
    }
    return this._grid;
  };
  // Distancia radial (como Context.radial de Python) en un mapa de 1 canal.
  Context.prototype.radial = function (cx, cy, roundness) {
    if (cx === undefined) cx = 0.5; if (cy === undefined) cy = 0.5; if (roundness === undefined) roundness = 1;
    var g = this.grid(), a = this.aspect;
    var ax = a >= 1 ? 1 + (a - 1) * roundness : 1, ay = a < 1 ? 1 + (1 / a - 1) * roundness : 1;
    var norm = Math.sqrt(ax * ax + ay * ay), out = img(this.w, this.h, 1), o = out.d;
    for (var y = 0; y < this.h; y++) {
      var dy = (g.v[y] - cy) * 2 * ay;
      for (var x = 0; x < this.w; x++) {
        var dx = (g.u[x] - cx) * 2 * ax;
        o[y * this.w + x] = Math.sqrt(dx * dx + dy * dy) / norm;
      }
    }
    return out;
  };
  Context.prototype.small = function (maxSide) {
    maxSide = maxSide || 720;
    var f = Math.max(1, Math.max(this.h, this.w) / maxSide);
    var h = Math.max(1, Math.round(this.h / f)), w = Math.max(1, Math.round(this.w / f));
    return new Context(h, w, this.k * w / this.w, this.rect, this.seed, [this.full_w, this.full_h]);
  };
  Context.prototype.resized = function (h, w, scale) {
    var c = new Context(h, w, this.k * scale, this.rect, this.seed, [this.full_w, this.full_h]);
    c.alpha = this.alpha;
    return c;
  };
  Context.prototype.rng = function (salt) { return makeRng(((this.seed * 7919 + (salt || 0)) & 0x7fffffff) >>> 0); };

  // Generador pseudoaleatorio con semilla (mulberry32) + normales (Box-Muller).
  function makeRng(seed) {
    var s = (seed >>> 0) || 1, spare = null;
    function next() {
      s = (s + 0x6D2B79F5) >>> 0;
      var t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    return {
      random: next,
      uniform: function (a, b) { return a + (b - a) * next(); },
      integers: function (a, b) { return a + Math.floor(next() * (b - a)); },
      normal: function () {
        if (spare !== null) { var v = spare; spare = null; return v; }
        var u = 0, w = 0;
        while (u === 0) u = next();
        w = next();
        var m = Math.sqrt(-2 * Math.log(u));
        spare = m * Math.sin(2 * Math.PI * w);
        return m * Math.cos(2 * Math.PI * w);
      },
      choice: function (arr) { return arr[Math.floor(next() * arr.length)]; },
      pareto: function (a) { return Math.pow(1 - next(), -1 / a) - 1; }
    };
  }
  function noise1(w, h, rg) {
    var out = img(w, h, 1), o = out.d;
    for (var i = 0; i < o.length; i++) o[i] = rg.normal();
    return out;
  }
  function std(d) {
    var m = 0, n = d.length, i;
    for (i = 0; i < n; i++) m += d[i];
    m /= n;
    var v = 0;
    for (i = 0; i < n; i++) v += (d[i] - m) * (d[i] - m);
    return Math.sqrt(v / n);
  }

  // ------------------------------------------------------------------ máscaras
  function toneMaskVal(l, which, softness) {
    var s = 0.12 + 0.25 * softness;
    if (which === 'shadows') return 1 - smooth(0.25 - s, 0.25 + s, l);
    if (which === 'highlights') return smooth(0.75 - s, 0.75 + s, l);
    if (which === 'midtones') return Math.pow(clip01(1 - Math.abs(l - 0.5) / (0.25 + s)), 1.5);
    return 1;
  }
  function buildMask(a, spec, ctx) {
    if (!spec) return null;
    var t = spec.type || 'all';
    if (t === 'all') return null;
    var soft = (spec.softness === undefined ? 50 : spec.softness) / 100;
    var n = a.w * a.h, m = new Float32Array(n), d = a.d, i, x, y;
    if (t === 'shadows' || t === 'midtones' || t === 'highlights') {
      for (i = 0; i < n; i++) m[i] = toneMaskVal(d[3 * i] * LR + d[3 * i + 1] * LG + d[3 * i + 2] * LB, t, soft);
    } else if (t === 'color') {
      var hc = spec.hue === undefined ? 30 : spec.hue, wd = spec.width === undefined ? 40 : spec.width, tmp = [0, 0, 0];
      for (i = 0; i < n; i++) {
        rgb2hsv(d[3 * i], d[3 * i + 1], d[3 * i + 2], tmp, 0);
        m[i] = hueWeight(tmp[0], hc, wd) * smooth(0.05, 0.25, tmp[1]);
      }
    } else if (t === 'center' || t === 'edges') {
      var r = ctx.radial().d;
      for (i = 0; i < n; i++) { m[i] = 1 - smooth(0.35 - 0.3 * soft, 0.35 + 0.5 * soft, r[i]); if (t === 'edges') m[i] = 1 - m[i]; }
    } else if (t === 'top' || t === 'bottom') {
      var g = ctx.grid();
      for (y = 0; y < a.h; y++) for (x = 0; x < a.w; x++) {
        var mv = 1 - smooth(0.3 - 0.3 * soft, 0.5 + 0.3 * soft, g.v[y]);
        m[y * a.w + x] = t === 'bottom' ? 1 - mv : mv;
      }
    } else throw new Error('Máscara desconocida: ' + t);
    if (spec.invert) for (i = 0; i < n; i++) m[i] = 1 - m[i];
    return m;
  }

  // ------------------------------------------------------------------ ayudas de mapeo
  // map3(a, fn): fn(r,g,b,i,o,j) escribe en o[j..j+2]
  function map3(a, fn) {
    var out = img(a.w, a.h, 3), d = a.d, o = out.d;
    for (var i = 0, j = 0; j < d.length; i++, j += 3) fn(d[j], d[j + 1], d[j + 2], i, o, j);
    return out;
  }
  function mix(a, b, t) {   // a + (b - a) * t  (t número)
    var out = img(a.w, a.h, a.c), x = a.d, y = b.d, o = out.d;
    for (var i = 0; i < x.length; i++) o[i] = x[i] + (y[i] - x[i]) * t;
    return out;
  }
  function mixMap(a, b, m, scale) {   // a + (b - a) * m[i] * scale
    var out = img(a.w, a.h, 3), x = a.d, y = b.d, o = out.d;
    scale = scale === undefined ? 1 : scale;
    for (var i = 0, j = 0; j < x.length; i++, j += 3) {
      var t = m[i] * scale;
      o[j] = x[j] + (y[j] - x[j]) * t; o[j + 1] = x[j + 1] + (y[j + 1] - x[j + 1]) * t; o[j + 2] = x[j + 2] + (y[j + 2] - x[j + 2]) * t;
    }
    return out;
  }
  function gray3(L) {
    var out = img(L.w, L.h, 3), l = L.d, o = out.d;
    for (var i = 0; i < l.length; i++) o[3 * i] = o[3 * i + 1] = o[3 * i + 2] = l[i];
    return out;
  }
  function clipImg(a) {
    var out = img(a.w, a.h, a.c), d = a.d, o = out.d;
    for (var i = 0; i < d.length; i++) o[i] = clip01(d[i]);
    return out;
  }

  var core = {
    EPS: EPS, LR: LR, LG: LG, LB: LB, img: img, clone: clone, clamp: clamp, clip01: clip01, fmod: fmod, smooth: smooth,
    luminance: luminance, clipPx: clipPx, clipPreserve: clipPreserve, setLuminance: setLuminance, saturate: saturate,
    rgb2hsv: rgb2hsv, hsv2rgb: hsv2rgb, toHSV: toHSV, fromHSV: fromHSV, hueColor: hueColor, hexColor: hexColor,
    hueWeight: hueWeight, resize: resize, resizeArea: resizeArea, resizeLinear: resizeLinear, blur: blur,
    blurDirect: blurDirect, blurBox: blurBox, powLUT: powLUT, interp: interp, sCurve: sCurve, sCurveFn: sCurveFn, blend: blend, Context: Context,
    makeRng: makeRng, noise1: noise1, std: std, buildMask: buildMask, map3: map3, mix: mix, mixMap: mixMap,
    gray3: gray3, clipImg: clipImg
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = core;
  else root.EGCore = core;
})(typeof self !== 'undefined' ? self : this);
