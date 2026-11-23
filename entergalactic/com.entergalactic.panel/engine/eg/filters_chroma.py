"""ENTERGALACTIC Chroma: color cinematográfico, contraste, luz, filtros fotográficos y atmósferas."""
import numpy as np

from . import core as C
from .registry import register, rng, hue, sel, chk

ALL_LOOK = ["chroma", "plata", "analog"]


# --------------------------------------------------------------------------- contraste y tono
@register("tonal_contrast", "Contraste tonal", ["chroma", "plata"], [
    rng("strength", "Intensidad", 0, 100, 40),
    rng("radius", "Radio", 5, 200, 40, unit="px"),
    rng("fine", "Detalle fino", 0, 100, 30),
    rng("saturation", "Saturación", -100, 100, 0),
], "Contraste local en medios tonos: da volumen sin quemar luces ni sombras.")
def tonal_contrast(img, p, ctx):
    l = C.luminance(img)
    big = l - C.blur(l, ctx.px(p["radius"]))
    small = l - C.blur(l, ctx.px(max(1.5, p["radius"] / 10.0)))
    mid = 1.0 - np.abs(l - 0.5) * 1.4
    k = p["strength"] / 100.0
    nl = l + (k * 1.6 * big + (p["fine"] / 100.0) * 1.2 * small) * np.clip(mid, 0.2, 1.0)
    out = C.set_luminance(img, np.clip(nl, 0, 1))
    return C.saturate(out, 1.0 + p["saturation"] / 100.0)


@register("brilliance", "Brillo / Calidez", ["chroma", "analog"], [
    rng("brightness", "Brillo", -100, 100, 0),
    rng("contrast", "Contraste", -100, 100, 0),
    rng("saturation", "Saturación", -100, 100, 15),
    rng("vibrance", "Intensidad de color", -100, 100, 0),
    rng("warmth", "Calidez", -100, 100, 0),
], "Ajustes básicos de luz y color, con intensidad que protege los tonos ya saturados.")
def brilliance(img, p, ctx):
    out = img
    b = p["brightness"] / 100.0
    if b:
        g = 1.0 / (1.0 + b * 0.8) if b > 0 else 1.0 - b * 0.8
        out = np.power(np.clip(out, 0, 1), g)
    if p["contrast"]:
        out = C.s_curve(out, p["contrast"] / 100.0)
    w = p["warmth"] / 100.0
    if w:
        out = C.set_luminance(out * np.array([1 + 0.12 * w, 1 + 0.02 * w, 1 - 0.14 * w], np.float32), C.luminance(out))
    out = C.saturate(out, 1.0 + p["saturation"] / 100.0)
    v = p["vibrance"] / 100.0
    if v:
        sat = C.to_hsv(out)[..., 1]
        l = C.luminance(out)[..., None]
        out = C.clip_preserve(l + (out - l) * (1.0 + v * (1.0 - sat))[..., None])
    return out


@register("pro_contrast", "Contraste profesional", ["chroma"], [
    rng("cast", "Corregir dominante", 0, 100, 50),
    rng("contrast", "Contraste", 0, 100, 30),
    rng("dynamic", "Contraste dinámico", 0, 100, 30),
], "Neutraliza dominantes de color y ajusta el contraste automáticamente.")
def pro_contrast(img, p, ctx):
    out = img
    if p["cast"]:
        l = C.luminance(img)
        m = (l > 0.15) & (l < 0.9)
        if m.sum() > 100:
            avg = img[m].mean(axis=0)
            gain = avg.mean() / np.maximum(avg, 1e-3)
            gain = 1.0 + (gain - 1.0) * p["cast"] / 100.0
            out = C.set_luminance(np.clip(out * gain, 0, 1.5), l)
    if p["contrast"]:
        l = C.luminance(out)
        lo, hi = np.percentile(l, [0.5, 99.5])
        t = p["contrast"] / 100.0
        lo, hi = lo * t, 1.0 - (1.0 - hi) * t
        out = np.clip((out - lo) / max(hi - lo, 0.05), 0, 1)
    if p["dynamic"]:
        out = tonal_contrast(out, {"strength": p["dynamic"] * 0.6, "radius": 60, "fine": 10, "saturation": 0}, ctx)
    return out


@register("shadows_highlights", "Sombras / Luces", ["chroma", "plata"], [
    rng("shadows", "Recuperar sombras", 0, 100, 40),
    rng("highlights", "Recuperar luces", 0, 100, 30),
    rng("radius", "Radio", 5, 150, 30, unit="px"),
    rng("color", "Corrección de color", -100, 100, 0),
], "Aclara sombras y recupera luces usando el entorno de cada píxel (sin halos duros).")
def shadows_highlights(img, p, ctx):
    l = C.luminance(img)
    base = C.blur(l, ctx.px(p["radius"]))
    sm = (1.0 - C.smoothstep(0.0, 0.55, base)) * (p["shadows"] / 100.0)
    hm = C.smoothstep(0.45, 1.0, base) * (p["highlights"] / 100.0)
    nl = l + sm * 0.65 * (np.sqrt(np.clip(l, 0, 1)) - l) * 2.0
    nl = np.clip(nl, 0, 1)
    nl = nl - hm * 0.6 * (nl - nl ** 2.2)
    out = C.set_luminance(img, np.clip(nl, 0, 1))
    if p["color"]:
        out = C.saturate(out, 1.0 + p["color"] / 100.0 * 0.5 * np.maximum(sm, hm).mean())
    return out


@register("curves", "Niveles y curva", ALL_LOOK + ["clean"], [
    rng("black", "Punto negro", 0, 50, 0),
    rng("white", "Punto blanco", 50, 100, 100),
    rng("gamma", "Medios tonos", -100, 100, 0),
    rng("contrast", "Curva en S", -100, 100, 0),
    rng("fade", "Negros desvaídos", 0, 100, 0),
], "Niveles clásicos: puntos negro/blanco, gamma, curva en S y negros mate.")
def curves(img, p, ctx):
    lo, hi = p["black"] / 100.0, p["white"] / 100.0
    out = np.clip((img - lo) / max(hi - lo, 0.02), 0, 1)
    if p["gamma"]:
        out = np.power(out, 1.0 / (1.0 + p["gamma"] / 100.0 * 0.7) if p["gamma"] > 0 else 1.0 - p["gamma"] / 100.0 * 0.7)
    out = C.s_curve(out, p["contrast"] / 100.0)
    if p["fade"]:
        f = p["fade"] / 100.0 * 0.25
        out = f + out * (1.0 - f)
    return out


@register("dramatic", "Dramático", ["chroma", "plata"], [
    rng("strength", "Intensidad", 0, 100, 60),
    rng("saturation", "Saturación", -100, 100, -30),
    rng("darken", "Oscurecer bordes", 0, 100, 30),
], "Contraste local muy marcado, color contenido y bordes oscuros.")
def dramatic(img, p, ctx):
    k = p["strength"] / 100.0
    out = tonal_contrast(img, {"strength": 100 * k, "radius": 90, "fine": 60 * k, "saturation": 0}, ctx)
    out = C.s_curve(out, 0.35 * k)
    out = C.saturate(out, 1.0 + p["saturation"] / 100.0)
    if p["darken"]:
        r = ctx.radial(roundness=0.6)
        out = out * (1.0 - p["darken"] / 100.0 * 0.6 * C.smoothstep(0.4, 1.1, r))[..., None]
    return out


@register("detail_extractor", "Extractor de detalle", ["chroma", "plata", "realce"], [
    rng("amount", "Cantidad", 0, 100, 50),
    rng("size", "Tamaño del detalle", 1, 30, 6, unit="px"),
    rng("protect", "Proteger cielos lisos", 0, 100, 50),
], "Resalta texturas en varias escalas (piedra, madera, piel curtida).")
def detail_extractor(img, p, ctx):
    l = C.luminance(img)
    r = ctx.px(p["size"])
    d = (l - C.blur(l, r)) + 0.6 * (l - C.blur(l, r * 3)) + 0.3 * (l - C.blur(l, r * 8))
    act = C.blur(np.abs(l - C.blur(l, r)), r * 2)
    prot = p["protect"] / 100.0
    gate = C.smoothstep(0.0, 0.02 + 0.03 * prot, act) if prot else 1.0
    nl = l + np.tanh(d * 4.0) * 0.25 * (p["amount"] / 100.0) * 2.0 * gate
    return C.set_luminance(img, np.clip(nl, 0, 1))


# --------------------------------------------------------------------------- luz
@register("glow", "Resplandor", ["chroma", "analog"], [
    rng("amount", "Intensidad", 0, 100, 40),
    rng("radius", "Difusión", 2, 200, 30, unit="px"),
    rng("threshold", "Umbral de luces", 0, 100, 55),
    rng("warmth", "Calidez", -100, 100, 10),
    sel("style", "Estilo", [("soft", "Suave (Orton)"), ("bloom", "Bloom cinematográfico"), ("halation", "Halación (película)")], "soft"),
], "Brillo difuso alrededor de las luces: sueño, bloom de cine o halación roja de película.")
def glow(img, p, ctx):
    l = C.luminance(img)
    t = p["threshold"] / 100.0
    src = img * C.smoothstep(t - 0.15, t + 0.15, l)[..., None]
    if p["style"] == "soft":
        src = img * (0.3 + 0.7 * C.smoothstep(t - 0.3, t + 0.2, l))[..., None]
    r = ctx.px(p["radius"])
    g = C.blur(src, r) * 0.6 + C.blur(src, r * 3) * 0.4
    w = p["warmth"] / 100.0
    tint = np.array([1 + 0.25 * w, 1 + 0.05 * w, 1 - 0.3 * w], np.float32)
    if p["style"] == "halation":
        tint = np.array([1.0, 0.35, 0.15], np.float32)
    g = g * tint
    a = p["amount"] / 100.0
    if p["style"] == "soft":
        out = C.blend(img, np.clip(g * 1.1, 0, 1), "screen")
        out = C.s_curve(out, 0.15)
        return img + (out - img) * a
    return 1.0 - (1.0 - img) * (1.0 - np.clip(g * a * 1.5, 0, 1))


@register("light_beam", "Haz de luz", ["chroma", "analog"], [
    rng("x", "Posición horizontal", 0, 100, 75),
    rng("y", "Posición vertical", 0, 100, 20),
    rng("size", "Tamaño", 5, 150, 60),
    rng("intensity", "Intensidad", 0, 100, 50),
    rng("warmth", "Calidez", -100, 100, 60),
    sel("type", "Tipo", [("sun", "Sol"), ("spot", "Foco"), ("rays", "Rayos")], "sun"),
], "Añade una fuente de luz: sol cálido, foco de estudio o rayos que atraviesan la escena.")
def light_beam(img, p, ctx):
    u, v = ctx.grid()
    cx, cy = p["x"] / 100.0, p["y"] / 100.0
    a = ctx.aspect
    dx, dy = (u - cx) * a, (v - cy)
    d = np.sqrt(dx * dx + dy * dy) / (p["size"] / 100.0)
    light = np.exp(-d * d * 2.0)
    if p["type"] == "spot":
        light = 1.0 - C.smoothstep(0.6, 1.0, d)
    elif p["type"] == "rays":
        ang = np.arctan2(dy, dx)
        rays = 0.5 + 0.5 * np.sin(ang * 14.0 + np.sin(ang * 5.0) * 2.0)
        light = np.exp(-d * 0.9) * (0.35 + 0.65 * rays ** 3)
    w = p["warmth"] / 100.0
    white = np.ones(3, np.float32)
    target = np.array([1.0, 0.8, 0.5], np.float32) if w >= 0 else np.array([0.7, 0.85, 1.0], np.float32)
    col = white + (target - white) * abs(w)
    k = p["intensity"] / 100.0
    lit = 1.0 - (1.0 - img) * (1.0 - np.clip(light[..., None] * col * k * 0.9, 0, 1))
    return C.blend(lit, np.clip(0.5 + light[..., None] * col * k * 0.3, 0, 1), "soft_light")


@register("sunlight", "Luz cálida dorada", ["chroma"], [
    rng("strength", "Intensidad", 0, 100, 50),
    rng("temperature", "Temperatura", 0, 100, 60),
    rng("lift", "Luminosidad", -50, 50, 10),
], "Simula la luz de la hora dorada: luces cálidas, sombras ligeramente frías.")
def sunlight(img, p, ctx):
    k = p["strength"] / 100.0
    t = p["temperature"] / 100.0
    l = C.luminance(img)
    hi = C.smoothstep(0.3, 1.0, l)[..., None]
    warm = img * np.array([1 + 0.25 * t, 1 + 0.08 * t, 1 - 0.3 * t], np.float32)
    cool = img * np.array([1 - 0.05 * t, 1.0, 1 + 0.08 * t], np.float32)
    out = cool * (1 - hi) + warm * hi
    out = np.power(np.clip(out, 0, 1), 1.0 / (1.0 + p["lift"] / 100.0))
    return img + (C.clip_preserve(out) - img) * k


# --------------------------------------------------------------------------- filtros fotográficos
PHOTO_FILTERS = {
    "warm_81a": ("Cálido 81A", "#f4c58a"), "warm_85": ("Cálido 85 (ámbar)", "#e89b44"),
    "cool_80a": ("Frío 80A (azul)", "#5d8fe0"), "cool_82": ("Frío 82 (azul suave)", "#9cbbe8"),
    "sepia": ("Sepia", "#a9773f"), "green": ("Verde", "#6fa85a"), "red": ("Rojo", "#d9473c"),
    "magenta": ("Magenta", "#c25bb0"), "underwater": ("Subacuático", "#2fa7a1"),
}


@register("photo_filter", "Filtro fotográfico", ["chroma", "analog"], [
    sel("type", "Filtro", [(k, v[0]) for k, v in PHOTO_FILTERS.items()], "warm_81a"),
    rng("density", "Densidad", 0, 100, 35),
    chk("preserve", "Conservar luminosidad", True),
], "Filtros de color de objetivo: cálidos, fríos y de efecto.")
def photo_filter(img, p, ctx):
    col = C.hex_color(PHOTO_FILTERS[p["type"]][1])
    d = p["density"] / 100.0
    f = 1.0 - d + d * col
    out = img * f
    if p["preserve"]:
        out = C.set_luminance(out, C.luminance(img))
    return out


@register("polarizer", "Polarizador", ["chroma"], [
    rng("strength", "Intensidad", 0, 100, 60),
    rng("rotation", "Rotación (tono del cielo)", -30, 30, 0),
    rng("reflections", "Reducir reflejos", 0, 100, 30),
], "Cielos azules profundos, nubes que destacan y menos reflejos.")
def polarizer(img, p, ctx):
    k = p["strength"] / 100.0
    hsv = C.to_hsv(img)
    w = C.hue_weight(hsv[..., 0], 215.0 + p["rotation"], 45.0) * C.smoothstep(0.05, 0.3, hsv[..., 1])
    w = w * k
    hsv[..., 1] = np.clip(hsv[..., 1] * (1 + 0.6 * w), 0, 1)
    hsv[..., 2] = hsv[..., 2] * (1 - 0.35 * w)
    out = C.from_hsv(hsv)
    if p["reflections"]:
        l = C.luminance(out)
        spec = C.smoothstep(0.8, 1.0, l) * (1.0 - hsv[..., 1])
        out = out * (1.0 - 0.25 * spec * p["reflections"] / 100.0)[..., None]
    return C.saturate(out, 1.0 + 0.15 * k)


GRAD_COLORS = {
    "nd": ("Neutro (ND)", "#808080"), "blue": ("Azul", "#3f6fd8"), "orange": ("Naranja", "#e8873a"),
    "tobacco": ("Tabaco", "#8a6236"), "magenta": ("Magenta", "#b94a9d"), "sunset": ("Atardecer", "#e85b3a"),
    "teal": ("Verde azulado", "#2f8f94"),
}


@register("graduated", "Filtro degradado", ["chroma", "plata", "analog"], [
    sel("color", "Color", [(k, v[0]) for k, v in GRAD_COLORS.items()], "nd"),
    rng("density", "Densidad", 0, 100, 50),
    rng("position", "Posición", 0, 100, 45),
    rng("softness", "Suavidad", 0, 100, 50),
    rng("angle", "Ángulo", -90, 90, 0, unit="°"),
    chk("invert", "Desde abajo", False),
], "Oscurece o tiñe el cielo como un filtro degradado de cristal.")
def graduated(img, p, ctx):
    u, v = ctx.grid()
    a = np.deg2rad(p["angle"])
    t = (v - 0.5) * np.cos(a) - (u - 0.5) * np.sin(a) * ctx.aspect + 0.5
    if p["invert"]:
        t = 1.0 - t
    pos = p["position"] / 100.0
    s = 0.02 + p["softness"] / 100.0 * 0.5
    m = (1.0 - C.smoothstep(pos - s, pos + s, t)) * (p["density"] / 100.0)
    col = C.hex_color(GRAD_COLORS[p["color"]][1])
    if p["color"] == "nd":
        return img * (1.0 - 0.75 * m)[..., None]
    tinted = img * (0.35 + 0.65 * col / max(col.max(), 1e-3)) * 1.1
    return img + (np.clip(tinted, 0, 1) - img) * m[..., None]


# --------------------------------------------------------------------------- color cinematográfico
@register("cinematic", "Cine (sombras / luces)", ["chroma"], [
    hue("shadow_hue", "Tono de sombras", 190),
    hue("highlight_hue", "Tono de luces", 32),
    rng("strength", "Intensidad", 0, 100, 50),
    rng("balance", "Equilibrio", -100, 100, 0),
    chk("skin", "Proteger piel", True),
    rng("contrast", "Contraste de cine", 0, 100, 25),
], "Gradación de color de película: el clásico verde azulado y naranja o cualquier pareja de tonos.")
def cinematic(img, p, ctx):
    l = C.luminance(img)
    b = p["balance"] / 100.0
    sh = (1.0 - C.smoothstep(0.0, 0.55 + 0.25 * b, l))[..., None]
    hi = C.smoothstep(0.35 + 0.25 * b, 1.0, l)[..., None]
    cs = C.hue_color(p["shadow_hue"], 0.7, 1.0)
    ch = C.hue_color(p["highlight_hue"], 0.6, 1.0)
    k = p["strength"] / 100.0
    tint = 0.5 + (cs - 0.5) * sh * 0.6 + (ch - 0.5) * hi * 0.5
    out = C.blend(img, np.clip(tint, 0, 1), "soft_light")
    out = img + (out - img) * k * 1.4
    if p["skin"]:
        hsv = C.to_hsv(img)
        skin = C.hue_weight(hsv[..., 0], 25.0, 25.0) * C.smoothstep(0.1, 0.3, hsv[..., 1]) * (1 - C.smoothstep(0.75, 0.95, hsv[..., 1]))
        out = out + (img - out) * (skin * 0.7)[..., None]
    out = C.set_luminance(out, l)
    return C.s_curve(out, p["contrast"] / 100.0 * 0.6)


@register("split_tone", "Virado partido", ["chroma", "plata", "analog"], [
    hue("shadow_hue", "Tono de sombras", 220),
    rng("shadow_sat", "Saturación sombras", 0, 100, 30),
    hue("highlight_hue", "Tono de luces", 45),
    rng("highlight_sat", "Saturación luces", 0, 100, 25),
    rng("balance", "Equilibrio", -100, 100, 0),
], "Tiñe sombras y luces con colores distintos conservando la luminosidad.")
def split_tone(img, p, ctx):
    l = C.luminance(img)
    pivot = 0.5 + p["balance"] / 200.0
    w = C.smoothstep(pivot - 0.3, pivot + 0.3, l)[..., None]
    cs = C.hue_color(p["shadow_hue"]) - 0.5
    ch = C.hue_color(p["highlight_hue"]) - 0.5
    off = cs * (1 - w) * p["shadow_sat"] / 100.0 * 0.35 + ch * w * p["highlight_sat"] / 100.0 * 0.35
    return C.set_luminance(img + off, l)


@register("bleach_bypass", "Blanqueo parcial (bleach bypass)", ["chroma", "analog"], [
    rng("strength", "Intensidad", 0, 100, 60),
    rng("contrast", "Contraste", 0, 100, 50),
    rng("saturation", "Color restante", 0, 100, 40),
], "Plata retenida en el revelado: alto contraste, colores apagados y aspecto metálico.")
def bleach_bypass(img, p, ctx):
    l = C.luminance(img)[..., None]
    gray = np.repeat(l, 3, axis=2)
    ov = C.blend(img, gray, "overlay")
    ov = C.s_curve(ov, p["contrast"] / 100.0 * 0.6)
    ov = C.saturate(ov, p["saturation"] / 100.0)
    return img + (ov - img) * p["strength"] / 100.0


@register("cross_process", "Proceso cruzado", ["chroma", "analog"], [
    sel("type", "Tipo", [("yg", "Diapositiva en C-41 (amarillo/verde)"), ("bm", "Negativo en E-6 (azul/magenta)"),
                         ("cyan", "Cian lavado")], "yg"),
    rng("strength", "Intensidad", 0, 100, 60),
], "Revelar película con el químico equivocado: colores inesperados y contraste alto.")
def cross_process(img, p, ctx):
    x = np.clip(img, 0, 1)
    out = np.empty_like(x)
    if p["type"] == "yg":
        out[..., 0] = C.curve(x[..., 0], [0, .25, .5, .75, 1], [0, .18, .52, .85, 1])
        out[..., 1] = C.curve(x[..., 1], [0, .25, .5, .75, 1], [0, .22, .58, .88, 1])
        out[..., 2] = C.curve(x[..., 2], [0, .5, 1], [.18, .45, .7])
    elif p["type"] == "bm":
        out[..., 0] = C.curve(x[..., 0], [0, .5, 1], [.08, .5, .92])
        out[..., 1] = C.curve(x[..., 1], [0, .5, 1], [0, .44, .9])
        out[..., 2] = C.curve(x[..., 2], [0, .5, 1], [.2, .62, .95])
    else:
        out[..., 0] = C.curve(x[..., 0], [0, .5, 1], [.05, .45, .95])
        out[..., 1] = C.curve(x[..., 1], [0, .5, 1], [.1, .55, 1])
        out[..., 2] = C.curve(x[..., 2], [0, .5, 1], [.2, .58, .95])
    return img + (out - img) * p["strength"] / 100.0


@register("selective_hsl", "Tonos específicos (HSL)", ["chroma", "analog"], [
    hue("target", "Color a modificar", 30),
    rng("range", "Amplitud", 10, 120, 35, unit="°"),
    rng("hue_shift", "Cambiar tono", -90, 90, 0, unit="°"),
    rng("saturation", "Saturación", -100, 100, 0),
    rng("lightness", "Luminosidad", -100, 100, 0),
], "Modifica un solo color: cielos más azules, verdes más naturales, piel más uniforme...")
def selective_hsl(img, p, ctx):
    hsv = C.to_hsv(img)
    w = C.hue_weight(hsv[..., 0], p["target"], p["range"]) * C.smoothstep(0.03, 0.2, hsv[..., 1])
    hsv[..., 0] = (hsv[..., 0] + p["hue_shift"] * w) % 360.0
    s = p["saturation"] / 100.0
    hsv[..., 1] = np.clip(hsv[..., 1] * (1 + s * w), 0, 1)
    out = C.from_hsv(hsv)
    li = p["lightness"] / 100.0
    if li:
        l = C.luminance(out)
        nl = l + w * li * (np.where(li > 0, 1 - l, l)) * 0.6
        out = C.set_luminance(out, nl)
    return out


@register("white_balance", "Balance de blancos", ["chroma", "analog", "clean"], [
    rng("temperature", "Temperatura", -100, 100, 0),
    rng("tint", "Matiz (verde/magenta)", -100, 100, 0),
], "Corrige o exagera la temperatura de color.")
def white_balance(img, p, ctx):
    t, m = p["temperature"] / 100.0, p["tint"] / 100.0
    gain = np.array([1 + 0.18 * t + 0.05 * m, 1 - 0.12 * m, 1 - 0.2 * t + 0.05 * m], np.float32)
    return C.set_luminance(img * gain, C.luminance(img))


@register("foliage", "Follaje / Otoño", ["chroma"], [
    sel("mode", "Modo", [("enhance", "Realzar verdes"), ("autumn", "Otoño dorado"), ("indian", "Verano tardío (rojizo)")], "enhance"),
    rng("strength", "Intensidad", 0, 100, 60),
], "Vegetación más viva o convertida en tonos otoñales.")
def foliage(img, p, ctx):
    hsv = C.to_hsv(img)
    w = C.hue_weight(hsv[..., 0], 95.0, 50.0) * C.smoothstep(0.05, 0.25, hsv[..., 1]) * (p["strength"] / 100.0)
    if p["mode"] == "enhance":
        hsv[..., 0] = hsv[..., 0] + (105.0 - hsv[..., 0]) * w * 0.3
        hsv[..., 1] = np.clip(hsv[..., 1] * (1 + 0.45 * w), 0, 1)
        hsv[..., 2] = np.clip(hsv[..., 2] * (1 + 0.08 * w), 0, 1)
    else:
        target = 38.0 if p["mode"] == "autumn" else 12.0
        hsv[..., 0] = (hsv[..., 0] + (target - hsv[..., 0]) * w) % 360.0
        hsv[..., 1] = np.clip(hsv[..., 1] * (1 + 0.35 * w), 0, 1)
    return C.from_hsv(hsv)


@register("atmosphere", "Atmósfera / niebla", ["chroma", "analog"], [
    rng("amount", "Cantidad", 0, 100, 40),
    sel("mood", "Ambiente", [("neutral", "Neutro"), ("warm", "Cálido"), ("cold", "Frío"), ("mystic", "Místico"),
                            ("dramatic", "Tormenta")], "neutral"),
    sel("direction", "Dirección", [("uniform", "Uniforme"), ("bottom", "Desde abajo (bruma)"), ("top", "Desde arriba"),
                                   ("depth", "Profundidad (zonas lisas)")], "uniform"),
], "Bruma, niebla o aire denso que crea profundidad y ambientes cálidos, fríos o dramáticos.")
def atmosphere(img, p, ctx):
    moods = {"neutral": "#d8d8d8", "warm": "#f0c89a", "cold": "#a9c3e0", "mystic": "#b9a6d6", "dramatic": "#59606b"}
    col = C.hex_color(moods[p["mood"]])
    a = p["amount"] / 100.0
    u, v = ctx.grid()
    if p["direction"] == "bottom":
        m = C.smoothstep(0.3, 1.0, v)
    elif p["direction"] == "top":
        m = 1.0 - C.smoothstep(0.0, 0.7, v)
    elif p["direction"] == "depth":
        l = C.luminance(img)
        act = C.blur(np.abs(l - C.blur(l, ctx.px(6))), ctx.px(25))
        m = 1.0 - C.smoothstep(0.0, 0.05, act)
    else:
        m = np.ones_like(u)
    m = (m * a * 0.65)[..., None]
    out = img * (1 - m) + col * m
    if p["mood"] == "dramatic":
        out = C.s_curve(out, 0.3 * a)
    return out


@register("pastel", "Pastel / película suave", ["chroma", "analog"], [
    rng("strength", "Intensidad", 0, 100, 50),
    rng("lift", "Levantar negros", 0, 100, 40),
    hue("tint", "Tinte", 330),
    rng("tint_amount", "Cantidad de tinte", 0, 100, 20),
], "Colores suaves, negros levantados y un tinte delicado.")
def pastel(img, p, ctx):
    k = p["strength"] / 100.0
    lift = p["lift"] / 100.0 * 0.25
    out = lift + img * (1 - lift)
    out = C.saturate(out, 1 - 0.35 * k)
    tint = C.hue_color(p["tint"], 0.35, 1.0)
    out = out + (out * tint - out) * p["tint_amount"] / 100.0 * 0.5
    out = C.s_curve(out, -0.3 * k)
    return img + (out - img) * k


@register("vignette", "Viñeta", ALL_LOOK, [
    rng("amount", "Cantidad", -100, 100, -40),
    rng("size", "Tamaño", 0, 100, 50),
    rng("roundness", "Redondez", 0, 100, 60),
    rng("softness", "Suavidad", 0, 100, 60),
    rng("x", "Centro horizontal", 0, 100, 50),
    rng("y", "Centro vertical", 0, 100, 50),
], "Oscurece (o aclara) los bordes para llevar la mirada al centro.")
def vignette(img, p, ctx):
    r = ctx.radial(p["x"] / 100.0, p["y"] / 100.0, p["roundness"] / 100.0)
    start = 0.15 + 0.7 * p["size"] / 100.0
    s = 0.05 + 0.7 * p["softness"] / 100.0
    m = C.smoothstep(start - s * 0.3, start + s, r)[..., None]
    a = p["amount"] / 100.0
    if a < 0:
        return img * (1.0 + a * 0.9 * m)
    return img + (1.0 - img) * a * 0.8 * m


@register("infrared_color", "Infrarrojo color", ["chroma", "analog"], [
    rng("strength", "Intensidad", 0, 100, 70),
    rng("foliage", "Brillo del follaje", 0, 100, 60),
], "Falso color infrarrojo: vegetación clara y cielos invertidos.")
def infrared_color(img, p, ctx):
    r, g, b = img[..., 0], img[..., 1], img[..., 2]
    hsv = C.to_hsv(img)
    leaf = C.hue_weight(hsv[..., 0], 95, 60) * C.smoothstep(0.05, 0.3, hsv[..., 1]) * p["foliage"] / 100.0
    out = np.stack([b, g * 0.9 + r * 0.1, r], axis=-1)
    out = out + leaf[..., None] * (1 - out) * 0.7
    return img + (np.clip(out, 0, 1) - img) * p["strength"] / 100.0
