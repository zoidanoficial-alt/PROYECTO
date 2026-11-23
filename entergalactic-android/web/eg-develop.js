/* ENTERGALACTIC móvil — «Revelado»: revelador de fotos con controles de tipo profesional.
 *
 * Orden del proceso (como un revelador RAW):
 *   1. balance de blancos y exposición en luz lineal
 *   2. tono: contraste, iluminaciones, sombras, blancos, negros (con adaptación local)
 *   3. curva de tonos (RGB y por canal)
 *   4. presencia: textura, claridad, neblina, intensidad, saturación
 *   5. mezcla de color HSL (8 tonos) y gradación de color (sombras / medios / luces)
 *   6. detalle: reducción de ruido y enfoque con máscara
 *   7. efectos: viñeta y grano
 *   8. geometría: enderezar y recortar
 * Con todos los valores a 0 la imagen no cambia.
 */
(function (root) {
  'use strict';
  var isNode = typeof module !== 'undefined' && module.exports;
  var C = isNode ? require('./eg-core.js') : root.EGCore;
  var F = (isNode ? require('./eg-filters.js') : root.EGFilters).filters;
  var img = C.img, clip01 = C.clip01, smooth = C.smooth, LR = C.LR, LG = C.LG, LB = C.LB;

  // ------------------------------------------------------------------ definición de controles (la interfaz se genera de aquí)
  function r(id, label, min, max, def, extra) {
    var o = { id: id, label: label, min: min, max: max, def: def === undefined ? 0 : def, step: 1 };
    for (var k in extra || {}) o[k] = extra[k];
    return o;
  }
  var HSL_COLORS = [
    ['red', 'Rojo', 0], ['orange', 'Naranja', 30], ['yellow', 'Amarillo', 60], ['green', 'Verde', 120],
    ['aqua', 'Aguamarina', 180], ['blue', 'Azul', 225], ['purple', 'Morado', 270], ['magenta', 'Magenta', 315]
  ];
  var SECTIONS = [
    { id: 'basic', name: 'Básico', params: [
      r('temp', 'Temperatura', -100, 100, 0, { track: 'temp' }), r('tint', 'Matiz', -100, 100, 0, { track: 'tint' }),
      r('exposure', 'Exposición', -5, 5, 0, { step: 0.05, unit: 'EV' }), r('contrast', 'Contraste', -100, 100),
      r('highlights', 'Iluminaciones', -100, 100), r('shadows', 'Sombras', -100, 100),
      r('whites', 'Blancos', -100, 100), r('blacks', 'Negros', -100, 100),
      r('texture', 'Textura', -100, 100), r('clarity', 'Claridad', -100, 100), r('dehaze', 'Neblina', -100, 100),
      r('vibrance', 'Intensidad', -100, 100), r('saturation', 'Saturación', -100, 100)] },
    { id: 'curve', name: 'Curva', custom: 'curve' },
    { id: 'hsl', name: 'Mezcla de color', custom: 'hsl' },
    { id: 'grading', name: 'Gradación de color', params: [
      r('gs_hue', 'Sombras · tono', 0, 360, 220, { track: 'hue' }), r('gs_sat', 'Sombras · saturación', 0, 100, 0),
      r('gs_lum', 'Sombras · luminancia', -100, 100),
      r('gm_hue', 'Medios · tono', 0, 360, 40, { track: 'hue' }), r('gm_sat', 'Medios · saturación', 0, 100, 0),
      r('gm_lum', 'Medios · luminancia', -100, 100),
      r('gh_hue', 'Luces · tono', 0, 360, 45, { track: 'hue' }), r('gh_sat', 'Luces · saturación', 0, 100, 0),
      r('gh_lum', 'Luces · luminancia', -100, 100),
      r('g_blend', 'Fusión', 0, 100, 50), r('g_balance', 'Equilibrio', -100, 100)] },
    { id: 'detail', name: 'Detalle', params: [
      r('sharp', 'Enfoque · cantidad', 0, 150, 0), r('sharp_radius', 'Enfoque · radio', 0.5, 3, 1, { step: 0.1 }),
      r('sharp_detail', 'Enfoque · detalle', 0, 100, 25), r('sharp_mask', 'Enfoque · máscara', 0, 100, 0),
      r('nr_luma', 'Ruido de luminancia', 0, 100, 0), r('nr_color', 'Ruido de color', 0, 100, 0)] },
    { id: 'effects', name: 'Efectos', params: [
      r('vig', 'Viñeta · cantidad', -100, 100), r('vig_mid', 'Viñeta · punto medio', 0, 100, 50),
      r('vig_round', 'Viñeta · redondez', -100, 100), r('vig_feather', 'Viñeta · desvanecer', 0, 100, 50),
      r('grain', 'Grano · cantidad', 0, 100), r('grain_size', 'Grano · tamaño', 0, 100, 25),
      r('grain_rough', 'Grano · aspereza', 0, 100, 50)] },
    { id: 'geometry', name: 'Recortar y enderezar', params: [
      r('angle', 'Enderezar', -45, 45, 0, { step: 0.1, unit: '°' }),
      { id: 'aspect', label: 'Proporción', type: 'select', def: 'free',
        options: [['free', 'Original'], ['1:1', '1:1'], ['4:5', '4:5'], ['5:4', '5:4'], ['3:2', '3:2'], ['2:3', '2:3'],
          ['16:9', '16:9'], ['9:16', '9:16'], ['2.39:1', '2.39:1 (cine)']] },
      r('zoom', 'Recorte adicional', 0, 50, 0, { unit: '%' })] }
  ];
  function defaults() {
    var d = { curve: { rgb: [[0, 0], [1, 1]], r: [[0, 0], [1, 1]], g: [[0, 0], [1, 1]], b: [[0, 0], [1, 1]] }, hsl: {} };
    SECTIONS.forEach(function (s) { (s.params || []).forEach(function (p) { d[p.id] = p.def; }); });
    HSL_COLORS.forEach(function (c) { d.hsl[c[0]] = { h: 0, s: 0, l: 0 }; });
    return d;
  }

  // ------------------------------------------------------------------ utilidades
  var LIN = new Float32Array(4097), N = 4096;
  for (var i = 0; i <= N; i++) { var v = i / N; LIN[i] = v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }
  function toLin(x) { if (x <= 0) return 0; if (x >= 1) return 1; var f = x * N, k = f | 0; return LIN[k] + (LIN[k + 1] - LIN[k]) * (f - k); }
  var SRGB = new Float32Array(4097);
  for (i = 0; i <= N; i++) { var l = i / N; SRGB[i] = l <= 0.0031308 ? l * 12.92 : 1.055 * Math.pow(l, 1 / 2.4) - 0.055; }
  function toSrgb(x) {
    if (x <= 0) return 0;
    if (x > 1) return 1 + (1 - Math.exp(-(x - 1) * 1.5)) * 0.25;   // luz por encima de 1: se conserva para las iluminaciones
    var f = x * N, k = f | 0; return SRGB[k] + (SRGB[k + 1] - SRGB[k]) * (f - k);
  }
  // Curva monótona (Fritsch–Carlson) → tabla de 1024 valores
  function curveLUT(pts) {
    pts = pts.slice().sort(function (a, b) { return a[0] - b[0]; });
    var n = pts.length, lut = new Float32Array(1025);
    if (n < 2 || (n === 2 && pts[0][0] === 0 && pts[0][1] === 0 && pts[1][0] === 1 && pts[1][1] === 1)) return null;
    var xs = pts.map(function (p) { return p[0]; }), ys = pts.map(function (p) { return p[1]; }), d = [], m = [];
    for (var k = 0; k < n - 1; k++) d.push((ys[k + 1] - ys[k]) / Math.max(xs[k + 1] - xs[k], 1e-6));
    m[0] = d[0]; m[n - 1] = d[n - 2];
    for (k = 1; k < n - 1; k++) m[k] = d[k - 1] * d[k] <= 0 ? 0 : (d[k - 1] + d[k]) / 2;
    for (k = 0; k < n - 1; k++) {
      if (d[k] === 0) { m[k] = m[k + 1] = 0; continue; }
      var a = m[k] / d[k], b = m[k + 1] / d[k], s = a * a + b * b;
      if (s > 9) { var t = 3 / Math.sqrt(s); m[k] = t * a * d[k]; m[k + 1] = t * b * d[k]; }
    }
    for (var q = 0; q <= 1024; q++) {
      var x = q / 1024, j = 0;
      if (x <= xs[0]) { lut[q] = ys[0]; continue; }
      if (x >= xs[n - 1]) { lut[q] = ys[n - 1]; continue; }
      while (j < n - 2 && x > xs[j + 1]) j++;
      var hh = xs[j + 1] - xs[j], tt = (x - xs[j]) / hh, t2 = tt * tt, t3 = t2 * tt;
      lut[q] = clip01((2 * t3 - 3 * t2 + 1) * ys[j] + (t3 - 2 * t2 + tt) * hh * m[j] + (-2 * t3 + 3 * t2) * ys[j + 1] + (t3 - t2) * hh * m[j + 1]);
    }
    return lut;
  }
  function lutAt(lut, x) { if (x <= 0) return lut[0]; if (x >= 1) return lut[1024]; var f = x * 1024, k = f | 0; return lut[k] + (lut[k + 1] - lut[k]) * (f - k); }
  // ¿Los ajustes dejan la imagen igual? (entonces no se calcula nada)
  function isNeutral(s) {
    if (!s) return true;
    var d = defaults();
    var vals = ['temp', 'tint', 'exposure', 'contrast', 'highlights', 'shadows', 'whites', 'blacks', 'texture', 'clarity',
      'dehaze', 'vibrance', 'saturation', 'gs_sat', 'gm_sat', 'gh_sat', 'gs_lum', 'gm_lum', 'gh_lum', 'sharp', 'nr_luma',
      'nr_color', 'vig', 'grain', 'angle', 'zoom'];
    for (var i = 0; i < vals.length; i++) if (s[vals[i]] !== undefined && s[vals[i]] !== d[vals[i]]) return false;
    if (s.aspect && s.aspect !== 'free') return false;
    if (s.curve && ['rgb', 'r', 'g', 'b'].some(function (c) { return s.curve[c] && curveLUT(s.curve[c]); })) return false;
    if (s.hsl && HSL_COLORS.some(function (c) { var v = s.hsl[c[0]]; return v && (v.h || v.s || v.l); })) return false;
    return true;
  }

  // ------------------------------------------------------------------ revelado
  function develop(a, S, ctx) {
    var s = defaults(), key;
    for (key in S || {}) s[key] = S[key];
    var w = a.w, h = a.h, n = w * h, d = a.d, sz = Math.max(ctx.full_w, ctx.full_h) * ctx.k, i, j;

    // 1. balance de blancos + exposición en lineal
    var t = s.temp / 100, ti = s.tint / 100, ev = Math.pow(2, s.exposure);
    var gr = (1 + 0.28 * t + 0.06 * ti) * ev, gg = (1 - 0.18 * ti) * ev, gb = (1 - 0.32 * t + 0.06 * ti) * ev;
    var gnorm = 1 / (gr * LR + gg * LG + gb * LB) * ev;     // el balance no cambia el brillo, la exposición sí
    gr *= gnorm; gg *= gnorm; gb *= gnorm;
    var o = new Float32Array(d.length), L = new Float32Array(n);
    for (i = 0, j = 0; i < n; i++, j += 3) {
      o[j] = toSrgb(toLin(d[j]) * gr); o[j + 1] = toSrgb(toLin(d[j + 1]) * gg); o[j + 2] = toSrgb(toLin(d[j + 2]) * gb);
      L[i] = o[j] * LR + o[j + 1] * LG + o[j + 2] * LB;
    }

    // 2. tono con adaptación local (la base suavizada evita halos y aplanamiento)
    var needTone = s.contrast || s.highlights || s.shadows || s.whites || s.blacks;
    var curveRGB = curveLUT(s.curve.rgb), cR = curveLUT(s.curve.r), cG = curveLUT(s.curve.g), cB = curveLUT(s.curve.b);
    var base = needTone ? C.blur(img(w, h, 1, L), Math.max(1, sz * 0.02)).d : null;
    var sc = C.sCurveFn(s.contrast / 100 * 0.8), hi = s.highlights / 100, sh = s.shadows / 100, wh = s.whites / 100, bk = s.blacks / 100;
    for (i = 0, j = 0; i < n; i++, j += 3) {
      var r0 = o[j], g0 = o[j + 1], b0 = o[j + 2];
      if (needTone) {
        var l0 = L[i], lb = base[i], l1 = l0;
        if (hi) { var wH = smooth(0.45, 1.05, lb); l1 += hi * 0.45 * wH * (hi < 0 ? l1 - 0.35 : 1.05 - l1); }
        if (sh) { var wS = 1 - smooth(0, 0.5, lb); l1 += sh * 0.4 * wS * (sh > 0 ? Math.max(0, 0.7 - l1) : l1); }
        if (wh) { l1 += wh * 0.3 * smooth(0.5, 1.0, l1) * (wh > 0 ? 1.1 - l1 : l1); }
        if (bk) { l1 += bk * 0.25 * (1 - smooth(0, 0.35, l1)) * (bk > 0 ? 0.4 - Math.min(l1, 0.4) : l1); }
        if (sc) l1 = sc(clip01(l1));
        var dl = l1 - l0;
        r0 += dl; g0 += dl; b0 += dl;
      }
      if (r0 > 1 || g0 > 1 || b0 > 1 || r0 < 0 || g0 < 0 || b0 < 0) { C.clipPx(r0, g0, b0, o, j); r0 = o[j]; g0 = o[j + 1]; b0 = o[j + 2]; }
      // 3. curva
      if (curveRGB) { r0 = lutAt(curveRGB, r0); g0 = lutAt(curveRGB, g0); b0 = lutAt(curveRGB, b0); }
      if (cR) r0 = lutAt(cR, r0);
      if (cG) g0 = lutAt(cG, g0);
      if (cB) b0 = lutAt(cB, b0);
      o[j] = r0; o[j + 1] = g0; o[j + 2] = b0;
    }
    var out = img(w, h, 3, o);

    // 4. presencia: textura (detalle fino), claridad (contraste local medio), neblina
    if (s.texture || s.clarity) {
      var Lc = C.luminance(out), lc = Lc.d;
      var bT = s.texture ? C.blur(Lc, Math.max(0.8, sz * 0.002)).d : null, bC = s.clarity ? C.blur(Lc, Math.max(3, sz * 0.03)).d : null;
      var kt = s.texture / 100 * 1.2, kc = s.clarity / 100 * 0.9;
      for (i = 0, j = 0; i < n; i++, j += 3) {
        var dd = 0, mid = Math.max(0.25, 1 - Math.abs(lc[i] - 0.5) * 1.6);
        if (bT) dd += (lc[i] - bT[i]) * kt;
        if (bC) dd += (lc[i] - bC[i]) * kc * mid;
        C.clipPx(o[j] + dd, o[j + 1] + dd, o[j + 2] + dd, o, j);
      }
    }
    if (s.dehaze) {
      var dc = img(w, h, 1);
      for (i = 0, j = 0; i < n; i++, j += 3) dc.d[i] = Math.min(o[j], o[j + 1], o[j + 2]);
      var dcb = C.blur(dc, Math.max(2, sz * 0.02)).d, kd = s.dehaze / 100, A = 0.96;
      for (i = 0, j = 0; i < n; i++, j += 3) {
        for (var c = 0; c < 3; c++) {
          var x = o[j + c];
          if (kd > 0) { var tt = Math.max(0.35, 1 - 0.9 * kd * dcb[i]); x = (x - A * (1 - tt)) / tt; }
          else x = x * (1 + kd * 0.35) - kd * 0.35 * A * 0.85;
          o[j + c] = x;
        }
        C.clipPx(o[j], o[j + 1], o[j + 2], o, j);
      }
      if (kd > 0) out = C.saturate(out, 1 + kd * 0.15);
      o = out.d;
    }

    // 5. color: intensidad, saturación, HSL por tono, gradación
    var vib = s.vibrance / 100, sat = s.saturation / 100;
    var hslOn = HSL_COLORS.some(function (cc) { var v = s.hsl[cc[0]]; return v && (v.h || v.s || v.l); });
    var gradOn = s.gs_sat || s.gm_sat || s.gh_sat || s.gs_lum || s.gm_lum || s.gh_lum;
    if (vib || sat || hslOn || gradOn) {
      var hsv = [0, 0, 0], cs = C.hueColor(s.gs_hue), cm = C.hueColor(s.gm_hue), ch = C.hueColor(s.gh_hue);
      var bal = s.g_balance / 100, bl = 0.15 + 0.35 * s.g_blend / 100;
      // Tabla por tono (cada 0,5°) con el desplazamiento combinado de las 8 bandas de color.
      var hslN = 720, hslRes = hslN / 360, hslH = new Float32Array(hslN), hslS = new Float32Array(hslN), hslL = new Float32Array(hslN);
      if (hslOn) {
        for (var hb = 0; hb < hslN; hb++) {
          var hue = hb / hslRes, sh2 = 0, ss2 = 0, sl2 = 0, ws2 = 0;
          HSL_COLORS.forEach(function (cc, qi) {
            var v = s.hsl[cc[0]] || { h: 0, s: 0, l: 0 }, wq = C.hueWeight(hue, cc[2], qi === 4 || qi === 5 ? 50 : 40);
            ws2 += wq; sh2 += wq * v.h; ss2 += wq * v.s; sl2 += wq * v.l;
          });
          var nrm = Math.max(1, ws2);
          hslH[hb] = sh2 / nrm * 0.3; hslS[hb] = ss2 / nrm / 100; hslL[hb] = sl2 / nrm / 100;
        }
      }
      for (i = 0, j = 0; i < n; i++, j += 3) {
        var R = o[j], G = o[j + 1], B = o[j + 2], lum = R * LR + G * LG + B * LB;
        if (sat || vib) {
          C.rgb2hsv(R, G, B, hsv, 0);
          var skin = C.hueWeight(hsv[0], 25, 30);
          var f = 1 + sat + vib * (1 - hsv[1]) * (1 - 0.6 * skin);
          R = lum + (R - lum) * f; G = lum + (G - lum) * f; B = lum + (B - lum) * f;
        }
        if (hslOn) {
          C.rgb2hsv(clip01(R), clip01(G), clip01(B), hsv, 0);
          var hk = hsv[0] * hslRes, hk0 = hk | 0, hf = hk - hk0, hk1 = (hk0 + 1) % hslN;
          hk0 %= hslN;
          var dh = hslH[hk0] + (hslH[hk1] - hslH[hk0]) * hf, ds = hslS[hk0] + (hslS[hk1] - hslS[hk0]) * hf, dlm = hslL[hk0] + (hslL[hk1] - hslL[hk0]) * hf;
          if (dh || ds || dlm) {
            var gate = smooth(0.03, 0.2, hsv[1]);
            dh *= gate; ds *= gate; dlm *= gate;
            C.hsv2rgb(C.fmod(hsv[0] + dh, 360), clip01(hsv[1] * (1 + ds)), hsv[2], hsv, 0);
            var l2 = hsv[0] * LR + hsv[1] * LG + hsv[2] * LB, target = l2 + dlm * 0.35 * (dlm > 0 ? 1 - l2 : l2);
            R = hsv[0] + (target - l2); G = hsv[1] + (target - l2); B = hsv[2] + (target - l2);
          }
        }
        if (gradOn) {
          var piv = 0.5 + bal * 0.3, wsh = 1 - smooth(piv - bl - 0.2, piv, lum), whi = smooth(piv, piv + bl + 0.2, lum), wmi = Math.max(0, 1 - wsh - whi);
          var ks = s.gs_sat / 100 * 0.3 * wsh, km = s.gm_sat / 100 * 0.3 * wmi, kh = s.gh_sat / 100 * 0.3 * whi;
          R += (cs[0] - 0.5) * ks + (cm[0] - 0.5) * km + (ch[0] - 0.5) * kh;
          G += (cs[1] - 0.5) * ks + (cm[1] - 0.5) * km + (ch[1] - 0.5) * kh;
          B += (cs[2] - 0.5) * ks + (cm[2] - 0.5) * km + (ch[2] - 0.5) * kh;
          var lnow = R * LR + G * LG + B * LB, dlg = (lum - lnow) + (s.gs_lum * wsh + s.gm_lum * wmi + s.gh_lum * whi) / 100 * 0.2;
          R += dlg; G += dlg; B += dlg;
        }
        C.clipPx(R, G, B, o, j);
      }
    }

    // 6. detalle: ruido de color (croma), ruido de luminancia, enfoque con máscara
    if (s.nr_color > 0 || s.nr_luma > 0) {
      var Y = new Float32Array(n), Cb = img(w, h, 2);
      for (i = 0, j = 0; i < n; i++, j += 3) {
        Y[i] = o[j] * 0.299 + o[j + 1] * 0.587 + o[j + 2] * 0.114;
        Cb.d[2 * i] = o[j + 2] - Y[i]; Cb.d[2 * i + 1] = o[j] - Y[i];
      }
      var cbl = Cb.d;
      if (s.nr_color > 0) {   // el ruido de color es de baja frecuencia: se filtra a media resolución
        var hw = Math.max(1, w >> 1), hh2 = Math.max(1, h >> 1);
        var half = C.blur(C.resize(Cb, hw, hh2, 'area'), Math.max(0.5, s.nr_color / 100 * Math.max(1.5, sz * 0.004) / 2));
        cbl = C.resize(half, w, h, 'linear').d;
      }
      var Yn = Y;
      if (s.nr_luma > 0) {
        var Yi = img(w, h, 1, Y), yb = C.blur(Yi, Math.max(0.6, s.nr_luma / 100 * Math.max(1.2, sz * 0.0015))).d;
        var dev = new Float32Array(n);
        for (i = 0; i < n; i++) dev[i] = Math.abs(Y[i] - yb[i]);
        var devb = C.blur(img(w, h, 1, dev), Math.max(1, sz * 0.003)).d, kl = s.nr_luma / 100, thr = 0.01 + 0.05 * kl;
        Yn = new Float32Array(n);
        for (i = 0; i < n; i++) { var flat = 1 - smooth(thr * 0.5, thr * 2, devb[i]); Yn[i] = Y[i] + (yb[i] - Y[i]) * flat * Math.min(1, kl * 1.4); }
      }
      for (i = 0, j = 0; i < n; i++, j += 3) {
        var cb = cbl[2 * i], cr = cbl[2 * i + 1], yy = Yn[i];
        var rr = yy + cr, bb = yy + cb, g2 = (yy - 0.299 * rr - 0.114 * bb) / 0.587;
        C.clipPx(rr, g2, bb, o, j);
      }
    }
    if (s.sharp > 0) {
      var Ls = C.luminance(out), ls = Ls.d, rad = Math.max(0.5, s.sharp_radius * ctx.k);
      var bs = C.blur(Ls, rad).d, amt = s.sharp / 100 * 1.6, thr2 = (1 - s.sharp_detail / 100) * 0.015;
      var mk = s.sharp_mask / 100, edge = null;
      if (mk > 0) {
        var ed = new Float32Array(n);
        for (var y = 1; y < h - 1; y++) for (var x = 1; x < w - 1; x++) {
          var p = y * w + x;
          ed[p] = Math.abs(ls[p + 1] - ls[p - 1]) + Math.abs(ls[p + w] - ls[p - w]);
        }
        edge = C.blur(img(w, h, 1, ed), 1.2).d;
      }
      for (i = 0, j = 0; i < n; i++, j += 3) {
        var dd2 = ls[i] - bs[i];
        dd2 = (dd2 > 0 ? 1 : -1) * Math.max(Math.abs(dd2) - thr2, 0) * amt;
        if (edge) dd2 *= smooth(mk * 0.06, mk * 0.06 + 0.04, edge[i]);
        C.clipPx(o[j] + dd2, o[j + 1] + dd2, o[j + 2] + dd2, o, j);
      }
    }

    // 7. efectos (se reutilizan los filtros del motor)
    if (s.vig) {
      out = F.vignette(out, { amount: s.vig, size: s.vig_mid, roundness: (s.vig_round + 100) / 2, softness: s.vig_feather, x: 50, y: 50 }, ctx);
    }
    if (s.grain) {
      out = F.grain(out, { amount: s.grain * 0.8, size: 0.6 + s.grain_size / 100 * 3, roughness: s.grain_rough, response: 'film', color: false }, ctx);
    }

    // 8. enderezar y recortar
    if (s.angle || s.aspect !== 'free' || s.zoom) out = geometry(out, s);
    return out;
  }

  // Rota alrededor del centro y recorta el mayor rectángulo sin bordes vacíos con la proporción pedida.
  function geometry(a, s) {
    var w = a.w, h = a.h, th = s.angle * Math.PI / 180, ca = Math.abs(Math.cos(th)), sa = Math.abs(Math.sin(th));
    var ratio = s.aspect === 'free' ? w / h : (function (t) { var p = t.split(':'); return parseFloat(p[0]) / parseFloat(p[1]); })(s.aspect);
    // rectángulo de proporción `ratio` inscrito en la imagen rotada
    var cw = Math.min(w / (ca + sa / ratio), h / (sa + ca / ratio));
    cw = Math.min(cw, w * ca + h * sa, (h * ca + w * sa) * ratio);
    if (!s.angle) cw = Math.min(w, h * ratio);
    var chh = cw / ratio, z = 1 - s.zoom / 100;
    cw = Math.max(8, Math.floor(cw * z)); chh = Math.max(8, Math.floor(chh * z));
    var out = img(cw, chh, 3), cos = Math.cos(th), sin = Math.sin(th), cx = w / 2, cy = h / 2, d = a.d;
    for (var y = 0; y < chh; y++) for (var x = 0; x < cw; x++) {
      var dx = x + 0.5 - cw / 2, dy = y + 0.5 - chh / 2;
      var sx = cos * dx - sin * dy + cx - 0.5, sy = sin * dx + cos * dy + cy - 0.5;
      sx = Math.min(w - 1, Math.max(0, sx)); sy = Math.min(h - 1, Math.max(0, sy));
      var x0 = Math.floor(sx), y0 = Math.floor(sy), x1 = Math.min(x0 + 1, w - 1), y1 = Math.min(y0 + 1, h - 1), fx = sx - x0, fy = sy - y0;
      var o = (y * cw + x) * 3, p00 = (y0 * w + x0) * 3, p10 = (y0 * w + x1) * 3, p01 = (y1 * w + x0) * 3, p11 = (y1 * w + x1) * 3;
      for (var c = 0; c < 3; c++) out.d[o + c] = (d[p00 + c] * (1 - fx) + d[p10 + c] * fx) * (1 - fy) + (d[p01 + c] * (1 - fx) + d[p11 + c] * fx) * fy;
    }
    return out;
  }

  // Ajuste automático: lleva el histograma a un rango cómodo (como el botón «Auto»).
  function auto(a) {
    var L = C.luminance(a).d, s = Float32Array.from(L).sort(), n = s.length;
    var pct = function (q) { return s[Math.min(n - 1, Math.max(0, Math.round(q / 100 * (n - 1))))]; };
    var med = pct(50), lo = pct(0.5), hi = pct(99.5);
    var exposure = Math.max(-2, Math.min(2, Math.log(0.42 / Math.max(med, 0.02)) / Math.log(2) * 0.8));
    var res = defaults();
    res.exposure = Math.round(exposure * 20) / 20;
    res.highlights = hi > 0.97 ? -40 : -15;
    res.shadows = lo < 0.04 ? 30 : 15;
    res.whites = Math.round(Math.max(-30, Math.min(40, (0.96 - hi) * 120)));
    res.blacks = Math.round(Math.max(-40, Math.min(25, (0.02 - lo) * -150)));
    res.contrast = Math.round(Math.max(-15, Math.min(25, (0.35 - (pct(90) - pct(10))) * 60)));
    res.vibrance = 15;
    return res;
  }

  function histogram(a) {
    var hR = new Uint32Array(64), hG = new Uint32Array(64), hB = new Uint32Array(64), d = a.d, step = Math.max(1, Math.floor(a.w * a.h / 120000));
    for (var i = 0; i < a.w * a.h; i += step) {
      var j = i * 3;
      hR[Math.min(63, (clip01(d[j]) * 64) | 0)]++; hG[Math.min(63, (clip01(d[j + 1]) * 64) | 0)]++; hB[Math.min(63, (clip01(d[j + 2]) * 64) | 0)]++;
    }
    return { r: Array.from(hR), g: Array.from(hG), b: Array.from(hB) };
  }

  var api = { SECTIONS: SECTIONS, HSL_COLORS: HSL_COLORS, defaults: defaults, develop: develop, auto: auto,
    histogram: histogram, isNeutral: isNeutral, curveLUT: curveLUT };
  if (isNode) module.exports = api; else root.EGDevelop = api;
})(typeof self !== 'undefined' ? self : this);
