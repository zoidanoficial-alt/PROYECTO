"""ENTERGALACTIC Cine: herramientas para looks de dirección de fotografía cinematográfica.

- Copia de cine (film-out): curva de negativo + copia con pie y hombro, densidad
  sustractiva de color y dominantes de laboratorio.
- Paleta limitada: acerca todos los tonos a uno dominante (desiertos, ciudades nocturnas).
- Destello anamórfico: rayas horizontales desde las luces intensas.
- Formato de pantalla: bandas para 2.76, 2.39, 1.90, 1.66, 1.43...
"""
import numpy as np
import cv2

from . import core as C
from .registry import register, rng, hue, sel, chk

PRINT_TINTS = {
    "neutral": ("Neutra", (0.0, 0.0, 0.0), (0.0, 0.0, 0.0)),
    "warm": ("Copia cálida", (0.010, 0.000, -0.015), (0.025, 0.008, -0.030)),
    "teal": ("Sombras verde azulado", (-0.020, 0.005, 0.020), (0.020, 0.005, -0.020)),
    "cold": ("Copia fría", (-0.010, 0.000, 0.020), (-0.010, 0.000, 0.015)),
    "filmout": ("Ida y vuelta a película (film-out)", (0.006, 0.000, -0.004), (0.012, 0.004, -0.012)),
}


def _filmic(x, contrast, toe, shoulder):
    """Curva tipo negativo+copia: pie (sombras densas) y hombro (luces suaves)."""
    x = np.clip(x, 0.0, 1.0)
    c = 1.0 + contrast * 1.2
    y = 0.5 + (x - 0.5) * c
    # hombro: comprime suavemente las luces en vez de quemarlas
    s = 0.25 + 0.5 * shoulder
    hi = y > 1.0 - s
    yh = 1.0 - s + s * np.tanh((y - (1.0 - s)) / max(s, 1e-3))
    y = np.where(hi, yh, y)
    # pie: negros densos pero con detalle
    t = 0.2 + 0.4 * toe
    lo = y < t
    yl = t * np.power(np.clip(y / t, 0.0, 1.0), 1.0 + toe * 1.2)
    y = np.where(lo, yl, y)
    return np.clip(y, 0.0, 1.0).astype(np.float32)


@register("print_film", "Copia de cine (film-out)", ["cine", "chroma"], [
    rng("strength", "Intensidad", 0, 100, 80),
    rng("contrast", "Contraste de copia", -50, 100, 35),
    rng("toe", "Densidad de negros (pie)", 0, 100, 50),
    rng("shoulder", "Suavidad de luces (hombro)", 0, 100, 60),
    rng("density", "Densidad de color", 0, 100, 40),
    sel("tint", "Laboratorio", [(k, v[0]) for k, v in PRINT_TINTS.items()], "neutral"),
], "Pasa la imagen por un negativo y una copia de proyección: luces que ruedan suave, negros densos y colores con cuerpo.")
def print_film(img, p, ctx):
    l = C.luminance(img)
    nl = _filmic(l, p["contrast"] / 100.0, p["toe"] / 100.0, p["shoulder"] / 100.0)
    out = C.set_luminance(img, nl)
    d = p["density"] / 100.0
    if d:
        # Densidad sustractiva: los colores saturados se oscurecen y ganan cuerpo, como en película.
        mx = np.maximum(np.maximum(out[..., 0], out[..., 1]), out[..., 2])
        mn = np.minimum(np.minimum(out[..., 0], out[..., 1]), out[..., 2])
        chroma = mx - mn
        out = out * (1.0 - d * 0.35 * chroma)[..., None]
        out = C.saturate(out, 1.0 + 0.15 * d)
    _, sh, hl = PRINT_TINTS[p["tint"]]
    if any(sh) or any(hl):
        w = C.smoothstep(0.15, 0.85, C.luminance(out))[..., None]
        out = out + np.array(sh, np.float32) * (1 - w) * 4.0 + np.array(hl, np.float32) * w * 4.0
    out = np.clip(out, 0, 1)
    return img + (out - img) * p["strength"] / 100.0


@register("limited_palette", "Paleta limitada", ["cine", "chroma"], [
    hue("target", "Tono dominante", 35),
    rng("strength", "Intensidad", 0, 100, 50),
    rng("desaturate", "Apagar otros colores", 0, 100, 40),
    chk("skin", "Proteger piel", True),
], "Lleva todos los colores hacia un tono dominante: desiertos, ciudades de noche, mundos de un solo color.")
def limited_palette(img, p, ctx):
    hsv = C.to_hsv(img)
    h, sat = hsv[..., 0], hsv[..., 1]
    delta = ((p["target"] - h + 180.0) % 360.0) - 180.0
    far = np.abs(delta) / 180.0
    k = np.full(h.shape, p["strength"] / 100.0, np.float32)
    if p["skin"]:
        skin = C.hue_weight(h, 25.0, 25.0) * C.smoothstep(0.1, 0.3, sat) * (1 - C.smoothstep(0.7, 0.9, sat))
        k = k * (1.0 - 0.75 * skin)
    # 1) Los tonos cercanos (< 90°) se desplazan hacia el dominante.
    near = 1.0 - C.smoothstep(0.35, 0.55, far)
    hsv[..., 0] = (h + np.clip(delta, -60.0, 60.0) * k * near) % 360.0
    hsv[..., 1] = np.clip(sat * (1.0 - p["desaturate"] / 100.0 * far * 1.2), 0, 1)
    out = C.from_hsv(hsv)
    # 2) Los tonos lejanos no se giran (pasarían por colores intermedios: un cielo azul
    #    se volvería verde); se apagan y se tiñen del tono dominante.
    l = C.luminance(img)
    tint = C.hue_color(p["target"], 1.0, 1.0)
    tint = tint - float(tint @ C.LUMA)
    colorized = C.clip_preserve(l[..., None] + tint * (sat * 0.35 + 0.05)[..., None])
    w = (k * C.smoothstep(0.3, 0.7, far))[..., None]
    return out + (colorized - out) * w


FLARE_COLORS = {"blue": ("Azul", "#5aa0ff"), "amber": ("Ámbar", "#ffb060"),
                "neutral": ("Neutro", "#f0f0f0"), "red": ("Rojo", "#ff6050")}


@register("anamorphic_flare", "Destello anamórfico", ["cine", "chroma", "analog"], [
    rng("intensity", "Intensidad", 0, 100, 40),
    rng("threshold", "Umbral de luces", 40, 98, 80),
    rng("length", "Longitud", 5, 100, 35, unit="%"),
    sel("color", "Color", [(k, v[0]) for k, v in FLARE_COLORS.items()], "blue"),
], "Rayas horizontales que salen de las luces intensas, como con objetivos anamórficos.")
def anamorphic_flare(img, p, ctx):
    h, w = img.shape[:2]
    l = C.luminance(img)
    t = p["threshold"] / 100.0
    src = (C.smoothstep(t - 0.05, t + 0.05, l) * l).astype(np.float32)
    f = max(1, int(round(max(h, w) / 480.0)))
    small = cv2.resize(src, (max(1, w // f), max(1, h // f)), interpolation=cv2.INTER_AREA)
    L = max(2.0, p["length"] / 100.0 * small.shape[1] * 0.25)
    streak = cv2.GaussianBlur(small, (0, 0), sigmaX=L, sigmaY=0.6) * 0.7 + \
        cv2.GaussianBlur(small, (0, 0), sigmaX=L * 0.25, sigmaY=0.8) * 0.5
    streak = cv2.resize(streak, (w, h), interpolation=cv2.INTER_LINEAR)
    streak = streak / max(float(streak.max()), 1e-4) if streak.max() > 0 else streak
    col = C.hex_color(FLARE_COLORS[p["color"]][1])
    layer = np.clip(streak[..., None] * col * p["intensity"] / 100.0 * 1.4, 0, 1)
    return 1.0 - (1.0 - img) * (1.0 - layer)


RATIOS = [("2.76", "2.76:1 (Ultra Panavision 70)"), ("2.39", "2.39:1 (anamórfico)"), ("2.00", "2.00:1"),
          ("1.90", "1.90:1 (IMAX digital)"), ("1.85", "1.85:1"), ("1.66", "1.66:1 (VistaVision europeo)"),
          ("1.43", "1.43:1 (IMAX 70 mm)")]


@register("letterbox", "Formato de pantalla", ["cine"], [
    sel("ratio", "Proporción", RATIOS, "2.39"),
    rng("opacity", "Opacidad de las bandas", 0, 100, 100),
], "Añade bandas negras para ver la foto en una proporción de cine (no cambia el tamaño del documento).")
def letterbox(img, p, ctx):
    r = float(p["ratio"])
    a = ctx.aspect
    u, v = ctx.grid()
    if a < r:              # la foto es más alta: bandas arriba y abajo
        frac = (1.0 - a / r) / 2.0
        m = (v < frac) | (v > 1.0 - frac)
    else:                  # la foto es más ancha: bandas laterales
        frac = (1.0 - r / a) / 2.0
        m = (u < frac) | (u > 1.0 - frac)
    k = (m.astype(np.float32) * p["opacity"] / 100.0)[..., None]
    return img * (1.0 - k)
