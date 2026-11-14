"""ENTERGALACTIC Plata: blanco y negro con estética de fotografía química."""
import numpy as np

from . import core as C
from .registry import register, rng, sel, chk

# Sensibilidad espectral aproximada (R, G, B), curva característica y grano sugerido.
FILMS = {
    "neutral":   ("Neutra (digital)",            (0.30, 0.59, 0.11), 0.00, 0.00),
    "pan100":    ("Pancromática 100 (fina)",      (0.34, 0.50, 0.16), 0.15, 0.02),
    "classic400": ("Clásica 400 (granulada)",     (0.36, 0.46, 0.18), 0.30, 0.05),
    "high3200":  ("Alta sensibilidad 3200",       (0.38, 0.44, 0.18), 0.40, 0.04),
    "ortho":     ("Ortocromática (antigua)",      (0.02, 0.55, 0.43), 0.25, -0.03),
    "infrared":  ("Infrarroja B/N",               (1.05, 0.25, -0.30), 0.35, 0.06),
    "portrait":  ("Retrato suave",                (0.42, 0.45, 0.13), 0.05, 0.04),
    "document":  ("Documental de alto contraste", (0.32, 0.52, 0.16), 0.60, -0.02),
}

COLOR_FILTERS = {
    "none":   ("Sin filtro", (1.0, 1.0, 1.0)),
    "red":    ("Rojo (cielos dramáticos)", (2.2, 0.45, 0.15)),
    "orange": ("Naranja", (1.7, 0.8, 0.2)),
    "yellow": ("Amarillo (clásico paisaje)", (1.3, 1.1, 0.4)),
    "green":  ("Verde (follaje y piel)", (0.6, 1.6, 0.6)),
    "blue":   ("Azul (niebla, atmósfera)", (0.5, 0.8, 2.0)),
}


@register("bw_convert", "Conversión a blanco y negro", ["plata"], [
    sel("film", "Película", [(k, v[0]) for k, v in FILMS.items()], "classic400"),
    sel("filter", "Filtro de color", [(k, v[0]) for k, v in COLOR_FILTERS.items()], "none"),
    rng("brightness", "Luminosidad", -100, 100, 0),
    rng("contrast", "Contraste", -100, 100, 0),
    rng("structure", "Estructura (textura)", -100, 100, 20),
    rng("whites", "Amplificar blancos", 0, 100, 0),
    rng("blacks", "Negros profundos", 0, 100, 15),
], "Convierte con la respuesta espectral de una película y un filtro de color delante del objetivo.")
def bw_convert(img, p, ctx):
    _, weights, film_contrast, film_shoulder = FILMS[p["film"]]
    fw = np.array(COLOR_FILTERS[p["filter"]][1], np.float32)
    w = np.array(weights, np.float32) * fw
    w = w / max(w.sum(), 1e-3)
    l = np.clip(img @ w, 0, 1)
    b = p["brightness"] / 100.0
    if b:
        l = np.power(l, 1.0 / (1.0 + 0.8 * b) if b > 0 else 1.0 - 0.8 * b)
    l = C.s_curve(l, film_contrast * 0.6 + p["contrast"] / 100.0 * 0.8)
    if film_shoulder:
        l = l + film_shoulder * np.sin(np.pi * l) * 0.5
    if p["structure"]:
        s = p["structure"] / 100.0
        d = (l - C.blur(l, ctx.px(4))) + 0.7 * (l - C.blur(l, ctx.px(15)))
        mid = np.clip(1.0 - np.abs(l - 0.5) * 1.6, 0.15, 1.0)
        l = l + d * s * 1.4 * mid
    if p["whites"]:
        hw = C.smoothstep(0.55, 1.0, l)
        l = l + hw * (1 - l) * p["whites"] / 100.0 * 0.7
    if p["blacks"]:
        sw = 1.0 - C.smoothstep(0.0, 0.45, l)
        l = l - sw * l * p["blacks"] / 100.0 * 0.8
    l = np.clip(l, 0, 1)
    return np.repeat(l[..., None], 3, axis=2)


@register("bw_zones", "Zonas: luces, medios, sombras", ["plata"], [
    rng("highlights", "Luces", -100, 100, 0),
    rng("midtones", "Medios tonos", -100, 100, 0),
    rng("shadows", "Sombras", -100, 100, 0),
    rng("hl_structure", "Estructura en luces", -100, 100, 0),
    rng("sh_structure", "Estructura en sombras", -100, 100, 0),
], "Control independiente de cada zona tonal, como en el sistema de zonas.")
def bw_zones(img, p, ctx):
    l = C.luminance(img)
    sh = 1.0 - C.smoothstep(0.0, 0.4, l)
    hi = C.smoothstep(0.6, 1.0, l)
    md = np.clip(1.0 - np.abs(l - 0.5) * 2.2, 0, 1)
    nl = l + (p["shadows"] * sh + p["midtones"] * md + p["highlights"] * hi) / 100.0 * 0.25
    d = l - C.blur(l, ctx.px(6))
    nl = nl + d * (p["hl_structure"] * hi + p["sh_structure"] * sh) / 100.0 * 1.5
    return C.set_luminance(img, np.clip(nl, 0, 1))


@register("grain", "Grano de película", ["plata", "analog", "chroma"], [
    rng("amount", "Cantidad", 0, 100, 35),
    rng("size", "Tamaño", 0.5, 6, 1.4, step=0.1, unit="px"),
    rng("roughness", "Rugosidad", 0, 100, 50),
    sel("response", "Respuesta", [("film", "Película (más en medios tonos)"), ("uniform", "Uniforme"),
                                  ("shadows", "Más en sombras (forzado)")], "film"),
    chk("color", "Grano de color", False),
], "Grano fotográfico orgánico que depende de la luminosidad, no ruido digital uniforme.")
def grain(img, p, ctx):
    h, w = img.shape[:2]
    rg = ctx.rng(17)
    size = ctx.px(p["size"])
    ch = 3 if p["color"] else 1
    n = rg.standard_normal((h, w, ch)).astype(np.float32)
    n = C.blur(n, size * 0.6)
    if p["roughness"]:
        n2 = C.blur(rg.standard_normal((h, w, ch)).astype(np.float32), size * 2.0)
        n = n + n2 * (p["roughness"] / 100.0) * 1.5
    if n.ndim == 2:
        n = n[..., None]
    n = n / (n.std() + 1e-6)
    l = C.luminance(img)[..., None]
    if p["response"] == "film":
        resp = 0.35 + 0.65 * np.clip(np.sin(np.pi * np.clip(l, 0, 1)), 0, 1) ** 0.8
    elif p["response"] == "shadows":
        resp = 1.1 - 0.8 * l
    else:
        resp = np.ones_like(l)
    amt = p["amount"] / 100.0 * 0.11
    return np.clip(img + n * resp * amt, 0, 1)


TONINGS = {
    "selenium": ("Selenio", [(0, "#120f14"), (0.45, "#5a4c55"), (1, "#f4f1ee")]),
    "sepia":    ("Sepia", [(0, "#1e1309"), (0.5, "#8b6a45"), (1, "#f6ecd8")]),
    "cyanotype": ("Cianotipia", [(0, "#071a33"), (0.5, "#2f5f8c"), (1, "#e6eef4")]),
    "gold":     ("Oro (azul frío)", [(0, "#0d1118"), (0.5, "#5e6a78"), (1, "#f1f2f2")]),
    "platinum": ("Platino / paladio", [(0, "#1a1410"), (0.5, "#7d6c5d"), (1, "#f3ede4")]),
    "copper":   ("Cobre", [(0, "#1c0c08"), (0.5, "#8f4f36"), (1, "#f7e6da")]),
    "split":    ("Partido: selenio y sepia", [(0, "#14101a"), (0.35, "#4a4250"), (0.65, "#a28a69"), (1, "#f6efe2")]),
}


@register("toning", "Virado", ["plata", "analog"], [
    sel("type", "Virado", [(k, v[0]) for k, v in TONINGS.items()], "selenium"),
    rng("strength", "Intensidad", 0, 100, 50),
    chk("paper_white", "Conservar blanco del papel", True),
], "Virados químicos clásicos: selenio, sepia, cianotipia, oro, platino...")
def toning(img, p, ctx):
    stops = [(s, C.hex_color(c)) for s, c in TONINGS[p["type"]][1]]
    l = C.luminance(img)
    mapped = C.gradient_map(np.clip(l, 0, 1), stops)
    mapped = C.set_luminance(mapped, l)
    k = p["strength"] / 100.0
    if p["paper_white"]:
        k = k * (1.0 - C.smoothstep(0.85, 1.0, l))[..., None]
    return img + (mapped - img) * k


@register("paper_grade", "Grado de papel", ["plata"], [
    rng("grade", "Grado (0 suave – 5 duro)", 0, 5, 2, step=0.5),
    rng("exposure", "Exposición de ampliadora", -100, 100, 0),
], "Contraste del papel de copia: grados suaves para mucho detalle, duros para gráficos.")
def paper_grade(img, p, ctx):
    l = C.luminance(img)
    e = p["exposure"] / 100.0
    l = np.clip(l - e * 0.25 * (1 - l) * 1.5 if e > 0 else l - e * 0.25 * l, 0, 1)
    amt = (p["grade"] - 2.0) / 3.0
    nl = C.s_curve(l, amt * 0.9)
    return C.set_luminance(img, nl)


@register("burn_edges", "Quemar bordes (cuarto oscuro)", ["plata", "analog", "chroma"], [
    rng("amount", "Intensidad", 0, 100, 40),
    rng("size", "Anchura", 5, 60, 25),
    rng("top", "Arriba", 0, 100, 100), rng("bottom", "Abajo", 0, 100, 100),
    rng("left", "Izquierda", 0, 100, 100), rng("right", "Derecha", 0, 100, 100),
], "Da más exposición a los bordes de la copia, como hace un positivador en la ampliadora.")
def burn_edges(img, p, ctx):
    u, v = ctx.grid()
    s = p["size"] / 100.0
    m = np.zeros_like(u)
    m = np.maximum(m, (1 - C.smoothstep(0, s, v)) * p["top"] / 100.0)
    m = np.maximum(m, C.smoothstep(1 - s, 1, v) * p["bottom"] / 100.0)
    m = np.maximum(m, (1 - C.smoothstep(0, s / ctx.aspect, u)) * p["left"] / 100.0)
    m = np.maximum(m, C.smoothstep(1 - s / ctx.aspect, 1, u) * p["right"] / 100.0)
    k = (m * p["amount"] / 100.0)[..., None]
    burned = np.power(np.clip(img, 0, 1), 1.0 + 1.8 * k)
    return burned


@register("dodge_center", "Aclarar centro (tapado)", ["plata", "chroma"], [
    rng("amount", "Intensidad", 0, 100, 30),
    rng("x", "Centro horizontal", 0, 100, 50),
    rng("y", "Centro vertical", 0, 100, 45),
    rng("size", "Tamaño", 5, 100, 40),
], "Retiene luz sobre el motivo principal para aclararlo sutilmente.")
def dodge_center(img, p, ctx):
    u, v = ctx.grid()
    dx = (u - p["x"] / 100.0) * ctx.aspect
    dy = v - p["y"] / 100.0
    d = np.sqrt(dx * dx + dy * dy) / max(p["size"] / 100.0, 0.05)
    m = np.exp(-d * d * 1.5)[..., None] * p["amount"] / 100.0
    return np.power(np.clip(img, 0, 1), 1.0 / (1.0 + 0.8 * m))


@register("lith_print", "Copia lith", ["plata"], [
    rng("strength", "Intensidad", 0, 100, 70),
    rng("hardness", "Dureza de sombras", 0, 100, 60),
    rng("warmth", "Calidez de luces", 0, 100, 60),
    rng("grain", "Grano en sombras", 0, 100, 40),
], "Revelado lith: luces suaves y cálidas, sombras duras y granuladas.")
def lith_print(img, p, ctx):
    l = C.luminance(img)
    hard = p["hardness"] / 100.0
    sh = 1.0 - C.smoothstep(0.15, 0.55, l)
    nl = np.where(l < 0.5, l * (1.0 - 0.6 * hard * sh), 0.5 + (l - 0.5) * (1.0 - 0.45 * hard))
    if p["grain"]:
        n = C.blur(ctx.rng(5).standard_normal(l.shape).astype(np.float32), ctx.px(1.3))
        nl = nl + n / (n.std() + 1e-6) * sh * p["grain"] / 100.0 * 0.08
    nl = np.clip(nl, 0, 1)
    w = p["warmth"] / 100.0
    stops = [(0, np.array([0.05, 0.04, 0.04])), (0.5, np.array([0.55, 0.42, 0.35]) * (1 + 0.2 * w)),
             (1, np.array([1.0, 0.93 - 0.05 * w, 0.85 - 0.15 * w]))]
    toned = C.set_luminance(C.gradient_map(nl, stops), nl)
    return img + (toned - img) * p["strength"] / 100.0


@register("sabattier", "Solarización (Sabattier)", ["plata", "analog"], [
    rng("strength", "Intensidad", 0, 100, 50),
    rng("threshold", "Umbral", 30, 95, 65),
    chk("lines", "Líneas de Mackie", True),
], "Exposición a la luz durante el revelado: tonos parcialmente invertidos y bordes luminosos.")
def sabattier(img, p, ctx):
    l = C.luminance(img)
    t = p["threshold"] / 100.0
    inv = np.where(l > t, t - (l - t) * (t / max(1 - t, 0.05)), l)
    if p["lines"]:
        e = np.abs(l - C.blur(l, ctx.px(2)))
        inv = inv + C.smoothstep(0.01, 0.06, e) * 0.25
    nl = l + (np.clip(inv, 0, 1) - l) * p["strength"] / 100.0
    return C.set_luminance(img, nl)
