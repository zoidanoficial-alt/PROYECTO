// Shaders GLSL ES 3.0 del motor de revelado.

export const VERT = `#version 300 es
in vec2 aPos;
out vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

// Desenfoque gaussiano separable (una dirección por pasada).
export const BLUR = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 o;
uniform sampler2D uTex;
uniform vec2 uDir;
uniform float uSigma;
void main() {
  int r = min(int(ceil(uSigma * 3.0)), 24);
  vec4 sum = vec4(0.0);
  float ws = 0.0;
  for (int i = -24; i <= 24; i++) {
    if (i < -r || i > r) continue;
    float fi = float(i);
    float w = exp(-fi * fi / (2.0 * uSigma * uSigma));
    sum += texture(uTex, vUv + uDir * fi) * w;
    ws += w;
  }
  o = sum / ws;
}`;

// Reducción 4x4 (caja) para preparar el desenfoque grande sin aliasing.
export const DOWN = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 o;
uniform sampler2D uTex;
uniform vec2 uTexel;
uniform float uStep;
void main() {
  vec4 s = vec4(0.0);
  for (int j = 0; j < 4; j++)
    for (int i = 0; i < 4; i++)
      s += texture(uTex, vUv + (vec2(float(i), float(j)) - 1.5) * uTexel * uStep);
  o = s / 16.0;
}`;

export const MAIN = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 o;

uniform sampler2D uSrc;
uniform sampler2D uBlurS;
uniform sampler2D uBlurL;
uniform sampler2D uCurve;
uniform vec2 uSrcSize;
uniform vec4 uCrop;      // x, y, w, h (normalizado, y hacia abajo, espacio enderezado)
uniform float uAngle;    // radianes
uniform vec2 uOutSize;
uniform bool uBicubic;
uniform bool uBypass;    // vista "antes"
uniform float uPixScale; // píxeles de vista previa por píxel original

uniform float uExposure, uContrast, uHighlights, uShadows, uWhites, uBlacks;
uniform vec3 uWb;
uniform float uTexture, uClarity, uDehaze, uVibrance, uSaturation;
uniform bool uMono;
uniform float uHue[8], uHslH[8], uHslS[8], uHslL[8];
uniform float uSharpen, uMasking, uNrLuma, uNrColor;
uniform float uVignette, uVigMid, uGrain;
uniform bool uCurveOn;
uniform bool uShowMask;

const vec3 LW = vec3(0.2126, 0.7152, 0.0722);
float luma(vec3 c) { return dot(c, LW); }

vec3 toLin(vec3 c) {
  c = max(c, 0.0);
  return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c));
}
vec3 toSrgb(vec3 c) {
  c = max(c, 0.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}

vec3 rgb2hsv(vec3 c) {
  vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
  vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
  vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
  float d = q.x - min(q.w, q.y);
  float e = 1.0e-10;
  return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}
vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

// Catmull-Rom en 9 lecturas: re-muestreo nítido para la súper resolución.
vec4 bicubic(sampler2D tex, vec2 uv, vec2 size) {
  vec2 sp = uv * size;
  vec2 t1 = floor(sp - 0.5) + 0.5;
  vec2 f = sp - t1;
  vec2 w0 = f * (-0.5 + f * (1.0 - 0.5 * f));
  vec2 w1 = 1.0 + f * f * (-2.5 + 1.5 * f);
  vec2 w2 = f * (0.5 + f * (2.0 - 1.5 * f));
  vec2 w3 = f * f * (-0.5 + 0.5 * f);
  vec2 w12 = w1 + w2;
  vec2 t0 = (t1 - 1.0) / size;
  vec2 t3 = (t1 + 2.0) / size;
  vec2 t12 = (t1 + w2 / w12) / size;
  vec4 r = vec4(0.0);
  r += texture(tex, vec2(t0.x, t0.y)) * w0.x * w0.y;
  r += texture(tex, vec2(t12.x, t0.y)) * w12.x * w0.y;
  r += texture(tex, vec2(t3.x, t0.y)) * w3.x * w0.y;
  r += texture(tex, vec2(t0.x, t12.y)) * w0.x * w12.y;
  r += texture(tex, vec2(t12.x, t12.y)) * w12.x * w12.y;
  r += texture(tex, vec2(t3.x, t12.y)) * w3.x * w12.y;
  r += texture(tex, vec2(t0.x, t3.y)) * w0.x * w3.y;
  r += texture(tex, vec2(t12.x, t3.y)) * w12.x * w3.y;
  r += texture(tex, vec2(t3.x, t3.y)) * w3.x * w3.y;
  return r;
}

vec2 sourceUv(vec2 uv) {
  vec2 q = vec2(uCrop.x + uv.x * uCrop.z, uCrop.y + (1.0 - uv.y) * uCrop.w) * uSrcSize;
  vec2 c = 0.5 * uSrcSize;
  vec2 d = q - c;
  float cs = cos(uAngle), sn = sin(uAngle);
  vec2 s = vec2(cs * d.x + sn * d.y, -sn * d.x + cs * d.y) + c;
  return vec2(s.x / uSrcSize.x, 1.0 - s.y / uSrcSize.y);
}

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float curveAt(float x, int ch) {
  vec4 v = texture(uCurve, vec2(clamp(x, 0.0, 1.0) * (255.0 / 256.0) + 0.5 / 256.0, 0.5));
  return ch == 0 ? v.r : ch == 1 ? v.g : ch == 2 ? v.b : v.a;
}

void main() {
  vec2 suv = sourceUv(vUv);
  if (suv.x < 0.0 || suv.y < 0.0 || suv.x > 1.0 || suv.y > 1.0) {
    o = vec4(0.09, 0.09, 0.1, 1.0);
    return;
  }
  vec3 c = uBicubic ? bicubic(uSrc, suv, uSrcSize).rgb : texture(uSrc, suv).rgb;
  if (uBypass) { o = vec4(clamp(c, 0.0, 1.0), 1.0); return; }

  vec2 texel = 1.0 / uSrcSize;
  vec3 bs = texture(uBlurS, suv).rgb;

  // --- Reducción de ruido (bilateral 5x5) ---
  if (uNrLuma > 0.0 || uNrColor > 0.0) {
    float lc = luma(c);
    float sr = 0.015 + uNrLuma * 0.1;
    float stp = max(1.0, uPixScale * 1.5);
    vec3 acc = vec3(0.0);
    float wacc = 0.0;
    for (int j = -2; j <= 2; j++) {
      for (int i = -2; i <= 2; i++) {
        vec3 s = texture(uSrc, suv + vec2(float(i), float(j)) * texel * stp).rgb;
        float dl = luma(s) - lc;
        float w = exp(-float(i * i + j * j) / 4.5 - dl * dl / (2.0 * sr * sr));
        acc += s * w;
        wacc += w;
      }
    }
    vec3 bil = acc / wacc;
    float L = mix(lc, luma(bil), uNrLuma);
    vec3 chroma = c - lc;
    vec3 chromaSmooth = mix(bil - luma(bil), bs - luma(bs), 0.6);
    c = vec3(L) + mix(chroma, chromaSmooth, uNrColor);
  }

  // --- Enfoque y textura (máscara de enfoque sobre la luminancia) ---
  float dL = luma(c) - luma(bs);
  if (uSharpen > 0.0) {
    float mask = 1.0;
    if (uMasking > 0.0) {
      float gx = luma(texture(uBlurS, suv + vec2(texel.x, 0.0)).rgb) - luma(texture(uBlurS, suv - vec2(texel.x, 0.0)).rgb);
      float gy = luma(texture(uBlurS, suv + vec2(0.0, texel.y)).rgb) - luma(texture(uBlurS, suv - vec2(0.0, texel.y)).rgb);
      float g = length(vec2(gx, gy)) / max(uPixScale, 0.25);
      float th = uMasking * 0.06;
      mask = smoothstep(th, th + 0.03, g);
    }
    if (uShowMask) { o = vec4(vec3(mask), 1.0); return; }
    c += dL * uSharpen * 1.6 * mask;
  }
  c += dL * uTexture * 0.9;

  // --- Balance de blancos y exposición (en lineal) ---
  vec3 lin = toLin(c) * uWb * exp2(uExposure);
  vec3 p = toSrgb(lin);
  float Lb = luma(toSrgb(toLin(texture(uBlurL, suv).rgb) * exp2(uExposure)));

  // --- Tonos: negros/blancos, sombras/iluminaciones, contraste ---
  float L = luma(p);
  float Lm = mix(L, Lb, 0.5);
  float t = L;
  float bp = -0.10 * uBlacks;
  float wp = 1.0 - 0.25 * uWhites;
  t = (t - bp) / (wp - bp);
  float ws = 1.0 - smoothstep(0.0, 0.5, Lm);
  t += uShadows * 0.3 * ws * (uShadows > 0.0 ? max(0.0, 1.0 - t) : t);
  // Iluminaciones: actúa sobre todo arriba de 0.5 y comprime más lo más claro,
  // para recuperar textura del cascarón sin volver gris todo el fondo.
  float wh = smoothstep(0.5, 1.0, Lm);
  t += uHighlights * wh * (uHighlights > 0.0 ? 0.3 * max(0.0, 1.0 - t) : 0.22 * t * smoothstep(0.45, 1.1, t));
  if (uContrast > 0.0) {
    float tc = clamp(t, 0.0, 1.0);
    t = mix(t, tc * tc * (3.0 - 2.0 * tc), uContrast * 0.9);
  } else {
    t = mix(t, 0.5 + (t - 0.5) * 0.5, -uContrast);
  }
  p = L > 0.002 ? p * (t / L) : p + (t - L);

  // --- Claridad (contraste local) y neblina ---
  float L2 = luma(p);
  float mid = 1.0 - pow(abs(2.0 * clamp(L2, 0.0, 1.0) - 1.0), 2.0);
  p += (L2 - Lb) * uClarity * 0.8 * mid;
  if (uDehaze > 0.0) {
    float k = uDehaze * 0.12;
    p = (p - k) / (1.0 - k);
  } else {
    p = mix(p, vec3(0.75), -uDehaze * 0.3);
  }

  // --- Curva de tonos ---
  if (uCurveOn) {
    p = clamp(p, 0.0, 1.0);
    p = vec3(curveAt(p.r, 3), curveAt(p.g, 3), curveAt(p.b, 3));
    p = vec3(curveAt(p.r, 0), curveAt(p.g, 1), curveAt(p.b, 2));
  }

  // --- HSL por rangos de color ---
  p = clamp(p, 0.0, 1.0);
  vec3 hsv = rgb2hsv(p);
  float hdeg = hsv.x * 360.0;
  float dh = 0.0, ds = 0.0, dl = 0.0, wsum = 0.0;
  for (int i = 0; i < 8; i++) {
    float d = abs(mod(hdeg - uHue[i] + 180.0, 360.0) - 180.0);
    float w = max(0.0, 1.0 - d / 40.0);
    dh += w * uHslH[i];
    ds += w * uHslS[i];
    dl += w * uHslL[i];
    wsum += w;
  }
  if (wsum > 0.0) {
    float n = max(wsum, 1.0);
    float satW = smoothstep(0.02, 0.25, hsv.y);
    hsv.x = fract(hsv.x + dh / n * 30.0 / 360.0 * satW + 1.0);
    hsv.y = clamp(hsv.y * (1.0 + ds / n), 0.0, 1.0);
    hsv.z = clamp(hsv.z * (1.0 + dl / n * 0.5 * satW), 0.0, 1.0);
    p = hsv2rgb(hsv);
  }

  // --- Intensidad y saturación ---
  float g = luma(p);
  float sat = rgb2hsv(p).y;
  float neblinaSat = max(uDehaze, 0.0) * 0.2;
  p = mix(vec3(g), p, max(0.0, 1.0 + uVibrance * (1.0 - sat) + uSaturation + neblinaSat));
  if (uMono) p = vec3(luma(p));

  // --- Viñeta y grano (después del recorte) ---
  float aspect = uOutSize.x / uOutSize.y;
  vec2 dv = (vUv - 0.5) * vec2(aspect, 1.0);
  float r = length(dv) / length(vec2(aspect, 1.0) * 0.5);
  float vm = smoothstep(mix(0.0, 0.9, uVigMid), 1.15, r);
  p *= 1.0 + uVignette * vm * 0.9;
  if (uGrain > 0.0) {
    float cell = max(1.0, uOutSize.x / 1800.0);
    float nz = hash(floor(gl_FragCoord.xy / cell)) - 0.5;
    p += nz * uGrain * 0.18 * (1.0 - abs(2.0 * luma(p) - 1.0) * 0.6);
  }

  o = vec4(clamp(p, 0.0, 1.0), 1.0);
}`;

// AMD FidelityFX CAS simplificado: nitidez adaptativa al contraste, sin halos.
export const FINAL = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 o;
uniform sampler2D uTex;
uniform vec2 uTexel;
uniform float uSharp;
void main() {
  vec3 e = texture(uTex, vUv).rgb;
  if (uSharp <= 0.0) { o = vec4(e, 1.0); return; }
  vec3 b = texture(uTex, vUv + vec2(0.0, uTexel.y)).rgb;
  vec3 d = texture(uTex, vUv - vec2(uTexel.x, 0.0)).rgb;
  vec3 f = texture(uTex, vUv + vec2(uTexel.x, 0.0)).rgb;
  vec3 h = texture(uTex, vUv - vec2(0.0, uTexel.y)).rgb;
  vec3 mn = min(min(min(d, e), min(f, b)), h);
  vec3 mx = max(max(max(d, e), max(f, b)), h);
  vec3 amp = sqrt(clamp(min(mn, 2.0 - mx) / max(mx, 1e-4), 0.0, 1.0));
  vec3 w = amp * (-1.0 / mix(8.0, 4.5, uSharp));
  vec3 c = (b * w + d * w + f * w + h * w + e) / (1.0 + 4.0 * w);
  o = vec4(clamp(c, 0.0, 1.0), 1.0);
}`;
