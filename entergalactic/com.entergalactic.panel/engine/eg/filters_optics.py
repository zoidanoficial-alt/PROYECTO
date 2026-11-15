"""ENTERGALACTIC Óptica y luz: destellos de lente, rayos de luz, partículas, filtros
ópticos, carácter de objetivo y corrección de color.

Todo se dibuja en coordenadas normalizadas de la imagen completa (ctx.grid), así la
vista previa (reducida o recortada) coincide con el resultado final.
"""
import numpy as np
import cv2

from . import core as C
from .registry import register, rng, sel, chk, hue


def _screen(img, layer):
    return 1.0 - (1.0 - img) * (1.0 - np.clip(layer, 0, 1))


def _brightest(img, ctx):
    """Posición normalizada (u, v) del punto más brillante (suavizado)."""
    sc = cv2.resize(C.luminance(img), (96, max(8, int(96 * img.shape[0] / img.shape[1]))), interpolation=cv2.INTER_AREA)
    sc = C.blur(sc, 2.0)
    y, x = np.unravel_index(int(np.argmax(sc)), sc.shape)
    x0, y0, x1, y1 = ctx.rect
    return x0 + (x + 0.5) / sc.shape[1] * (x1 - x0), y0 + (y + 0.5) / sc.shape[0] * (y1 - y0)


def _source(img, p, ctx):
    if p.get("auto", False):
        return _brightest(img, ctx)
    return p["x"] / 100.0, p["y"] / 100.0


# --------------------------------------------------------------------------- destello de lente
FLARE_STYLES = {"warm": ("Cálido (objetivo vintage)", (1.0, 0.75, 0.45)), "cool": ("Frío (recubrimiento moderno)", (0.55, 0.75, 1.0)),
                "anamorphic": ("Anamórfico azul", (0.4, 0.65, 1.0)), "rainbow": ("Arcoíris", (1.0, 1.0, 1.0)),
                "sun": ("Sol blanco", (1.0, 0.95, 0.85))}


@register("lens_flare", "Destello de lente", ["optics"], [
    chk("auto", "Situar en la luz más brillante", True),
    rng("x", "Posición horizontal", 0, 100, 75), rng("y", "Posición vertical", 0, 100, 25),
    rng("intensity", "Intensidad", 0, 100, 55),
    sel("style", "Estilo", [(k, v[0]) for k, v in FLARE_STYLES.items()], "warm"),
    rng("ghosts", "Reflejos (ghosts)", 0, 100, 60),
    rng("starburst", "Estrella de diafragma", 0, 100, 35),
    sel("blades", "Láminas del diafragma", [("6", "6"), ("8", "8"), ("9", "9 (rayos 18)"), ("14", "14")], "8"),
    rng("streak", "Raya horizontal", 0, 100, 25),
    rng("halo", "Anillo", 0, 100, 25),
], "Destello óptico completo: brillo central, estrella del diafragma, reflejos internos alineados con el centro, raya y anillo.")
def lens_flare(img, p, ctx):
    sx, sy = _source(img, p, ctx)
    full_ctx, ctx = ctx, ctx.small(1200)       # el destello es luz suave: se calcula reducido y se amplía
    u, v = ctx.grid()
    a = ctx.aspect
    dx, dy = (u - sx) * a, v - sy
    r = np.sqrt(dx * dx + dy * dy)
    col = np.array(FLARE_STYLES[p["style"]][1], np.float32)
    k = p["intensity"] / 100.0
    layer = np.zeros((ctx.h, ctx.w, 3), np.float32)
    # brillo central
    core = 1.2 * np.exp(-(r / 0.045) ** 2) + 0.5 * np.exp(-(r / 0.16) ** 2)
    layer += core[..., None] * col
    # estrella de diafragma
    if p["starburst"]:
        n = int(p["blades"])
        n = n * 2 if n % 2 else n
        ang = np.arctan2(dy, dx)
        rays = np.abs(np.cos(ang * n / 2.0)) ** 40
        star = rays * np.exp(-r / 0.3) * p["starburst"] / 100.0 * 1.6
        layer += star[..., None] * col
    # raya horizontal
    if p["streak"]:
        sk = np.exp(-(dy / 0.006) ** 2) * np.exp(-np.abs(dx) / 0.45) * p["streak"] / 100.0
        scol = np.array([0.45, 0.7, 1.0], np.float32) if p["style"] in ("anamorphic", "cool") else col
        layer += sk[..., None] * scol
    # reflejos internos sobre la línea fuente → centro → reflejo
    if p["ghosts"]:
        cx, cy = 0.5, 0.5
        rg = np.random.default_rng(42)
        for t, size, hue_ in ((-0.35, 0.06, 30), (0.25, 0.035, 200), (0.55, 0.08, 120), (0.85, 0.025, 280),
                              (1.25, 0.1, 40), (1.6, 0.05, 190), (1.9, 0.14, 300)):
            # t = 0 en la fuente, 0,5 en el centro óptico, 1 en el punto reflejado
            gx, gy = sx + (cx - sx) * 2 * t, sy + (cy - sy) * 2 * t
            gd = np.sqrt(((u - gx) * a) ** 2 + (v - gy) ** 2)
            ring = 1.0 - C.smoothstep(size * 0.7, size, gd)
            edge = C.smoothstep(size * 0.55, size * 0.95, gd) * (1.0 - C.smoothstep(size * 0.95, size * 1.05, gd))
            gcol = C.hue_color(hue_, 0.55, 1.0) if p["style"] == "rainbow" else col * (0.75 + 0.25 * C.hue_color(hue_, 0.4, 1.0))
            layer += (ring * 0.22 + edge * 0.3)[..., None] * gcol * rg.uniform(0.6, 1.0) * p["ghosts"] / 100.0
    # anillo
    if p["halo"]:
        hr = 0.32
        ring = np.exp(-((r - hr) / 0.025) ** 2) * p["halo"] / 100.0 * 0.6
        layer += ring[..., None] * (C.hue_color(20, 0.5, 1.0) if p["style"] != "cool" else col)
    layer = layer * k * 1.3
    if layer.shape[:2] != img.shape[:2]:
        layer = cv2.resize(layer, (img.shape[1], img.shape[0]), interpolation=cv2.INTER_LINEAR)
    return _screen(img, layer)


# --------------------------------------------------------------------------- rayos de luz
@register("light_rays", "Rayos de luz", ["optics"], [
    chk("auto", "Desde la luz más brillante", True),
    rng("x", "Origen horizontal", 0, 100, 70), rng("y", "Origen vertical", 0, 100, 15),
    rng("intensity", "Intensidad", 0, 100, 55),
    rng("length", "Longitud", 10, 100, 60),
    rng("threshold", "Umbral de luz", 30, 95, 70),
    rng("warmth", "Calidez", -100, 100, 40),
], "Rayos volumétricos: la luz atraviesa ventanas, ramas o nubes y deja haces en el aire.")
def light_rays(img, p, ctx):
    h, w = img.shape[:2]
    sx, sy = _source(img, p, ctx)
    small = ctx.small(420)
    lum = cv2.resize(C.luminance(img), (small.w, small.h), interpolation=cv2.INTER_AREA)
    t = p["threshold"] / 100.0
    m = C.smoothstep(t - 0.1, t + 0.05, lum)
    x0, y0, x1, y1 = ctx.rect
    px = (sx - x0) / (x1 - x0) * small.w
    py = (sy - y0) / (y1 - y0) * small.h
    acc = np.zeros_like(m)
    steps = 40
    L = 0.15 + 0.75 * p["length"] / 100.0
    for i in range(steps):
        s = 1.0 - L * i / steps
        M = np.float32([[s, 0, px * (1 - s)], [0, s, py * (1 - s)]])
        acc += cv2.warpAffine(m, M, (small.w, small.h), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT) * (0.97 ** i)
    acc /= steps * 0.3
    acc = cv2.resize(acc, (w, h), interpolation=cv2.INTER_LINEAR)
    wm = p["warmth"] / 100.0
    col = np.array([1.0, 0.92 - 0.12 * max(wm, 0) + 0.05 * min(wm, 0), 0.8 - 0.35 * max(wm, 0) + 0.2 * -min(wm, 0)], np.float32)
    # sólo se ven sobre lo que no es ya luz: se atenúan donde la fuente es la propia zona brillante
    acc = np.clip(acc - C.smoothstep(t - 0.1, t + 0.05, C.luminance(img)) * 0.35, 0, None)
    return _screen(img, acc[..., None] * col * p["intensity"] / 100.0 * 1.5)


# --------------------------------------------------------------------------- partículas
PARTICLES = {"dust": "Polvo en la luz", "bokeh": "Bokeh (círculos desenfocados)", "snow": "Nieve", "rain": "Lluvia",
             "sparks": "Chispas y brasas", "fireflies": "Luciérnagas", "stars": "Estrellas", "confetti": "Confeti"}


@register("particles", "Partículas", ["optics"], [
    sel("type", "Tipo", list(PARTICLES.items()), "dust"),
    rng("amount", "Cantidad", 0, 100, 45),
    rng("size", "Tamaño", 10, 300, 100, unit="%"),
    rng("opacity", "Opacidad", 0, 100, 70),
    rng("depth", "Profundidad (desenfoque variado)", 0, 100, 50),
    sel("where", "Dónde", [("all", "Toda la imagen"), ("light", "Cerca de las luces"), ("top", "Arriba"),
                           ("bottom", "Abajo")], "all"),
    rng("angle", "Ángulo (lluvia / chispas)", -60, 60, 10, unit="°"),
    rng("seed", "Variación", 1, 99, 12),
], "Polvo suspendido en la luz, bokeh, nieve, lluvia, chispas, luciérnagas, estrellas o confeti, generados con semilla.")
def particles(img, p, ctx):
    h, w = img.shape[:2]
    rg = np.random.default_rng(int(p["seed"]) * 1009 + ctx.seed)
    full = max(ctx.full_w, ctx.full_h) * ctx.k
    x0, y0, x1, y1 = ctx.rect
    sx, sy = w / (x1 - x0), h / (y1 - y0)
    t = p["type"]
    base_n = {"dust": 500, "bokeh": 40, "snow": 450, "rain": 380, "sparks": 120, "fireflies": 60, "stars": 700, "confetti": 160}[t]
    n = int(base_n * p["amount"] / 100.0)
    size_k = p["size"] / 100.0
    lum_small = None
    if p["where"] == "light":
        lum_small = C.blur(cv2.resize(C.luminance(img), (64, max(8, int(64 * h / w))), interpolation=cv2.INTER_AREA), 2.0)
    layers = [np.zeros((h, w, 3), np.float32) for _ in range(3)]       # cerca, medio, lejos
    ang = np.deg2rad(p["angle"])
    for _ in range(n):
        nx, ny = rg.uniform(0, 1), rg.uniform(0, 1)
        if p["where"] == "top" and ny > rg.uniform(0.2, 0.9):
            continue
        if p["where"] == "bottom" and ny < rg.uniform(0.1, 0.8):
            continue
        if lum_small is not None:
            lv = lum_small[min(lum_small.shape[0] - 1, int(ny * lum_small.shape[0])), min(lum_small.shape[1] - 1, int(nx * lum_small.shape[1]))]
            if rg.uniform() > lv ** 1.5:
                continue
        layer_i = int(rg.integers(0, 3))
        X, Y = (nx - x0) * sx, (ny - y0) * sy
        depth_scale = (1.6, 1.0, 0.6)[layer_i]
        if t == "dust":
            r, col, a = 0.0012 * rg.pareto(3) + 0.0006, (1.0, 0.97, 0.9), rg.uniform(0.3, 1)
        elif t == "bokeh":
            r, col, a = rg.uniform(0.012, 0.04), C.hue_color(rg.uniform(20, 60) if rg.uniform() < 0.7 else rg.uniform(180, 320), 0.45, 1.0), rg.uniform(0.25, 0.6)
        elif t == "snow":
            r, col, a = rg.uniform(0.0012, 0.004), (1, 1, 1), rg.uniform(0.5, 1)
        elif t == "rain":
            r, col, a = rg.uniform(0.0004, 0.0008), (0.85, 0.9, 1.0), rg.uniform(0.25, 0.6)
        elif t == "sparks":
            r, col, a = rg.uniform(0.0008, 0.0018), (1.0, rg.uniform(0.4, 0.7), 0.15), rg.uniform(0.6, 1)
        elif t == "fireflies":
            r, col, a = rg.uniform(0.002, 0.005), (0.85, 1.0, 0.35), rg.uniform(0.5, 1)
        elif t == "stars":
            r, col, a = rg.uniform(0.0003, 0.0011), (1, 1, rg.uniform(0.85, 1.0)), rg.uniform(0.3, 1)
        else:
            r, col, a = rg.uniform(0.002, 0.005), C.hue_color(rg.uniform(0, 360), 0.85, 1.0), 1.0
        rp = max(0.6, r * full * size_k * depth_scale)
        colv = tuple(float(c * a) for c in col)
        L = layers[layer_i]
        if t in ("rain", "sparks"):
            ln = rp * (40 if t == "rain" else 18)
            dx, dy = np.sin(ang) * ln, np.cos(ang) * ln
            cv2.line(L, (int(X), int(Y)), (int(X + dx), int(Y + dy)), colv, max(1, int(round(rp))), cv2.LINE_AA)
        elif t == "confetti":
            pts = cv2.boxPoints(((X, Y), (rp * 2.2, rp * 1.2), rg.uniform(0, 180))).astype(np.int32)
            cv2.fillConvexPoly(L, pts, colv, cv2.LINE_AA)
        else:
            cv2.circle(L, (int(X), int(Y)), int(round(rp)), colv, -1, cv2.LINE_AA)
    dep = p["depth"] / 100.0
    out_layer = np.zeros((h, w, 3), np.float32)
    for i, L in enumerate(layers):
        blur = (0.004 * dep * full, 0.0015 * dep * full, 0.0004 * full)[i]
        if t == "bokeh":
            blur = (0.006, 0.004, 0.003)[i] * full * (0.3 + dep)
        if t in ("fireflies", "sparks"):
            L = L + C.blur(L, max(1.0, 0.004 * full)) * 1.5      # brillo propio
        out_layer += C.blur(L, max(0.4, blur))
    return _screen(img, out_layer * p["opacity"] / 100.0 * (1.6 if t != "bokeh" else 1.2))


# --------------------------------------------------------------------------- filtros ópticos
OPTICAL = {"star4": "Estrella 4 puntas", "star6": "Estrella 6 puntas", "star8": "Estrella 8 puntas",
           "black_mist": "Niebla negra (difusión suave)", "white_mist": "Niebla blanca (difusión fuerte)",
           "fog": "Niebla (fog)", "glimmer": "Destellos finos (glimmer)", "center_spot": "Centro nítido (center spot)"}


@register("optical_filter", "Filtro óptico", ["optics"], [
    sel("type", "Filtro", list(OPTICAL.items()), "black_mist"),
    rng("strength", "Intensidad (densidad del filtro)", 0, 100, 50),
    rng("threshold", "Umbral de luces", 30, 98, 75),
    rng("size", "Tamaño", 10, 200, 100, unit="%"),
    rng("angle", "Giro del filtro", 0, 90, 20, unit="°"),
], "Filtros de cristal delante del objetivo: estrellas, nieblas de difusión, fog, glimmer y centro nítido.")
def optical_filter(img, p, ctx):
    t = p["type"]
    k = p["strength"] / 100.0
    full = max(ctx.full_w, ctx.full_h) * ctx.k
    l = C.luminance(img)
    th = p["threshold"] / 100.0
    if t.startswith("star") or t == "glimmer":
        m = C.smoothstep(th - 0.03, th + 0.05, l)
        n = {"star4": 4, "star6": 6, "star8": 8, "glimmer": 8}[t]
        length = (0.04 if t != "glimmer" else 0.012) * full * p["size"] / 100.0
        acc = np.zeros_like(m)
        L = int(max(5, length)) | 1
        for i in range(n // 2):
            kern = np.zeros((L, L), np.float32)
            kern[L // 2, :] = np.exp(-np.abs(np.arange(L) - L // 2) / (L / 6.0))
            M = cv2.getRotationMatrix2D((L / 2 - 0.5, L / 2 - 0.5), p["angle"] + i * 360.0 / n, 1.0)
            kern = cv2.warpAffine(kern, M, (L, L))
            kern /= max(kern.sum(), 1e-6)
            acc += cv2.filter2D(m, -1, kern) * L * 0.35
        layer = np.clip(acc, 0, 1)[..., None] * np.clip(img * 0.4 + 0.6, 0, 1)
        return _screen(img, layer * k * 1.4)
    if t in ("black_mist", "white_mist", "fog"):
        r = 0.012 * full * p["size"] / 100.0
        src = img * C.smoothstep(th - 0.35, th, l)[..., None]
        halo = C.blur(src, r) * 0.6 + C.blur(src, r * 3) * 0.4
        out = _screen(img, halo * k * (0.6 if t == "black_mist" else 1.0))
        if t == "white_mist":
            out = out + (np.mean(out) - out) * 0.12 * k + 0.03 * k
        if t == "fog":
            out = out * (1 - 0.35 * k) + 0.35 * k * np.clip(C.blur(out, r * 6), 0, 1) + 0.06 * k
        return np.clip(out, 0, 1)
    # centro nítido: bordes desenfocados y ligeramente difusos
    r = ctx.radial(roundness=1.0)
    m = C.smoothstep(0.25, 0.25 + 0.5 * p["size"] / 100.0, r)[..., None] * k
    b = C.blur(img, 0.008 * full)
    return img + (_screen(b, b * 0.12) - img) * m


# --------------------------------------------------------------------------- carácter de objetivo
@register("lens_character", "Carácter de objetivo", ["optics"], [
    rng("distortion", "Distorsión (barril − / cojín +)", -100, 100, 0),
    rng("swirl", "Bokeh en remolino (tipo Petzval)", 0, 100, 0),
    rng("softness", "Bordes blandos", 0, 100, 20),
    rng("falloff", "Caída de luz natural (cos⁴)", 0, 100, 30),
    rng("fringing", "Franjas de color", 0, 100, 10),
], "La personalidad de un objetivo: distorsión, remolino en el fondo, bordes blandos, caída de luz y franjas de color.")
def lens_character(img, p, ctx):
    h, w = img.shape[:2]
    u, v = ctx.grid()
    a = ctx.aspect
    x0, y0, x1, y1 = ctx.rect
    out = img
    dxn, dyn = (u - 0.5) * 2 * a / np.sqrt(a * a + 1), (v - 0.5) * 2 / np.sqrt(a * a + 1)
    r2 = dxn * dxn + dyn * dyn
    if p["distortion"]:
        kd = p["distortion"] / 100.0 * 0.12
        f = 1 + kd * r2
        su, sv = 0.5 + (u - 0.5) * f, 0.5 + (v - 0.5) * f
        mx = ((su - x0) / (x1 - x0) * w - 0.5).astype(np.float32)
        my = ((sv - y0) / (y1 - y0) * h - 0.5).astype(np.float32)
        out = cv2.remap(out, mx, my, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)
    if p["swirl"]:
        # desenfoque tangencial: copias giradas alrededor del centro, más fuertes hacia los bordes
        cx = (0.5 - x0) / (x1 - x0) * w
        cy = (0.5 - y0) / (y1 - y0) * h
        acc = np.zeros_like(out)
        steps = 9
        amax = p["swirl"] / 100.0 * 2.5
        for i in range(steps):
            angd = (i / (steps - 1) - 0.5) * amax
            M = cv2.getRotationMatrix2D((cx, cy), angd, 1.0)
            acc += cv2.warpAffine(out, M, (w, h), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)
        sw = acc / steps
        m = C.smoothstep(0.25, 0.9, np.sqrt(r2))[..., None]
        out = out + (sw - out) * m
    if p["softness"]:
        full = max(ctx.full_w, ctx.full_h) * ctx.k
        b = C.blur(out, 0.004 * full * p["softness"] / 50.0)
        m = C.smoothstep(0.4, 1.0, np.sqrt(r2))[..., None] * p["softness"] / 100.0
        out = out + (b - out) * m
    if p["fringing"]:
        from .filters_analog import chromatic_aberration
        out = chromatic_aberration(out, {"amount": p["fringing"], "type": "radial"}, ctx)
    if p["falloff"]:
        cos4 = (1.0 / (1.0 + r2 * 0.6)) ** 2
        out = out * (1.0 - (1.0 - cos4) * p["falloff"] / 100.0 * 1.4)[..., None]
    return np.clip(out, 0, 1)


# --------------------------------------------------------------------------- corrección de color
@register("color_correction", "Corrección de color", ["optics", "film"], [
    sel("auto", "Corrección automática", [("none", "Ninguna"), ("gray", "Mundo gris"), ("white", "Punto blanco"),
                                          ("levels", "Niveles automáticos")], "none"),
    hue("lift_hue", "Sombras (lift) · tono", 210), rng("lift", "Sombras (lift) · cantidad", 0, 100, 0),
    rng("lift_l", "Sombras (lift) · nivel", -100, 100, 0),
    hue("gamma_hue", "Medios (gamma) · tono", 40), rng("gamma", "Medios (gamma) · cantidad", 0, 100, 0),
    rng("gamma_l", "Medios (gamma) · nivel", -100, 100, 0),
    hue("gain_hue", "Luces (gain) · tono", 45), rng("gain", "Luces (gain) · cantidad", 0, 100, 0),
    rng("gain_l", "Luces (gain) · nivel", -100, 100, 0),
    rng("saturation", "Saturación", -100, 100, 0),
], "Corrección de color tipo etalonaje: neutraliza dominantes y equilibra sombras, medios y luces (lift, gamma, gain).")
def color_correction(img, p, ctx):
    out = img.astype(np.float32)
    mode = p["auto"]
    if mode == "gray":
        avg = out.reshape(-1, 3).mean(axis=0)
        out = out * np.clip(avg.mean() / np.maximum(avg, 1e-3), 0.8, 1.25)
    elif mode == "white":
        l = C.luminance(out)
        m = l >= np.percentile(l, 99)
        ref = out[m].mean(axis=0) if m.any() else np.ones(3)
        out = out * np.clip(ref.max() / np.maximum(ref, 1e-3), 0.8, 1.25)
    elif mode == "levels":
        lo = np.percentile(out.reshape(-1, 3), 0.5, axis=0)
        hi = np.percentile(out.reshape(-1, 3), 99.5, axis=0)
        out = (out - lo) / np.maximum(hi - lo, 0.05)
    out = np.clip(out, 0, 1)

    def wheel(hue_deg, amount):
        c = C.hue_color(hue_deg, 1.0, 1.0)
        return (c - float(c @ C.LUMA)) * amount / 100.0

    lift = wheel(p["lift_hue"], p["lift"]) * 0.15 + p["lift_l"] / 100.0 * 0.1
    gamma = wheel(p["gamma_hue"], p["gamma"]) * 0.25
    gain = 1.0 + wheel(p["gain_hue"], p["gain"]) * 0.3 + p["gain_l"] / 100.0 * 0.3
    out = out * gain + lift * (1.0 - out)
    g = np.clip(1.0 - gamma - p["gamma_l"] / 100.0 * 0.35, 0.3, 3.0)
    out = np.power(np.clip(out, 0, 1), g)
    if p["saturation"]:
        out = C.saturate(out, 1.0 + p["saturation"] / 100.0)
    return np.clip(out, 0, 1)
