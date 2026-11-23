"""Núcleo de ENTERGALACTIC: E/S, contexto, utilidades de color, fusiones y máscaras.

Convenciones:
- Las imágenes son float32 RGB en [0, 1] con forma (alto, ancho, 3).
- Los parámetros espaciales de los filtros se expresan en píxeles de la imagen
  a resolución completa; `ctx.px(valor)` los adapta a la vista previa.
- Las posiciones (viñetas, degradados, fugas de luz...) se calculan en
  coordenadas normalizadas de la imagen completa con `ctx.grid()`, así la vista
  previa recortada o reducida coincide con el resultado final.
"""
from __future__ import annotations

import os

import numpy as np
import cv2

EPS = 1e-6


# --------------------------------------------------------------------------- E/S
def load_image(path):
    img = cv2.imread(path, cv2.IMREAD_UNCHANGED)
    if img is None:
        raise RuntimeError("No se pudo leer la imagen: %s" % path)
    if img.dtype == np.uint16:
        maxv = 65535.0
    elif img.dtype == np.uint8:
        maxv = 255.0
    elif img.dtype == np.float32:
        maxv = 1.0
    else:
        raise RuntimeError("Profundidad de bits no soportada: %s" % img.dtype)
    dtype = np.uint16 if img.dtype == np.uint16 else np.uint8
    if img.ndim == 2:
        img = cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)
    alpha = None
    if img.shape[2] == 4:
        alpha = img[:, :, 3].astype(np.float32) / maxv
        img = img[:, :, :3]
    rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB).astype(np.float32) / maxv
    return rgb, alpha, dtype


def save_image(path, rgb, alpha=None, dtype=np.uint8):
    maxv = 65535.0 if dtype == np.uint16 else 255.0
    out = cv2.cvtColor(np.clip(rgb, 0.0, 1.0).astype(np.float32), cv2.COLOR_RGB2BGR)
    if alpha is not None:
        out = np.dstack([out, np.clip(alpha, 0.0, 1.0)])
    out = np.round(out * maxv).astype(np.uint16 if dtype == np.uint16 else np.uint8)
    d = os.path.dirname(os.path.abspath(path))
    os.makedirs(d, exist_ok=True)
    if not cv2.imwrite(path, out):
        raise RuntimeError("No se pudo guardar la imagen: %s" % path)


def to_u8(x):
    return np.round(np.clip(x, 0.0, 1.0) * 255.0).astype(np.uint8)


# --------------------------------------------------------------------------- contexto
class Context:
    """Información geométrica compartida por los filtros.

    k:     píxeles de trabajo por píxel de la imagen completa (vista previa < 1).
    rect:  (x0, y0, x1, y1) zona procesada en coordenadas normalizadas de la
           imagen completa (vista previa recortada); (0, 0, 1, 1) normalmente.
    """

    def __init__(self, h, w, k=1.0, rect=(0.0, 0.0, 1.0, 1.0), seed=1, full_size=None):
        self.h, self.w = h, w
        self.k = float(k)
        self.rect = rect
        self.seed = int(seed)
        self.alpha = None
        if full_size is None:
            full_size = (int(round(w / (rect[2] - rect[0]) / k)), int(round(h / (rect[3] - rect[1]) / k)))
        self.full_w, self.full_h = full_size
        self._grid = None

    def px(self, v):
        """Convierte píxeles de la imagen completa a píxeles de trabajo."""
        return max(0.3, float(v) * self.k)

    @property
    def aspect(self):
        return self.full_w / float(max(1, self.full_h))

    def grid(self):
        """(u, v) en [0,1] de la imagen completa para cada píxel de trabajo."""
        if self._grid is None or self._grid[0].shape != (self.h, self.w):
            x0, y0, x1, y1 = self.rect
            u = x0 + (np.arange(self.w, dtype=np.float32) + 0.5) / self.w * (x1 - x0)
            v = y0 + (np.arange(self.h, dtype=np.float32) + 0.5) / self.h * (y1 - y0)
            self._grid = np.meshgrid(u, v)
        return self._grid

    def radial(self, cx=0.5, cy=0.5, roundness=1.0):
        """Distancia al centro: 0 en el centro, 1 en las esquinas (con el centro en 0.5).

        roundness 1 = círculo real; 0 = elipse que sigue la forma de la foto.
        """
        u, v = self.grid()
        a = self.aspect
        ax = 1.0 + (a - 1.0) * roundness if a >= 1 else 1.0
        ay = 1.0 + (1.0 / a - 1.0) * roundness if a < 1 else 1.0
        dx = (u - cx) * 2.0 * ax
        dy = (v - cy) * 2.0 * ay
        return np.sqrt(dx * dx + dy * dy) / np.sqrt(ax * ax + ay * ay)

    def small(self, max_side=720):
        """Contexto reducido para calcular campos suaves (degradados, fugas de luz)."""
        f = max(1.0, max(self.h, self.w) / float(max_side))
        h, w = max(1, int(round(self.h / f))), max(1, int(round(self.w / f)))
        c = Context(h, w, self.k * w / float(self.w), self.rect, self.seed, (self.full_w, self.full_h))
        return c

    def rng(self, salt=0):
        return np.random.default_rng((self.seed * 7919 + salt) & 0x7FFFFFFF)

    def resized(self, h, w, scale):
        c = Context(h, w, self.k * scale, self.rect, self.seed, (self.full_w, self.full_h))
        c.alpha = self.alpha
        return c


# --------------------------------------------------------------------------- color
LUMA = np.array([0.2126, 0.7152, 0.0722], np.float32)


def luminance(img):
    return img @ LUMA


def set_luminance(img, new_l):
    """Cambia la luminancia manteniendo el color (aditivo, con límite suave)."""
    out = img + (new_l - luminance(img))[..., None]
    return clip_preserve(out)


def clip_preserve(img):
    """Recorta a [0,1] desaturando hacia la luminancia en vez de cortar canales."""
    r, g, b = img[..., 0], img[..., 1], img[..., 2]
    hi = np.maximum(np.maximum(r, g), b)      # más rápido que max(axis=2) en fotos grandes
    lo = np.minimum(np.minimum(r, g), b)
    if hi.max() <= 1.0 and lo.min() >= 0.0:
        return img
    l = np.clip(img @ LUMA, 0.0, 1.0)
    t = np.ones_like(l)
    np.minimum(t, np.where(hi > 1.0, (1.0 - l) / np.maximum(hi - l, EPS), 1.0), out=t)
    np.minimum(t, np.where(lo < 0.0, l / np.maximum(l - lo, EPS), 1.0), out=t)
    np.clip(t, 0.0, 1.0, out=t)
    l = l[..., None]
    return np.clip(l + (img - l) * t[..., None], 0.0, 1.0)


def saturate(img, amount):
    """amount: 0 = gris, 1 = igual, 2 = doble saturación."""
    l = luminance(img)[..., None]
    return clip_preserve(l + (img - l) * amount)


def to_hsv(img):
    return cv2.cvtColor(np.clip(img, 0, 1).astype(np.float32), cv2.COLOR_RGB2HSV)  # H 0-360


def from_hsv(hsv):
    return cv2.cvtColor(hsv.astype(np.float32), cv2.COLOR_HSV2RGB)


def to_lab(img):
    return cv2.cvtColor(np.clip(img, 0, 1).astype(np.float32), cv2.COLOR_RGB2Lab)  # L 0-100


def from_lab(lab):
    return np.clip(cv2.cvtColor(lab.astype(np.float32), cv2.COLOR_Lab2RGB), 0, 1)


def hue_color(hue, sat=1.0, val=1.0):
    """Color RGB (array 3) a partir de un tono en grados."""
    hsv = np.array([[[hue % 360.0, sat, val]]], np.float32)
    return from_hsv(hsv)[0, 0]


def hex_color(h):
    h = h.lstrip("#")
    return np.array([int(h[i:i + 2], 16) / 255.0 for i in (0, 2, 4)], np.float32)


def blur(img, sigma):
    """Desenfoque gaussiano. Los radios grandes se calculan a menor resolución
    (resultado prácticamente idéntico y mucho más rápido en fotos grandes)."""
    if sigma <= 0.05:
        return img
    sigma = float(sigma)
    h, w = img.shape[:2]
    f = int(sigma / 4.0)
    if f >= 2 and min(h, w) // f >= 8:
        small = cv2.resize(img, (max(1, w // f), max(1, h // f)), interpolation=cv2.INTER_AREA)
        small = cv2.GaussianBlur(small, (0, 0), sigma / f)
        return cv2.resize(small, (w, h), interpolation=cv2.INTER_LINEAR)
    return cv2.GaussianBlur(img, (0, 0), sigma)


def smoothstep(e0, e1, x):
    t = np.clip((x - e0) / max(e1 - e0, EPS), 0.0, 1.0)
    return t * t * (3.0 - 2.0 * t)


def curve(x, xs, ys):
    """Curva tonal por interpolación (monótona a trozos)."""
    return np.interp(x, xs, ys).astype(np.float32)


def s_curve(x, amount):
    """Curva en S centrada en 0.5. amount -1..1 (negativo = aplanar)."""
    if amount == 0:
        return x
    k = 1.0 + 4.0 * abs(amount)
    s = 1.0 / (1.0 + cv2.exp((-k * (x - 0.5)).astype(np.float32)))
    s0 = 1.0 / (1.0 + np.exp(k * 0.5))
    s1 = 1.0 / (1.0 + np.exp(-k * 0.5))
    s = (s - s0) / (s1 - s0)
    if amount > 0:
        return (x + (s - x) * min(1.0, amount * 1.5)).astype(np.float32)
    inv = 0.5 + (x - 0.5) * (1.0 - 0.6 * abs(amount))
    return inv.astype(np.float32)


def gradient_map(l, stops):
    """Mapa de degradado: stops = [(posición, rgb), ...]."""
    xs = np.array([s[0] for s in stops], np.float32)
    out = np.empty(l.shape + (3,), np.float32)
    for c in range(3):
        out[..., c] = np.interp(l, xs, [s[1][c] for s in stops])
    return out


# --------------------------------------------------------------------------- fusiones
def _soft_light(a, b):
    return np.where(b < 0.5, a - (1 - 2 * b) * a * (1 - a), a + (2 * b - 1) * (np.sqrt(np.clip(a, 0, 1)) - a))


def _overlay(a, b):
    return np.where(a < 0.5, 2 * a * b, 1 - 2 * (1 - a) * (1 - b))


def blend(base, top, mode):
    if mode == "normal":
        return top
    if mode == "multiply":
        return base * top
    if mode == "screen":
        return 1 - (1 - base) * (1 - top)
    if mode == "overlay":
        return _overlay(base, top)
    if mode == "soft_light":
        return _soft_light(base, top)
    if mode == "luminosity":
        return set_luminance(base, luminance(top))
    if mode == "color":
        return set_luminance(top, luminance(base))
    if mode == "lighten":
        return np.maximum(base, top)
    if mode == "darken":
        return np.minimum(base, top)
    raise ValueError("Modo de fusión desconocido: %s" % mode)


BLEND_MODES = [
    ("normal", "Normal"), ("multiply", "Multiplicar"), ("screen", "Trama"),
    ("overlay", "Superponer"), ("soft_light", "Luz suave"), ("luminosity", "Luminosidad"),
    ("color", "Color"), ("lighten", "Aclarar"), ("darken", "Oscurecer"),
]


# --------------------------------------------------------------------------- máscaras
def tone_mask(img, which, softness=0.5):
    l = luminance(img)
    s = 0.12 + 0.25 * softness
    if which == "shadows":
        return 1.0 - smoothstep(0.25 - s, 0.25 + s, l)
    if which == "highlights":
        return smoothstep(0.75 - s, 0.75 + s, l)
    if which == "midtones":
        return np.clip(1.0 - np.abs(l - 0.5) / (0.25 + s), 0.0, 1.0) ** 1.5
    return np.ones_like(l)


def hue_weight(hue, center, width):
    d = np.abs(((hue - center + 180.0) % 360.0) - 180.0)
    return np.clip(1.0 - d / max(width, 1.0), 0.0, 1.0) ** 1.5


def color_mask(img, center, width):
    hsv = to_hsv(img)
    w = hue_weight(hsv[..., 0], center, width)
    return w * smoothstep(0.05, 0.25, hsv[..., 1])


def build_mask(img, spec, ctx):
    """spec: {"type": "all"|"shadows"|"midtones"|"highlights"|"color"|"center"|"edges", ...}"""
    if not spec:
        return None
    t = spec.get("type", "all")
    if t == "all":
        return None
    soft = float(spec.get("softness", 50)) / 100.0
    if t in ("shadows", "midtones", "highlights"):
        m = tone_mask(img, t, soft)
    elif t == "color":
        m = color_mask(img, float(spec.get("hue", 30)), float(spec.get("width", 40)))
    elif t in ("center", "edges"):
        r = ctx.radial()
        m = 1.0 - smoothstep(0.35 - 0.3 * soft, 0.35 + 0.5 * soft, r)
        if t == "edges":
            m = 1.0 - m
    elif t in ("top", "bottom"):
        _, v = ctx.grid()
        m = 1.0 - smoothstep(0.3 - 0.3 * soft, 0.5 + 0.3 * soft, v)
        if t == "bottom":
            m = 1.0 - m
    elif t in SMART_MASKS:
        m = SMART_MASKS[t](img, ctx)
        if soft:
            m = blur(m, ctx.px(2 + 30 * soft) if hasattr(ctx, "px") else 2)
    else:
        raise ValueError("Máscara desconocida: %s" % t)
    if spec.get("invert"):
        m = 1.0 - m
    return m.astype(np.float32)


# ------------------------------------------------------------------ máscaras inteligentes
# Segmentación heurística (color, posición, textura, contraste): sin modelos de IA.
def _small(img, ctx, side=320):
    h, w = img.shape[:2]
    f = min(1.0, side / float(max(h, w)))
    return cv2.resize(img, (max(1, int(w * f)), max(1, int(h * f))), interpolation=cv2.INTER_AREA) if f < 1 else img


def _up(m, img):
    h, w = img.shape[:2]
    return cv2.resize(m.astype(np.float32), (w, h), interpolation=cv2.INTER_LINEAR) if m.shape != (h, w) else m


def mask_skin(img, ctx):
    hsv = to_hsv(img)
    h, s, v = hsv[..., 0], hsv[..., 1], hsv[..., 2]
    m = hue_weight(h, 18.0, 28.0) * smoothstep(0.12, 0.22, s) * (1 - smoothstep(0.65, 0.85, s)) * smoothstep(0.18, 0.35, v)
    return np.clip(m * 1.6, 0, 1).astype(np.float32)


def mask_foliage(img, ctx):
    hsv = to_hsv(img)
    m = hue_weight(hsv[..., 0], 95.0, 55.0) * smoothstep(0.12, 0.3, hsv[..., 1]) * smoothstep(0.06, 0.15, hsv[..., 2])
    return np.clip(m * 1.4, 0, 1).astype(np.float32)


def mask_sky(img, ctx):
    sm = _small(img, ctx)
    hsv = to_hsv(sm)
    hh, ss, vv = hsv[..., 0], hsv[..., 1], hsv[..., 2]
    l = luminance(sm)
    tex = blur(np.abs(l - blur(l, 1.5)), 3.0)
    blue = hue_weight(hh, 210.0, 45.0) * smoothstep(0.08, 0.25, ss) * smoothstep(0.25, 0.45, vv)
    bright = smoothstep(0.65, 0.85, vv) * (1 - smoothstep(0.15, 0.35, ss))          # cielo cubierto / nubes
    sunset = hue_weight(hh, 25.0, 30.0) * smoothstep(0.55, 0.75, vv) * smoothstep(0.2, 0.4, ss)
    cand = np.clip(np.maximum(np.maximum(blue, bright * 0.9), sunset * 0.7), 0, 1) * (1 - smoothstep(0.015, 0.05, tex))
    # El cielo está conectado con el borde superior: una fila es cielo si lo parece
    # y el cielo de la fila de encima (o de sus vecinas) llega hasta ella.
    conn = np.zeros_like(cand)
    conn[0] = cand[0]
    for y in range(1, cand.shape[0]):
        up = conn[y - 1]
        prev = np.maximum(up, np.maximum(np.roll(up, 1), np.roll(up, -1)) * 0.98)
        conn[y] = cand[y] * smoothstep(0.15, 0.4, prev)
    m = blur(conn, 1.5)
    return _up(m, img)


def mask_subject(img, ctx):
    """Sujeto probable: contraste de color con el entorno + sesgo al centro + piel + nitidez."""
    sm = _small(img, ctx, 256)
    lab = to_lab(sm)
    mean = lab.reshape(-1, 3).mean(axis=0)
    d = np.sqrt(((blur(lab, 2.0) - mean) ** 2).sum(axis=2))
    d = d / (np.percentile(d, 98) + 1e-6)
    l = luminance(sm)
    sharp = blur(np.abs(l - blur(l, 1.2)), 4.0)
    sharp = sharp / (np.percentile(sharp, 98) + 1e-6)
    h, w = sm.shape[:2]
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    center = np.exp(-(((xx / w - 0.5) / 0.32) ** 2 + ((yy / h - 0.52) / 0.36) ** 2))
    m = (0.45 * np.clip(d, 0, 1) + 0.35 * np.clip(sharp, 0, 1) + 0.5 * mask_skin(sm, ctx)) * (0.35 + 0.65 * center)
    m = blur(m, 4.0)
    m = smoothstep(np.percentile(m, 55), np.percentile(m, 92), m)
    return _up(m.astype(np.float32), img)


def mask_focus(img, ctx):
    sm = _small(img, ctx, 320)
    l = luminance(sm)
    lap = np.abs(cv2.Laplacian(l, cv2.CV_32F, ksize=3))
    e = blur(lap, 5.0)
    e = e / (np.percentile(e, 97) + 1e-6)
    return _up(np.clip(smoothstep(0.15, 0.6, e), 0, 1).astype(np.float32), img)


def mask_specular(img, ctx):
    return smoothstep(0.88, 0.97, luminance(img)).astype(np.float32)


SMART_MASKS = {"sky": mask_sky, "skin": mask_skin, "foliage": mask_foliage, "subject": mask_subject,
               "focus": mask_focus, "specular": mask_specular}

MASK_TYPES = [
    ("all", "Toda la imagen"), ("shadows", "Sombras"), ("midtones", "Medios tonos"),
    ("highlights", "Luces"), ("color", "Rango de color"), ("center", "Centro"),
    ("edges", "Bordes"), ("top", "Parte superior"), ("bottom", "Parte inferior"),
    ("sky", "Cielo (automático)"), ("skin", "Piel (automático)"), ("foliage", "Vegetación (automático)"),
    ("subject", "Sujeto principal (automático)"), ("focus", "Zonas nítidas (automático)"),
    ("specular", "Brillos especulares"),
]
BASIC_MASK_TYPES = ["all", "shadows", "midtones", "highlights", "color", "center", "edges", "top", "bottom"]
