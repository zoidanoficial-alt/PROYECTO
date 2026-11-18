/* ENTERGALACTIC móvil — filtros (port de filters_chroma/plata/analog/cine/realce.py).
 * Cada filtro: fn(img, p, ctx) -> img. Los parámetros y recetas vienen de schema.json,
 * generado por el motor Python: un solo catálogo para Photoshop y Android.
 */
(function (root) {
  'use strict';
  var C = (typeof module !== 'undefined' && module.exports) ? require('./eg-core.js') : root.EGCore;
  var img = C.img, clip01 = C.clip01, smooth = C.smooth, LR = C.LR, LG = C.LG, LB = C.LB;
  var F = {};
  function lumAt(d, j) { return d[j] * LR + d[j + 1] * LG + d[j + 2] * LB; }
  function px3(o, j, r, g, b) { o[j] = r; o[j + 1] = g; o[j + 2] = b; }

  // =================================================================== CHROMA
  F.tonal_contrast = function (a, p, ctx) {
    var L = C.luminance(a), l = L.d;
    var b1 = C.blur(L, ctx.px(p.radius)).d, b2 = C.blur(L, ctx.px(Math.max(1.5, p.radius / 10))).d;
    var k = p.strength / 100, fine = p.fine / 100, nl = img(a.w, a.h, 1), o = nl.d;
    for (var i = 0; i < l.length; i++) {
      var mid = Math.min(1, Math.max(0.2, 1 - Math.abs(l[i] - 0.5) * 1.4));
      o[i] = clip01(l[i] + (k * 1.6 * (l[i] - b1[i]) + fine * 1.2 * (l[i] - b2[i])) * mid);
    }
    return C.saturate(C.setLuminance(a, nl), 1 + p.saturation / 100);
  };

  F.brilliance = function (a, p, ctx) {
    var out = a, b = p.brightness / 100, i;
    if (b) {
      var g = b > 0 ? 1 / (1 + b * 0.8) : 1 - b * 0.8, t = img(a.w, a.h, 3), pw = C.powLUT(g);
      for (i = 0; i < a.d.length; i++) t.d[i] = pw(a.d[i]);
      out = t;
    }
    if (p.contrast) out = C.sCurve(out, p.contrast / 100);
    var w = p.warmth / 100;
    if (w) {
      var L = C.luminance(out), gr = 1 + 0.12 * w, gg = 1 + 0.02 * w, gb = 1 - 0.14 * w;
      var m = C.map3(out, function (r, g2, b2, ii, o, j) { px3(o, j, r * gr, g2 * gg, b2 * gb); });
      out = C.setLuminance(m, L);
    }
    out = C.saturate(out, 1 + p.saturation / 100);
    var v = p.vibrance / 100;
    if (v) {
      var tmp = [0, 0, 0];
      out = C.map3(out, function (r, g3, b3, ii, o, j) {
        C.rgb2hsv(r, g3, b3, tmp, 0);
        var l = r * LR + g3 * LG + b3 * LB, f = 1 + v * (1 - tmp[1]);
        C.clipPx(l + (r - l) * f, l + (g3 - l) * f, l + (b3 - l) * f, o, j);
      });
    }
    return out;
  };

  F.pro_contrast = function (a, p, ctx) {
    var out = a, n = a.w * a.h, d = a.d, i;
    if (p.cast) {
      var L = C.luminance(a), s = [0, 0, 0], cnt = 0;
      for (i = 0; i < n; i++) if (L.d[i] > 0.15 && L.d[i] < 0.9) { s[0] += d[3 * i]; s[1] += d[3 * i + 1]; s[2] += d[3 * i + 2]; cnt++; }
      if (cnt > 100) {
        var avg = [s[0] / cnt, s[1] / cnt, s[2] / cnt], am = (avg[0] + avg[1] + avg[2]) / 3, k = p.cast / 100;
        var gn = avg.map(function (x) { return 1 + (am / Math.max(x, 1e-3) - 1) * k; });
        var t = C.map3(out, function (r, g, b, ii, o, j) { px3(o, j, Math.min(1.5, Math.max(0, r * gn[0])), Math.min(1.5, Math.max(0, g * gn[1])), Math.min(1.5, Math.max(0, b * gn[2]))); });
        out = C.setLuminance(t, L);
      }
    }
    if (p.contrast) {
      var l2 = Float32Array.from(C.luminance(out).d).sort();
      var pct = function (q) { var pos = q / 100 * (l2.length - 1), lo = Math.floor(pos), f = pos - lo; return l2[lo] + ((l2[Math.min(lo + 1, l2.length - 1)] - l2[lo]) * f); };
      var tt = p.contrast / 100, lo2 = pct(0.5) * tt, hi2 = 1 - (1 - pct(99.5)) * tt, sc = Math.max(hi2 - lo2, 0.05);
      var o2 = img(a.w, a.h, 3);
      for (i = 0; i < o2.d.length; i++) o2.d[i] = clip01((out.d[i] - lo2) / sc);
      out = o2;
    }
    if (p.dynamic) out = F.tonal_contrast(out, { strength: p.dynamic * 0.6, radius: 60, fine: 10, saturation: 0 }, ctx);
    return out;
  };

  F.shadows_highlights = function (a, p, ctx) {
    var L = C.luminance(a), l = L.d, base = C.blur(L, ctx.px(p.radius)).d, n = l.length;
    var nl = img(a.w, a.h, 1), o = nl.d, msum = 0, ks = p.shadows / 100, kh = p.highlights / 100;
    for (var i = 0; i < n; i++) {
      var sm = (1 - smooth(0, 0.55, base[i])) * ks, hm = smooth(0.45, 1, base[i]) * kh;
      var v = clip01(l[i] + sm * 0.65 * (Math.sqrt(clip01(l[i])) - l[i]) * 2);
      v = v - hm * 0.6 * (v - Math.pow(v, 2.2));
      o[i] = clip01(v);
      msum += Math.max(sm, hm);
    }
    var out = C.setLuminance(a, nl);
    if (p.color) out = C.saturate(out, 1 + p.color / 100 * 0.5 * (msum / n));
    return out;
  };

  F.curves = function (a, p, ctx) {
    var lo = p.black / 100, hi = p.white / 100, sc = Math.max(hi - lo, 0.02);
    var g = p.gamma ? (p.gamma > 0 ? 1 / (1 + p.gamma / 100 * 0.7) : 1 - p.gamma / 100 * 0.7) : 1;
    var sf = C.sCurveFn(p.contrast / 100), f = p.fade ? p.fade / 100 * 0.25 : 0, pw = g !== 1 ? C.powLUT(g) : null;
    var out = img(a.w, a.h, 3), d = a.d, o = out.d;
    for (var i = 0; i < d.length; i++) {
      var v = clip01((d[i] - lo) / sc);
      if (g !== 1) v = pw(v);
      if (sf) v = sf(v);
      o[i] = f ? f + v * (1 - f) : v;
    }
    return out;
  };

  F.dramatic = function (a, p, ctx) {
    var k = p.strength / 100;
    var out = F.tonal_contrast(a, { strength: 100 * k, radius: 90, fine: 60 * k, saturation: 0 }, ctx);
    out = C.saturate(C.sCurve(out, 0.35 * k), 1 + p.saturation / 100);
    if (p.darken) {
      var r = ctx.radial(0.5, 0.5, 0.6).d, dk = p.darken / 100 * 0.6;
      out = C.map3(out, function (R, G, B, i, o, j) { var f = 1 - dk * smooth(0.4, 1.1, r[i]); px3(o, j, R * f, G * f, B * f); });
    }
    return out;
  };

  F.detail_extractor = function (a, p, ctx) {
    var L = C.luminance(a), l = L.d, r = ctx.px(p.size);
    var b1 = C.blur(L, r).d, b3 = C.blur(L, r * 3).d, b8 = C.blur(L, r * 8).d;
    var act = img(a.w, a.h, 1);
    for (var i = 0; i < l.length; i++) act.d[i] = Math.abs(l[i] - b1[i]);
    var ac = C.blur(act, r * 2).d, prot = p.protect / 100, amt = p.amount / 100;
    var nl = img(a.w, a.h, 1);
    for (i = 0; i < l.length; i++) {
      var d = (l[i] - b1[i]) + 0.6 * (l[i] - b3[i]) + 0.3 * (l[i] - b8[i]);
      var gate = prot ? smooth(0, 0.02 + 0.03 * prot, ac[i]) : 1;
      nl.d[i] = clip01(l[i] + Math.tanh(d * 4) * 0.25 * amt * 2 * gate);
    }
    return C.setLuminance(a, nl);
  };

  F.glow = function (a, p, ctx) {
    var t = p.threshold / 100, soft = p.style === 'soft';
    var src = C.map3(a, function (r, g, b, i, o, j) {
      var l = r * LR + g * LG + b * LB;
      var m = soft ? 0.3 + 0.7 * smooth(t - 0.3, t + 0.2, l) : smooth(t - 0.15, t + 0.15, l);
      px3(o, j, r * m, g * m, b * m);
    });
    var rr = ctx.px(p.radius), g1 = C.blur(src, rr).d, g3 = C.blur(src, rr * 3).d;
    var w = p.warmth / 100, tint = [1 + 0.25 * w, 1 + 0.05 * w, 1 - 0.3 * w];
    if (p.style === 'halation') tint = [1, 0.35, 0.15];
    var A = p.amount / 100, d = a.d, out = img(a.w, a.h, 3), o = out.d, sf = C.sCurveFn(0.15);
    for (var j = 0; j < d.length; j++) {
      var gv = (g1[j] * 0.6 + g3[j] * 0.4) * tint[j % 3];
      if (soft) {
        var sc = 1 - (1 - d[j]) * (1 - clip01(gv * 1.1));
        o[j] = d[j] + (sf(sc) - d[j]) * A;
      } else o[j] = 1 - (1 - d[j]) * (1 - clip01(gv * A * 1.5));
    }
    return out;
  };

  F.light_beam = function (a, p, ctx) {
    var g = ctx.grid(), cx = p.x / 100, cy = p.y / 100, asp = ctx.aspect, sz = p.size / 100;
    var w = p.warmth / 100, tg = w >= 0 ? [1, 0.8, 0.5] : [0.7, 0.85, 1], aw = Math.abs(w);
    var col = [1 + (tg[0] - 1) * aw, 1 + (tg[1] - 1) * aw, 1 + (tg[2] - 1) * aw], k = p.intensity / 100;
    var out = img(a.w, a.h, 3), d = a.d, o = out.d;
    for (var y = 0; y < a.h; y++) for (var x = 0; x < a.w; x++) {
      var dx = (g.u[x] - cx) * asp, dy = g.v[y] - cy, dd = Math.sqrt(dx * dx + dy * dy) / sz, L;
      if (p.type === 'spot') L = 1 - smooth(0.6, 1, dd);
      else if (p.type === 'rays') {
        var ang = Math.atan2(dy, dx), rays = 0.5 + 0.5 * Math.sin(ang * 14 + Math.sin(ang * 5) * 2);
        L = Math.exp(-dd * 0.9) * (0.35 + 0.65 * rays * rays * rays);
      } else L = Math.exp(-dd * dd * 2);
      var j = (y * a.w + x) * 3;
      for (var c = 0; c < 3; c++) {
        var lit = 1 - (1 - d[j + c]) * (1 - clip01(L * col[c] * k * 0.9));
        var top = clip01(0.5 + L * col[c] * k * 0.3);
        o[j + c] = top < 0.5 ? lit - (1 - 2 * top) * lit * (1 - lit) : lit + (2 * top - 1) * (Math.sqrt(clip01(lit)) - lit);
      }
    }
    return out;
  };

  F.sunlight = function (a, p, ctx) {
    var k = p.strength / 100, t = p.temperature / 100, e = 1 / (1 + p.lift / 100);
    var warm = [1 + 0.25 * t, 1 + 0.08 * t, 1 - 0.3 * t], cool = [1 - 0.05 * t, 1, 1 + 0.08 * t], tmp = [0, 0, 0], pw = C.powLUT(e);
    return C.map3(a, function (r, g, b, i, o, j) {
      var hi = smooth(0.3, 1, r * LR + g * LG + b * LB), v = [r, g, b];
      for (var c = 0; c < 3; c++) v[c] = pw(v[c] * (cool[c] * (1 - hi) + warm[c] * hi));
      C.clipPx(v[0], v[1], v[2], tmp, 0);
      px3(o, j, r + (tmp[0] - r) * k, g + (tmp[1] - g) * k, b + (tmp[2] - b) * k);
    });
  };

  var PHOTO = { warm_81a: '#f4c58a', warm_85: '#e89b44', cool_80a: '#5d8fe0', cool_82: '#9cbbe8', sepia: '#a9773f',
    green: '#6fa85a', red: '#d9473c', magenta: '#c25bb0', underwater: '#2fa7a1' };
  F.photo_filter = function (a, p, ctx) {
    var col = C.hexColor(PHOTO[p.type]), dd = p.density / 100, f = col.map(function (c) { return 1 - dd + dd * c; });
    var out = C.map3(a, function (r, g, b, i, o, j) { px3(o, j, r * f[0], g * f[1], b * f[2]); });
    return p.preserve ? C.setLuminance(out, C.luminance(a)) : out;
  };

  F.polarizer = function (a, p, ctx) {
    var k = p.strength / 100, hsv = [0, 0, 0], rgb = [0, 0, 0], rf = p.reflections / 100;
    var out = C.map3(a, function (r, g, b, i, o, j) {
      C.rgb2hsv(r, g, b, hsv, 0);
      var w = C.hueWeight(hsv[0], 215 + p.rotation, 45) * smooth(0.05, 0.3, hsv[1]) * k;
      var s = clip01(hsv[1] * (1 + 0.6 * w)), v = hsv[2] * (1 - 0.35 * w);
      C.hsv2rgb(hsv[0], s, v, rgb, 0);
      if (rf) {
        var spec = smooth(0.8, 1, rgb[0] * LR + rgb[1] * LG + rgb[2] * LB) * (1 - s), f = 1 - 0.25 * spec * rf;
        rgb[0] *= f; rgb[1] *= f; rgb[2] *= f;
      }
      px3(o, j, rgb[0], rgb[1], rgb[2]);
    });
    return C.saturate(out, 1 + 0.15 * k);
  };

  var GRAD = { nd: '#808080', blue: '#3f6fd8', orange: '#e8873a', tobacco: '#8a6236', magenta: '#b94a9d', sunset: '#e85b3a', teal: '#2f8f94' };
  F.graduated = function (a, p, ctx) {
    var g = ctx.grid(), an = p.angle * Math.PI / 180, ca = Math.cos(an), sa = Math.sin(an), asp = ctx.aspect;
    var pos = p.position / 100, s = 0.02 + p.softness / 100 * 0.5, den = p.density / 100;
    var col = C.hexColor(GRAD[p.color]), mx = Math.max(col[0], col[1], col[2], 1e-3), nd = p.color === 'nd';
    var fac = col.map(function (c) { return (0.35 + 0.65 * c / mx) * 1.1; });
    var out = img(a.w, a.h, 3), d = a.d, o = out.d;
    for (var y = 0; y < a.h; y++) for (var x = 0; x < a.w; x++) {
      var t = (g.v[y] - 0.5) * ca - (g.u[x] - 0.5) * sa * asp + 0.5;
      if (p.invert) t = 1 - t;
      var m = (1 - smooth(pos - s, pos + s, t)) * den, j = (y * a.w + x) * 3;
      for (var c = 0; c < 3; c++) o[j + c] = nd ? d[j + c] * (1 - 0.75 * m) : d[j + c] + (clip01(d[j + c] * fac[c]) - d[j + c]) * m;
    }
    return out;
  };

  F.cinematic = function (a, p, ctx) {
    var b = p.balance / 100, cs = C.hueColor(p.shadow_hue, 0.7, 1), ch = C.hueColor(p.highlight_hue, 0.6, 1);
    var k = p.strength / 100 * 1.4, hsv = [0, 0, 0], L = C.luminance(a), l = L.d;
    var out = C.map3(a, function (r, g, bb, i, o, j) {
      var sh = 1 - smooth(0, 0.55 + 0.25 * b, l[i]), hi = smooth(0.35 + 0.25 * b, 1, l[i]), v = [r, g, bb], skin = 0;
      if (p.skin) {
        C.rgb2hsv(r, g, bb, hsv, 0);
        skin = C.hueWeight(hsv[0], 25, 25) * smooth(0.1, 0.3, hsv[1]) * (1 - smooth(0.75, 0.95, hsv[1]));
      }
      for (var c = 0; c < 3; c++) {
        var tint = clip01(0.5 + (cs[c] - 0.5) * sh * 0.6 + (ch[c] - 0.5) * hi * 0.5), x = v[c];
        var sl = tint < 0.5 ? x - (1 - 2 * tint) * x * (1 - x) : x + (2 * tint - 1) * (Math.sqrt(clip01(x)) - x);
        var res = x + (sl - x) * k;
        if (p.skin) res = res + (x - res) * skin * 0.7;
        v[c] = res;
      }
      px3(o, j, v[0], v[1], v[2]);
    });
    return C.sCurve(C.setLuminance(out, L), p.contrast / 100 * 0.6);
  };

  F.split_tone = function (a, p, ctx) {
    var piv = 0.5 + p.balance / 200, cs = C.hueColor(p.shadow_hue), ch = C.hueColor(p.highlight_hue);
    var ss = p.shadow_sat / 100 * 0.35, hs = p.highlight_sat / 100 * 0.35, L = C.luminance(a), l = L.d;
    var out = C.map3(a, function (r, g, b, i, o, j) {
      var w = smooth(piv - 0.3, piv + 0.3, l[i]);
      px3(o, j, r + (cs[0] - 0.5) * (1 - w) * ss + (ch[0] - 0.5) * w * hs,
        g + (cs[1] - 0.5) * (1 - w) * ss + (ch[1] - 0.5) * w * hs,
        b + (cs[2] - 0.5) * (1 - w) * ss + (ch[2] - 0.5) * w * hs);
    });
    return C.setLuminance(out, L);
  };

  F.bleach_bypass = function (a, p, ctx) {
    var ov = C.blend(a, C.gray3(C.luminance(a)), 'overlay');
    ov = C.saturate(C.sCurve(ov, p.contrast / 100 * 0.6), p.saturation / 100);
    return C.mix(a, ov, p.strength / 100);
  };

  var CROSS = {
    yg: [[[0, .25, .5, .75, 1], [0, .18, .52, .85, 1]], [[0, .25, .5, .75, 1], [0, .22, .58, .88, 1]], [[0, .5, 1], [.18, .45, .7]]],
    bm: [[[0, .5, 1], [.08, .5, .92]], [[0, .5, 1], [0, .44, .9]], [[0, .5, 1], [.2, .62, .95]]],
    cyan: [[[0, .5, 1], [.05, .45, .95]], [[0, .5, 1], [.1, .55, 1]], [[0, .5, 1], [.2, .58, .95]]]
  };
  function curves3(a, cv, k) {
    var out = img(a.w, a.h, 3), d = a.d, o = out.d;
    for (var j = 0; j < d.length; j++) {
      var c = cv[j % 3], v = C.interp(clip01(d[j]), c[0], c[1]);
      o[j] = d[j] + (v - d[j]) * k;
    }
    return out;
  }
  F.cross_process = function (a, p, ctx) { return curves3(a, CROSS[p.type], p.strength / 100); };

  F.selective_hsl = function (a, p, ctx) {
    var hsv = [0, 0, 0], s = p.saturation / 100, li = p.lightness / 100, W = new Float32Array(a.w * a.h);
    var out = C.map3(a, function (r, g, b, i, o, j) {
      C.rgb2hsv(r, g, b, hsv, 0);
      var w = C.hueWeight(hsv[0], p.target, p.range) * smooth(0.03, 0.2, hsv[1]);
      W[i] = w;
      C.hsv2rgb(C.fmod(hsv[0] + p.hue_shift * w, 360), clip01(hsv[1] * (1 + s * w)), hsv[2], o, j);
    });
    if (li) {
      var L = C.luminance(out), nl = img(a.w, a.h, 1);
      for (var i = 0; i < nl.d.length; i++) {
        var l = L.d[i];
        nl.d[i] = l + W[i] * li * (li > 0 ? 1 - l : l) * 0.6;
      }
      out = C.setLuminance(out, nl);
    }
    return out;
  };

  F.white_balance = function (a, p, ctx) {
    var t = p.temperature / 100, m = p.tint / 100, gn = [1 + 0.18 * t + 0.05 * m, 1 - 0.12 * m, 1 - 0.2 * t + 0.05 * m];
    var out = C.map3(a, function (r, g, b, i, o, j) { px3(o, j, r * gn[0], g * gn[1], b * gn[2]); });
    return C.setLuminance(out, C.luminance(a));
  };

  F.foliage = function (a, p, ctx) {
    var hsv = [0, 0, 0], k = p.strength / 100, tgt = p.mode === 'autumn' ? 38 : 12;
    return C.map3(a, function (r, g, b, i, o, j) {
      C.rgb2hsv(r, g, b, hsv, 0);
      var w = C.hueWeight(hsv[0], 95, 50) * smooth(0.05, 0.25, hsv[1]) * k, h = hsv[0], s = hsv[1], v = hsv[2];
      if (p.mode === 'enhance') { h = h + (105 - h) * w * 0.3; s = clip01(s * (1 + 0.45 * w)); v = clip01(v * (1 + 0.08 * w)); }
      else { h = C.fmod(h + (tgt - h) * w, 360); s = clip01(s * (1 + 0.35 * w)); }
      C.hsv2rgb(h, s, v, o, j);
    });
  };

  var MOODS = { neutral: '#d8d8d8', warm: '#f0c89a', cold: '#a9c3e0', mystic: '#b9a6d6', dramatic: '#59606b' };
  F.atmosphere = function (a, p, ctx) {
    var col = C.hexColor(MOODS[p.mood]), A = p.amount / 100, g = ctx.grid(), n = a.w * a.h, m = new Float32Array(n), x, y;
    if (p.direction === 'depth') {
      var L = C.luminance(a), b6 = C.blur(L, ctx.px(6)).d, act = img(a.w, a.h, 1);
      for (var i = 0; i < n; i++) act.d[i] = Math.abs(L.d[i] - b6[i]);
      var ac = C.blur(act, ctx.px(25)).d;
      for (i = 0; i < n; i++) m[i] = 1 - smooth(0, 0.05, ac[i]);
    } else {
      for (y = 0; y < a.h; y++) for (x = 0; x < a.w; x++) {
        var v = g.v[y], mv = 1;
        if (p.direction === 'bottom') mv = smooth(0.3, 1, v); else if (p.direction === 'top') mv = 1 - smooth(0, 0.7, v);
        m[y * a.w + x] = mv;
      }
    }
    var out = C.map3(a, function (r, gg, b, ii, o, j) {
      var t = m[ii] * A * 0.65;
      px3(o, j, r * (1 - t) + col[0] * t, gg * (1 - t) + col[1] * t, b * (1 - t) + col[2] * t);
    });
    return p.mood === 'dramatic' ? C.sCurve(out, 0.3 * A) : out;
  };

  F.pastel = function (a, p, ctx) {
    var k = p.strength / 100, lift = p.lift / 100 * 0.25, tint = C.hueColor(p.tint, 0.35, 1), ta = p.tint_amount / 100 * 0.5;
    var out = C.map3(a, function (r, g, b, i, o, j) { px3(o, j, lift + r * (1 - lift), lift + g * (1 - lift), lift + b * (1 - lift)); });
    out = C.saturate(out, 1 - 0.35 * k);
    out = C.map3(out, function (r, g, b, i, o, j) { px3(o, j, r + (r * tint[0] - r) * ta, g + (g * tint[1] - g) * ta, b + (b * tint[2] - b) * ta); });
    out = C.sCurve(out, -0.3 * k);
    return C.mix(a, out, k);
  };

  F.vignette = function (a, p, ctx) {
    var r = ctx.radial(p.x / 100, p.y / 100, p.roundness / 100).d;
    var st = 0.15 + 0.7 * p.size / 100, s = 0.05 + 0.7 * p.softness / 100, A = p.amount / 100;
    return C.map3(a, function (R, G, B, i, o, j) {
      var m = smooth(st - s * 0.3, st + s, r[i]);
      if (A < 0) { var f = 1 + A * 0.9 * m; px3(o, j, R * f, G * f, B * f); }
      else { var t = A * 0.8 * m; px3(o, j, R + (1 - R) * t, G + (1 - G) * t, B + (1 - B) * t); }
    });
  };

  F.infrared_color = function (a, p, ctx) {
    var hsv = [0, 0, 0], k = p.strength / 100, fo = p.foliage / 100;
    return C.map3(a, function (r, g, b, i, o, j) {
      C.rgb2hsv(r, g, b, hsv, 0);
      var leaf = C.hueWeight(hsv[0], 95, 60) * smooth(0.05, 0.3, hsv[1]) * fo;
      var v = [b, g * 0.9 + r * 0.1, r];
      for (var c = 0; c < 3; c++) v[c] = clip01(v[c] + leaf * (1 - v[c]) * 0.7);
      px3(o, j, r + (v[0] - r) * k, g + (v[1] - g) * k, b + (v[2] - b) * k);
    });
  };

  // =================================================================== PLATA
  var FILMS = {
    neutral: [[0.30, 0.59, 0.11], 0.00, 0.00], pan100: [[0.34, 0.50, 0.16], 0.15, 0.02],
    classic400: [[0.36, 0.46, 0.18], 0.30, 0.05], high3200: [[0.38, 0.44, 0.18], 0.40, 0.04],
    ortho: [[0.02, 0.55, 0.43], 0.25, -0.03], infrared: [[1.05, 0.25, -0.30], 0.35, 0.06],
    portrait: [[0.42, 0.45, 0.13], 0.05, 0.04], document: [[0.32, 0.52, 0.16], 0.60, -0.02]
  };
  var CFILT = { none: [1, 1, 1], red: [2.2, 0.45, 0.15], orange: [1.7, 0.8, 0.2], yellow: [1.3, 1.1, 0.4], green: [0.6, 1.6, 0.6], blue: [0.5, 0.8, 2.0] };
  F.bw_convert = function (a, p, ctx) {
    var fl = FILMS[p.film], cf = CFILT[p.filter], w = [fl[0][0] * cf[0], fl[0][1] * cf[1], fl[0][2] * cf[2]];
    var sw = Math.max(w[0] + w[1] + w[2], 1e-3); w = [w[0] / sw, w[1] / sw, w[2] / sw];
    var n = a.w * a.h, L = img(a.w, a.h, 1), l = L.d, d = a.d, i, b = p.brightness / 100;
    var ge = b ? (b > 0 ? 1 / (1 + 0.8 * b) : 1 - 0.8 * b) : 1, sf = C.sCurveFn(fl[1] * 0.6 + p.contrast / 100 * 0.8), pwb = C.powLUT(ge);
    for (i = 0; i < n; i++) {
      var v = clip01(d[3 * i] * w[0] + d[3 * i + 1] * w[1] + d[3 * i + 2] * w[2]);
      if (b) v = pwb(v);
      if (sf) v = sf(v);
      if (fl[2]) v = v + fl[2] * Math.sin(Math.PI * v) * 0.5;
      l[i] = v;
    }
    if (p.structure) {
      var s = p.structure / 100, b4 = C.blur(L, ctx.px(4)).d, b15 = C.blur(L, ctx.px(15)).d;
      for (i = 0; i < n; i++) {
        var mid = Math.min(1, Math.max(0.15, 1 - Math.abs(l[i] - 0.5) * 1.6));
        l[i] = l[i] + ((l[i] - b4[i]) + 0.7 * (l[i] - b15[i])) * s * 1.4 * mid;
      }
    }
    for (i = 0; i < n; i++) {
      var x = l[i];
      if (p.whites) x = x + smooth(0.55, 1, x) * (1 - x) * p.whites / 100 * 0.7;
      if (p.blacks) x = x - (1 - smooth(0, 0.45, x)) * x * p.blacks / 100 * 0.8;
      l[i] = clip01(x);
    }
    return C.gray3(L);
  };

  F.bw_zones = function (a, p, ctx) {
    var L = C.luminance(a), l = L.d, b6 = C.blur(L, ctx.px(6)).d, nl = img(a.w, a.h, 1);
    for (var i = 0; i < l.length; i++) {
      var sh = 1 - smooth(0, 0.4, l[i]), hi = smooth(0.6, 1, l[i]), md = clip01(1 - Math.abs(l[i] - 0.5) * 2.2);
      var v = l[i] + (p.shadows * sh + p.midtones * md + p.highlights * hi) / 100 * 0.25;
      v = v + (l[i] - b6[i]) * (p.hl_structure * hi + p.sh_structure * sh) / 100 * 1.5;
      nl.d[i] = clip01(v);
    }
    return C.setLuminance(a, nl);
  };

  F.grain = function (a, p, ctx) {
    var w = a.w, h = a.h, rg = ctx.rng(17), size = ctx.px(p.size), ch = p.color ? 3 : 1, i;
    var N = img(w, h, ch);
    for (i = 0; i < N.d.length; i++) N.d[i] = rg.normal();
    N = C.blur(N, size * 0.6);
    if (p.roughness) {
      var N2 = img(w, h, ch);
      for (i = 0; i < N2.d.length; i++) N2.d[i] = rg.normal();
      N2 = C.blur(N2, size * 2);
      var rf = p.roughness / 100 * 1.5;
      for (i = 0; i < N.d.length; i++) N.d[i] += N2.d[i] * rf;
    }
    var sd = C.std(N.d) + 1e-6, amt = p.amount / 100 * 0.11, d = a.d;
    var out = img(w, h, 3), o = out.d;
    for (var k = 0; k < w * h; k++) {
      var j = 3 * k, l = d[j] * LR + d[j + 1] * LG + d[j + 2] * LB, resp;
      if (p.response === 'film') resp = 0.35 + 0.65 * Math.pow(clip01(Math.sin(Math.PI * clip01(l))), 0.8);
      else if (p.response === 'shadows') resp = 1.1 - 0.8 * l;
      else resp = 1;
      for (var c = 0; c < 3; c++) o[j + c] = clip01(d[j + c] + N.d[ch === 3 ? j + c : k] / sd * resp * amt);
    }
    return out;
  };

  var TONINGS = {
    selenium: [[0, '#120f14'], [0.45, '#5a4c55'], [1, '#f4f1ee']], sepia: [[0, '#1e1309'], [0.5, '#8b6a45'], [1, '#f6ecd8']],
    cyanotype: [[0, '#071a33'], [0.5, '#2f5f8c'], [1, '#e6eef4']], gold: [[0, '#0d1118'], [0.5, '#5e6a78'], [1, '#f1f2f2']],
    platinum: [[0, '#1a1410'], [0.5, '#7d6c5d'], [1, '#f3ede4']], copper: [[0, '#1c0c08'], [0.5, '#8f4f36'], [1, '#f7e6da']],
    split: [[0, '#14101a'], [0.35, '#4a4250'], [0.65, '#a28a69'], [1, '#f6efe2']]
  };
  function gradMap(stops) {
    var xs = stops.map(function (s) { return s[0]; }), cols = stops.map(function (s) { return s[1]; });
    var ch = [0, 1, 2].map(function (c) { return cols.map(function (col) { return col[c]; }); });
    return function (l, out) { for (var c = 0; c < 3; c++) out[c] = C.interp(l, xs, ch[c]); };
  }
  F.toning = function (a, p, ctx) {
    var gm = gradMap(TONINGS[p.type].map(function (s) { return [s[0], C.hexColor(s[1])]; })), k0 = p.strength / 100, v = [0, 0, 0], t = [0, 0, 0];
    return C.map3(a, function (r, g, b, i, o, j) {
      var l = r * LR + g * LG + b * LB;
      gm(clip01(l), v);
      var dl = l - (v[0] * LR + v[1] * LG + v[2] * LB);
      C.clipPx(v[0] + dl, v[1] + dl, v[2] + dl, t, 0);
      var k = p.paper_white ? k0 * (1 - smooth(0.85, 1, l)) : k0;
      px3(o, j, r + (t[0] - r) * k, g + (t[1] - g) * k, b + (t[2] - b) * k);
    });
  };

  F.paper_grade = function (a, p, ctx) {
    var e = p.exposure / 100, sf = C.sCurveFn((p.grade - 2) / 3 * 0.9), L = C.luminance(a), nl = img(a.w, a.h, 1);
    for (var i = 0; i < nl.d.length; i++) {
      var l = L.d[i];
      l = clip01(e > 0 ? l - e * 0.25 * (1 - l) * 1.5 : l - e * 0.25 * l);
      nl.d[i] = sf ? sf(l) : l;
    }
    return C.setLuminance(a, nl);
  };

  F.burn_edges = function (a, p, ctx) {
    var g = ctx.grid(), s = p.size / 100, asp = ctx.aspect, A = p.amount / 100;
    var out = img(a.w, a.h, 3), d = a.d, o = out.d;
    for (var y = 0; y < a.h; y++) for (var x = 0; x < a.w; x++) {
      var u = g.u[x], v = g.v[y], m = 0;
      m = Math.max(m, (1 - smooth(0, s, v)) * p.top / 100);
      m = Math.max(m, smooth(1 - s, 1, v) * p.bottom / 100);
      m = Math.max(m, (1 - smooth(0, s / asp, u)) * p.left / 100);
      m = Math.max(m, smooth(1 - s / asp, 1, u) * p.right / 100);
      var e = 1 + 1.8 * m * A, j = (y * a.w + x) * 3;
      for (var c = 0; c < 3; c++) o[j + c] = Math.pow(clip01(d[j + c]), e);
    }
    return out;
  };

  F.dodge_center = function (a, p, ctx) {
    var g = ctx.grid(), cx = p.x / 100, cy = p.y / 100, sz = Math.max(p.size / 100, 0.05), A = p.amount / 100, asp = ctx.aspect;
    var out = img(a.w, a.h, 3), d = a.d, o = out.d;
    for (var y = 0; y < a.h; y++) for (var x = 0; x < a.w; x++) {
      var dx = (g.u[x] - cx) * asp, dy = g.v[y] - cy, dd = Math.sqrt(dx * dx + dy * dy) / sz;
      var m = Math.exp(-dd * dd * 1.5) * A, e = 1 / (1 + 0.8 * m), j = (y * a.w + x) * 3;
      for (var c = 0; c < 3; c++) o[j + c] = Math.pow(clip01(d[j + c]), e);
    }
    return out;
  };

  F.lith_print = function (a, p, ctx) {
    var L = C.luminance(a), l = L.d, n = l.length, hard = p.hardness / 100, nl = img(a.w, a.h, 1), i, sh = new Float32Array(n);
    for (i = 0; i < n; i++) {
      sh[i] = 1 - smooth(0.15, 0.55, l[i]);
      nl.d[i] = l[i] < 0.5 ? l[i] * (1 - 0.6 * hard * sh[i]) : 0.5 + (l[i] - 0.5) * (1 - 0.45 * hard);
    }
    if (p.grain) {
      var rg = ctx.rng(5), N = img(a.w, a.h, 1);
      for (i = 0; i < n; i++) N.d[i] = rg.normal();
      N = C.blur(N, ctx.px(1.3));
      var sd = C.std(N.d) + 1e-6;
      for (i = 0; i < n; i++) nl.d[i] += N.d[i] / sd * sh[i] * p.grain / 100 * 0.08;
    }
    var w = p.warmth / 100, m = 1 + 0.2 * w;
    var gm = gradMap([[0, [0.05, 0.04, 0.04]], [0.5, [0.55 * m, 0.42 * m, 0.35 * m]], [1, [1, 0.93 - 0.05 * w, 0.85 - 0.15 * w]]]);
    var k = p.strength / 100, v = [0, 0, 0], t = [0, 0, 0];
    return C.map3(a, function (r, g, b, ii, o, j) {
      var x = clip01(nl.d[ii]);
      gm(x, v);
      var dl = x - (v[0] * LR + v[1] * LG + v[2] * LB);
      C.clipPx(v[0] + dl, v[1] + dl, v[2] + dl, t, 0);
      px3(o, j, r + (t[0] - r) * k, g + (t[1] - g) * k, b + (t[2] - b) * k);
    });
  };

  F.sabattier = function (a, p, ctx) {
    var L = C.luminance(a), l = L.d, t = p.threshold / 100, k = p.strength / 100, b2 = p.lines ? C.blur(L, ctx.px(2)).d : null;
    var nl = img(a.w, a.h, 1);
    for (var i = 0; i < l.length; i++) {
      var inv = l[i] > t ? t - (l[i] - t) * (t / Math.max(1 - t, 0.05)) : l[i];
      if (b2) inv = inv + smooth(0.01, 0.06, Math.abs(l[i] - b2[i])) * 0.25;
      nl.d[i] = l[i] + (clip01(inv) - l[i]) * k;
    }
    return C.setLuminance(a, nl);
  };

  // =================================================================== ANALÓGICO
  var LOOKS = {
    slide60: [[[0, .3, .7, 1], [.02, .27, .78, 1]], [[0, .3, .7, 1], [.03, .28, .72, .97]], [[0, .3, .7, 1], [.08, .3, .64, .9]], 0.03, 1.15],
    neg70: [[[0, .5, 1], [.1, .58, .98]], [[0, .5, 1], [.06, .5, .92]], [[0, .5, 1], [.04, .38, .78]], 0.08, 0.85],
    neg80: [[[0, .5, 1], [.04, .53, .98]], [[0, .5, 1], [.03, .5, .96]], [[0, .5, 1], [.07, .5, .9]], 0.04, 1.05],
    expired: [[[0, .5, 1], [.12, .6, .95]], [[0, .5, 1], [.1, .52, .9]], [[0, .5, 1], [.18, .5, .78]], 0.12, 0.7],
    cine35: [[[0, .25, .75, 1], [.03, .2, .8, .98]], [[0, .25, .75, 1], [.04, .22, .78, .97]], [[0, .25, .75, 1], [.08, .25, .72, .92]], 0.04, 0.95],
    faded_print: [[[0, .5, 1], [.15, .6, .95]], [[0, .5, 1], [.13, .55, .92]], [[0, .5, 1], [.13, .48, .85]], 0.15, 0.55],
    chrome_cool: [[[0, .5, 1], [0, .45, .95]], [[0, .5, 1], [.02, .5, .97]], [[0, .5, 1], [.06, .56, 1]], 0.02, 1.1]
  };
  F.vintage_film = function (a, p, ctx) {
    var lk = LOOKS[p.look], f = lk[3] + p.fade / 100 * 0.2;
    var out = curves3(a, [lk[0], lk[1], lk[2]], 1);
    for (var i = 0; i < out.d.length; i++) out.d[i] = f + out.d[i] * (1 - f);
    return C.mix(a, C.saturate(out, lk[4]), p.strength / 100);
  };

  var LEAK = { red: ['#ff3b1f', '#ff8a3d'], amber: ['#ff9a2e', '#ffd27a'], rainbow: ['#ff4d6d', '#ffb347', '#7ad3ff'],
    magenta: ['#ff3fa4', '#ff9ad5'], burn: ['#ff5a00', '#fff0b0'] };
  F.light_leak = function (a, p, ctx0) {
    var ctx = ctx0.small(), g = ctx.grid(), rg = C.makeRng((p.seed * 131 + ctx.seed) >>> 0);
    var cols = LEAK[p.style].map(C.hexColor), size = p.size / 100, pos = p.position;
    if (pos === 'random') pos = ['left', 'right', 'top', 'bottom', 'corner'][rg.integers(0, 5)];
    var acc = img(ctx.w, ctx.h, 3), A = acc.d, nb = 3 + cols.length;
    for (var b = 0; b < nb; b++) {
      var t = rg.uniform(0.1, 0.9), cx, cy;
      if (pos === 'left') { cx = rg.uniform(-0.1, 0.08); cy = t; }
      else if (pos === 'right') { cx = 1 - rg.uniform(-0.1, 0.08); cy = t; }
      else if (pos === 'top') { cx = t; cy = rg.uniform(-0.1, 0.08); }
      else if (pos === 'bottom') { cx = t; cy = 1 - rg.uniform(-0.1, 0.08); }
      else { cx = 1 - rg.uniform(-0.05, 0.25); cy = rg.uniform(-0.05, 0.25); }
      var rx = size * rg.uniform(0.3, 0.8), ry = size * rg.uniform(0.5, 1.4), st = rg.uniform(0.5, 1), col = cols[b % cols.length];
      if (pos === 'top' || pos === 'bottom') { var tmp = rx; rx = ry; ry = tmp; }
      for (var y = 0; y < ctx.h; y++) for (var x = 0; x < ctx.w; x++) {
        var ex = (g.u[x] - cx) * ctx.aspect / rx, ey = (g.v[y] - cy) / ry, bl = Math.exp(-(ex * ex + ey * ey) * 1.5) * st, j = (y * ctx.w + x) * 3;
        A[j] += bl * col[0]; A[j + 1] += bl * col[1]; A[j + 2] += bl * col[2];
      }
    }
    var k = p.intensity / 100;
    for (var i = 0; i < A.length; i++) { A[i] = clip01(A[i] * k); if (p.style === 'burn') A[i] = clip01(A[i] * 1.6); }
    if (acc.w !== a.w || acc.h !== a.h) acc = C.resizeLinear(acc, a.w, a.h);
    var out = img(a.w, a.h, 3);
    for (i = 0; i < out.d.length; i++) out.d[i] = 1 - (1 - a.d[i]) * (1 - acc.d[i]);
    return out;
  };

  // --- rasterizado sencillo con antialias para polvo, rayones y pelos
  function stampDisk(L, cx, cy, r, val) {
    var x0 = Math.max(0, Math.floor(cx - r - 1)), x1 = Math.min(L.w - 1, Math.ceil(cx + r + 1));
    var y0 = Math.max(0, Math.floor(cy - r - 1)), y1 = Math.min(L.h - 1, Math.ceil(cy + r + 1));
    for (var y = y0; y <= y1; y++) for (var x = x0; x <= x1; x++) {
      var dd = Math.sqrt((x - cx) * (x - cx) + (y - cy) * (y - cy)), cov = clip01(r + 0.5 - dd);
      if (cov > 0) { var i = y * L.w + x; L.d[i] = L.d[i] * (1 - cov) + val * cov; }
    }
  }
  function stampLine(L, ax, ay, bx, by, th, val) {
    var r = Math.max(0.5, th / 2), x0 = Math.max(0, Math.floor(Math.min(ax, bx) - r - 1)), x1 = Math.min(L.w - 1, Math.ceil(Math.max(ax, bx) + r + 1));
    var y0 = Math.max(0, Math.floor(Math.min(ay, by) - r - 1)), y1 = Math.min(L.h - 1, Math.ceil(Math.max(ay, by) + r + 1));
    var vx = bx - ax, vy = by - ay, len2 = vx * vx + vy * vy || 1;
    for (var y = y0; y <= y1; y++) for (var x = x0; x <= x1; x++) {
      var t = clip01(((x - ax) * vx + (y - ay) * vy) / len2), qx = ax + vx * t - x, qy = ay + vy * t - y;
      var cov = clip01(r + 0.5 - Math.sqrt(qx * qx + qy * qy));
      if (cov > 0) { var i = y * L.w + x; L.d[i] = L.d[i] * (1 - cov) + val * cov; }
    }
  }
  F.dust_scratches = function (a, p, ctx) {
    var w = a.w, h = a.h, rg = C.makeRng((p.seed * 977 + ctx.seed) >>> 0), L = img(w, h, 1);
    var r = ctx.rect, sx = w / (r[2] - r[0]), sy = h / (r[3] - r[1]), full = Math.max(ctx.full_w, ctx.full_h) * ctx.k;
    var sign = function () { return p.tone === 'print' ? -1 : (p.tone === 'negative' ? 1 : rg.choice([-1, 1])); };
    var X = function (nx) { return (nx - r[0]) * sx; }, Y = function (ny) { return (ny - r[1]) * sy; }, i;
    var nd = Math.floor(p.dust / 100 * 900);
    for (i = 0; i < nd; i++) {
      var nx = rg.uniform(0, 1), ny = rg.uniform(0, 1), rr = Math.max(0.5, (rg.pareto(3) * 0.0006 + 0.0002) * full), px = X(nx), py = Y(ny);
      if (px > -rr && px < w + rr && py > -rr && py < h + rr) stampDisk(L, px, py, Math.round(rr), sign() * rg.uniform(0.4, 1));
    }
    var nsc = Math.floor(p.scratches / 100 * 14), th = Math.max(1, Math.round(0.0006 * full));
    for (i = 0; i < nsc; i++) {
      var sxn = rg.uniform(0.02, 0.98), y0 = rg.uniform(0, 1), y1 = rg.uniform(0, 1);
      if (y0 > y1) { var tt = y0; y0 = y1; y1 = tt; }
      if (rg.random() < 0.6) { y0 = 0; y1 = 1; }
      var dr = rg.uniform(-0.01, 0.01);
      stampLine(L, X(sxn), Y(y0), X(sxn + dr), Y(y1), th, sign() * rg.uniform(0.25, 0.7));
    }
    var nh = Math.floor(p.hairs / 100 * 8), th2 = Math.max(1, Math.round(0.0005 * full));
    for (i = 0; i < nh; i++) {
      var cx = rg.uniform(0, 1), cy = rg.uniform(0, 1), ang = rg.uniform(0, 2 * Math.PI), len = rg.uniform(0.02, 0.08), v = sign() * 0.8;
      var px0 = X(cx), py0 = Y(cy);
      for (var s = 0; s < 24; s++) {
        ang += rg.normal() * 0.25;
        cx += Math.cos(ang) * len / 24; cy += Math.sin(ang) * len / 24 * ctx.aspect;
        var px1 = X(cx), py1 = Y(cy);
        stampLine(L, px0, py0, px1, py1, th2, v);
        px0 = px1; py0 = py1;
      }
    }
    L = C.blur(L, Math.max(0.4, 0.25 * full / 1000));
    return C.map3(a, function (R, G, B, k, o, j) {
      var lv = L.d[k], li = clip01(lv) * 0.9, dk = 1 - clip01(-lv) * 0.85;
      px3(o, j, (R + (1 - R) * li) * dk, (G + (1 - G) * li) * dk, (B + (1 - B) * li) * dk);
    });
  };

  F.lens_blur = function (a, p, ctx) {
    var A = p.amount / 100;
    if (A <= 0) return a;
    var full = Math.max(ctx.full_w, ctx.full_h) * ctx.k, rad = Math.max(0.5, A * 0.012 * full);
    var fx = p.focus_x / 100, fy = p.focus_y / 100, fs = p.focus_size / 100, g = ctx.grid(), asp = ctx.aspect, t = p.type;
    var mask = new Float32Array(a.w * a.h), x, y;
    if (t === 'tilt' || t === 'soft_edges' || t === 'dream') {
      for (y = 0; y < a.h; y++) for (x = 0; x < a.w; x++) {
        var m;
        if (t === 'tilt') m = smooth(0.6, 1.6, Math.abs(g.v[y] - fy) / Math.max(fs * 0.5, 0.02));
        else { var dx = (g.u[x] - fx) * asp, dy = g.v[y] - fy; m = smooth(0.5, 1.5, Math.sqrt(dx * dx + dy * dy) / Math.max(fs, 0.05)); }
        mask[y * a.w + x] = m;
      }
      var bl = C.blur(a, rad), base = a;
      if (t === 'dream') {
        var gl = C.blur(a, rad * 2.5);
        base = img(a.w, a.h, 3);
        for (var i = 0; i < base.d.length; i++) base.d[i] = 1 - (1 - a.d[i]) * (1 - gl.d[i] * 0.5 * A);
      }
      return C.mixMap(base, bl, mask);
    }
    if (t === 'zoom') {
      var cxp = (fx - ctx.rect[0]) / (ctx.rect[2] - ctx.rect[0]) * a.w, cyp = (fy - ctx.rect[1]) / (ctx.rect[3] - ctx.rect[1]) * a.h;
      var acc = new Float32Array(a.d.length), steps = 10;
      for (var s = 0; s < steps; s++) {
        var sc = 1 + A * 0.08 * s / (steps - 1);
        for (y = 0; y < a.h; y++) for (x = 0; x < a.w; x++) {
          var sxp = (x - cxp * (1 - sc)) / sc, syp = (y - cyp * (1 - sc)) / sc;
          sxp = Math.min(a.w - 1, Math.max(0, sxp)); syp = Math.min(a.h - 1, Math.max(0, syp));
          var x0 = Math.floor(sxp), y0 = Math.floor(syp), x1 = Math.min(x0 + 1, a.w - 1), y1 = Math.min(y0 + 1, a.h - 1), ax = sxp - x0, ay = syp - y0, j = (y * a.w + x) * 3;
          for (var c = 0; c < 3; c++) {
            acc[j + c] += (a.d[(y0 * a.w + x0) * 3 + c] * (1 - ax) + a.d[(y0 * a.w + x1) * 3 + c] * ax) * (1 - ay) +
              (a.d[(y1 * a.w + x0) * 3 + c] * (1 - ax) + a.d[(y1 * a.w + x1) * 3 + c] * ax) * ay;
          }
        }
      }
      var zo = img(a.w, a.h, 3);
      for (i = 0; i < acc.length; i++) zo.d[i] = acc[i] / steps;
      for (y = 0; y < a.h; y++) for (x = 0; x < a.w; x++) {
        var ddx = (g.u[x] - fx) * asp, ddy = g.v[y] - fy;
        mask[y * a.w + x] = smooth(0, Math.max(fs, 0.05), Math.sqrt(ddx * ddx + ddy * ddy));
      }
      return C.mixMap(a, zo, mask);
    }
    // movimiento: desenfoque lineal en la dirección del ángulo
    var Lk = Math.max(3, Math.floor(rad * 3)) | 1, half = (Lk - 1) / 2, an = -p.angle * Math.PI / 180, ux = Math.cos(an), uy = Math.sin(an);
    var mo = img(a.w, a.h, 3);
    for (y = 0; y < a.h; y++) for (x = 0; x < a.w; x++) {
      var r0 = 0, g0 = 0, b0 = 0, jj = (y * a.w + x) * 3;
      for (var q = -half; q <= half; q++) {
        var xx = Math.min(a.w - 1, Math.max(0, Math.round(x + ux * q))), yy = Math.min(a.h - 1, Math.max(0, Math.round(y + uy * q))), jq = (yy * a.w + xx) * 3;
        r0 += a.d[jq]; g0 += a.d[jq + 1]; b0 += a.d[jq + 2];
      }
      mo.d[jj] = r0 / Lk; mo.d[jj + 1] = g0 / Lk; mo.d[jj + 2] = b0 / Lk;
    }
    return mo;
  };

  function sampleBilinear(a, ch, x, y) {
    x = Math.min(a.w - 1, Math.max(0, x)); y = Math.min(a.h - 1, Math.max(0, y));
    var x0 = Math.floor(x), y0 = Math.floor(y), x1 = Math.min(x0 + 1, a.w - 1), y1 = Math.min(y0 + 1, a.h - 1), fx = x - x0, fy = y - y0;
    return (a.d[(y0 * a.w + x0) * 3 + ch] * (1 - fx) + a.d[(y0 * a.w + x1) * 3 + ch] * fx) * (1 - fy) +
      (a.d[(y1 * a.w + x0) * 3 + ch] * (1 - fx) + a.d[(y1 * a.w + x1) * 3 + ch] * fx) * fy;
  }
  F.chromatic_aberration = function (a, p, ctx) {
    var A = p.amount / 100, full = Math.max(ctx.full_w, ctx.full_h) * ctx.k, out = C.clone(a), x, y, j;
    if (p.type === 'shift') {
      var dsh = A * 0.004 * full;
      for (y = 0; y < a.h; y++) for (x = 0; x < a.w; x++) {
        j = (y * a.w + x) * 3;
        out.d[j] = sampleBilinear(a, 0, x - dsh, y); out.d[j + 2] = sampleBilinear(a, 2, x + dsh, y);
      }
      return out;
    }
    var g = ctx.grid(), r = ctx.rect;
    var sr = 1 + 0.006 * A, sb = 1 - 0.006 * A;
    for (y = 0; y < a.h; y++) for (x = 0; x < a.w; x++) {
      j = (y * a.w + x) * 3;
      var u = g.u[x], v = g.v[y];
      var ur = 0.5 + (u - 0.5) / sr, vr = 0.5 + (v - 0.5) / sr, ub = 0.5 + (u - 0.5) / sb, vb = 0.5 + (v - 0.5) / sb;
      out.d[j] = sampleBilinear(a, 0, (ur - r[0]) / (r[2] - r[0]) * a.w - 0.5, (vr - r[1]) / (r[3] - r[1]) * a.h - 0.5);
      out.d[j + 2] = sampleBilinear(a, 2, (ub - r[0]) / (r[2] - r[0]) * a.w - 0.5, (vb - r[1]) / (r[3] - r[1]) * a.h - 0.5);
    }
    return out;
  };

  F.texture = function (a, p, ctx) {
    var w = a.w, h = a.h, full = Math.max(ctx.full_w, ctx.full_h) * ctx.k, sc = p.scale / 100, t = p.type, i;
    function noise(fr, salt) {
      var rg = C.makeRng((p.seed * 101 + salt) >>> 0), N = img(w, h, 1);
      for (var q = 0; q < N.d.length; q++) N.d[q] = rg.normal();
      N = C.blur(N, Math.max(0.4, fr * full * sc));
      var sd = C.std(N.d) + 1e-6;
      for (q = 0; q < N.d.length; q++) N.d[q] /= sd;
      return N.d;
    }
    var tex = new Float32Array(w * h), n1, n2;
    if (t === 'paper') { n1 = noise(0.0008, 1); n2 = noise(0.004, 2); for (i = 0; i < tex.length; i++) tex[i] = n1[i] * 0.6 + n2[i] * 0.4; }
    else if (t === 'canvas') {
      var g = ctx.grid(), f = 900 / sc; n1 = noise(0.0007, 3);
      for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) { i = y * w + x; tex[i] = Math.sin(g.u[x] * f * ctx.aspect) * Math.sin(g.v[y] * f) * 0.7 + n1[i] * 0.5; }
    } else if (t === 'emulsion') {
      n1 = noise(0.01, 4); n2 = noise(0.001, 5);
      for (i = 0; i < tex.length; i++) tex[i] = -(1 - smooth(0, 0.08, Math.abs(n1[i]))) * 2 + n2[i] * 0.4;
    } else {
      n1 = noise(0.05, 6); n2 = noise(0.015, 7);
      for (i = 0; i < tex.length; i++) { var v = n1[i] * 0.8 + n2[i] * 0.4; tex[i] = v > 0.6 ? v * 1.5 : v * 0.3; }
    }
    var k = p.amount / 100 * 0.12, mode = t === 'stains' ? 'overlay' : 'soft_light', layer = img(w, h, 3);
    for (i = 0; i < tex.length; i++) layer.d[3 * i] = layer.d[3 * i + 1] = layer.d[3 * i + 2] = clip01(0.5 + tex[i] * k);
    return C.blend(a, layer, mode);
  };

  F.old_camera = function (a, p, ctx) {
    var cam = p.camera, s = p.seed, out = a;
    if (cam === 'toy') {
      out = F.cross_process(out, { type: 'yg', strength: 45 }, ctx);
      out = F.brilliance(out, { brightness: 5, contrast: 35, saturation: 35, vibrance: 0, warmth: 10 }, ctx);
      out = F.lens_blur(out, { type: 'soft_edges', amount: 35, focus_x: 50, focus_y: 50, focus_size: 45, angle: 0 }, ctx);
      out = F.vignette(out, { amount: -75, size: 35, roundness: 100, softness: 55, x: 50, y: 50 }, ctx);
      out = F.light_leak(out, { style: 'red', position: 'random', intensity: 35, size: 35, seed: s }, ctx);
    } else if (cam === 'box50') {
      out = F.bw_convert(out, { film: 'pan100', filter: 'yellow', brightness: 0, contrast: 10, structure: -10, whites: 0, blacks: 10 }, ctx);
      out = F.toning(out, { type: 'sepia', strength: 35, paper_white: true }, ctx);
      out = F.lens_blur(out, { type: 'soft_edges', amount: 30, focus_x: 50, focus_y: 50, focus_size: 55, angle: 0 }, ctx);
      out = F.vignette(out, { amount: -45, size: 45, roundness: 40, softness: 70, x: 50, y: 50 }, ctx);
      out = F.dust_scratches(out, { dust: 25, scratches: 10, hairs: 5, tone: 'print', seed: s }, ctx);
    } else if (cam === 'wetplate') {
      out = F.bw_convert(out, { film: 'ortho', filter: 'none', brightness: 0, contrast: 30, structure: 40, whites: 20, blacks: 30 }, ctx);
      out = F.toning(out, { type: 'platinum', strength: 55, paper_white: false }, ctx);
      out = F.lens_blur(out, { type: 'soft_edges', amount: 45, focus_x: 50, focus_y: 45, focus_size: 35, angle: 0 }, ctx);
      out = F.texture(out, { type: 'emulsion', amount: 40, scale: 100, seed: s }, ctx);
      out = F.burn_edges(out, { amount: 70, size: 18, top: 100, bottom: 100, left: 100, right: 100 }, ctx);
    } else if (cam === 'rangefinder70') {
      out = F.vintage_film(out, { look: 'neg70', strength: 85, fade: 10 }, ctx);
      out = F.vignette(out, { amount: -30, size: 55, roundness: 50, softness: 70, x: 50, y: 50 }, ctx);
      out = F.grain(out, { amount: 25, size: 1.3, roughness: 40, response: 'film', color: true }, ctx);
    } else if (cam === 'disposable90') {
      out = F.vintage_film(out, { look: 'neg80', strength: 80, fade: 0 }, ctx);
      out = F.brilliance(out, { brightness: 10, contrast: 20, saturation: 15, vibrance: 0, warmth: -5 }, ctx);
      out = F.white_balance(out, { temperature: -5, tint: -15 }, ctx);
      out = F.vignette(out, { amount: -35, size: 50, roundness: 30, softness: 60, x: 50, y: 50 }, ctx);
      out = F.chromatic_aberration(out, { amount: 30, type: 'radial' }, ctx);
      out = F.grain(out, { amount: 30, size: 1.6, roughness: 50, response: 'shadows', color: true }, ctx);
    } else if (cam === 'pinhole') {
      out = C.blur(out, ctx.px(Math.max(ctx.full_w, ctx.full_h) * 0.0015));
      out = F.vignette(out, { amount: -85, size: 25, roundness: 100, softness: 90, x: 50, y: 50 }, ctx);
      out = F.vintage_film(out, { look: 'faded_print', strength: 60, fade: 0 }, ctx);
    }
    return C.mix(a, out, p.strength / 100);
  };

  var INSTANT = {
    classic: [[[0, .5, 1], [.08, .55, .97]], [[0, .5, 1], [.1, .52, .93]], [[0, .5, 1], [.16, .5, .82]]],
    sx: [[[0, .5, 1], [.06, .5, .92]], [[0, .5, 1], [.1, .55, .95]], [[0, .5, 1], [.12, .47, .85]]],
    faded: [[[0, .5, 1], [.2, .62, .96]], [[0, .5, 1], [.18, .58, .93]], [[0, .5, 1], [.2, .55, .88]]]
  };
  F.instant = function (a, p, ctx) {
    var k = p.strength / 100, out;
    if (p.look === 'bw') {
      out = F.bw_convert(a, { film: 'portrait', filter: 'none', brightness: 5, contrast: -10, structure: -20, whites: 0, blacks: 0 }, ctx);
      out = F.toning(out, { type: 'selenium', strength: 30, paper_white: true }, ctx);
    } else {
      out = C.saturate(curves3(a, INSTANT[p.look], 1), p.look !== 'faded' ? 0.8 : 0.55);
      out = F.vignette(out, { amount: -25, size: 55, roundness: 30, softness: 70, x: 50, y: 50 }, ctx);
    }
    out = C.mix(a, out, k);
    var frame = p.frame;
    if (frame === 'none') return out;
    var asp = { square: 1, wide: 4 / 3, mini: 0.73, black: 1 }[frame];
    if (p.crop && asp) {
      var w = out.w, h = out.h, nw = w, nh = h, x0 = 0, y0 = 0;
      if (w / h > asp) { nw = Math.round(h * asp); x0 = Math.floor((w - nw) / 2); } else { nh = Math.round(w / asp); y0 = Math.floor((h - nh) / 2); }
      var cr = img(nw, nh, 3);
      for (var y = 0; y < nh; y++) cr.d.set(out.d.subarray(((y + y0) * w + x0) * 3, ((y + y0) * w + x0 + nw) * 3), y * nw * 3);
      out = cr;
    }
    var W = out.w, H = out.h, res, i;
    if (frame === 'film_border') {
      var bw = Math.round(Math.max(H, W) * 0.035), CW = W + 2 * bw, CH = H + 2 * bw;
      var inner = img(CW, CH, 1), rg = ctx.rng(99), en = img(CW, CH, 1);
      for (y = 0; y < H; y++) for (var x = 0; x < W; x++) inner.d[(y + bw) * CW + x + bw] = 1;
      for (i = 0; i < en.d.length; i++) en.d[i] = rg.normal();
      en = C.blur(en, bw * 0.15); inner = C.blur(inner, bw * 0.08);
      res = img(CW, CH, 3);
      for (y = 0; y < CH; y++) for (x = 0; x < CW; x++) {
        var ii = y * CW + x, m = clip01(inner.d[ii] + en.d[ii] * 0.08), inside = y >= bw && y < bw + H && x >= bw && x < bw + W;
        for (var c = 0; c < 3; c++) {
          var cv = inside ? out.d[((y - bw) * W + x - bw) * 3 + c] : 0.03;
          res.d[ii * 3 + c] = cv * m + 0.03 * (1 - m);
        }
      }
    } else {
      var side = Math.round(W * 0.06), top = side, bot = Math.round(W * (frame === 'square' || frame === 'black' ? 0.22 : 0.17));
      var col = frame !== 'black' ? [0.95, 0.94, 0.91] : [0.06, 0.06, 0.07], RW = W + 2 * side, RH = H + top + bot;
      res = img(RW, RH, 3);
      for (i = 0; i < RW * RH; i++) { res.d[3 * i] = col[0]; res.d[3 * i + 1] = col[1]; res.d[3 * i + 2] = col[2]; }
      var sh = img(RW, RH, 1);
      for (i = 0; i < sh.d.length; i++) sh.d[i] = 1;
      for (y = 0; y < H; y++) for (x = 0; x < W; x++) sh.d[(y + top) * RW + x + side] = 0;
      sh = C.blur(sh, Math.max(1, W * 0.004));
      for (y = 0; y < H; y++) for (x = 0; x < W; x++) {
        var q = (y + top) * RW + x + side, f = 1 - 0.25 * sh.d[q];
        for (c = 0; c < 3; c++) res.d[q * 3 + c] = out.d[(y * W + x) * 3 + c] * f;
      }
    }
    ctx.alpha = null; ctx.last_scale = 1;
    return res;
  };

  // =================================================================== CINE
  var PRINT = { neutral: [[0, 0, 0], [0, 0, 0]], warm: [[0.010, 0, -0.015], [0.025, 0.008, -0.030]],
    teal: [[-0.020, 0.005, 0.020], [0.020, 0.005, -0.020]], cold: [[-0.010, 0, 0.020], [-0.010, 0, 0.015]],
    filmout: [[0.006, 0, -0.004], [0.012, 0.004, -0.012]] };
  function filmic(x, contrast, toe, shoulder) {
    x = clip01(x);
    var y = 0.5 + (x - 0.5) * (1 + contrast * 1.2), s = 0.25 + 0.5 * shoulder, t = 0.2 + 0.4 * toe;
    if (y > 1 - s) y = 1 - s + s * Math.tanh((y - (1 - s)) / Math.max(s, 1e-3));
    if (y < t) y = t * Math.pow(clip01(y / t), 1 + toe * 1.2);
    return clip01(y);
  }
  F.print_film = function (a, p, ctx) {
    var L = C.luminance(a), nl = img(a.w, a.h, 1), ct = p.contrast / 100, toe = p.toe / 100, sh = p.shoulder / 100;
    for (var i = 0; i < nl.d.length; i++) nl.d[i] = filmic(L.d[i], ct, toe, sh);
    var out = C.setLuminance(a, nl), d = p.density / 100;
    if (d) {
      out = C.map3(out, function (r, g, b, ii, o, j) {
        var f = 1 - d * 0.35 * (Math.max(r, g, b) - Math.min(r, g, b));
        px3(o, j, r * f, g * f, b * f);
      });
      out = C.saturate(out, 1 + 0.15 * d);
    }
    var tn = PRINT[p.tint], s0 = tn[0], s1 = tn[1];
    if (s0[0] || s0[1] || s0[2] || s1[0] || s1[1] || s1[2]) {
      out = C.map3(out, function (r, g, b, ii, o, j) {
        var w = smooth(0.15, 0.85, r * LR + g * LG + b * LB);
        px3(o, j, clip01(r + s0[0] * (1 - w) * 4 + s1[0] * w * 4), clip01(g + s0[1] * (1 - w) * 4 + s1[1] * w * 4), clip01(b + s0[2] * (1 - w) * 4 + s1[2] * w * 4));
      });
    } else out = C.clipImg(out);
    return C.mix(a, out, p.strength / 100);
  };

  F.limited_palette = function (a, p, ctx) {
    var hsv = [0, 0, 0], rgb = [0, 0, 0], tint = C.hueColor(p.target, 1, 1), k0 = p.strength / 100, ds = p.desaturate / 100;
    var tl = tint[0] * LR + tint[1] * LG + tint[2] * LB, tt = [tint[0] - tl, tint[1] - tl, tint[2] - tl], cz = [0, 0, 0];
    return C.map3(a, function (r, g, b, i, o, j) {
      C.rgb2hsv(r, g, b, hsv, 0);
      var h = hsv[0], sat = hsv[1], delta = C.fmod(p.target - h + 180, 360) - 180, far = Math.abs(delta) / 180, k = k0;
      if (p.skin) k = k * (1 - 0.75 * C.hueWeight(h, 25, 25) * smooth(0.1, 0.3, sat) * (1 - smooth(0.7, 0.9, sat)));
      var near = 1 - smooth(0.35, 0.55, far);
      var sat2 = clip01(sat * (1 - ds * far * 1.2));
      C.hsv2rgb(C.fmod(h + Math.max(-60, Math.min(60, delta)) * k * near, 360), sat2, hsv[2], rgb, 0);
      // El teñido usa la saturación ya reducida (igual que el motor Python).
      var l = r * LR + g * LG + b * LB, amt = sat2 * 0.35 + 0.05;
      C.clipPx(l + tt[0] * amt, l + tt[1] * amt, l + tt[2] * amt, cz, 0);
      var w = k * smooth(0.3, 0.7, far);
      px3(o, j, rgb[0] + (cz[0] - rgb[0]) * w, rgb[1] + (cz[1] - rgb[1]) * w, rgb[2] + (cz[2] - rgb[2]) * w);
    });
  };

  var FLARE = { blue: '#5aa0ff', amber: '#ffb060', neutral: '#f0f0f0', red: '#ff6050' };
  F.anamorphic_flare = function (a, p, ctx) {
    var w = a.w, h = a.h, t = p.threshold / 100, src = img(w, h, 1), d = a.d;
    for (var i = 0; i < w * h; i++) { var l = d[3 * i] * LR + d[3 * i + 1] * LG + d[3 * i + 2] * LB; src.d[i] = smooth(t - 0.05, t + 0.05, l) * l; }
    var f = Math.max(1, Math.round(Math.max(h, w) / 480));
    var sm = C.resizeArea(src, Math.max(1, Math.floor(w / f)), Math.max(1, Math.floor(h / f)));
    var Lx = Math.max(2, p.length / 100 * sm.w * 0.25);
    var s1 = C.blurDirect(sm, Lx, 0.6), s2 = C.blurDirect(sm, Lx * 0.25, 0.8), st = img(sm.w, sm.h, 1), mx = 0;
    for (i = 0; i < st.d.length; i++) { st.d[i] = s1.d[i] * 0.7 + s2.d[i] * 0.5; }
    st = C.resizeLinear(st, w, h);
    for (i = 0; i < st.d.length; i++) if (st.d[i] > mx) mx = st.d[i];
    var col = C.hexColor(FLARE[p.color]), k = p.intensity / 100 * 1.4, norm = mx > 0 ? Math.max(mx, 1e-4) : 1;
    var out = img(w, h, 3);
    for (i = 0; i < w * h; i++) {
      var sv = st.d[i] / norm;
      for (var c = 0; c < 3; c++) out.d[3 * i + c] = 1 - (1 - d[3 * i + c]) * (1 - clip01(sv * col[c] * k));
    }
    return out;
  };

  F.letterbox = function (a, p, ctx) {
    var r = parseFloat(p.ratio), asp = ctx.aspect, g = ctx.grid(), k = p.opacity / 100, out = C.clone(a), frac;
    var tall = asp < r;
    frac = tall ? (1 - asp / r) / 2 : (1 - r / asp) / 2;
    for (var y = 0; y < a.h; y++) for (var x = 0; x < a.w; x++) {
      var m = tall ? (g.v[y] < frac || g.v[y] > 1 - frac) : (g.u[x] < frac || g.u[x] > 1 - frac);
      if (m) { var j = (y * a.w + x) * 3; out.d[j] *= 1 - k; out.d[j + 1] *= 1 - k; out.d[j + 2] *= 1 - k; }
    }
    return out;
  };

  // =================================================================== POP (serigrafía inspirada en Warhol)
  var PALETTES = {
    pink_turq: ['#ffe25a', '#f6a3c4', '#29c3c0', '#e5283c', '#141414'],
    yellow: ['#fff3a0', '#ffd21f', '#ff4f9a', '#1fa3ff', '#1a1a1a'],
    violet_orange: ['#ffb347', '#ff7a2f', '#7b3fd1', '#ffe14d', '#161018'],
    lime: ['#f2ff8a', '#b6f03c', '#2f6bff', '#ff3d7f', '#121a12'],
    blue_peach: ['#ffe7c2', '#ffb08a', '#1f4fd6', '#ff2f6d', '#10131c'],
    red_silver: ['#eeeef2', '#c9c9d1', '#9a9aa6', '#d7192a', '#121212'],
    bw: ['#f2f2f2', '#bdbdbd', '#8a8a8a', '#5e5e5e', '#111111']
  };
  var COLOR_PALETTES = ['pink_turq', 'yellow', 'violet_orange', 'lime', 'blue_peach', 'red_silver'];
  function percentile(arr, q) {   // como np.percentile (interpolación lineal)
    var s = Float32Array.from(arr).sort(), pos = q / 100 * (s.length - 1), lo = Math.floor(pos), f = pos - lo;
    return lo + 1 < s.length ? s[lo] + (s[lo + 1] - s[lo]) * f : s[lo];
  }
  function popClasses(a, p, ctx) {
    var sm = p.simplify > 0 ? C.blur(a, ctx.px(p.simplify)) : a, n = a.w * a.h, hsv = [0, 0, 0], d = sm.d;
    var L = C.luminance(sm).d, cls = new Int32Array(n), ink = new Float32Array(n);
    var hiT = percentile(L, p.highlights), t = percentile(L, p.ink);
    for (var i = 0; i < n; i++) {
      C.rgb2hsv(d[3 * i], d[3 * i + 1], d[3 * i + 2], hsv, 0);
      var c = 2;
      if (C.hueWeight(hsv[0], 25, 40) > 0.35 && hsv[1] > 0.12) c = 1;
      if (L[i] > hiT) c = 0;
      if (hsv[1] > 0.45 && C.hueWeight(hsv[0], 355, 22) > 0.5) c = 3;
      cls[i] = c;
      ink[i] = L[i] < t ? 1 : 0;   // la plancha imprime tinta o no la imprime
    }
    return { cls: cls, ink: ink, l: L, w: a.w, h: a.h };
  }
  function popRender(m, palette, p, ctx) {
    var pal = PALETTES[palette].map(C.hexColor), w = m.w, h = m.h, n = w * h, dd = p.detail / 100;
    var off = p.offset / 1000 * Math.max(ctx.full_w, ctx.full_h) * ctx.k;
    var dx = Math.round(off), dy = Math.round(off * 0.6), inkS = new Float32Array(n), x, y, i;
    // Python round() redondea medios al par: se replica para que el desplazamiento coincida.
    var pyRound = function (v) { var r = Math.round(v); return (Math.abs(v % 1) === 0.5 && r % 2 !== 0) ? r - 1 : r; };
    dx = pyRound(off); dy = pyRound(off * 0.6);
    for (y = 0; y < h; y++) {
      var sy = Math.min(h - 1, Math.max(0, y - dy));
      for (x = 0; x < w; x++) inkS[y * w + x] = m.ink[sy * w + Math.min(w - 1, Math.max(0, x - dx))];
    }
    if (p.texture) {
      var rg = ctx.rng(31), N = img(w, h, 1);
      for (i = 0; i < n; i++) N.d[i] = rg.normal();
      N = C.blur(N, ctx.px(1.2));
      var sd = C.std(N.d) + 1e-6, kt = p.texture / 100 * 0.25;
      for (i = 0; i < n; i++) inkS[i] = clip01(inkS[i] * (1 - kt * Math.min(3, Math.max(0, N.d[i] / sd))));
    }
    var out = img(w, h, 3), ic = pal[4];
    for (i = 0; i < n; i++) {
      var col = pal[m.cls[i]], f = dd ? 1 - dd + dd * Math.min(1.5, Math.max(0, 0.5 + m.l[i])) : 1, k = inkS[i];
      for (var c = 0; c < 3; c++) out.d[3 * i + c] = clip01(col[c] * f * (1 - k) + ic[c] * k);
    }
    return out;
  }
  F.pop_silkscreen = function (a, p, ctx) { return popRender(popClasses(a, p, ctx), p.palette, p, ctx); };

  F.pop_grid = function (a, p, ctx) {
    var w = a.w, h = a.h, r = ctx.rect;
    if (r[0] !== 0 || r[1] !== 0 || r[2] !== 1 || r[3] !== 1) return F.pop_silkscreen(a, p, ctx);
    var g = { '1x2': [1, 2], '2x2': [2, 2], '3x3': [3, 3], '2x3': [2, 3], '4x4': [4, 4] }[p.grid], rows = g[0], cols = g[1];
    var pyRound = function (v) { var rr = Math.round(v); return (Math.abs(v % 1) === 0.5 && rr % 2 !== 0) ? rr - 1 : rr; };
    var gap = pyRound(p.gap / 1000 * Math.max(w, h));
    var tw = Math.max(4, Math.floor((w - gap * (cols + 1)) / cols)), th = Math.max(4, Math.floor((h - gap * (rows + 1)) / rows));
    var ta = tw / th, cw, ch;
    if (w / h > ta) { cw = pyRound(h * ta); ch = h; } else { cw = w; ch = pyRound(w / ta); }
    var x0 = Math.floor((w - cw) / 2), y0 = Math.floor((h - ch) / 2), src = img(cw, ch, 3), y, x, c;
    for (y = 0; y < ch; y++) src.d.set(a.d.subarray(((y + y0) * w + x0) * 3, ((y + y0) * w + x0 + cw) * 3), y * cw * 3);
    var tile = (tw !== cw || th !== ch) ? C.resize(src, tw, th, 'area') : src;
    var tk = ctx.k * tw / cw, tctx = new C.Context(th, tw, tk, [0, 0, 1, 1], ctx.seed, [tw, th]);
    var m = popClasses(tile, p, tctx), out = img(w, h, 3);
    for (var i = 0; i < w * h; i++) { out.d[3 * i] = 0.97; out.d[3 * i + 1] = 0.96; out.d[3 * i + 2] = 0.93; }
    var start = COLOR_PALETTES.indexOf(p.palette); if (start < 0) start = 0;
    var idx = 0;
    for (var rr = 0; rr < rows; rr++) for (var cc = 0; cc < cols; cc++) {
      var pal;
      if (p.diptych_bw && cc === cols - 1) pal = 'bw';
      else if (p.palette === 'bw' && !p.rotate) pal = 'bw';
      else pal = COLOR_PALETTES[(start + (p.rotate ? idx : 0)) % COLOR_PALETTES.length];
      var t2 = new C.Context(th, tw, tk, [0, 0, 1, 1], ctx.seed + idx, [tw, th]);
      var rd = popRender(m, pal, p, t2), ox = gap + cc * (tw + gap), oy = gap + rr * (th + gap);
      for (y = 0; y < th; y++) out.d.set(rd.d.subarray(y * tw * 3, (y + 1) * tw * 3), ((oy + y) * w + ox) * 3);
      idx++;
    }
    return out;
  };

  F.halftone = function (a, p, ctx) {
    var w = a.w, h = a.h, g = ctx.grid(), r = ctx.rect, cell = Math.max(2, p.size * ctx.k), k = 1 + p.contrast / 100 * 1.5;
    var sm = C.blur(a, cell * 0.5), out = img(w, h, 3), i, x, y;
    function dot(dark, ang, fx, fy) {
      var an = ang * Math.PI / 180, ca = Math.cos(an), sa = Math.sin(an);
      var rx = fx * ca + fy * sa, ry = -fx * sa + fy * ca;
      var cx = (Math.floor(rx / cell) + 0.5) * cell - rx, cy = (Math.floor(ry / cell) + 0.5) * cell - ry;
      var dist = Math.sqrt(cx * cx + cy * cy) / cell, rad = Math.sqrt(clip01(dark)) * 0.72;
      var t = clip01((dist - (rad - 0.04)) / 0.08);
      return 1 - t * t * (3 - 2 * t);
    }
    var inv = function (v) { return 0.5 + (0.5 - v) * k; };
    var base = p.mode === 'ink' ? C.saturate(C.map3(sm, function (R, G, B, ii, o, j) { o[j] = clip01(R * 1.1); o[j + 1] = clip01(G * 1.1); o[j + 2] = clip01(B * 1.1); }), 1.3) : null;
    for (y = 0; y < h; y++) {
      var fy = (g.v[y] - r[1]) / (r[3] - r[1]) * h;
      for (x = 0; x < w; x++) {
        var fx = (g.u[x] - r[0]) / (r[2] - r[0]) * w, j = (y * w + x) * 3, d = sm.d;
        if (p.mode === 'cmy') {
          out.d[j] = clip01(1 - dot(inv(d[j]), p.angle + 15, fx, fy));
          out.d[j + 1] = clip01(1 - dot(inv(d[j + 1]), p.angle + 75, fx, fy));
          out.d[j + 2] = clip01(1 - dot(inv(d[j + 2]), p.angle, fx, fy));
        } else {
          var l = d[j] * LR + d[j + 1] * LG + d[j + 2] * LB;
          if (p.mode === 'mono') { var v = 1 - dot(inv(l), p.angle, fx, fy); out.d[j] = out.d[j + 1] = out.d[j + 2] = v; }
          else {
            var dd = dot((0.7 - l) * k, p.angle, fx, fy);
            for (var c = 0; c < 3; c++) out.d[j + c] = base.d[j + c] * (1 - dd * 0.85);
          }
        }
      }
    }
    return out;
  };

  // =================================================================== nitidez (de Realce)
  F.sharpen = function (a, p, ctx) {
    var L = C.luminance(a), l = L.d, r = ctx.px(p.radius), b = C.blur(L, r).d, thr = p.threshold / 100 * 0.02, amt = p.amount / 100 * 2.5;
    var ks = Math.max(3, Math.round(r * 2)) | 1, rad = (ks - 1) >> 1, w = a.w, h = a.h;
    // mínimo y máximo local (erosión / dilatación con ventana cuadrada)
    var mn = new Float32Array(l.length), mxx = new Float32Array(l.length), tmn = new Float32Array(l.length), tmx = new Float32Array(l.length), x, y, q;
    for (y = 0; y < h; y++) for (x = 0; x < w; x++) {
      var lo = 1e9, hi = -1e9;
      for (q = Math.max(0, x - rad); q <= Math.min(w - 1, x + rad); q++) { var v = l[y * w + q]; if (v < lo) lo = v; if (v > hi) hi = v; }
      tmn[y * w + x] = lo; tmx[y * w + x] = hi;
    }
    for (y = 0; y < h; y++) for (x = 0; x < w; x++) {
      var lo2 = 1e9, hi2 = -1e9;
      for (q = Math.max(0, y - rad); q <= Math.min(h - 1, y + rad); q++) { if (tmn[q * w + x] < lo2) lo2 = tmn[q * w + x]; if (tmx[q * w + x] > hi2) hi2 = tmx[q * w + x]; }
      mn[y * w + x] = lo2; mxx[y * w + x] = hi2;
    }
    var nl = img(w, h, 1);
    for (var i = 0; i < l.length; i++) {
      var dd = l[i] - b[i];
      dd = (dd > 0 ? 1 : (dd < 0 ? -1 : 0)) * Math.max(Math.abs(dd) - thr, 0);
      nl.d[i] = clip01(Math.min(Math.max(l[i] + dd * amt, mn[i] - 0.03), mxx[i] + 0.03));
    }
    return C.setLuminance(a, nl);
  };

  // =================================================================== ejecución de recetas
  var MAX_STACK = 15;
  function fill(schemaFilter, given) {
    var out = {};
    schemaFilter.params.forEach(function (p) {
      var v = given && given[p.id] !== undefined ? given[p.id] : p['default'];
      if (p.type === 'range' || p.type === 'hue') v = Math.min(Math.max(Number(v), p.min), p.max);
      else if (p.type === 'check') v = !!v;
      else if (p.type === 'select' && !p.options.some(function (o) { return o[0] === v; })) v = p['default'];
      out[p.id] = v;
    });
    return out;
  }
  function runStack(a, recipe, ctx, schemaById, progress) {
    var stack = (recipe.stack || []).filter(function (it) { return it.enabled !== false; });
    if (stack.length > MAX_STACK) throw new Error('Máximo ' + MAX_STACK + ' filtros por receta.');
    for (var i = 0; i < stack.length; i++) {
      var it = stack[i], fn = F[it.id], sf = schemaById[it.id];
      if (!fn || !sf) throw new Error('Filtro no disponible en móvil: ' + it.id);
      if (progress) progress(i / Math.max(1, stack.length), sf.name);
      var out = fn(a, fill(sf, it.params || {}), ctx);
      if (out.w !== a.w || out.h !== a.h) {
        a = C.clipImg(out);
        ctx = ctx.resized(a.h, a.w, ctx.last_scale || 1);
        continue;
      }
      var mode = it.blend || 'normal', op = (it.opacity === undefined ? 100 : it.opacity) / 100;
      out = C.clipImg(out);
      var res = mode !== 'normal' ? C.clipImg(C.blend(a, out, mode)) : out;
      var mask = C.buildMask(a, it.mask, ctx);
      if (!mask && op >= 0.999) a = res;
      else if (!mask) a = C.clipImg(C.mix(a, res, op));
      else a = C.clipImg(C.mixMap(a, res, mask, op));
    }
    if (progress) progress(1, 'Listo');
    return { img: a, ctx: ctx };
  }

  var api = { filters: F, runStack: runStack, fill: fill, MAX_STACK: MAX_STACK };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.EGFilters = api;
})(typeof self !== 'undefined' ? self : this);
