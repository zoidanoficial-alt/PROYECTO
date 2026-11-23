/* CINELAB — motores de Película, Óptica, Cristal y Papel (port de filters_film.py,
 * filters_optics.py y paper_sim de filters_plata.py). Se añaden al catálogo de EGFilters.
 * Los perfiles de película llegan en schema.json (film_profiles) mediante setData().
 */
(function (root) {
  'use strict';
  var isNode = typeof module !== 'undefined' && module.exports;
  var C = isNode ? require('./eg-core.js') : root.EGCore;
  var E = isNode ? require('./eg-filters.js') : root.EGFilters;
  var F = E.filters, img = C.img, clip01 = C.clip01, smooth = C.smooth, LR = C.LR, LG = C.LG, LB = C.LB;
  var DATA = { profiles: {} };
  function px3(o, j, r, g, b) { o[j] = r; o[j + 1] = g; o[j + 2] = b; }
  function screenLayer(a, layer) {
    var out = img(a.w, a.h, 3);
    for (var i = 0; i < a.d.length; i++) out.d[i] = 1 - (1 - a.d[i]) * (1 - clip01(layer.d[i]));
    return out;
  }

  // ------------------------------------------------------------------ transformaciones geométricas (como cv2)
  function sampleBorder(a, x, y, c, mode) {
    // muestreo bilineal con borde 'reflect' (fedcba|abcdef) o 'zero'
    var w = a.w, h = a.h, x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0, s = 0;
    for (var dy = 0; dy < 2; dy++) for (var dx = 0; dx < 2; dx++) {
      var xi = x0 + dx, yi = y0 + dy, wt = (dx ? fx : 1 - fx) * (dy ? fy : 1 - fy);
      if (wt === 0) continue;
      if (mode === 'zero') { if (xi < 0 || yi < 0 || xi >= w || yi >= h) continue; }
      else {
        while (xi < 0 || xi >= w) xi = xi < 0 ? -xi - 1 : 2 * w - xi - 1;
        while (yi < 0 || yi >= h) yi = yi < 0 ? -yi - 1 : 2 * h - yi - 1;
      }
      s += a.d[(yi * w + xi) * a.c + c] * wt;
    }
    return s;
  }
  // M: [a, b, c, d, e, f] (2×3, convención de cv2.warpAffine: destino = M · origen)
  function warpAffine(a, M, mode) {
    var det = M[0] * M[4] - M[1] * M[3], ia = M[4] / det, ib = -M[1] / det, ic = -M[3] / det, id = M[0] / det;
    var out = img(a.w, a.h, a.c);
    for (var y = 0; y < a.h; y++) for (var x = 0; x < a.w; x++) {
      var X = x - M[2], Y = y - M[5], sx = ia * X + ib * Y, sy = ic * X + id * Y, o = (y * a.w + x) * a.c;
      for (var c = 0; c < a.c; c++) out.d[o + c] = sampleBorder(a, sx, sy, c, mode);
    }
    return out;
  }
  function rotMatrix(cx, cy, angDeg) {   // cv2.getRotationMatrix2D(center, angle, 1)
    var t = angDeg * Math.PI / 180, al = Math.cos(t), be = Math.sin(t);
    return [al, be, (1 - al) * cx - be * cy, -be, al, be * cx + (1 - al) * cy];
  }
  function remap(a, mx, my, mode) {
    var out = img(a.w, a.h, a.c);
    for (var i = 0; i < a.w * a.h; i++) for (var c = 0; c < a.c; c++) out.d[i * a.c + c] = sampleBorder(a, mx[i], my[i], c, mode);
    return out;
  }

  // ================================================================== PELÍCULA
  function srgbToLin(x) { x = clip01(x); return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); }
  function linToSrgb(x) { x = clip01(x); return x <= 0.0031308 ? x * 12.92 : 1.055 * Math.pow(x, 1 / 2.4) - 0.055; }
  var K_LO = 0.75, K_HI = 1.0;
  function rawCurve(lin, kl, kh, shift) {
    var st = Math.log2(Math.max(lin, 1e-6) / 0.18) + (shift || 0);
    return 1 / (1 + Math.exp(-(st < 0 ? kl : kh) * st));
  }
  var REF_N = 2048, REF_X = new Float64Array(REF_N), REF_Y = new Float64Array(REF_N);
  (function () {
    var a = Math.log(1e-5), b = 0;
    for (var i = 0; i < REF_N; i++) { REF_X[i] = Math.exp(a + (b - a) * i / (REF_N - 1)); REF_Y[i] = rawCurve(REF_X[i], K_LO, K_HI); }
  })();
  function interpSorted(x, xs, ys) {
    var n = xs.length;
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    var lo = 0, hi = n - 1;
    while (hi - lo > 1) { var m = (lo + hi) >> 1; if (xs[m] <= x) lo = m; else hi = m; }
    return ys[lo] + (ys[hi] - ys[lo]) * (x - xs[lo]) / (xs[hi] - xs[lo]);
  }
  function charCurve(lin, kl, kh, black, white, shift) {
    var y = rawCurve(lin, kl, kh, shift), y1 = rawCurve(1.0, kl, kh), r1 = REF_Y[REF_N - 1];
    if (Math.abs(y1 - 0.5) > 1e-6 && y > 0.5) y = 0.5 + (y - 0.5) * (r1 - 0.5) / (y1 - 0.5);
    return black + (white - black) * linToSrgb(interpSorted(y, REF_Y, REF_X));
  }
  // Tabla de 1024 nodos (0 + logarítmicos hasta xmax), como en Python.
  function logNodes(xmax) {
    var xs = new Float64Array(1024), a = Math.log(1e-5), b = Math.log(xmax);
    xs[0] = 0;
    for (var i = 0; i < 1023; i++) xs[i + 1] = Math.exp(a + (b - a) * i / 1022);
    return xs;
  }
  function makeLUT(xs, kl, kh, black, white, shift) {
    var ys = new Float64Array(xs.length);
    for (var i = 0; i < xs.length; i++) ys[i] = charCurve(xs[i], kl, kh, black, white, shift);
    return function (x) { return interpSorted(x, xs, ys); };
  }
  function tints(a, sh, hi) {
    if (!sh.some(Boolean) && !hi.some(Boolean)) return a;
    return C.map3(a, function (r, g, b, i, o, j) {
      var w = smooth(0.1, 0.9, r * LR + g * LG + b * LB);
      px3(o, j, r + sh[0] * (1 - w) * 3 + hi[0] * w * 3, g + sh[1] * (1 - w) * 3 + hi[1] * w * 3, b + sh[2] * (1 - w) * 3 + hi[2] * w * 3);
    });
  }
  function twist(a, tw) {
    if (!tw || !tw.length) return a;
    var hsv = [0, 0, 0];
    return C.map3(a, function (r, g, b, i, o, j) {
      C.rgb2hsv(r, g, b, hsv, 0);
      for (var q = 0; q < tw.length; q++) {
        var w = C.hueWeight(hsv[0], tw[q][0], tw[q][1]) * smooth(0.05, 0.2, hsv[1]);
        hsv[0] = C.fmod(hsv[0] + tw[q][2] * w, 360);
        hsv[1] = clip01(hsv[1] * (1 + (tw[q][3] - 1) * w));
      }
      C.hsv2rgb(hsv[0], hsv[1], hsv[2], o, j);
    });
  }
  function printStage(a, contrast, toe, black, sat, sh, hi) {
    var xs = new Float64Array(1024), ys = new Float64Array(1024);
    for (var i = 0; i < 1024; i++) { xs[i] = i / 1023; ys[i] = charCurve(srgbToLin(xs[i]), K_LO * contrast * toe, K_HI * contrast, black, 1.0); }
    var out = img(a.w, a.h, 3);
    for (i = 0; i < a.d.length; i++) {
      var x = clip01(a.d[i]), f = x * 1023, k = Math.min(1022, f | 0);
      out.d[i] = ys[k] + (ys[k + 1] - ys[k]) * (f - k);
    }
    return C.clipImg(tints(C.saturate(out, sat), sh, hi));
  }
  function applyProfile(a, pr, exposure, ctx) {
    var ev = Math.pow(2, exposure), n = a.w * a.h, d = a.d, i, j;
    var kl = K_LO * pr.contrast * pr.toe, kh = K_HI * pr.contrast * pr.shoulder;
    var lin = new Float64Array(d.length);
    for (i = 0; i < d.length; i++) lin[i] = srgbToLin(d[i]) * ev;
    if (pr.kind === 'bw') {
      var w = pr.w, ws = Math.max(w[0] + w[1] + w[2], 1e-3), l = new Float64Array(n), lmax = 0;
      for (i = 0; i < n; i++) { l[i] = Math.max(0, (lin[3 * i] * w[0] + lin[3 * i + 1] * w[1] + lin[3 * i + 2] * w[2]) / ws); if (l[i] > lmax) lmax = l[i]; }
      var f = makeLUT(logNodes(Math.max(4, lmax + 1e-3)), kl, kh, pr.black, pr.white, 0), Y = img(a.w, a.h, 1);
      for (i = 0; i < n; i++) Y.d[i] = f(l[i]);
      if (pr.tone) {
        var stops = pr.tone.map(function (s) { return [s[0], C.hexColor(s[1])]; });
        var xs = stops.map(function (s) { return s[0]; }), v = [0, 0, 0];
        var gm = C.map3(C.gray3(Y), function (r, g, b, ii, o, jj) {
          for (var c = 0; c < 3; c++) o[jj + c] = C.interp(r, xs, stops.map(function (s) { return s[1][c]; }));
        });
        return C.clipImg(C.setLuminance(gm, Y));
      }
      return C.gray3(Y);
    }
    if (pr.kind === 'tech3') {
      for (i = 0; i < n; i++) {
        j = 3 * i; var r = lin[j], g = lin[j + 1], b = lin[j + 2];
        lin[j] = Math.max(0, r * 1.25 - (g + b) * 0.125); lin[j + 1] = Math.max(0, g * 1.25 - (r + b) * 0.125); lin[j + 2] = Math.max(0, b * 1.25 - (r + g) * 0.125);
      }
    } else if (pr.kind === 'tech2') {
      for (i = 0; i < n; i++) { j = 3 * i; var cy = lin[j + 1] * 0.6 + lin[j + 2] * 0.4; lin[j + 1] = cy * 1.02; lin[j + 2] = cy * 0.92; }
    }
    var nodes = logNodes(Math.max(4, ev)), luts = [0, 1, 2].map(function (c) {
      return makeLUT(nodes, kl * pr.kmul[c], kh * pr.kmul[c], pr.black, pr.white, pr.bal[c]);
    });
    var out = img(a.w, a.h, 3);
    for (i = 0; i < d.length; i++) out.d[i] = luts[i % 3](lin[i]);
    out = tints(twist(C.saturate(out, pr.sat), pr.twists), pr.sh, pr.hi);
    if (pr.kind === 'auto' && ctx) {
      var rg = ctx.rng(71), dots = img(a.w, a.h, 3);
      for (i = 0; i < dots.d.length; i++) dots.d[i] = rg.normal();
      dots = C.blur(dots, ctx.px(1.6));
      var sd = C.std(dots.d) + 1e-6;
      for (i = 0; i < out.d.length; i++) out.d[i] *= 1 + 0.035 * dots.d[i] / sd;
    }
    return C.clipImg(out);
  }

  function grainLayer(w, h, ctx, amount, size, rough, color, salt) {
    var rg = ctx.rng(salt), base = Math.max(0.35, size * ctx.k), muls = [1.25, 1.0, 1.4], layers = [], i;
    for (var ch = 0; ch < (color ? 3 : 1); ch++) {
      var N = img(w, h, 1);
      for (i = 0; i < N.d.length; i++) N.d[i] = rg.normal();
      N = C.blur(N, base * 0.55 * muls[ch]);
      if (rough) {
        var N2 = img(w, h, 1);
        for (i = 0; i < N2.d.length; i++) N2.d[i] = rg.normal();
        N2 = C.blur(N2, base * 1.8 * muls[ch]);
        for (i = 0; i < N.d.length; i++) N.d[i] += N2.d[i] * rough * 1.2;
      }
      var sd = C.std(N.d) + 1e-6;
      for (i = 0; i < N.d.length; i++) N.d[i] /= sd;
      layers.push(N.d);
    }
    var g = img(w, h, 3);
    for (i = 0; i < w * h; i++) {
      if (!color) { g.d[3 * i] = g.d[3 * i + 1] = g.d[3 * i + 2] = layers[0][i] * amount; continue; }
      var mono = (layers[0][i] + layers[1][i] + layers[2][i]) / 3;
      for (var c = 0; c < 3; c++) g.d[3 * i + c] = (layers[c][i] * 0.55 + mono * 0.45) * amount;
    }
    return g;
  }
  var FORMATS = { '8mm': 3.2, '16mm': 2.0, '35mm': 1.0, '65mm': 0.5, still35: 1.1, medium: 0.6 };
  F.cine_grain = function (a, p, ctx) {
    var fm = FORMATS[p.format], lg = Math.log2(Math.max(p.iso, 25) / 50);
    var size = (0.7 + 0.55 * lg) * fm, amount = (0.035 + 0.02 * lg) * Math.sqrt(fm) * p.amount / 100;
    var g = grainLayer(a.w, a.h, ctx, amount, size, p.roughness / 100, p.color, 17);
    return C.map3(a, function (r, gg, b, i, o, j) {
      var l = r * LR + gg * LG + b * LB, resp;
      if (p.response === 'neg') resp = 0.45 + 0.55 * Math.pow(1 - l, 0.7) * clip01(l * 6);
      else if (p.response === 'print') resp = 0.3 + 0.7 * clip01(Math.sin(Math.PI * clip01(l)));
      else resp = 1;
      px3(o, j, clip01(r + g.d[j] * resp), clip01(gg + g.d[j + 1] * resp), clip01(b + g.d[j + 2] * resp));
    });
  };

  var HALO = { red: [1.0, 0.25, 0.08], orange: [1.0, 0.5, 0.15], warm: [1.0, 0.72, 0.45], pink: [1.0, 0.4, 0.45] };
  function halationLayer(a, ctx, amount, radius, th, col) {
    var L = C.luminance(a), m = img(a.w, a.h, 1), i;
    for (i = 0; i < m.d.length; i++) m.d[i] = smooth(th - 0.08, th + 0.06, L.d[i]);
    var r = ctx.px(radius), b1 = C.blur(m, r).d, b2 = C.blur(m, r * 2.6).d, out = img(a.w, a.h, 3);
    for (i = 0; i < m.d.length; i++) {
      var hv = clip01(b1[i] * 0.65 + b2[i] * 0.45 - m.d[i] * 0.55);
      for (var c = 0; c < 3; c++) out.d[3 * i + c] = clip01(hv * col[c] * amount);
    }
    return out;
  }
  F.halation = function (a, p, ctx) {
    return screenLayer(a, halationLayer(a, ctx, p.amount / 100 * 1.6, p.radius, p.threshold / 100, HALO[p.color]));
  };
  F.bloom = function (a, p, ctx) {
    var t = p.threshold / 100, src = C.map3(a, function (r, g, b, i, o, j) {
      var m = smooth(t - 0.2, t + 0.15, r * LR + g * LG + b * LB); px3(o, j, r * m, g * m, b * m);
    });
    var r = ctx.px(p.radius), b1 = C.blur(src, r * 0.5).d, b2 = C.blur(src, r).d, b3 = C.blur(src, r * 2.5).d;
    var w = p.warmth / 100, gn = [1 + 0.2 * w, 1 + 0.03 * w, 1 - 0.25 * w], A = p.amount / 100, out = img(a.w, a.h, 3), i;
    for (i = 0; i < a.d.length; i++) {
      var bv = (b1[i] * 0.35 + b2[i] * 0.4 + b3[i] * 0.35) * gn[i % 3];
      out.d[i] = 1 - (1 - a.d[i]) * (1 - clip01(bv * A * 1.2));
    }
    var cl = p.contrast_loss / 100 * A;
    if (cl) {
      var mean = C.blur(out, r * 3).d;
      for (i = 0; i < out.d.length; i++) out.d[i] = out.d[i] + (mean[i] - out.d[i]) * cl * 0.25 + cl * 0.03;
    }
    return C.clipImg(out);
  };

  F.film_profile = function (a, p, ctx) {
    var pr = DATA.profiles[p.profile];
    if (!pr) throw new Error('Perfil de película desconocido: ' + p.profile);
    var out = applyProfile(a, pr, p.exposure, ctx), pm = p.print;
    if (pm === 'auto') pm = (pr.family === 'cine' || pr.family === 'cinestill') ? 'print2383' : 'none';
    if (pm !== 'none' && pr.kind !== 'bw' && pr.kind !== 'print') {
      var pp = DATA.profiles[pm];
      out = printStage(out, pp.contrast * 0.85, pp.toe, 0, pp.sat, pp.sh, pp.hi);
    }
    var hal = pr.hal * p.halation / 100;
    if (hal > 0) out = screenLayer(out, halationLayer(out, ctx, hal / 100 * 1.6, 22, 0.78, pr.kind === 'bw' ? [0.95, 0.95, 0.95] : [1.0, 0.25, 0.08]));
    var gamt = pr.grain[0] / 100 * 0.075 * p.grain / 100;
    if (gamt > 0) {
      var g = grainLayer(a.w, a.h, ctx, gamt, pr.grain[1], 0.4, pr.kind !== 'bw', 23);
      out = C.map3(out, function (r, gg, b, i, o, j) {
        var resp = 0.4 + 0.6 * clip01(Math.sin(Math.PI * clip01(r * LR + gg * LG + b * LB)));
        px3(o, j, clip01(r + g.d[j] * resp), clip01(gg + g.d[j + 1] * resp), clip01(b + g.d[j + 2] * resp));
      });
    }
    return C.mix(a, out, p.strength / 100);
  };

  F.film_compression = function (a, p, ctx) {
    var h = p.highlights / 100, s = p.shadows / 100, knee = 0.75 - 0.3 * h, foot = 0.12 + 0.18 * s, th = Math.tanh(1 + h);
    var sc = C.sCurveFn(p.midtones / 100), L = C.luminance(a), nl = img(a.w, a.h, 1), i;
    for (i = 0; i < nl.d.length; i++) {
      var l = L.d[i], v = l > knee ? knee + (1 - knee) * Math.tanh((l - knee) / Math.max(1 - knee, 1e-3) * (1 + h)) / th : l;
      if (v < foot) v = foot * Math.pow(clip01(v / foot), 1 + s * 0.8);
      if (p.midtones) v = sc(clip01(v));
      nl.d[i] = v;
    }
    var out = C.setLuminance(a, C.clipImg(nl)), hl = p.hl_desat / 100, sd = p.sh_desat / 100;
    return C.map3(out, function (r, g, b, ii, o, j) {
      var v = nl.d[ii], k = 1 - Math.max(smooth(0.7, 1, v) * hl, (1 - smooth(0, 0.25, v)) * sd) * 0.8, lm = r * LR + g * LG + b * LB;
      px3(o, j, clip01(lm + (r - lm) * k), clip01(lm + (g - lm) * k), clip01(lm + (b - lm) * k));
    });
  };

  F.film_breath = function (a, p, ctx) {
    var sc = ctx.small(256), sigma = Math.max(2, Math.max(sc.w, sc.h) * (0.05 + 0.25 * p.scale / 100));
    function field(salt) {
      var rg = C.makeRng((p.seed * 313 + salt) >>> 0), N = img(sc.w, sc.h, 1);
      for (var i = 0; i < N.d.length; i++) N.d[i] = rg.normal();
      N = C.blur(N, sigma);
      var sd = C.std(N.d) + 1e-6;
      for (i = 0; i < N.d.length; i++) N.d[i] /= sd;
      return C.resizeLinear(N, a.w, a.h).d;
    }
    var e = field(1), ca = p.color / 100 * 0.025, fr = ca ? [field(2), field(3), field(4)] : null, ke = p.exposure / 100 * 0.18;
    return C.map3(a, function (r, g, b, i, o, j) {
      var m = Math.pow(2, e[i] * ke);
      px3(o, j, clip01(r * m + (fr ? fr[0][i] * ca : 0)), clip01(g * m + (fr ? fr[1][i] * 0.6 * ca : 0)), clip01(b * m + (fr ? fr[2][i] * ca : 0)));
    });
  };

  F.film_damage = function (a, p, ctx) {
    var out = F.dust_scratches(a, { dust: p.dust, scratches: p.scratches, hairs: p.hairs, tone: p.tone, seed: p.seed }, ctx);
    if (p.stains) out = F.texture(out, { type: 'stains', amount: p.stains * 0.8, scale: 120, seed: p.seed }, ctx);
    if (p.edge_fog) out = F.light_leak(out, { style: 'amber', position: 'random', intensity: p.edge_fog * 0.7, size: 30, seed: p.seed + 5 }, ctx);
    if (p.flicker) {
      var f = Math.pow(2, C.makeRng(p.seed * 7 + 3).uniform(-1, 1) * p.flicker / 100 * 0.25);
      for (var i = 0; i < out.d.length; i++) out.d[i] = clip01(out.d[i] * f);
    }
    if (p.cue_mark) {
      var g = ctx.grid(), asp = ctx.aspect;
      out = C.map3(out, function (r, gg, b, ii, o, j) {
        var x = ii % a.w, y = (ii / a.w) | 0, du = (g.u[x] - 0.9) * asp, dv = g.v[y] - 0.12, dd = Math.sqrt(du * du + dv * dv);
        var ring = (1 - smooth(0.022, 0.03, dd)) * smooth(0.012, 0.02, dd), disk = 1 - smooth(0.012, 0.02, dd), k = 1 - 0.8 * disk;
        px3(o, j, r * k + 0.05 * ring, gg * k + 0.05 * ring, b * k + 0.05 * ring);
      });
    }
    return C.clipImg(out);
  };

  // ================================================================== ÓPTICA
  function brightest(a, ctx) {
    var hh = Math.max(8, Math.floor(96 * a.h / a.w)), sm = C.blur(C.resize(C.luminance(a), 96, hh, 'area'), 2.0), best = -1, bi = 0;
    for (var i = 0; i < sm.d.length; i++) if (sm.d[i] > best) { best = sm.d[i]; bi = i; }
    var r = ctx.rect, x = bi % 96, y = (bi / 96) | 0;
    return [r[0] + (x + 0.5) / 96 * (r[2] - r[0]), r[1] + (y + 0.5) / hh * (r[3] - r[1])];
  }
  function source(a, p, ctx) { return p.auto ? brightest(a, ctx) : [p.x / 100, p.y / 100]; }
  var FLARE = { warm: [1.0, 0.75, 0.45], cool: [0.55, 0.75, 1.0], anamorphic: [0.4, 0.65, 1.0], rainbow: [1, 1, 1], sun: [1.0, 0.95, 0.85] };
  var GHOSTS = [[-0.35, 0.06, 30, 0.9], [0.25, 0.035, 200, 0.7], [0.55, 0.08, 120, 0.85], [0.85, 0.025, 280, 0.65], [1.25, 0.1, 40, 0.95], [1.6, 0.05, 190, 0.75], [1.9, 0.14, 300, 0.6]];
  F.lens_flare = function (a, p, ctx0) {
    var src = source(a, p, ctx0), sx = src[0], sy = src[1], ctx = ctx0.small(1200), g = ctx.grid(), asp = ctx.aspect;
    var col = FLARE[p.style], k = p.intensity / 100, layer = img(ctx.w, ctx.h, 3), L = layer.d;
    var nb = parseInt(p.blades, 10); if (nb % 2) nb *= 2;
    var scol = (p.style === 'anamorphic' || p.style === 'cool') ? [0.45, 0.7, 1.0] : col;
    var gcols = GHOSTS.map(function (gh) {
      if (p.style === 'rainbow') return C.hueColor(gh[2], 0.55, 1);
      var hc = C.hueColor(gh[2], 0.4, 1); return [col[0] * (0.75 + 0.25 * hc[0]), col[1] * (0.75 + 0.25 * hc[1]), col[2] * (0.75 + 0.25 * hc[2])];
    });
    var hcol = p.style !== 'cool' ? C.hueColor(20, 0.5, 1) : col;
    for (var y = 0; y < ctx.h; y++) for (var x = 0; x < ctx.w; x++) {
      var u = g.u[x], v = g.v[y], dx = (u - sx) * asp, dy = v - sy, r = Math.sqrt(dx * dx + dy * dy), j = (y * ctx.w + x) * 3, c;
      var core = 1.2 * Math.exp(-Math.pow(r / 0.045, 2)) + 0.5 * Math.exp(-Math.pow(r / 0.16, 2));
      for (c = 0; c < 3; c++) L[j + c] += core * col[c];
      if (p.starburst) {
        var ang = Math.atan2(dy, dx), st = Math.pow(Math.abs(Math.cos(ang * nb / 2)), 40) * Math.exp(-r / 0.3) * p.starburst / 100 * 1.6;
        for (c = 0; c < 3; c++) L[j + c] += st * col[c];
      }
      if (p.streak) {
        var sk = Math.exp(-Math.pow(dy / 0.006, 2)) * Math.exp(-Math.abs(dx) / 0.45) * p.streak / 100;
        for (c = 0; c < 3; c++) L[j + c] += sk * scol[c];
      }
      if (p.ghosts) for (var q = 0; q < GHOSTS.length; q++) {
        var gh = GHOSTS[q], gx = sx + (0.5 - sx) * 2 * gh[0], gy = sy + (0.5 - sy) * 2 * gh[0];
        var gd = Math.sqrt(Math.pow((u - gx) * asp, 2) + Math.pow(v - gy, 2)), sz = gh[1];
        var ring = 1 - smooth(sz * 0.7, sz, gd), edge = smooth(sz * 0.55, sz * 0.95, gd) * (1 - smooth(sz * 0.95, sz * 1.05, gd));
        var wgt = (ring * 0.22 + edge * 0.3) * gh[3] * p.ghosts / 100;
        for (c = 0; c < 3; c++) L[j + c] += wgt * gcols[q][c];
      }
      if (p.halo) {
        var hr = Math.exp(-Math.pow((r - 0.32) / 0.025, 2)) * p.halo / 100 * 0.6;
        for (c = 0; c < 3; c++) L[j + c] += hr * hcol[c];
      }
    }
    for (var i = 0; i < L.length; i++) L[i] *= k * 1.3;
    if (layer.w !== a.w || layer.h !== a.h) layer = C.resizeLinear(layer, a.w, a.h);
    return screenLayer(a, layer);
  };

  F.light_rays = function (a, p, ctx) {
    var src = source(a, p, ctx), sm = ctx.small(420), r = ctx.rect;
    var lum = C.resize(C.luminance(a), sm.w, sm.h, 'area'), t = p.threshold / 100, m = img(sm.w, sm.h, 1), i;
    for (i = 0; i < m.d.length; i++) m.d[i] = smooth(t - 0.1, t + 0.05, lum.d[i]);
    var px = (src[0] - r[0]) / (r[2] - r[0]) * sm.w, py = (src[1] - r[1]) / (r[3] - r[1]) * sm.h;
    var acc = img(sm.w, sm.h, 1), steps = 40, Lr = 0.15 + 0.75 * p.length / 100;
    for (var q = 0; q < steps; q++) {
      var s = 1 - Lr * q / steps, wq = Math.pow(0.97, q), wa = warpAffine(m, [s, 0, px * (1 - s), 0, s, py * (1 - s)], 'zero');
      for (i = 0; i < acc.d.length; i++) acc.d[i] += wa.d[i] * wq;
    }
    for (i = 0; i < acc.d.length; i++) acc.d[i] /= steps * 0.3;
    acc = C.resizeLinear(acc, a.w, a.h);
    var wm = p.warmth / 100, col = [1.0, 0.92 - 0.12 * Math.max(wm, 0) + 0.05 * Math.min(wm, 0), 0.8 - 0.35 * Math.max(wm, 0) + 0.2 * -Math.min(wm, 0)];
    var k = p.intensity / 100 * 1.5, Lf = C.luminance(a).d, layer = img(a.w, a.h, 3);
    for (i = 0; i < Lf.length; i++) {
      var av = Math.max(0, acc.d[i] - smooth(t - 0.1, t + 0.05, Lf[i]) * 0.35);
      for (var c = 0; c < 3; c++) layer.d[3 * i + c] = av * col[c] * k;
    }
    return screenLayer(a, layer);
  };

  F.optical_filter = function (a, p, ctx) {
    var t = p.type, k = p.strength / 100, full = Math.max(ctx.full_w, ctx.full_h) * ctx.k, L = C.luminance(a), th = p.threshold / 100, i;
    if (t.indexOf('star') === 0 || t === 'glimmer') {
      var sm = ctx.small(900), lum = (sm.w !== a.w || sm.h !== a.h) ? C.resize(L, sm.w, sm.h, 'area') : L, m = img(sm.w, sm.h, 1);
      for (i = 0; i < m.d.length; i++) m.d[i] = smooth(th - 0.03, th + 0.05, lum.d[i]);
      var n = { star4: 4, star6: 6, star8: 8, glimmer: 8 }[t], sfull = Math.max(sm.full_w, sm.full_h) * sm.k;
      var R = Math.max(2, Math.floor((t !== 'glimmer' ? 0.04 : 0.012) * sfull * p.size / 100 / 2)), acc = img(sm.w, sm.h, 1), wsum = 0;
      for (var q = 0; q < n / 2; q++) {
        var ang = (p.angle + q * 360 / n) * Math.PI / 180, dx = Math.cos(ang), dy = -Math.sin(ang);
        wsum = 0;
        for (var jj = -R; jj <= R; jj++) {
          var wj = Math.exp(-Math.abs(jj) / (R / 3)), sh = warpAffine(m, [1, 0, jj * dx, 0, 1, jj * dy], 'zero');
          for (i = 0; i < acc.d.length; i++) acc.d[i] += sh.d[i] * wj;
          wsum += wj;
        }
      }
      var sc = (2 * R + 1) * 0.35 / Math.floor(n / 2) * 2 / Math.max(wsum, 1e-6);
      for (i = 0; i < acc.d.length; i++) acc.d[i] *= sc;
      if (acc.w !== a.w || acc.h !== a.h) acc = C.resizeLinear(acc, a.w, a.h);
      var layer = img(a.w, a.h, 3);
      for (i = 0; i < a.w * a.h; i++) for (var c = 0; c < 3; c++) layer.d[3 * i + c] = clip01(acc.d[i]) * clip01(a.d[3 * i + c] * 0.4 + 0.6) * k * 1.4;
      return screenLayer(a, layer);
    }
    if (t === 'black_mist' || t === 'white_mist' || t === 'fog') {
      var r = 0.012 * full * p.size / 100, src = C.map3(a, function (R0, G, B, ii, o, j) {
        var mm = smooth(th - 0.35, th, L.d[ii]); px3(o, j, R0 * mm, G * mm, B * mm);
      });
      var h1 = C.blur(src, r).d, h3 = C.blur(src, r * 3).d, f = k * (t === 'black_mist' ? 0.6 : 1), halo = img(a.w, a.h, 3);
      for (i = 0; i < a.d.length; i++) halo.d[i] = (h1[i] * 0.6 + h3[i] * 0.4) * f;
      var out = screenLayer(a, halo);
      if (t === 'white_mist') {
        var mean = 0; for (i = 0; i < out.d.length; i++) mean += out.d[i]; mean /= out.d.length;
        for (i = 0; i < out.d.length; i++) out.d[i] = out.d[i] + (mean - out.d[i]) * 0.12 * k + 0.03 * k;
      }
      if (t === 'fog') {
        var bl = C.blur(out, r * 6).d;
        for (i = 0; i < out.d.length; i++) out.d[i] = out.d[i] * (1 - 0.35 * k) + 0.35 * k * clip01(bl[i]) + 0.06 * k;
      }
      return C.clipImg(out);
    }
    var rad = ctx.radial(0.5, 0.5, 1.0).d, b = C.blur(a, 0.008 * full), sb = screenLayer(b, C.map3(b, function (R0, G, B, ii, o, j) { px3(o, j, R0 * 0.12, G * 0.12, B * 0.12); }));
    var mk = new Float32Array(a.w * a.h);
    for (i = 0; i < mk.length; i++) mk[i] = smooth(0.25, 0.25 + 0.5 * p.size / 100, rad[i]) * k;
    return C.mixMap(a, sb, mk);
  };

  F.lens_character = function (a, p, ctx) {
    var w = a.w, h = a.h, g = ctx.grid(), asp = ctx.aspect, rc = ctx.rect, n = w * h, i, x, y;
    var nrm = Math.sqrt(asp * asp + 1), r2 = new Float32Array(n);
    for (y = 0; y < h; y++) for (x = 0; x < w; x++) {
      var dxn = (g.u[x] - 0.5) * 2 * asp / nrm, dyn = (g.v[y] - 0.5) * 2 / nrm; r2[y * w + x] = dxn * dxn + dyn * dyn;
    }
    var out = a;
    if (p.distortion) {
      var kd = p.distortion / 100 * 0.12, mx = new Float32Array(n), my = new Float32Array(n);
      for (y = 0; y < h; y++) for (x = 0; x < w; x++) {
        i = y * w + x; var f = 1 + kd * r2[i], su = 0.5 + (g.u[x] - 0.5) * f, sv = 0.5 + (g.v[y] - 0.5) * f;
        mx[i] = (su - rc[0]) / (rc[2] - rc[0]) * w - 0.5; my[i] = (sv - rc[1]) / (rc[3] - rc[1]) * h - 0.5;
      }
      out = remap(out, mx, my, 'reflect');
    }
    if (p.swirl) {
      var cx = (0.5 - rc[0]) / (rc[2] - rc[0]) * w, cy = (0.5 - rc[1]) / (rc[3] - rc[1]) * h, acc = img(w, h, 3), steps = 9, amax = p.swirl / 100 * 2.5;
      for (var q = 0; q < steps; q++) {
        var wa = warpAffine(out, rotMatrix(cx, cy, (q / (steps - 1) - 0.5) * amax), 'reflect');
        for (i = 0; i < acc.d.length; i++) acc.d[i] += wa.d[i];
      }
      for (i = 0; i < acc.d.length; i++) acc.d[i] /= steps;
      var ms = new Float32Array(n);
      for (i = 0; i < n; i++) ms[i] = smooth(0.25, 0.9, Math.sqrt(r2[i]));
      out = C.mixMap(out, acc, ms);
    }
    if (p.softness) {
      var full = Math.max(ctx.full_w, ctx.full_h) * ctx.k, bl = C.blur(out, 0.004 * full * p.softness / 50), mso = new Float32Array(n);
      for (i = 0; i < n; i++) mso[i] = smooth(0.4, 1.0, Math.sqrt(r2[i])) * p.softness / 100;
      out = C.mixMap(out, bl, mso);
    }
    if (p.fringing) out = F.chromatic_aberration(out, { amount: p.fringing, type: 'radial' }, ctx);
    if (p.falloff) {
      var fo = p.falloff / 100 * 1.4;
      out = C.map3(out, function (R0, G, B, ii, o, j) { var c4 = Math.pow(1 / (1 + r2[ii] * 0.6), 2), m = 1 - (1 - c4) * fo; px3(o, j, R0 * m, G * m, B * m); });
    }
    return C.clipImg(out);
  };

  function pctSorted(sorted, q) { var pos = q / 100 * (sorted.length - 1), lo = Math.floor(pos), f = pos - lo; return lo + 1 < sorted.length ? sorted[lo] + (sorted[lo + 1] - sorted[lo]) * f : sorted[lo]; }
  F.color_correction = function (a, p, ctx) {
    var out = C.clone(a), n = a.w * a.h, i, c;
    if (p.auto === 'gray') {
      var avg = [0, 0, 0]; for (i = 0; i < n; i++) for (c = 0; c < 3; c++) avg[c] += out.d[3 * i + c];
      avg = avg.map(function (v) { return v / n; }); var am = (avg[0] + avg[1] + avg[2]) / 3;
      var gn = avg.map(function (v) { return Math.min(1.25, Math.max(0.8, am / Math.max(v, 1e-3))); });
      for (i = 0; i < out.d.length; i++) out.d[i] *= gn[i % 3];
    } else if (p.auto === 'white') {
      var L = C.luminance(out).d, thr = pctSorted(Float32Array.from(L).sort(), 99), ref = [0, 0, 0], cnt = 0;
      for (i = 0; i < n; i++) if (L[i] >= thr) { for (c = 0; c < 3; c++) ref[c] += out.d[3 * i + c]; cnt++; }
      ref = cnt ? ref.map(function (v) { return v / cnt; }) : [1, 1, 1];
      var mx = Math.max(ref[0], ref[1], ref[2]), gw = ref.map(function (v) { return Math.min(1.25, Math.max(0.8, mx / Math.max(v, 1e-3))); });
      for (i = 0; i < out.d.length; i++) out.d[i] *= gw[i % 3];
    } else if (p.auto === 'levels') {
      for (c = 0; c < 3; c++) {
        var ch = new Float32Array(n); for (i = 0; i < n; i++) ch[i] = out.d[3 * i + c]; ch.sort();
        var lo = pctSorted(ch, 0.5), hi = pctSorted(ch, 99.5), sp = Math.max(hi - lo, 0.05);
        for (i = 0; i < n; i++) out.d[3 * i + c] = (out.d[3 * i + c] - lo) / sp;
      }
    }
    out = C.clipImg(out);
    function wheel(hh, amount) { var cc = C.hueColor(hh, 1, 1), l = cc[0] * LR + cc[1] * LG + cc[2] * LB; return cc.map(function (v) { return (v - l) * amount / 100; }); }
    var lw = wheel(p.lift_hue, p.lift), gw2 = wheel(p.gamma_hue, p.gamma), gnw = wheel(p.gain_hue, p.gain);
    var lift = lw.map(function (v) { return v * 0.15 + p.lift_l / 100 * 0.1; }), gain = gnw.map(function (v) { return 1 + v * 0.3 + p.gain_l / 100 * 0.3; });
    var gexp = gw2.map(function (v) { return Math.min(3, Math.max(0.3, 1 - v * 0.25 - p.gamma_l / 100 * 0.35)); });
    for (i = 0; i < out.d.length; i++) { c = i % 3; var v = out.d[i] * gain[c] + lift[c] * (1 - out.d[i]); out.d[i] = Math.pow(clip01(v), gexp[c]); }
    if (p.saturation) out = C.saturate(out, 1 + p.saturation / 100);
    return C.clipImg(out);
  };

  // --- partículas (aleatorias): misma estructura que el motor de escritorio
  function stamp(L, cx, cy, r, col) {
    var x0 = Math.max(0, Math.floor(cx - r - 1)), x1 = Math.min(L.w - 1, Math.ceil(cx + r + 1)), y0 = Math.max(0, Math.floor(cy - r - 1)), y1 = Math.min(L.h - 1, Math.ceil(cy + r + 1));
    for (var y = y0; y <= y1; y++) for (var x = x0; x <= x1; x++) {
      var cov = clip01(r + 0.5 - Math.sqrt((x - cx) * (x - cx) + (y - cy) * (y - cy)));
      if (cov > 0) for (var c = 0; c < 3; c++) { var j = (y * L.w + x) * 3 + c; L.d[j] = L.d[j] * (1 - cov) + col[c] * cov; }
    }
  }
  function stampSeg(L, ax, ay, bx, by, th, col) {
    var r = Math.max(0.5, th / 2), x0 = Math.max(0, Math.floor(Math.min(ax, bx) - r - 1)), x1 = Math.min(L.w - 1, Math.ceil(Math.max(ax, bx) + r + 1));
    var y0 = Math.max(0, Math.floor(Math.min(ay, by) - r - 1)), y1 = Math.min(L.h - 1, Math.ceil(Math.max(ay, by) + r + 1)), vx = bx - ax, vy = by - ay, l2 = vx * vx + vy * vy || 1;
    for (var y = y0; y <= y1; y++) for (var x = x0; x <= x1; x++) {
      var t = clip01(((x - ax) * vx + (y - ay) * vy) / l2), qx = ax + vx * t - x, qy = ay + vy * t - y, cov = clip01(r + 0.5 - Math.sqrt(qx * qx + qy * qy));
      if (cov > 0) for (var c = 0; c < 3; c++) { var j = (y * L.w + x) * 3 + c; L.d[j] = L.d[j] * (1 - cov) + col[c] * cov; }
    }
  }
  var PBASE = { dust: 500, bokeh: 40, snow: 450, rain: 380, sparks: 120, fireflies: 60, stars: 700, confetti: 160 };
  F.particles = function (a, p, ctx) {
    var w = a.w, h = a.h, rg = C.makeRng((p.seed * 1009 + ctx.seed) >>> 0), full = Math.max(ctx.full_w, ctx.full_h) * ctx.k, rc = ctx.rect;
    var sx = w / (rc[2] - rc[0]), sy = h / (rc[3] - rc[1]), t = p.type, n = Math.floor(PBASE[t] * p.amount / 100), sk = p.size / 100, ang = p.angle * Math.PI / 180;
    var lumS = null, lw = 64, lh = Math.max(8, Math.floor(64 * h / w));
    if (p.where === 'light') lumS = C.blur(C.resize(C.luminance(a), lw, lh, 'area'), 2.0);
    var layers = [img(w, h, 3), img(w, h, 3), img(w, h, 3)];
    for (var q = 0; q < n; q++) {
      var nx = rg.uniform(0, 1), ny = rg.uniform(0, 1);
      if (p.where === 'top' && ny > rg.uniform(0.2, 0.9)) continue;
      if (p.where === 'bottom' && ny < rg.uniform(0.1, 0.8)) continue;
      if (lumS) { var lv = lumS.d[Math.min(lh - 1, Math.floor(ny * lh)) * lw + Math.min(lw - 1, Math.floor(nx * lw))]; if (rg.random() > Math.pow(lv, 1.5)) continue; }
      var li = rg.integers(0, 3), X = (nx - rc[0]) * sx, Y = (ny - rc[1]) * sy, ds = [1.6, 1.0, 0.6][li], rr, col, al;
      if (t === 'dust') { rr = 0.0012 * rg.pareto(3) + 0.0006; col = [1, 0.97, 0.9]; al = rg.uniform(0.3, 1); }
      else if (t === 'bokeh') { rr = rg.uniform(0.012, 0.04); col = C.hueColor(rg.random() < 0.7 ? rg.uniform(20, 60) : rg.uniform(180, 320), 0.45, 1); al = rg.uniform(0.25, 0.6); }
      else if (t === 'snow') { rr = rg.uniform(0.0012, 0.004); col = [1, 1, 1]; al = rg.uniform(0.5, 1); }
      else if (t === 'rain') { rr = rg.uniform(0.0004, 0.0008); col = [0.85, 0.9, 1]; al = rg.uniform(0.25, 0.6); }
      else if (t === 'sparks') { rr = rg.uniform(0.0008, 0.0018); col = [1, rg.uniform(0.4, 0.7), 0.15]; al = rg.uniform(0.6, 1); }
      else if (t === 'fireflies') { rr = rg.uniform(0.002, 0.005); col = [0.85, 1, 0.35]; al = rg.uniform(0.5, 1); }
      else if (t === 'stars') { rr = rg.uniform(0.0003, 0.0011); col = [1, 1, rg.uniform(0.85, 1)]; al = rg.uniform(0.3, 1); }
      else { rr = rg.uniform(0.002, 0.005); col = C.hueColor(rg.uniform(0, 360), 0.85, 1); al = 1; }
      var rp = Math.max(0.6, rr * full * sk * ds), cv = col.map(function (v) { return v * al; });
      if (t === 'rain' || t === 'sparks') { var ln = rp * (t === 'rain' ? 40 : 18); stampSeg(layers[li], X, Y, X + Math.sin(ang) * ln, Y + Math.cos(ang) * ln, Math.max(1, Math.round(rp)), cv); }
      else if (t === 'confetti') { var ca = rg.uniform(0, Math.PI); stampSeg(layers[li], X - Math.cos(ca) * rp, Y - Math.sin(ca) * rp, X + Math.cos(ca) * rp, Y + Math.sin(ca) * rp, rp * 1.2, cv); }
      else stamp(layers[li], X, Y, Math.round(rp), cv);
    }
    var dep = p.depth / 100, acc = img(w, h, 3), i;
    for (var k = 0; k < 3; k++) {
      var Lk = layers[k], bl = [0.004 * dep * full, 0.0015 * dep * full, 0.0004 * full][k];
      if (t === 'bokeh') bl = [0.006, 0.004, 0.003][k] * full * (0.3 + dep);
      if (t === 'fireflies' || t === 'sparks') { var gl = C.blur(Lk, Math.max(1, 0.004 * full)); for (i = 0; i < Lk.d.length; i++) Lk.d[i] += gl.d[i] * 1.5; }
      var b = C.blur(Lk, Math.max(0.4, bl));
      for (i = 0; i < acc.d.length; i++) acc.d[i] += b.d[i];
    }
    var ko = p.opacity / 100 * (t !== 'bokeh' ? 1.6 : 1.2);
    for (i = 0; i < acc.d.length; i++) acc.d[i] *= ko;
    return screenLayer(a, acc);
  };

  // ================================================================== CRISTAL
  F.glass = function (a, p, ctx) {
    var w = a.w, h = a.h, g = ctx.grid(), rc = ctx.rect, k = p.intensity / 100, asp = ctx.aspect, t = p.type, ang = p.angle * Math.PI / 180, n = w * h, i, x, y;
    if (t === 'prism') {
      var off = 0.04 + 0.12 * p.size / 100, mx = new Float32Array(n), my = new Float32Array(n);
      for (y = 0; y < h; y++) for (x = 0; x < w; x++) {
        i = y * w + x;
        mx[i] = (g.u[x] + Math.cos(ang) * off / asp - rc[0]) / (rc[2] - rc[0]) * w - 0.5;
        my[i] = (g.v[y] + Math.sin(ang) * off - rc[1]) / (rc[3] - rc[1]) * h - 0.5;
      }
      var ghost = remap(a, mx, my, 'reflect'), tint = [0, 0, 0], out = img(w, h, 3);
      for (y = 0; y < h; y++) for (x = 0; x < w; x++) {
        i = y * w + x; var hue = C.fmod((g.u[x] * Math.cos(ang) * asp + g.v[y] * Math.sin(ang)) * 360 * 1.5, 360);
        C.hsv2rgb(hue, 0.6, 1, tint, 0);
        var side = smooth(p.x / 100 - 0.3, p.x / 100 + 0.3, g.u[x]);
        for (var c = 0; c < 3; c++) out.d[3 * i + c] = 1 - (1 - a.d[3 * i + c]) * (1 - clip01(ghost.d[3 * i + c] * tint[c] * 0.6 * k * side));
      }
      return out;
    }
    if (t === 'rainbow') {
      var cx = p.x / 100, cy = p.y / 100, width = 0.03 + 0.15 * p.size / 100, o2 = img(w, h, 3), col = [0, 0, 0];
      for (y = 0; y < h; y++) for (x = 0; x < w; x++) {
        i = y * w + x;
        var d = (g.u[x] - cx) * asp * Math.cos(ang + Math.PI / 2) + (g.v[y] - cy) * Math.sin(ang + Math.PI / 2);
        var tt = clip01(d / width * 0.5 + 0.5), band = Math.exp(-Math.pow(d / width, 2) * 2);
        C.hsv2rgb(C.fmod(tt * 300, 360), 0.85, 1, col, 0);
        for (var cc = 0; cc < 3; cc++) o2.d[3 * i + cc] = 1 - (1 - a.d[3 * i + cc]) * (1 - clip01(col[cc] * band * k * 0.6));
      }
      return o2;
    }
    if (t === 'crystal') {
      var bx = p.x / 100, by = p.y / 100, R = 0.08 + 0.4 * p.size / 100, mx2 = new Float32Array(n), my2 = new Float32Array(n), rr = new Float32Array(n);
      for (y = 0; y < h; y++) for (x = 0; x < w; x++) {
        i = y * w + x; var dx = (g.u[x] - bx) * asp, dy = g.v[y] - by, r = Math.sqrt(dx * dx + dy * dy);
        rr[i] = r;
        var f = r < R ? -(0.25 + 0.6 * Math.pow(r / R, 2)) * (0.5 + k) : 1;
        mx2[i] = (bx + dx * f / asp - rc[0]) / (rc[2] - rc[0]) * w - 0.5; my2[i] = (by + dy * f - rc[1]) / (rc[3] - rc[1]) * h - 0.5;
      }
      var ball = remap(a, mx2, my2, 'reflect'), o3 = img(w, h, 3);
      for (i = 0; i < n; i++) {
        var edge = 1 - smooth(R * 0.98, R, rr[i]), rim = Math.exp(-Math.pow((rr[i] - R) / (R * 0.04 + 1e-4), 2)) * 0.5;
        for (var c3 = 0; c3 < 3; c3++) o3.d[3 * i + c3] = clip01(a.d[3 * i + c3] * (1 - edge) + ball.d[3 * i + c3] * edge + rim * k);
      }
      return o3;
    }
    // esmerilado (aleatorio)
    var rg = ctx.rng(57), full = Math.max(ctx.full_w, ctx.full_h) * ctx.k, NX = img(w, h, 1), NY = img(w, h, 1);
    for (i = 0; i < n; i++) { NX.d[i] = rg.normal(); NY.d[i] = rg.normal(); }
    NX = C.blur(NX, Math.max(0.6, 0.002 * full)); NY = C.blur(NY, Math.max(0.6, 0.002 * full));
    var sc = 0.01 * full * k / (C.std(NX.d) + 1e-6), mx3 = new Float32Array(n), my3 = new Float32Array(n);
    for (y = 0; y < h; y++) for (x = 0; x < w; x++) { i = y * w + x; mx3[i] = x + NX.d[i] * sc; my3[i] = y + NY.d[i] * sc; }
    var fr = C.blur(remap(a, mx3, my3, 'reflect'), 0.004 * full * k), rad = ctx.radial(p.x / 100, p.y / 100, 1.0).d, mk = new Float32Array(n);
    for (i = 0; i < n; i++) mk[i] = smooth(0.2, 0.2 + 0.6 * p.size / 100, rad[i]);
    return C.mixMap(a, fr, mk);
  };

  // ================================================================== PAPEL FOTOGRÁFICO
  var PAPERS = { glossy_rc: ['#f8f8f6', 0.015, 0.0], pearl_rc: ['#f5f3ee', 0.03, 0.35], matte: ['#f1efea', 0.08, 0.5],
    fiber_neutral: ['#f4f2ec', 0.02, 0.6], fiber_warm: ['#f3ead9', 0.035, 0.7], fiber_cold: ['#eef1f3', 0.02, 0.6] };
  F.paper_sim = function (a, p, ctx) {
    var pp = PAPERS[p.paper], sc = C.sCurveFn((p.grade - 2) / 3 * 0.9), pw = C.hexColor(pp[0]), bk = [pp[1], pp[1], pp[1]], i;
    if (p.tone && p.paper === 'fiber_warm') bk = [bk[0] + 0.012, bk[1] + 0.004, bk[2] - 0.004];
    else if (p.tone && p.paper === 'fiber_cold') bk = [bk[0] - 0.004, bk[1], bk[2] + 0.01];
    var L = C.luminance(a).d, tex = null;
    if (p.texture) {
      var rg = ctx.rng(43), full = Math.max(ctx.full_w, ctx.full_h) * ctx.k, N = img(a.w, a.h, 1);
      for (i = 0; i < N.d.length; i++) N.d[i] = rg.normal();
      N = C.blur(N, Math.max(0.5, 0.0008 * full * (1 + pp[2] * 2)));
      var sd = C.std(N.d) + 1e-6, kt = p.texture / 100 * 0.025 * (0.5 + pp[2]);
      tex = N.d.map(function (v) { return 1 + v / sd * kt; });
    }
    return C.map3(a, function (r, g, b, ii, o, j) {
      var l = clip01(L[ii]), nl = sc ? sc(l) : l, m = tex ? tex[ii] : 1;
      px3(o, j, clip01((bk[0] + (pw[0] - bk[0]) * nl) * m), clip01((bk[1] + (pw[1] - bk[1]) * nl) * m), clip01((bk[2] + (pw[2] - bk[2]) * nl) * m));
    });
  };

  E.setData = function (d) {
    if (d && d.film_profiles) d.film_profiles.forEach(function (pr) { DATA.profiles[pr.id] = pr; });
  };
  if (isNode) module.exports = E;
})(typeof self !== 'undefined' ? self : this);
