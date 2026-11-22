#!/usr/bin/env python3
"""Genera las puntas de los pinceles FOTONEANDO (63 pinceles) como PNG en escala de grises.

En Photoshop, una punta de pincel es una imagen en grises: negro = pinta, blanco = transparente.
Este script dibuja cada punta por programa (ruido fractal, partículas, trazos de luz…)
y las guarda en  puntas/<NN Pack - Nombre>.png. Después, instalar_pinceles.jsx las convierte
en pinceles dentro de Photoshop.

Uso:  python generar_pinceles.py [carpeta_salida] [--muestra hoja.jpg]
Requiere numpy y opencv-python.
"""
import math
import os
import sys

import cv2
import numpy as np

# ----------------------------------------------------------------------------- utilidades
def rng(seed):
    return np.random.default_rng(seed)


def blur(a, sx, sy=None):
    if sx <= 0 and (sy is None or sy <= 0):
        return a
    return cv2.GaussianBlur(a, (0, 0), sigmaX=max(sx, 0.01), sigmaY=max(sy if sy is not None else sx, 0.01))


def norm(a):
    a = a - a.min()
    return a / max(float(a.max()), 1e-6)


def smooth(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


def grid(n, m=None):
    m = m or n
    y, x = np.mgrid[0:m, 0:n].astype(np.float32)
    return (x - n / 2) / (n / 2), (y - m / 2) / (m / 2)


def noise(n, scale, seed, m=None, aspect=1.0):
    """Ruido suave: ruido blanco a baja resolución, ampliado (rápido para escalas grandes)."""
    m = m or n
    r = rng(seed)
    w = max(2, int(n / (scale * aspect)))
    h = max(2, int(m / scale))
    g = r.standard_normal((h, w)).astype(np.float32)
    g = cv2.resize(g, (n, m), interpolation=cv2.INTER_CUBIC)
    return g / (g.std() + 1e-6)


def fbm(n, seed, base=200, octaves=6, gain=0.55, m=None, aspect=1.0):
    out = np.zeros((m or n, n), np.float32)
    amp, sc = 1.0, base
    for i in range(octaves):
        out += amp * noise(n, max(sc, 1.0), seed * 31 + i, m, aspect)
        amp *= gain
        sc /= 2
    return norm(out)


def white(n, seed, sigma=0.0, m=None):
    g = rng(seed).standard_normal((m or n, n)).astype(np.float32)
    return blur(g, sigma) / (blur(g, sigma).std() + 1e-6) if sigma > 0 else g


def edge_fade(n, feather=0.12, round_=True, m=None):
    """Borde suave para que las texturas se fundan al estampar."""
    x, y = grid(n, m)
    if round_:
        d = np.sqrt(x * x + y * y)
        return 1 - smooth(1 - feather * 2, 1.0, d)
    d = np.maximum(np.abs(x), np.abs(y))
    return 1 - smooth(1 - feather, 1.0, d)


def splat(a, cx, cy, r, v=1.0, hard=2.0, sx=1.0, sy=1.0, ang=0.0, mode="max"):
    """Mancha suave (o dura) elíptica en (cx, cy)."""
    R = int(math.ceil(r * max(sx, sy) * 2.2)) + 2
    x0, x1 = int(cx) - R, int(cx) + R + 1
    y0, y1 = int(cy) - R, int(cy) + R + 1
    H, W = a.shape
    if x1 <= 0 or y1 <= 0 or x0 >= W or y0 >= H:
        return
    yy, xx = np.mgrid[y0:y1, x0:x1].astype(np.float32)
    dx, dy = xx - cx, yy - cy
    c, s = math.cos(ang), math.sin(ang)
    u, w = (dx * c + dy * s) / (r * sx), (-dx * s + dy * c) / (r * sy)
    k = v * np.exp(-((u * u + w * w) ** (hard / 2)))
    cx0, cy0 = max(x0, 0), max(y0, 0)
    cx1, cy1 = min(x1, W), min(y1, H)
    sub = k[cy0 - y0:cy1 - y0, cx0 - x0:cx1 - x0]
    if mode == "max":
        np.maximum(a[cy0:cy1, cx0:cx1], sub, out=a[cy0:cy1, cx0:cx1])
    else:
        a[cy0:cy1, cx0:cx1] += sub


class Lines:
    """Lienzo para trazos con antialiasing (se dibuja al doble de tamaño)."""

    def __init__(self, n, m=None, ss=2):
        self.ss = ss
        self.c = np.zeros(((m or n) * ss, n * ss), np.uint8)

    def line(self, p, q, v=1.0, w=1.0):
        s = self.ss
        tmp = np.zeros_like(self.c)
        cv2.line(tmp, (int(p[0] * s), int(p[1] * s)), (int(q[0] * s), int(q[1] * s)), int(255 * min(1, v)),
                 max(1, int(round(w * s))), cv2.LINE_AA)
        np.maximum(self.c, tmp, out=self.c)

    def poly(self, pts, v=1.0, w=1.0):
        for p, q in zip(pts[:-1], pts[1:]):
            self.line(p, q, v, w)

    def fill(self, pts, v=1.0):
        s = self.ss
        tmp = np.zeros_like(self.c)
        cv2.fillPoly(tmp, [np.array([[int(x * s), int(y * s)] for x, y in pts], np.int32)], int(255 * v), cv2.LINE_AA)
        np.maximum(self.c, tmp, out=self.c)

    def get(self):
        h, w = self.c.shape
        return cv2.resize(self.c.astype(np.float32) / 255, (w // self.ss, h // self.ss), interpolation=cv2.INTER_AREA)


def wavy(r, p, length, ang, amp, freq, steps=40):
    pts = []
    ph = r.uniform(0, 6.28)
    for i in range(steps + 1):
        t = i / steps
        off = amp * math.sin(ph + t * freq * 6.28)
        x = p[0] + math.cos(ang) * t * length - math.sin(ang) * off
        y = p[1] + math.sin(ang) * t * length + math.cos(ang) * off
        pts.append((x, y))
    return pts


def scatter(a, r, count, rmin, rmax, v=(0.6, 1.0), hard=(2, 4), dist=None, mode="max"):
    n = a.shape[1]
    m = a.shape[0]
    for _ in range(count):
        if dist is not None:
            # rechazo según un mapa de densidad 0..1
            while True:
                x, y = r.uniform(0, n), r.uniform(0, m)
                if r.random() < dist[int(y) % m, int(x) % n]:
                    break
        else:
            x, y = r.uniform(0, n), r.uniform(0, m)
        rad = rmin * (rmax / rmin) ** r.random()
        splat(a, x, y, rad, r.uniform(*v), r.uniform(*hard), sx=r.uniform(0.7, 1.3), sy=r.uniform(0.7, 1.3),
              ang=r.uniform(0, 3.14), mode=mode)


# ----------------------------------------------------------------------------- PIEL
def skin_texture_fine(n=1200):
    a = 0.55 * fbm(n, 1, base=6, octaves=3) + 0.45 * norm(white(n, 2, 0.8))
    a = smooth(0.35, 0.95, a) * 0.75
    return a * edge_fade(n, 0.18)


def pore_scatter(n=1200):
    r = rng(11)
    a = np.zeros((n, n), np.float32)
    dens = smooth(0.25, 0.8, fbm(n, 12, base=180, octaves=3))
    scatter(a, r, 2600, 1.2, 4.0, v=(0.35, 0.9), hard=(1.6, 2.6), dist=0.15 + 0.85 * dens)
    return a * edge_fade(n, 0.18)


def skin_grain(n=1200):
    a = norm(white(n, 21, 1.1)) * 0.6 + 0.4 * fbm(n, 22, base=14, octaves=3)
    a = smooth(0.3, 1.0, a) * 0.55
    return a * edge_fade(n, 0.18)


def freckle_natural(n=1200):
    r = rng(31)
    a = np.zeros((n, n), np.float32)
    dens = smooth(0.35, 0.85, fbm(n, 32, base=260, octaves=3)) * edge_fade(n, 0.3)
    for _ in range(420):
        while True:
            x, y = r.uniform(0, n), r.uniform(0, n)
            if r.random() < dens[int(y), int(x)]:
                break
        rad = 2.5 * (5.5 ** r.random())
        # peca irregular: varias manchas unidas
        for _k in range(r.integers(1, 4)):
            splat(a, x + r.normal(0, rad * 0.4), y + r.normal(0, rad * 0.4), rad * r.uniform(0.5, 1.0),
                  r.uniform(0.35, 0.85), r.uniform(1.6, 2.4), sx=r.uniform(0.8, 1.3), sy=r.uniform(0.7, 1.1),
                  ang=r.uniform(0, 3.14))
    rough = 0.75 + 0.25 * fbm(n, 33, base=4, octaves=2)
    return a * rough


def beauty_soft(n=1000):
    x, y = grid(n)
    d = np.sqrt(x * x + y * y)
    a = np.exp(-(d / 0.55) ** 2) * (0.85 + 0.15 * fbm(n, 41, base=120, octaves=3))
    return a * edge_fade(n, 0.1) * 0.7


def imperfection(n=1000):
    r = rng(51)
    a = np.zeros((n, n), np.float32)
    zone = edge_fade(n, 0.35)
    for _ in range(55):  # granitos, marcas y puntos
        while True:
            x, y = r.uniform(0, n), r.uniform(0, n)
            if r.random() < zone[int(y), int(x)]:
                break
        kind = r.random()
        if kind < 0.6:
            splat(a, x, y, r.uniform(2, 7), r.uniform(0.3, 0.75), 1.8)
        elif kind < 0.9:
            splat(a, x, y, r.uniform(6, 16), r.uniform(0.15, 0.35), 1.5, sx=1.4, sy=0.8, ang=r.uniform(0, 3.14))
        else:
            L = Lines(n)
            L.poly(wavy(r, (x, y), r.uniform(15, 40), r.uniform(0, 6.28), 2, 1.2, 12), r.uniform(0.3, 0.6), 1.2)
            np.maximum(a, blur(L.get(), 0.6), out=a)
    return a * (0.8 + 0.2 * fbm(n, 52, base=3, octaves=2))


def micro_wrinkle(n=1200):
    r = rng(61)
    L = Lines(n)
    for i in range(16):
        y0 = n * (0.2 + 0.6 * i / 16) + r.normal(0, 8)
        x0 = n * r.uniform(0.15, 0.3)
        pts = wavy(r, (x0, y0), n * r.uniform(0.45, 0.65), r.normal(0, 0.06), r.uniform(4, 12), r.uniform(0.5, 1.3), 60)
        L.poly(pts, r.uniform(0.25, 0.7), r.uniform(0.8, 2.0))
    for i in range(40):  # líneas finas que se cruzan
        p = (r.uniform(0.2, 0.8) * n, r.uniform(0.2, 0.8) * n)
        L.poly(wavy(r, p, r.uniform(20, 70), r.uniform(0, 6.28), 2, 0.8, 16), r.uniform(0.15, 0.35), 0.8)
    a = blur(L.get(), 0.8) * (0.7 + 0.3 * fbm(n, 62, base=60, octaves=3))
    return a * edge_fade(n, 0.25)


def skin_highlight(n=1000):
    x, y = grid(n)
    d = np.sqrt((x / 0.75) ** 2 + (y / 0.45) ** 2)
    base = np.exp(-(d / 0.6) ** 2)
    tex = smooth(0.25, 0.9, 0.6 * fbm(n, 71, base=5, octaves=3) + 0.4 * norm(white(n, 72, 0.9)))
    return np.clip(base * (0.55 + 0.45 * tex), 0, 1) * 0.85


def skin_shadow(n=1000):
    x, y = grid(n)
    warp = 0.25 * (fbm(n, 81, base=180, octaves=4) - 0.5)
    d = np.sqrt((x / 0.85) ** 2 + (y / 0.6) ** 2) + warp
    return np.exp(-(np.clip(d, 0, None) / 0.6) ** 2.2) * 0.55 * edge_fade(n, 0.1)


# ----------------------------------------------------------------------------- LUZ
def window_light(n=1600):
    a = np.zeros((n, n), np.float32)
    L = Lines(n, ss=1)
    # cuatro paños de ventana en perspectiva
    def quad(u0, v0, u1, v1):
        def P(u, v):
            # perspectiva: arriba más estrecho y desplazado
            return (n * (0.2 + 0.1 * v + u * (0.55 + 0.15 * v)), n * (0.15 + v * 0.7))
        return [P(u0, v0), P(u1, v0), P(u1, v1), P(u0, v1)]
    g = 0.035
    for (u0, u1) in ((0, 0.5 - g), (0.5 + g, 1)):
        for (v0, v1) in ((0, 0.5 - g), (0.5 + g, 1)):
            L.fill(quad(u0, v0, u1, v1))
    a = blur(L.get(), n * 0.012)
    return a * (0.85 + 0.15 * fbm(n, 91, base=200, octaves=3)) * 0.9


def god_rays(n=2000):
    x, y = grid(n)
    sx, sy = 0.0, -1.15                      # fuente arriba, fuera del encuadre
    ang = np.arctan2(y - sy, x - sx)
    dist = np.sqrt((x - sx) ** 2 + (y - sy) ** 2)
    r = rng(101)
    rays = np.zeros_like(x)
    for _ in range(26):
        c = r.uniform(np.pi / 2 - 0.55, np.pi / 2 + 0.55)
        w = r.uniform(0.004, 0.03)
        rays += r.uniform(0.3, 1.0) * np.exp(-((ang - c) / w) ** 2)
    rays = np.clip(rays, 0, 1.2)
    fade = np.exp(-((dist - 0.2) / 1.6) ** 2) * smooth(0.0, 0.5, dist)
    fog = 0.75 + 0.25 * fbm(n, 102, base=300, octaves=4)
    return np.clip(rays * fade * fog, 0, 1) * edge_fade(n, 0.08)


def fog_beam(n=1800):
    x, y = grid(n)
    # cono de luz que baja en diagonal
    u = (x + 0.6) * 0.8 + (y + 0.9) * 0.6
    v = -(x + 0.6) * 0.6 + (y + 0.9) * 0.8
    width = 0.08 + 0.22 * np.clip(u, 0, 2)
    beam = np.exp(-(v / width) ** 2) * smooth(-0.05, 0.25, u) * np.exp(-np.clip(u - 0.6, 0, None) * 0.9)
    fog = 0.45 + 0.55 * fbm(n, 111, base=220, octaves=5)
    return np.clip(beam * fog * 1.1, 0, 1) * edge_fade(n, 0.08)


def rim_light(n=1400):
    x, y = grid(n)
    d = np.sqrt((x + 0.25) ** 2 + y ** 2)
    ring = np.exp(-((d - 0.62) / 0.025) ** 2) + 0.35 * np.exp(-((d - 0.62) / 0.08) ** 2)
    side = smooth(-0.1, 0.6, x)               # solo un lado, como contraluz
    return np.clip(ring * side, 0, 1) * edge_fade(n, 0.06)


def lens_glow(n=1400):
    x, y = grid(n)
    d = np.sqrt(x * x + y * y)
    return np.clip(np.exp(-(d / 0.08) ** 2) + 0.55 * np.exp(-(d / 0.3) ** 2) + 0.2 * np.exp(-(d / 0.75) ** 2), 0, 1) * edge_fade(n, 0.05)


def anamorphic_flare(n=2000):
    m = n // 4
    x, y = grid(n, m)
    core = np.exp(-(x / 0.04) ** 2 - (y / 0.12) ** 2)
    streak = np.exp(-(y / 0.035) ** 2) * np.exp(-(np.abs(x) / 0.55) ** 1.3)
    wide = 0.3 * np.exp(-(y / 0.18) ** 2) * np.exp(-(np.abs(x) / 0.3) ** 1.5)
    return np.clip(core + streak + wide, 0, 1) * edge_fade(n, 0.04, False, m)


def light_leak(n=1800):
    x, y = grid(n)
    warp = 0.35 * (fbm(n, 121, base=300, octaves=4) - 0.5)
    d = (x + 1.05) + warp + 0.15 * y * y           # entra desde el borde izquierdo
    leak = np.exp(-(np.clip(d, 0, None) / 0.55) ** 1.6)
    streaks = 0.75 + 0.25 * norm(blur(white(n, 122), 1, 25))
    return np.clip(leak * streaks, 0, 1) * edge_fade(n, 0.12, False)


def sunset_glow(n=2000):
    m = n // 2
    x, y = grid(n, m)
    d = np.sqrt((x / 1.0) ** 2 + ((y - 0.3) / 0.45) ** 2)
    return np.clip(np.exp(-(d / 0.7) ** 2) * (0.9 + 0.1 * fbm(n, 131, base=200, octaves=3, m=m)), 0, 1) * edge_fade(n, 0.05, False, m)


def blue_hour_glow(n=1800):
    x, y = grid(n)
    grad = smooth(1.0, -0.6, y)                      # más intenso arriba (cielo)
    d = np.sqrt((x / 1.1) ** 2 + ((y + 0.2) / 0.9) ** 2)
    haze = 0.8 + 0.2 * fbm(n, 141, base=250, octaves=4)
    return np.clip(grad * np.exp(-(d / 0.9) ** 2) * haze, 0, 1) * edge_fade(n, 0.06) * 0.85


def neon_glow(n=600):
    x, y = grid(n)
    d = np.sqrt(x * x + y * y)
    return np.clip((d < 0.08) * 1.0 + np.exp(-((d - 0.08).clip(0) / 0.12) ** 1.3) * 0.75 + 0.25 * np.exp(-(d / 0.6) ** 2), 0, 1) * edge_fade(n, 0.05)


def bounce_light(n=1600):
    x, y = grid(n)
    d = np.sqrt((x / 1.0) ** 2 + (y / 0.7) ** 2)
    return np.exp(-(d / 0.65) ** 2) * 0.45 * (0.9 + 0.1 * fbm(n, 151, base=200, octaves=3))


def soft_specular(n=800):
    x, y = grid(n)
    d = np.sqrt((x / 0.6) ** 2 + (y / 0.3) ** 2)
    a = np.exp(-(d / 0.35) ** 2) + 0.3 * np.exp(-(d / 0.9) ** 2)
    return np.clip(a, 0, 1) * edge_fade(n, 0.05) * 0.9


# ----------------------------------------------------------------------------- ATMÓSFERA
def fog_01(n=2000):
    a = smooth(0.2, 0.95, fbm(n, 201, base=420, octaves=6, gain=0.5)) * 0.55
    return a * edge_fade(n, 0.22)


def fog_02(n=2000):
    a = smooth(0.1, 0.75, fbm(n, 211, base=380, octaves=6, gain=0.55)) * 0.9
    return a * edge_fade(n, 0.2)


def ground_mist(n=2000):
    m = n // 2
    x, y = grid(n, m)
    f = fbm(n, 221, base=260, octaves=6, m=m, aspect=4.0)
    band = smooth(-0.9, 0.4, y)                      # más denso abajo
    return np.clip(smooth(0.2, 0.9, f) * band, 0, 1) * edge_fade(n, 0.12, False, m) * 0.85


def atmospheric_haze(n=2000):
    x, y = grid(n)
    a = smooth(1.0, -0.8, y) * (0.8 + 0.2 * fbm(n, 231, base=500, octaves=3))
    return a * edge_fade(n, 0.2) * 0.6


def ridged(n, seed, base, octaves=5, m=None, aspect=1.0):
    out = np.zeros((m or n, n), np.float32)
    amp, sc = 1.0, base
    for i in range(octaves):
        g = noise(n, max(sc, 1), seed * 17 + i, m, aspect)
        out += amp * (1 - np.abs(np.tanh(g)))
        amp *= 0.5
        sc /= 2
    return norm(out)


def smoke_wisps(n=1800):
    x, y = grid(n)
    wx = 0.25 * (fbm(n, 241, base=300, octaves=3) - 0.5)
    rid = ridged(n, 242, 160, 5)
    # deformar las crestas con el ruido de baja frecuencia
    M = np.dstack([(x + wx + 1) * n / 2, (y + 1) * n / 2]).astype(np.float32)
    rid = cv2.remap(rid, M[..., 0], M[..., 1], cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)
    a = smooth(0.72, 0.97, rid) * smooth(1.0, -0.4, y)
    return np.clip(blur(a, 1.2) * 1.1, 0, 1) * edge_fade(n, 0.15)


def smoke_volume(n=1800):
    x, y = grid(n)
    f = fbm(n, 251, base=200, octaves=6, gain=0.6)
    d = np.sqrt((x / 0.75) ** 2 + ((y - 0.1) / 0.8) ** 2) - 0.35 * (f - 0.5)
    a = smooth(1.0, 0.45, d) * (0.55 + 0.45 * f)
    return np.clip(a, 0, 1) * 0.9 * edge_fade(n, 0.08)


def dust_particles(n=1600):
    r = rng(261)
    a = np.zeros((n, n), np.float32)
    scatter(a, r, 900, 1.4, 6.0, v=(0.4, 1.0), hard=(1.8, 3.5))
    scatter(a, r, 70, 6, 16, v=(0.15, 0.35), hard=(1.2, 1.8))
    return a * edge_fade(n, 0.12)


def floating_dust(n=1600):
    r = rng(271)
    a = np.zeros((n, n), np.float32)
    for _ in range(260):   # profundidad: los cercanos, más grandes y desenfocados
        depth = r.random()
        rad = 2.0 + 12 * depth ** 2
        splat(a, r.uniform(0, n), r.uniform(0, n), rad, (1 - depth) * 0.8 + 0.2, 4.0 - 2.8 * depth)
    return a * edge_fade(n, 0.12)


def ash_particles(n=1600):
    r = rng(281)
    L = Lines(n)
    for _ in range(320):
        cx, cy = r.uniform(0, n), r.uniform(0, n)
        s = 3 + 12 * r.random() ** 2
        pts = [(cx + s * r.uniform(0.5, 1.2) * math.cos(t), cy + s * r.uniform(0.4, 1.0) * math.sin(t))
               for t in np.sort(r.uniform(0, 6.28, r.integers(4, 7)))]
        L.fill(pts, r.uniform(0.35, 0.95))
    a = L.get()
    return np.clip(blur(a, 0.4) * (0.8 + 0.2 * fbm(n, 282, base=4, octaves=2)), 0, 1) * edge_fade(n, 0.12)


def breath_vapor(n=1200):
    x, y = grid(n)
    f = fbm(n, 291, base=120, octaves=5)
    d = np.sqrt(((x + 0.3) / 0.9) ** 2 + (y / 0.45) ** 2) - 0.3 * (f - 0.5)
    a = smooth(0.9, 0.2, d) * smooth(0.35, 0.85, f) * smooth(-1.0, -0.4, x)
    return np.clip(a * 0.8, 0, 1) * edge_fade(n, 0.1)


def cold_atmosphere(n=1800):
    r = rng(301)
    a = smooth(0.25, 0.95, fbm(n, 302, base=350, octaves=5)) * 0.45
    scatter(a, r, 500, 0.6, 2.0, v=(0.5, 1.0), hard=(3, 5))     # cristales de hielo
    return np.clip(a, 0, 1) * edge_fade(n, 0.2)


def heat_distortion(n=1600):
    x, y = grid(n)
    w = fbm(n, 311, base=180, octaves=4)
    rip = 0.5 + 0.5 * np.sin((y * 38 + 4 * w + 2 * np.sin(x * 6)) * 1.0)
    a = rip * smooth(0.25, 0.8, fbm(n, 312, base=260, octaves=3))
    return np.clip(a * 0.7, 0, 1) * edge_fade(n, 0.15)


# ----------------------------------------------------------------------------- PARTÍCULAS
def streaks(n, seed, count, lmin, lmax, ang, ang_jit, wmin, wmax, vmin=0.5, dist=None, glow=0.0):
    r = rng(seed)
    L = Lines(n)
    for _ in range(count):
        x, y = r.uniform(0, n), r.uniform(0, n)
        if dist is not None and r.random() > dist[int(y), int(x)]:
            continue
        a = ang + r.normal(0, ang_jit)
        ln = lmin * (lmax / lmin) ** r.random()
        L.line((x, y), (x + math.cos(a) * ln, y + math.sin(a) * ln), r.uniform(vmin, 1.0), r.uniform(wmin, wmax))
    a = L.get()
    if glow:
        a = np.clip(a + glow * blur(a, 4), 0, 1)
    return a


def sparks(n=1600):
    x, y = grid(n)
    d = np.sqrt(x * x + y * y)
    r = rng(401)
    L = Lines(n)
    for _ in range(170):  # chispas que salen disparadas del centro, con curva
        a0 = r.uniform(0, 6.28)
        r0 = r.uniform(0.05, 0.75) * n / 2
        ln = r.uniform(15, 90)
        p = (n / 2 + math.cos(a0) * r0, n / 2 + math.sin(a0) * r0)
        pts = [(p[0] + math.cos(a0) * ln * t, p[1] + math.sin(a0) * ln * t + 25 * t * t) for t in np.linspace(0, 1, 8)]
        L.poly(pts, r.uniform(0.6, 1.0), r.uniform(0.8, 2.2))
    a = L.get()
    return np.clip(a + 0.6 * blur(a, 3), 0, 1) * edge_fade(n, 0.08)


def embers(n=1600):
    r = rng(411)
    a = np.zeros((n, n), np.float32)
    for _ in range(140):
        x, y = r.uniform(0, n), r.uniform(0, n)
        rad = r.uniform(1.5, 5)
        splat(a, x, y, rad, 1.0, 3.5)
        splat(a, x, y, rad * 4, 0.35, 1.6)                  # brillo
    a = np.clip(a + 0.5 * streaks(n, 412, 40, 10, 40, -1.4, 0.4, 1, 1.8, glow=0.4), 0, 1)
    return a * edge_fade(n, 0.1)


def fire_particles(n=1600):
    r = rng(421)
    a = np.zeros((n, n), np.float32)
    for _ in range(120):  # lenguas de fuego pequeñas (gotas alargadas hacia arriba)
        x, y = r.uniform(0.1, 0.9) * n, r.uniform(0.15, 0.95) * n
        s = r.uniform(4, 16)
        for k in range(5):
            splat(a, x + r.normal(0, s * 0.15), y - k * s * 0.7, s * (1 - k * 0.17), r.uniform(0.5, 0.9) * (1 - k * 0.12),
                  2.0, sx=0.6, sy=1.2)
    a = np.clip(a + 0.6 * embers(n), 0, 1)
    return a * edge_fade(n, 0.1)


def magic_dust(n=1600):
    r = rng(431)
    a = np.zeros((n, n), np.float32)
    x, y = grid(n)
    trail = np.exp(-((y - 0.4 * np.sin(x * 2.5)) / 0.3) ** 2)       # estela curva
    scatter(a, r, 900, 0.6, 3, v=(0.4, 1.0), hard=(2, 4), dist=0.1 + 0.9 * trail)
    L = Lines(n)
    for _ in range(45):   # destellos de 4 puntas
        cx, cy = r.uniform(0, n), r.uniform(0, n)
        if r.random() > 0.15 + 0.85 * trail[int(cy), int(cx)]:
            continue
        s = r.uniform(8, 30)
        L.line((cx - s, cy), (cx + s, cy), 1.0, 1.2)
        L.line((cx, cy - s), (cx, cy + s), 1.0, 1.2)
        splat(a, cx, cy, s * 0.25, 1.0, 2)
    a = np.clip(a + blur(L.get(), 0.8) + 0.4 * blur(a, 5), 0, 1)
    return a * edge_fade(n, 0.1)


def gold_dust(n=1600):
    r = rng(441)
    a = np.zeros((n, n), np.float32)
    dens = smooth(0.3, 0.8, fbm(n, 442, base=300, octaves=3))
    scatter(a, r, 2600, 0.9, 3.5, v=(0.4, 1.0), hard=(3, 6), dist=0.1 + 0.9 * dens)
    return np.clip(a + 0.25 * blur(a, 3), 0, 1) * edge_fade(n, 0.1)


def snowfall(n=1600):
    r = rng(451)
    a = np.zeros((n, n), np.float32)
    for _ in range(520):
        depth = r.random()
        splat(a, r.uniform(0, n), r.uniform(0, n), 1.5 + 9 * depth ** 2.2, 0.55 + 0.45 * (1 - depth), 3.5 - 2.2 * depth)
    return a * edge_fade(n, 0.1)


def rain_fine(n=1600):
    a = streaks(n, 461, 1600, 12, 45, 1.75, 0.03, 0.6, 1.1, vmin=0.25)
    return a * edge_fade(n, 0.1, False)


def rain_heavy(n=1600):
    a = streaks(n, 471, 2600, 40, 140, 1.72, 0.04, 0.8, 1.8, vmin=0.3)
    return np.clip(a + 0.15 * blur(a, 2), 0, 1) * edge_fade(n, 0.1, False)


def water_spray(n=1600):
    r = rng(481)
    a = np.zeros((n, n), np.float32)
    for _ in range(1500):
        ang = r.normal(-1.57, 0.6)
        dist = abs(r.normal(0, 0.35)) * n
        x = n / 2 + math.cos(ang) * dist
        y = n * 0.85 + math.sin(ang) * dist
        splat(a, x, y, r.uniform(0.6, 3.5), r.uniform(0.4, 1.0), 3)
    return a * edge_fade(n, 0.08)


def splash(n=1600):
    r = rng(491)
    a = np.zeros((n, n), np.float32)
    L = Lines(n)
    cx, cy = n / 2, n * 0.62
    for _ in range(60):   # corona de gotas
        ang = r.uniform(-3.0, -0.14)
        ln = r.uniform(0.12, 0.42) * n
        pts = [(cx + math.cos(ang) * ln * t, cy + math.sin(ang) * ln * t + 0.25 * n * t * t) for t in np.linspace(0, 1, 10)]
        L.poly(pts, r.uniform(0.4, 0.9), r.uniform(1.5, 4))
        e = pts[-1]
        splat(a, e[0], e[1], r.uniform(3, 9), 0.95, 3)
    splat(a, cx, cy, n * 0.06, 0.9, 2.5, sx=2.2, sy=0.6)
    a = np.clip(a + blur(L.get(), 0.8), 0, 1)
    scatter(a, r, 300, 0.8, 3, v=(0.4, 0.9))
    return a * edge_fade(n, 0.06)


def debris(n=1600):
    r = rng(501)
    L = Lines(n)
    for _ in range(260):
        cx, cy = r.uniform(0, n), r.uniform(0, n)
        s = 2 + 22 * r.random() ** 3
        k = r.integers(3, 7)
        pts = [(cx + s * r.uniform(0.4, 1.2) * math.cos(t), cy + s * r.uniform(0.4, 1.2) * math.sin(t))
               for t in np.sort(r.uniform(0, 6.28, k))]
        L.fill(pts, r.uniform(0.6, 1.0))
    a = L.get()
    a = np.clip(a + 0.6 * streaks(n, 502, 60, 6, 30, 0.3, 1.5, 0.8, 1.5), 0, 1)
    return a * edge_fade(n, 0.08)


def bokeh_particles(n=1600):
    r = rng(511)
    a = np.zeros((n, n), np.float32)
    y, x = np.mgrid[0:n, 0:n].astype(np.float32)
    for _ in range(55):
        cx, cy, rad = r.uniform(0, n), r.uniform(0, n), 12 + 70 * r.random() ** 2
        R = int(rad) + 3
        x0, y0 = max(int(cx) - R, 0), max(int(cy) - R, 0)
        x1, y1 = min(int(cx) + R, n), min(int(cy) + R, n)
        d = np.sqrt((x[y0:y1, x0:x1] - cx) ** 2 + (y[y0:y1, x0:x1] - cy) ** 2) / rad
        disc = smooth(1.0, 0.94, d) * (0.55 + 0.45 * smooth(0.6, 0.97, d))   # borde más brillante
        v = r.uniform(0.35, 0.9)
        a[y0:y1, x0:x1] = np.maximum(a[y0:y1, x0:x1], disc * v)
    return a * edge_fade(n, 0.08)


# ----------------------------------------------------------------------------- TEXTURAS
def grain(n, seed, sigma, clump, amount):
    g = norm(white(n, seed, sigma))
    c = fbm(n, seed + 1, base=clump, octaves=2)
    a = smooth(0.45, 1.0, g * (0.75 + 0.5 * c)) * amount
    return np.clip(a, 0, 1)


def film_grain_fine(n=1600):
    return grain(n, 601, 0.6, 6, 0.8) * edge_fade(n, 0.06, False)


def film_grain_medium(n=1600):
    return grain(n, 611, 1.1, 10, 0.9) * edge_fade(n, 0.06, False)


def film_grain_heavy(n=1600):
    return grain(n, 621, 1.9, 18, 1.0) * edge_fade(n, 0.06, False)


def iso_noise(n=1600):
    g = norm(white(n, 631, 0.0))
    bands = 0.9 + 0.1 * norm(blur(white(n, 632), 0.1, 30))[:, :1]          # leve bandeo horizontal
    return np.clip(smooth(0.5, 1.0, g) * bands, 0, 1) * edge_fade(n, 0.06, False)


def scratches_layer(n, seed, count, m=None):
    r = rng(seed)
    m = m or n
    L = Lines(n, m)
    for _ in range(count):
        x = r.uniform(0, n)
        y0 = r.uniform(-0.2, 0.6) * m
        ln = r.uniform(0.2, 1.0) * m
        pts = [(x + 3 * math.sin(t * 3 + seed) + r.normal(0, 0.3), y0 + ln * t) for t in np.linspace(0, 1, 30)]
        L.poly(pts, r.uniform(0.3, 1.0), r.uniform(0.6, 2.0))
    for _ in range(count // 3):   # rayones cortos y curvos
        p = (r.uniform(0, n), r.uniform(0, m))
        L.poly(wavy(r, p, r.uniform(20, 120), r.uniform(0, 6.28), r.uniform(3, 15), 0.6, 20), r.uniform(0.3, 0.8), 1.0)
    return L.get()


def dust_layer(n, seed, specks, hairs, blobs, m=None):
    r = rng(seed)
    m = m or n
    a = np.zeros((m, n), np.float32)
    scatter(a, r, specks, 0.8, 4.0, v=(0.5, 1.0), hard=(2.5, 5))
    for _ in range(blobs):
        splat(a, r.uniform(0, n), r.uniform(0, m), r.uniform(4, 14), r.uniform(0.6, 1.0), r.uniform(3, 5),
              sx=r.uniform(0.6, 1.4), sy=r.uniform(0.6, 1.4), ang=r.uniform(0, 3))
    L = Lines(n, m)
    for _ in range(hairs):
        p = (r.uniform(0, n), r.uniform(0, m))
        L.poly(wavy(r, p, r.uniform(40, 200), r.uniform(0, 6.28), r.uniform(5, 30), r.uniform(0.3, 1.5), 40),
               r.uniform(0.6, 1.0), r.uniform(0.8, 1.6))
    return np.clip(a + L.get(), 0, 1)


def film_scratches(n=1600):
    return np.clip(scratches_layer(n, 641, 70), 0, 1) * edge_fade(n, 0.05, False)


def dust_on_film(n=1600):
    return dust_layer(n, 651, 500, 14, 40) * edge_fade(n, 0.05, False)


def halftone(n=1600, cell=16):
    x, y = np.mgrid[0:n, 0:n].astype(np.float32)
    c, s = math.cos(math.radians(45)), math.sin(math.radians(45))
    u, v = (x * c + y * s) / cell, (-x * s + y * c) / cell
    du, dv = u - np.round(u), v - np.round(v)
    d = np.sqrt(du * du + dv * dv)
    tone = smooth(0.0, 1.0, fbm(n, 661, base=500, octaves=2))         # tamaño de punto variable
    rad = 0.12 + 0.42 * tone
    return smooth(rad + 0.04, rad - 0.04, d) * edge_fade(n, 0.06, False)


def paper_texture(n=1600):
    fibers = norm(blur(white(n, 671), 0.6, 6)) * 0.5 + norm(blur(white(n, 672), 6, 0.6)) * 0.5
    a = smooth(0.45, 1.0, 0.6 * fibers + 0.4 * fbm(n, 673, base=40, octaves=4)) * 0.75
    return a * edge_fade(n, 0.06, False)


def canvas_texture(n=1600, period=9.0):
    x, y = np.mgrid[0:n, 0:n].astype(np.float32)
    jx = 0.8 * fbm(n, 681, base=80, octaves=2)
    weave = (0.5 + 0.5 * np.sin((x + jx * 6) * 2 * np.pi / period)) * (0.5 + 0.5 * np.sin((y + jx * 6) * 2 * np.pi / period))
    weave2 = (0.5 + 0.5 * np.cos(x * 2 * np.pi / period)) * (0.5 + 0.5 * np.cos(y * 2 * np.pi / period))
    a = 0.55 * np.maximum(weave, weave2) + 0.25 * norm(white(n, 682, 0.8)) + 0.2 * fbm(n, 683, base=120, octaves=3)
    return smooth(0.35, 1.0, a) * 0.8 * edge_fade(n, 0.06, False)


def concrete_texture(n=1600):
    r = rng(691)
    a = 0.6 * fbm(n, 692, base=120, octaves=7, gain=0.6) + 0.4 * norm(white(n, 693, 0.8))
    a = smooth(0.4, 1.0, a) * 0.7
    pits = np.zeros((n, n), np.float32)
    scatter(pits, r, 900, 1, 5, v=(0.6, 1.0), hard=(3, 6))
    return np.clip(a + pits * 0.8, 0, 1) * edge_fade(n, 0.06, False)


def rust(n=1600):
    f = fbm(n, 701, base=220, octaves=7, gain=0.62)
    patches = smooth(0.48, 0.62, f)
    granular = smooth(0.4, 1.0, norm(white(n, 702, 1.0)) * 0.5 + fbm(n, 703, base=8, octaves=3) * 0.5)
    return np.clip(patches * (0.5 + 0.5 * granular), 0, 1) * edge_fade(n, 0.06, False)


def grunge(n=1600):
    r = rng(711)
    f = smooth(0.55, 0.75, fbm(n, 712, base=260, octaves=7, gain=0.65))
    a = np.zeros((n, n), np.float32)
    for _ in range(25):  # salpicaduras
        cx, cy = r.uniform(0, n), r.uniform(0, n)
        for _k in range(40):
            ang, d = r.uniform(0, 6.28), abs(r.normal(0, 40))
            splat(a, cx + math.cos(ang) * d, cy + math.sin(ang) * d, r.uniform(1, 6), 1.0, 4)
    s = scratches_layer(n, 713, 25) * 0.6
    return np.clip(f * 0.8 + a + s, 0, 1) * edge_fade(n, 0.06, False)


# ----------------------------------------------------------------------------- MEDIOS (combinados)
def media(n, seed, grain_sigma, grain_amt, clump, scr=0, dust=(0, 0, 0), iso=0.0, banding=0.0):
    a = grain(n, seed, grain_sigma, clump, grain_amt)
    if iso:
        a = np.maximum(a, smooth(0.55, 1.0, norm(white(n, seed + 5))) * iso)
    if banding:
        a = np.clip(a + banding * norm(blur(white(n, seed + 6), 0.1, 40))[:, :1], 0, 1)
    if scr:
        a = np.maximum(a, scratches_layer(n, seed + 7, scr) * 0.9)
    if any(dust):
        a = np.maximum(a, dust_layer(n, seed + 8, *dust))
    return a * edge_fade(n, 0.05, False)


def kodak_35mm(n=2000):
    return media(n, 801, 0.9, 0.8, 8, dust=(120, 2, 6))


def cine_16mm(n=2000):
    return media(n, 811, 1.7, 0.95, 16, scr=12, dust=(260, 5, 15))


def vintage_film(n=2000):
    return media(n, 821, 1.4, 0.9, 14, scr=40, dust=(400, 10, 30))


def high_iso(n=2000):
    return media(n, 831, 0.6, 0.6, 4, iso=0.9, banding=0.12)


def analog_dirty(n=2000):
    a = media(n, 841, 1.6, 0.95, 20, scr=60, dust=(800, 18, 60))
    return np.clip(a + 0.35 * smooth(0.6, 0.8, fbm(n, 842, base=300, octaves=6)) * edge_fade(n, 0.05, False), 0, 1)


def editorial_grain(n=2000):
    return media(n, 851, 0.75, 0.7, 5)


# ----------------------------------------------------------------------------- catálogo
PACKS = [
    ("Piel", [
        ("Skin Texture Fine", skin_texture_fine, "Textura microscópica de piel"),
        ("Pore Scatter", pore_scatter, "Poros sutiles y orgánicos"),
        ("Skin Grain", skin_grain, "Textura natural para evitar piel plástica"),
        ("Freckle Natural", freckle_natural, "Pecas realistas"),
        ("Beauty Soft", beauty_soft, "Transición suave entre maquillaje y piel"),
        ("Imperfection Brush", imperfection, "Pequeñas imperfecciones"),
        ("Micro Wrinkle", micro_wrinkle, "Líneas naturales de expresión"),
        ("Skin Highlight", skin_highlight, "Reflejos de piel"),
        ("Skin Shadow", skin_shadow, "Sombras suaves y orgánicas"),
    ]),
    ("Luz", [
        ("Window Light", window_light, "Luz de ventana"),
        ("God Rays", god_rays, "Rayos de luz volumétricos"),
        ("Fog Beam", fog_beam, "Haz de luz en niebla"),
        ("Rim Light", rim_light, "Luz de contorno"),
        ("Lens Glow", lens_glow, "Resplandor óptico"),
        ("Anamorphic Flare", anamorphic_flare, "Destello horizontal cinematográfico"),
        ("Light Leak", light_leak, "Fuga de luz"),
        ("Sunset Glow", sunset_glow, "Luz dorada de atardecer"),
        ("Blue Hour Glow", blue_hour_glow, "Luz azul de hora azul"),
        ("Neon Glow", neon_glow, "Iluminación de neón (para trazos)"),
        ("Bounce Light", bounce_light, "Luz rebotada"),
        ("Soft Specular", soft_specular, "Reflejo suave"),
    ]),
    ("Atmosfera", [
        ("Fog 01", fog_01, "Niebla fina"),
        ("Fog 02", fog_02, "Niebla densa"),
        ("Ground Mist", ground_mist, "Niebla a ras de suelo"),
        ("Atmospheric Haze", atmospheric_haze, "Bruma distante"),
        ("Smoke Wisps", smoke_wisps, "Humo fino"),
        ("Smoke Volume", smoke_volume, "Humo denso"),
        ("Dust Particles", dust_particles, "Partículas de polvo"),
        ("Floating Dust", floating_dust, "Polvo suspendido con profundidad"),
        ("Ash Particles", ash_particles, "Cenizas"),
        ("Breath Vapor", breath_vapor, "Vapor de respiración"),
        ("Cold Atmosphere", cold_atmosphere, "Ambiente frío con cristales de hielo"),
        ("Heat Distortion Texture", heat_distortion, "Textura para simular calor"),
    ]),
    ("Particulas", [
        ("Sparks", sparks, "Chispas"),
        ("Embers", embers, "Brasas"),
        ("Fire Particles", fire_particles, "Partículas de fuego"),
        ("Magic Dust", magic_dust, "Partículas luminosas"),
        ("Gold Dust", gold_dust, "Polvo dorado"),
        ("Snowfall", snowfall, "Nieve"),
        ("Rain Fine", rain_fine, "Lluvia fina"),
        ("Rain Heavy", rain_heavy, "Lluvia intensa"),
        ("Water Spray", water_spray, "Gotas de agua"),
        ("Splash", splash, "Salpicadura"),
        ("Debris", debris, "Partículas de destrucción"),
        ("Bokeh Particles", bokeh_particles, "Partículas desenfocadas"),
    ]),
    ("Texturas", [
        ("Film Grain Fine", film_grain_fine, "Grano fino"),
        ("Film Grain Medium", film_grain_medium, "Grano cinematográfico"),
        ("Film Grain Heavy", film_grain_heavy, "Grano agresivo"),
        ("ISO Noise", iso_noise, "Ruido fotográfico"),
        ("Film Scratches", film_scratches, "Rayones"),
        ("Dust on Film", dust_on_film, "Polvo en la película"),
        ("Halftone", halftone, "Semitonos"),
        ("Paper Texture", paper_texture, "Textura de papel"),
        ("Canvas Texture", canvas_texture, "Lienzo"),
        ("Concrete Texture", concrete_texture, "Cemento"),
        ("Rust", rust, "Óxido"),
        ("Grunge", grunge, "Desgaste"),
    ]),
    ("Medios", [
        ("Kodak 35mm", kodak_35mm, "Grano de 35 mm con polvo ligero"),
        ("Cine 16mm", cine_16mm, "Grano grueso de 16 mm, rayones y polvo"),
        ("Vintage Film", vintage_film, "Película vieja: grano, rayones, pelos y polvo"),
        ("High ISO", high_iso, "Ruido digital de ISO alto con bandeo leve"),
        ("Analog Dirty", analog_dirty, "Película sucia: mucho polvo, rayones y manchas"),
        ("Editorial Grain", editorial_grain, "Grano fino y parejo de revista"),
    ]),
]


def file_name(i, pack, name):
    return "%02d %s - %s" % (i, pack, name)


def build(out):
    os.makedirs(out, exist_ok=True)
    made = []
    i = 0
    for pack, items in PACKS:
        for name, fn, desc in items:
            i += 1
            a = np.clip(fn(), 0, 1).astype(np.float32)
            png = (255 * (1 - a) + 0.5).astype(np.uint8)        # negro = pinta
            path = os.path.join(out, file_name(i, pack, name) + ".png")
            cv2.imwrite(path, png, [cv2.IMWRITE_PNG_COMPRESSION, 9])
            made.append((pack, name, desc, path, a))
            print("%2d/63  %-10s %s" % (i, pack, name), flush=True)
    return made


def contact_sheet(made, path, cols=9, cell=210):
    rows = math.ceil(len(made) / cols)
    sheet = np.full((rows * (cell + 34), cols * cell, 3), 18, np.uint8)
    for k, (pack, name, _d, _p, a) in enumerate(made):
        h, w = a.shape
        s = (cell - 12) / max(h, w)
        t = cv2.resize(a, (max(1, int(w * s)), max(1, int(h * s))), interpolation=cv2.INTER_AREA)
        r0, c0 = (k // cols) * (cell + 34), (k % cols) * cell
        y = r0 + 6 + (cell - 12 - t.shape[0]) // 2
        x = c0 + 6 + (cell - 12 - t.shape[1]) // 2
        sheet[y:y + t.shape[0], x:x + t.shape[1]] = np.clip(18 + t[..., None] * 237, 0, 255).astype(np.uint8)
        cv2.putText(sheet, name, (c0 + 6, r0 + cell + 20), cv2.FONT_HERSHEY_SIMPLEX, 0.42, (230, 230, 230), 1, cv2.LINE_AA)
    cv2.imwrite(path, sheet)


if __name__ == "__main__":
    args = sys.argv[1:]
    sample = None
    if "--muestra" in args:
        k = args.index("--muestra")
        sample = args[k + 1]
        del args[k:k + 2]
    out = args[0] if args else os.path.join(os.path.dirname(os.path.abspath(__file__)), "puntas")
    made = build(out)
    if sample:
        contact_sheet(made, sample)
        print("Hoja de muestra:", sample)
