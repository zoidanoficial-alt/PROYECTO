"""ENTERGALACTIC Película: perfiles de emulsión, grano cinematográfico, halación, bloom,
daños de película, respiración y compresión tonal.

Modelo de emulsión: la imagen se pasa a luz lineal, se aplica la exposición en pasos
y cada canal atraviesa una curva característica sigmoidal (pie y hombro propios)
con su equilibrio de color; después se ajusta la saturación, se giran tonos
concretos y, opcionalmente, se positiva con una copia de proyección.
"""
import numpy as np
import cv2

from . import core as C
from .registry import register, rng, sel, chk
from .film_profiles import PROFILES, PROFILE_BY_ID, FAMILIES
from . import filters_analog as FA
from . import filters_plata as FP

_FAM = dict(FAMILIES)


# --------------------------------------------------------------------------- utilidades de color
def srgb_to_lin(x):
    x = np.clip(x, 0.0, 1.0)
    return np.where(x <= 0.04045, x / 12.92, ((x + 0.055) / 1.055) ** 2.4).astype(np.float32)


def _sig(stops, k_lo, k_hi):
    k = np.where(stops < 0, k_lo, k_hi)
    return 1.0 / (1.0 + np.exp(-k * stops))


def lin_to_srgb(x):
    x = np.clip(x, 0.0, 1.0)
    return np.where(x <= 0.0031308, x * 12.92, 1.055 * np.power(x, 1 / 2.4) - 0.055).astype(np.float32)


_K_LO, _K_HI = 0.75, 1.0
_REF_X = np.exp(np.linspace(np.log(1e-5), np.log(1.0), 2048)).astype(np.float64)


def _raw_curve(lin, k_lo, k_hi, shift=0.0):
    stops = np.log2(np.maximum(lin, 1e-6) / 0.18) + shift
    return 1.0 / (1.0 + np.exp(-np.where(stops < 0, k_lo, k_hi) * stops))


_REF_Y = _raw_curve(_REF_X, _K_LO, _K_HI)       # película neutra de referencia (monótona)


def _char_curve(lin, k_lo, k_hi, black, white, shift=0.0):
    """Curva característica relativa a una película neutra.

    Se calcula la respuesta de la emulsión y se pasa por la inversa de la respuesta
    neutra: una película con contraste, pie y hombro = 1 deja la imagen igual, y cada
    perfil sólo aporta su diferencia (más contraste, hombro más suave, dominante...).
    Devuelve valores sRGB en [black, white].
    """
    y = _raw_curve(lin, k_lo, k_hi, shift)
    # El hombro curva la llegada al blanco pero el blanco sigue siendo blanco:
    # se reescala la mitad alta para que la entrada 1,0 caiga donde cae en la neutra.
    y1, r1 = float(_raw_curve(1.0, k_lo, k_hi)), float(_REF_Y[-1])
    if abs(y1 - 0.5) > 1e-6:
        y = np.where(y > 0.5, 0.5 + (y - 0.5) * (r1 - 0.5) / (y1 - 0.5), y)
    out_lin = np.interp(y, _REF_Y, _REF_X)
    out = lin_to_srgb(out_lin)
    return (black + (white - black) * out).astype(np.float32)


def _twist(img, twists):
    if not twists:
        return img
    hsv = C.to_hsv(img)
    for center, width, shift, satmul in twists:
        w = C.hue_weight(hsv[..., 0], center, width) * C.smoothstep(0.05, 0.2, hsv[..., 1])
        hsv[..., 0] = (hsv[..., 0] + shift * w) % 360.0
        hsv[..., 1] = np.clip(hsv[..., 1] * (1.0 + (satmul - 1.0) * w), 0, 1)
    return C.from_hsv(hsv)


def _tints(img, sh, hi):
    if not any(sh) and not any(hi):
        return img
    w = C.smoothstep(0.1, 0.9, C.luminance(img))[..., None]
    return img + np.array(sh, np.float32) * (1 - w) * 3.0 + np.array(hi, np.float32) * w * 3.0


def print_stage(img, contrast=1.2, toe=1.3, black=0.0, sat=1.08, sh=(-0.02, 0.008, 0.012), hi=(0.015, 0.006, -0.012)):
    """Copia de proyección: segunda curva más contrastada con sus dominantes."""
    xs = np.linspace(0, 1, 1024, dtype=np.float32)
    lut = _char_curve(srgb_to_lin(xs), _K_LO * contrast * toe, _K_HI * contrast, black, 1.0)
    out = np.interp(np.clip(img, 0, 1), xs, lut).astype(np.float32)
    out = C.saturate(out, sat)
    return np.clip(_tints(out, sh, hi), 0, 1)


def apply_profile(img, pr, exposure=0.0, ctx=None):
    kind = pr["kind"]
    lin = srgb_to_lin(img) * (2.0 ** exposure)
    k_lo, k_hi = _K_LO * pr["contrast"] * pr["toe"], _K_HI * pr["contrast"] * pr["shoulder"]
    if kind == "bw":
        w = np.array(pr["w"], np.float32)
        w = w / max(float(w.sum()), 1e-3)
        l = np.clip(lin @ w, 0, None)
        xs = np.concatenate([[0.0], np.exp(np.linspace(np.log(1e-5), np.log(max(4.0, float(l.max()) + 1e-3)), 1023))]).astype(np.float32)
        y = np.interp(l, xs, _char_curve(xs, k_lo, k_hi, pr["black"], pr["white"])).astype(np.float32)
        if pr["tone"]:
            stops = [(s, C.hex_color(c)) for s, c in pr["tone"]]
            return np.clip(C.set_luminance(C.gradient_map(y, stops), y), 0, 1)
        return np.repeat(y[..., None], 3, axis=2)
    if kind == "tech3":
        # Separación en tres registros de tinta y recombinación con más pureza de color
        r, g, b = lin[..., 0], lin[..., 1], lin[..., 2]
        lin = np.clip(np.stack([r * 1.25 - (g + b) * 0.125, g * 1.25 - (r + b) * 0.125, b * 1.25 - (r + g) * 0.125], -1), 0, None)
    elif kind == "tech2":
        r, g, b = lin[..., 0], lin[..., 1], lin[..., 2]
        cy = (g * 0.6 + b * 0.4)
        lin = np.stack([r, cy * 1.02, cy * 0.92], -1)
    # La curva depende sólo del valor de cada canal: se tabula (rápido en fotos grandes).
    xs = np.concatenate([[0.0], np.exp(np.linspace(np.log(1e-5), np.log(max(4.0, 2.0 ** exposure)), 1023))]).astype(np.float32)
    out = np.stack([np.interp(lin[..., c], xs, _char_curve(xs, k_lo * pr["kmul"][c], k_hi * pr["kmul"][c], pr["black"],
                                                         pr["white"], shift=pr["bal"][c])).astype(np.float32)
                    for c in range(3)], axis=-1)
    out = C.saturate(out, pr["sat"])
    out = _twist(out, pr["twists"])
    out = _tints(out, pr["sh"], pr["hi"])
    if kind == "auto" and ctx is not None:
        # grano de almidón teñido: puntos de color rojo-anaranjado, verde y violeta
        rg = ctx.rng(71)
        h, w_ = out.shape[:2]
        dots = C.blur(rg.standard_normal((h, w_, 3)).astype(np.float32), ctx.px(1.6))
        dots = dots / (dots.std() + 1e-6)
        out = out * (1.0 + 0.035 * dots)
    return np.clip(out, 0, 1)


def _profile_options():
    out = []
    for fam_id, fam_name in FAMILIES:
        for p in PROFILES:
            if p["family"] == fam_id:
                out.append((p["id"], "%s · %s" % (fam_name, p["name"])))
    return out


# --------------------------------------------------------------------------- grano cinematográfico
FORMATS = {"8mm": ("Super 8", 3.2), "16mm": ("Super 16", 2.0), "35mm": ("35 mm", 1.0), "65mm": ("65 mm / IMAX", 0.5),
           "still35": ("Foto 35 mm", 1.1), "medium": ("Formato medio", 0.6)}


def cine_grain_layer(shape, ctx, amount, size, roughness, color, seed_salt=17):
    """Grano con tres capas (una por emulsión R, G, B) de tamaños distintos."""
    h, w = shape[:2]
    rg = ctx.rng(seed_salt)
    base = max(0.35, size * ctx.k)
    layers = []
    for ch, mul in enumerate((1.25, 1.0, 1.4)):
        n = rg.standard_normal((h, w)).astype(np.float32)
        n = C.blur(n, base * 0.55 * mul)
        if roughness:
            n2 = C.blur(rg.standard_normal((h, w)).astype(np.float32), base * 1.8 * mul)
            n = n + n2 * roughness * 1.2
        n = n / (n.std() + 1e-6)
        layers.append(n)
        if not color:
            break
    if not color:
        g = np.repeat(layers[0][..., None], 3, axis=2)
    else:
        mono = (layers[0] + layers[1] + layers[2]) / 3.0
        g = np.stack(layers, -1) * 0.55 + mono[..., None] * 0.45
    return g * amount


@register("cine_grain", "Grano cinematográfico", ["film"], [
    sel("format", "Formato", [(k, v[0]) for k, v in FORMATS.items()], "35mm"),
    rng("iso", "Sensibilidad (ISO)", 50, 3200, 500, step=50),
    rng("amount", "Intensidad", 0, 200, 100, unit="%"),
    rng("roughness", "Aspereza", 0, 100, 40),
    chk("color", "Grano de color (tres capas)", True),
    sel("response", "Respuesta", [("neg", "Negativo (más en sombras)"), ("print", "Copia (más en medios)"),
                                  ("even", "Uniforme")], "neg"),
], "Grano de tres capas de emulsión, con tamaño según el formato y la sensibilidad.")
def cine_grain(img, p, ctx):
    fmt_mul = FORMATS[p["format"]][1]
    iso = p["iso"]
    size = (0.7 + 0.55 * np.log2(max(iso, 25) / 50.0)) * fmt_mul
    amount = (0.035 + 0.02 * np.log2(max(iso, 25) / 50.0)) * fmt_mul ** 0.5 * p["amount"] / 100.0
    g = cine_grain_layer(img.shape, ctx, amount, size, p["roughness"] / 100.0, p["color"])
    l = C.luminance(img)[..., None]
    if p["response"] == "neg":
        resp = 0.45 + 0.55 * (1.0 - l) ** 0.7 * np.clip(l * 6, 0, 1)
    elif p["response"] == "print":
        resp = 0.3 + 0.7 * np.clip(np.sin(np.pi * np.clip(l, 0, 1)), 0, 1)
    else:
        resp = np.ones_like(l)
    return np.clip(img + g * resp, 0, 1)


# --------------------------------------------------------------------------- halación y bloom
HALO_COLORS = {"red": ("Rojo (sin capa antihalo)", (1.0, 0.25, 0.08)), "orange": ("Naranja", (1.0, 0.5, 0.15)),
               "warm": ("Cálido suave", (1.0, 0.72, 0.45)), "pink": ("Rosado", (1.0, 0.4, 0.45))}


def halation_layer(img, ctx, amount, radius, threshold, color):
    l = C.luminance(img)
    m = C.smoothstep(threshold - 0.08, threshold + 0.06, l)
    r = ctx.px(radius)
    halo = C.blur(m, r) * 0.65 + C.blur(m, r * 2.6) * 0.45
    halo = np.clip(halo - m * 0.55, 0, 1)            # sobre todo en el borde de las luces
    col = np.array(color, np.float32)
    return np.clip(halo[..., None] * col * amount, 0, 1)


@register("halation", "Halación", ["film", "optics"], [
    rng("amount", "Intensidad", 0, 100, 45),
    rng("radius", "Radio", 2, 120, 22, unit="px"),
    rng("threshold", "Umbral de luces", 40, 98, 78),
    sel("color", "Color del halo", [(k, v[0]) for k, v in HALO_COLORS.items()], "red"),
], "Halos rojizos alrededor de las luces: la luz atraviesa la emulsión y rebota en la base de la película.")
def halation(img, p, ctx):
    layer = halation_layer(img, ctx, p["amount"] / 100.0 * 1.6, p["radius"], p["threshold"] / 100.0,
                           HALO_COLORS[p["color"]][1])
    return 1.0 - (1.0 - img) * (1.0 - layer)


@register("bloom", "Bloom (difusión de luces)", ["film", "optics"], [
    rng("amount", "Intensidad", 0, 100, 40),
    rng("radius", "Difusión", 2, 200, 40, unit="px"),
    rng("threshold", "Umbral", 0, 95, 60),
    rng("warmth", "Calidez", -100, 100, 0),
    rng("contrast_loss", "Pérdida de contraste", 0, 100, 25),
], "Las luces se derraman suavemente sobre su entorno, como con lentes antiguas o filtros de difusión.")
def bloom(img, p, ctx):
    l = C.luminance(img)
    t = p["threshold"] / 100.0
    src = img * C.smoothstep(t - 0.2, t + 0.15, l)[..., None]
    r = ctx.px(p["radius"])
    b = C.blur(src, r * 0.5) * 0.35 + C.blur(src, r) * 0.4 + C.blur(src, r * 2.5) * 0.35
    w = p["warmth"] / 100.0
    b = b * np.array([1 + 0.2 * w, 1 + 0.03 * w, 1 - 0.25 * w], np.float32)
    a = p["amount"] / 100.0
    out = 1.0 - (1.0 - img) * (1.0 - np.clip(b * a * 1.2, 0, 1))
    cl = p["contrast_loss"] / 100.0 * a
    if cl:
        mean = C.blur(out, r * 3)
        out = out + (mean - out) * cl * 0.25 + cl * 0.03
    return np.clip(out, 0, 1)


# --------------------------------------------------------------------------- perfil de película
@register("film_profile", "Perfil de película", ["film"], [
    sel("profile", "Película", _profile_options(), "cine500t"),
    rng("strength", "Intensidad", 0, 100, 100),
    rng("exposure", "Exposición (forzado / subrevelado)", -3, 3, 0, step=0.1, unit="EV"),
    sel("print", "Copia de proyección", [("auto", "Según la película"), ("none", "Sin copia (escaneo del negativo)"),
                                          ("print2383", "Copia clásica (tipo 2383)"),
                                          ("print2393", "Copia premium (tipo 2393)"),
                                          ("print3513", "Copia fría (tipo 3513)")], "auto"),
    rng("grain", "Grano de la película", 0, 200, 100, unit="%"),
    rng("halation", "Halación de la película", 0, 200, 100, unit="%"),
], "Más de 60 emulsiones: negativo de cine, retrato, diapositiva, instantánea, copias de proyección, "
   "blanco y negro y procesos históricos, con su curva, color, grano y halación.")
def film_profile(img, p, ctx):
    pr = PROFILE_BY_ID[p["profile"]]
    out = apply_profile(img, pr, p["exposure"], ctx)
    pmode = p["print"]
    if pmode == "auto":
        pmode = "print2383" if pr["family"] in ("cine", "cinestill") else "none"
    if pmode != "none" and pr["kind"] not in ("bw", "print"):
        pp = PROFILE_BY_ID[pmode]
        out = print_stage(out, pp["contrast"] * 0.85, pp["toe"], 0.0, pp["sat"], pp["sh"], pp["hi"])
    hal = pr["hal"] * p["halation"] / 100.0
    if hal > 0:
        out = 1.0 - (1.0 - out) * (1.0 - halation_layer(out, ctx, hal / 100.0 * 1.6, 22, 0.78,
                                                          (0.95, 0.95, 0.95) if pr["kind"] == "bw" else (1.0, 0.25, 0.08)))
    ga, gs = pr["grain"]
    gamt = ga / 100.0 * 0.075 * p["grain"] / 100.0
    if gamt > 0:
        g = cine_grain_layer(out.shape, ctx, gamt, gs, 0.4, pr["kind"] not in ("bw",), seed_salt=23)
        l = C.luminance(out)[..., None]
        resp = 0.4 + 0.6 * np.clip(np.sin(np.pi * np.clip(l, 0, 1)), 0, 1)
        out = np.clip(out + g * resp, 0, 1)
    return img + (out - img) * p["strength"] / 100.0


# --------------------------------------------------------------------------- compresión tonal
@register("film_compression", "Compresión tonal de película", ["film"], [
    rng("highlights", "Hombro (comprimir luces)", 0, 100, 50),
    rng("shadows", "Pie (comprimir sombras)", 0, 100, 35),
    rng("midtones", "Contraste en medios", -50, 50, 10),
    rng("hl_desat", "Desaturar luces", 0, 100, 30),
    rng("sh_desat", "Desaturar sombras", 0, 100, 15),
], "Comprime luces y sombras como lo hace la película: nada se quema de golpe y los extremos pierden color con suavidad.")
def film_compression(img, p, ctx):
    l = C.luminance(img)
    h = p["highlights"] / 100.0
    s = p["shadows"] / 100.0
    knee = 0.75 - 0.3 * h
    nl = np.where(l > knee, knee + (1 - knee) * np.tanh((l - knee) / max(1 - knee, 1e-3) * (1 + h)) / np.tanh(1 + h), l)
    foot = 0.12 + 0.18 * s
    nl = np.where(nl < foot, foot * (np.clip(nl / foot, 0, 1) ** (1 + s * 0.8)), nl)
    if p["midtones"]:
        nl = C.s_curve(np.clip(nl, 0, 1), p["midtones"] / 100.0)
    out = C.set_luminance(img, np.clip(nl, 0, 1))
    hd = C.smoothstep(0.7, 1.0, nl) * p["hl_desat"] / 100.0
    sd = (1 - C.smoothstep(0.0, 0.25, nl)) * p["sh_desat"] / 100.0
    lum = C.luminance(out)[..., None]
    k = (1.0 - np.maximum(hd, sd) * 0.8)[..., None]
    return np.clip(lum + (out - lum) * k, 0, 1)


# --------------------------------------------------------------------------- respiración
@register("film_breath", "Respiración de película", ["film"], [
    rng("exposure", "Variación de exposición", 0, 100, 35),
    rng("color", "Variación de color", 0, 100, 30),
    rng("scale", "Tamaño de las variaciones", 10, 100, 45),
    rng("seed", "Variación", 1, 99, 9),
], "Pequeñas irregularidades de exposición y color en el fotograma, como un revelado químico real.")
def film_breath(img, p, ctx):
    h, w = img.shape[:2]
    sc = ctx.small(256)
    rg = np.random.default_rng(int(p["seed"]) * 313 + ctx.seed)
    sigma = max(2.0, max(sc.w, sc.h) * (0.05 + 0.25 * p["scale"] / 100.0))

    def field(salt):
        f = np.random.default_rng(int(p["seed"]) * 313 + salt).standard_normal((sc.h, sc.w)).astype(np.float32)
        f = C.blur(f, sigma)
        f = f / (f.std() + 1e-6)
        return cv2.resize(f, (w, h), interpolation=cv2.INTER_LINEAR)

    del rg
    e = field(1) * p["exposure"] / 100.0 * 0.18
    out = img * (2.0 ** e)[..., None]
    ca = p["color"] / 100.0 * 0.025
    if ca:
        out = out + np.stack([field(2), field(3) * 0.6, field(4)], -1) * ca
    return np.clip(out, 0, 1)


# --------------------------------------------------------------------------- daños de película
@register("film_damage", "Daños de película", ["film"], [
    rng("dust", "Polvo", 0, 100, 35),
    rng("scratches", "Rayones", 0, 100, 25),
    rng("hairs", "Pelos", 0, 100, 10),
    rng("stains", "Manchas químicas", 0, 100, 20),
    rng("edge_fog", "Velado de bordes", 0, 100, 25),
    chk("cue_mark", "Marca de cambio de rollo", False),
    rng("flicker", "Parpadeo de densidad", 0, 100, 15),
    sel("tone", "Tipo", [("negative", "Positivo de un negativo (manchas claras)"), ("print", "Copia (manchas oscuras)"),
                         ("mixed", "Mixto")], "mixed"),
    rng("seed", "Variación", 1, 99, 4),
], "Imperfecciones físicas: polvo, rayones, pelos, manchas, velado, marcas de cambio de rollo y parpadeo.")
def film_damage(img, p, ctx):
    out = FA.dust_scratches(img, {"dust": p["dust"], "scratches": p["scratches"], "hairs": p["hairs"],
                                  "tone": p["tone"], "seed": p["seed"]}, ctx)
    if p["stains"]:
        out = FA.texture(out, {"type": "stains", "amount": p["stains"] * 0.8, "scale": 120, "seed": p["seed"]}, ctx)
    if p["edge_fog"]:
        out = FA.light_leak(out, {"style": "amber", "position": "random", "intensity": p["edge_fog"] * 0.7,
                                  "size": 30, "seed": p["seed"] + 5}, ctx)
    if p["flicker"]:
        f = (np.random.default_rng(int(p["seed"]) * 7 + 3).uniform(-1, 1)) * p["flicker"] / 100.0 * 0.25
        out = np.clip(out * (2.0 ** f), 0, 1)
    if p["cue_mark"]:
        u, v = ctx.grid()
        d = np.sqrt(((u - 0.9) * ctx.aspect) ** 2 + (v - 0.12) ** 2)
        ring = (1.0 - C.smoothstep(0.022, 0.03, d)) * C.smoothstep(0.012, 0.02, d)
        disk = 1.0 - C.smoothstep(0.012, 0.02, d)
        out = out * (1.0 - 0.8 * disk[..., None]) + 0.05 * ring[..., None]
    return np.clip(out, 0, 1)
