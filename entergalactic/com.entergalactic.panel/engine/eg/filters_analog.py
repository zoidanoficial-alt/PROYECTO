"""ENTERGALACTIC Analógico: cámaras antiguas, fugas de luz, polvo, película vintage e instantáneas.

Los elementos aleatorios (polvo, rayones, fugas) se generan en coordenadas
normalizadas con una semilla: la vista previa y el resultado final coinciden.
"""
import numpy as np
import cv2

from . import core as C
from .registry import register, rng, sel, chk
from . import filters_chroma as FC
from . import filters_plata as FP

# --------------------------------------------------------------------------- película vintage
FILM_LOOKS = {
    # nombre, curvas R/G/B (x, y), desvaído, saturación
    "slide60": ("Diapositiva años 60", ([0, .3, .7, 1], [.02, .27, .78, 1]), ([0, .3, .7, 1], [.03, .28, .72, .97]),
                ([0, .3, .7, 1], [.08, .3, .64, .9]), 0.03, 1.15),
    "neg70": ("Negativo cálido años 70", ([0, .5, 1], [.1, .58, .98]), ([0, .5, 1], [.06, .5, .92]),
              ([0, .5, 1], [.04, .38, .78]), 0.08, 0.85),
    "neg80": ("Negativo años 80", ([0, .5, 1], [.04, .53, .98]), ([0, .5, 1], [.03, .5, .96]),
              ([0, .5, 1], [.07, .5, .9]), 0.04, 1.05),
    "expired": ("Película caducada", ([0, .5, 1], [.12, .6, .95]), ([0, .5, 1], [.1, .52, .9]),
                ([0, .5, 1], [.18, .5, .78]), 0.12, 0.7),
    "cine35": ("Cine 35 mm", ([0, .25, .75, 1], [.03, .2, .8, .98]), ([0, .25, .75, 1], [.04, .22, .78, .97]),
               ([0, .25, .75, 1], [.08, .25, .72, .92]), 0.04, 0.95),
    "faded_print": ("Copia descolorida", ([0, .5, 1], [.15, .6, .95]), ([0, .5, 1], [.13, .55, .92]),
                    ([0, .5, 1], [.13, .48, .85]), 0.15, 0.55),
    "chrome_cool": ("Diapositiva fría", ([0, .5, 1], [0, .45, .95]), ([0, .5, 1], [.02, .5, .97]),
                    ([0, .5, 1], [.06, .56, 1]), 0.02, 1.1),
}


@register("vintage_film", "Película vintage", ["analog", "chroma"], [
    sel("look", "Película", [(k, v[0]) for k, v in FILM_LOOKS.items()], "neg70"),
    rng("strength", "Intensidad", 0, 100, 80),
    rng("fade", "Desvaído extra", 0, 100, 0),
], "Respuesta de color de películas de época: dominantes, curvas y negros lavados.")
def vintage_film(img, p, ctx):
    _, cr, cg, cb, fade, sat = FILM_LOOKS[p["look"]]
    x = np.clip(img, 0, 1)
    out = np.stack([C.curve(x[..., 0], *cr), C.curve(x[..., 1], *cg), C.curve(x[..., 2], *cb)], axis=-1)
    f = fade + p["fade"] / 100.0 * 0.2
    out = f + out * (1 - f)
    out = C.saturate(out, sat)
    return img + (out - img) * p["strength"] / 100.0


# --------------------------------------------------------------------------- fugas de luz
LEAK_STYLES = {
    "red": ("Rojo intenso", ["#ff3b1f", "#ff8a3d"]),
    "amber": ("Ámbar", ["#ff9a2e", "#ffd27a"]),
    "rainbow": ("Arcoíris", ["#ff4d6d", "#ffb347", "#7ad3ff"]),
    "magenta": ("Magenta", ["#ff3fa4", "#ff9ad5"]),
    "burn": ("Quemado de bobina", ["#ff5a00", "#fff0b0"]),
}
LEAK_POS = [("left", "Izquierda"), ("right", "Derecha"), ("top", "Arriba"), ("bottom", "Abajo"),
            ("corner", "Esquina"), ("random", "Aleatoria")]


@register("light_leak", "Fuga de luz", ["analog"], [
    sel("style", "Estilo", [(k, v[0]) for k, v in LEAK_STYLES.items()], "amber"),
    sel("position", "Posición", LEAK_POS, "right"),
    rng("intensity", "Intensidad", 0, 100, 60),
    rng("size", "Tamaño", 5, 100, 40),
    rng("seed", "Variación", 1, 99, 7),
], "Luz que entra por la tapa o el chasis de la cámara y vela la película.")
def light_leak(img, p, ctx):
    full_ctx, ctx = ctx, ctx.small()   # las fugas son campos muy suaves: se calculan reducidas
    u, v = ctx.grid()
    rg = np.random.default_rng(int(p["seed"]) * 131 + ctx.seed)
    colors = [C.hex_color(c) for c in LEAK_STYLES[p["style"]][1]]
    size = p["size"] / 100.0
    pos = p["position"]
    if pos == "random":
        pos = ["left", "right", "top", "bottom", "corner"][int(rg.integers(0, 5))]
    acc = np.zeros((ctx.h, ctx.w, 3), np.float32)
    nblobs = 3 + len(colors)
    for i in range(nblobs):
        t = rg.uniform(0.1, 0.9)
        if pos == "left":
            cx, cy = rg.uniform(-0.1, 0.08), t
        elif pos == "right":
            cx, cy = 1.0 - rg.uniform(-0.1, 0.08), t
        elif pos == "top":
            cx, cy = t, rg.uniform(-0.1, 0.08)
        elif pos == "bottom":
            cx, cy = t, 1.0 - rg.uniform(-0.1, 0.08)
        else:
            cx, cy = 1.0 - rg.uniform(-0.05, 0.25), rg.uniform(-0.05, 0.25)
        rx = size * rg.uniform(0.3, 0.8)
        ry = size * rg.uniform(0.5, 1.4)
        if pos in ("top", "bottom"):
            rx, ry = ry, rx
        d = ((u - cx) * ctx.aspect / rx) ** 2 + ((v - cy) / ry) ** 2
        blob = np.exp(-d * 1.5) * rg.uniform(0.5, 1.0)
        acc += blob[..., None] * colors[i % len(colors)]
    k = p["intensity"] / 100.0
    acc = np.clip(acc * k, 0, 1)
    if p["style"] == "burn":
        acc = np.clip(acc * 1.6, 0, 1)
    if acc.shape[:2] != img.shape[:2]:
        acc = cv2.resize(acc, (img.shape[1], img.shape[0]), interpolation=cv2.INTER_LINEAR)
    return 1.0 - (1.0 - img) * (1.0 - acc)


# --------------------------------------------------------------------------- polvo y rayones
@register("dust_scratches", "Polvo y rayones", ["analog", "plata"], [
    rng("dust", "Polvo", 0, 100, 40),
    rng("scratches", "Rayones", 0, 100, 30),
    rng("hairs", "Pelos y fibras", 0, 100, 15),
    sel("tone", "Tipo", [("print", "Copia (manchas oscuras)"), ("negative", "Negativo escaneado (manchas claras)"),
                         ("mixed", "Mixto")], "negative"),
    rng("seed", "Variación", 1, 99, 3),
], "Partículas, rayones verticales y fibras como en una película manoseada.")
def dust_scratches(img, p, ctx):
    h, w = img.shape[:2]
    rg = np.random.default_rng(int(p["seed"]) * 977 + ctx.seed)
    layer = np.zeros((h, w), np.float32)      # positivo = claro, negativo = oscuro
    x0, y0, x1, y1 = ctx.rect
    sx = w / (x1 - x0)                        # píxeles de trabajo por unidad normalizada
    sy = h / (y1 - y0)
    full = max(ctx.full_w, ctx.full_h) * ctx.k
    sign_of = {"print": lambda: -1.0, "negative": lambda: 1.0, "mixed": lambda: rg.choice([-1.0, 1.0])}[p["tone"]]

    def to_px(nx, ny):
        return (nx - x0) * sx, (ny - y0) * sy

    n_dust = int(p["dust"] / 100.0 * 900)
    for _ in range(n_dust):
        nx, ny = rg.uniform(0, 1), rg.uniform(0, 1)
        r = rg.pareto(3.0) * 0.0006 + 0.0002
        X, Y = to_px(nx, ny)
        rr = max(0.5, r * full)
        if -rr < X < w + rr and -rr < Y < h + rr:
            cv2.circle(layer, (int(X), int(Y)), int(round(rr)), float(sign_of() * rg.uniform(0.4, 1.0)), -1, cv2.LINE_AA)
    n_scr = int(p["scratches"] / 100.0 * 14)
    for _ in range(n_scr):
        nx = rg.uniform(0.02, 0.98)
        ny0, ny1 = sorted(rg.uniform(0, 1, 2))
        if rg.uniform() < 0.6:
            ny0, ny1 = 0.0, 1.0
        drift = rg.uniform(-0.01, 0.01)
        A, B = to_px(nx, ny0), to_px(nx + drift, ny1)
        cv2.line(layer, (int(A[0]), int(A[1])), (int(B[0]), int(B[1])),
                 float(sign_of() * rg.uniform(0.25, 0.7)), max(1, int(round(0.0006 * full))), cv2.LINE_AA)
    n_hair = int(p["hairs"] / 100.0 * 8)
    for _ in range(n_hair):
        cx, cy = rg.uniform(0, 1), rg.uniform(0, 1)
        pts = []
        ang = rg.uniform(0, 2 * np.pi)
        L = rg.uniform(0.02, 0.08)
        for t in np.linspace(0, 1, 24):
            ang += rg.normal(0, 0.25)
            cx += np.cos(ang) * L / 24
            cy += np.sin(ang) * L / 24 * ctx.aspect
            pts.append(to_px(cx, cy))
        cv2.polylines(layer, [np.array(pts, np.int32)], False, float(sign_of() * 0.8), max(1, int(round(0.0005 * full))), cv2.LINE_AA)
    layer = C.blur(layer, max(0.4, 0.25 * full / 1000.0))
    light = np.clip(layer, 0, 1)[..., None]
    dark = np.clip(-layer, 0, 1)[..., None]
    out = img + (1.0 - img) * light * 0.9
    return out * (1.0 - dark * 0.85)


# --------------------------------------------------------------------------- óptica
@register("lens_blur", "Desenfoque óptico", ["analog", "chroma"], [
    sel("type", "Tipo", [("tilt", "Basculante (miniatura)"), ("soft_edges", "Bordes blandos (lente antigua)"),
                         ("zoom", "Zoom"), ("motion", "Movimiento"), ("dream", "Lente de ensueño")], "soft_edges"),
    rng("amount", "Cantidad", 0, 100, 50),
    rng("focus_x", "Foco horizontal", 0, 100, 50),
    rng("focus_y", "Foco vertical", 0, 100, 50),
    rng("focus_size", "Zona nítida", 5, 100, 35),
    rng("angle", "Ángulo (movimiento)", -90, 90, 0, unit="°"),
], "Desenfoques de lentes antiguas, efecto miniatura, zoom o movimiento.")
def lens_blur(img, p, ctx):
    a = p["amount"] / 100.0
    if a <= 0:
        return img
    full = max(ctx.full_w, ctx.full_h) * ctx.k
    rad = max(0.5, a * 0.012 * full)
    fx, fy = p["focus_x"] / 100.0, p["focus_y"] / 100.0
    fs = p["focus_size"] / 100.0
    u, v = ctx.grid()
    t = p["type"]
    if t == "tilt":
        d = np.abs(v - fy) / max(fs * 0.5, 0.02)
        m = C.smoothstep(0.6, 1.6, d)
        blurred = C.blur(img, rad)
        return img + (blurred - img) * m[..., None]
    if t in ("soft_edges", "dream"):
        dx = (u - fx) * ctx.aspect
        d = np.sqrt(dx * dx + (v - fy) ** 2) / max(fs, 0.05)
        m = C.smoothstep(0.5, 1.5, d)
        blurred = C.blur(img, rad)
        if t == "dream":
            glow = C.blur(img, rad * 2.5)
            out = 1.0 - (1.0 - img) * (1.0 - glow * 0.5 * a)
            return out + (blurred - out) * m[..., None]
        return img + (blurred - img) * m[..., None]
    if t == "zoom":
        h, w = img.shape[:2]
        cx, cy = (fx - ctx.rect[0]) / (ctx.rect[2] - ctx.rect[0]) * w, (fy - ctx.rect[1]) / (ctx.rect[3] - ctx.rect[1]) * h
        acc = np.zeros_like(img)
        steps = 10
        for i in range(steps):
            s = 1.0 + a * 0.08 * i / (steps - 1)
            M = np.float32([[s, 0, cx * (1 - s)], [0, s, cy * (1 - s)]])
            acc += cv2.warpAffine(img, M, (w, h), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)
        out = acc / steps
        dx = (u - fx) * ctx.aspect
        m = C.smoothstep(0.0, max(fs, 0.05), np.sqrt(dx * dx + (v - fy) ** 2))
        return img + (out - img) * m[..., None]
    # movimiento
    L = int(max(3, rad * 3)) | 1
    k = np.zeros((L, L), np.float32)
    k[L // 2, :] = 1.0
    M = cv2.getRotationMatrix2D((L / 2 - 0.5, L / 2 - 0.5), p["angle"], 1.0)
    k = cv2.warpAffine(k, M, (L, L))
    k /= max(k.sum(), 1e-6)
    return cv2.filter2D(img, -1, k, borderType=cv2.BORDER_REFLECT)


@register("chromatic_aberration", "Aberración cromática", ["analog"], [
    rng("amount", "Cantidad", 0, 100, 35),
    sel("type", "Tipo", [("radial", "Radial (lente)"), ("shift", "Desplazamiento (registro)")], "radial"),
], "Bordes de color rojo/cian típicos de objetivos sencillos.")
def chromatic_aberration(img, p, ctx):
    h, w = img.shape[:2]
    a = p["amount"] / 100.0
    full = max(ctx.full_w, ctx.full_h) * ctx.k
    if p["type"] == "shift":
        d = a * 0.004 * full
        r = cv2.warpAffine(img[..., 0], np.float32([[1, 0, d], [0, 1, 0]]), (w, h), borderMode=cv2.BORDER_REFLECT)
        b = cv2.warpAffine(img[..., 2], np.float32([[1, 0, -d], [0, 1, 0]]), (w, h), borderMode=cv2.BORDER_REFLECT)
        return np.stack([r, img[..., 1], b], axis=-1)
    u, v = ctx.grid()
    x0, y0, x1, y1 = ctx.rect
    out = img.copy()
    for ch, s in ((0, 1.0 + 0.006 * a), (2, 1.0 - 0.006 * a)):
        uu = 0.5 + (u - 0.5) / s
        vv = 0.5 + (v - 0.5) / s
        mx = ((uu - x0) / (x1 - x0) * w - 0.5).astype(np.float32)
        my = ((vv - y0) / (y1 - y0) * h - 0.5).astype(np.float32)
        out[..., ch] = cv2.remap(img[..., ch], mx, my, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)
    return out


# --------------------------------------------------------------------------- texturas
@register("texture", "Textura", ["analog", "plata"], [
    sel("type", "Textura", [("paper", "Papel fotográfico"), ("canvas", "Lienzo"), ("emulsion", "Emulsión craquelada"),
                            ("stains", "Manchas de revelado")], "paper"),
    rng("amount", "Cantidad", 0, 100, 35),
    rng("scale", "Escala", 10, 300, 100, unit="%"),
    rng("seed", "Variación", 1, 99, 11),
], "Superficies físicas: papel, lienzo, emulsión agrietada o manchas químicas.")
def texture(img, p, ctx):
    h, w = img.shape[:2]
    rg = np.random.default_rng(int(p["seed"]) * 37 + ctx.seed)
    full = max(ctx.full_w, ctx.full_h) * ctx.k
    sc = p["scale"] / 100.0
    t = p["type"]

    def noise(sigma_frac, salt):
        n = np.random.default_rng(int(p["seed"]) * 101 + salt).standard_normal((h, w)).astype(np.float32)
        n = C.blur(n, max(0.4, sigma_frac * full * sc))
        return n / (n.std() + 1e-6)

    if t == "paper":
        tex = noise(0.0008, 1) * 0.6 + noise(0.004, 2) * 0.4
    elif t == "canvas":
        u, v = ctx.grid()
        f = 900.0 / sc
        tex = np.sin(u * f * ctx.aspect) * np.sin(v * f) * 0.7 + noise(0.0007, 3) * 0.5
    elif t == "emulsion":
        n = noise(0.01, 4)
        cracks = 1.0 - C.smoothstep(0.0, 0.08, np.abs(n))
        tex = -cracks * 2.0 + noise(0.001, 5) * 0.4
    else:
        tex = noise(0.05, 6) * 0.8 + noise(0.015, 7) * 0.4
        tex = np.where(tex > 0.6, tex * 1.5, tex * 0.3)
    k = p["amount"] / 100.0 * 0.12
    layer = np.clip(0.5 + tex * k, 0, 1)[..., None]
    return C.blend(img, np.repeat(layer, 3, axis=2), "overlay" if t == "stains" else "soft_light")


# --------------------------------------------------------------------------- cámaras
CAMERAS = {
    "toy": "Cámara de juguete (plástico)",
    "box50": "Cámara de cajón años 50",
    "wetplate": "Placa húmeda (colodión)",
    "rangefinder70": "Telemétrica años 70",
    "disposable90": "Desechable años 90",
    "pinhole": "Estenopeica",
}


@register("old_camera", "Cámara antigua", ["analog"], [
    sel("camera", "Cámara", list(CAMERAS.items()), "toy"),
    rng("strength", "Intensidad", 0, 100, 80),
    rng("seed", "Variación", 1, 99, 5),
], "Combina óptica, película y defectos de una cámara de época en un solo paso.")
def old_camera(img, p, ctx):
    cam = p["camera"]
    s = int(p["seed"])
    out = img
    if cam == "toy":
        out = FC.cross_process(out, {"type": "yg", "strength": 45}, ctx)
        out = FC.brilliance(out, {"brightness": 5, "contrast": 35, "saturation": 35, "vibrance": 0, "warmth": 10}, ctx)
        out = lens_blur(out, {"type": "soft_edges", "amount": 35, "focus_x": 50, "focus_y": 50, "focus_size": 45, "angle": 0}, ctx)
        out = FC.vignette(out, {"amount": -75, "size": 35, "roundness": 100, "softness": 55, "x": 50, "y": 50}, ctx)
        out = light_leak(out, {"style": "red", "position": "random", "intensity": 35, "size": 35, "seed": s}, ctx)
    elif cam == "box50":
        out = FP.bw_convert(out, {"film": "pan100", "filter": "yellow", "brightness": 0, "contrast": 10,
                                  "structure": -10, "whites": 0, "blacks": 10}, ctx)
        out = FP.toning(out, {"type": "sepia", "strength": 35, "paper_white": True}, ctx)
        out = lens_blur(out, {"type": "soft_edges", "amount": 30, "focus_x": 50, "focus_y": 50, "focus_size": 55, "angle": 0}, ctx)
        out = FC.vignette(out, {"amount": -45, "size": 45, "roundness": 40, "softness": 70, "x": 50, "y": 50}, ctx)
        out = dust_scratches(out, {"dust": 25, "scratches": 10, "hairs": 5, "tone": "print", "seed": s}, ctx)
    elif cam == "wetplate":
        out = FP.bw_convert(out, {"film": "ortho", "filter": "none", "brightness": 0, "contrast": 30,
                                  "structure": 40, "whites": 20, "blacks": 30}, ctx)
        out = FP.toning(out, {"type": "platinum", "strength": 55, "paper_white": False}, ctx)
        out = lens_blur(out, {"type": "soft_edges", "amount": 45, "focus_x": 50, "focus_y": 45, "focus_size": 35, "angle": 0}, ctx)
        out = texture(out, {"type": "emulsion", "amount": 40, "scale": 100, "seed": s}, ctx)
        out = FP.burn_edges(out, {"amount": 70, "size": 18, "top": 100, "bottom": 100, "left": 100, "right": 100}, ctx)
    elif cam == "rangefinder70":
        out = vintage_film(out, {"look": "neg70", "strength": 85, "fade": 10}, ctx)
        out = FC.vignette(out, {"amount": -30, "size": 55, "roundness": 50, "softness": 70, "x": 50, "y": 50}, ctx)
        out = FP.grain(out, {"amount": 25, "size": 1.3, "roughness": 40, "response": "film", "color": True}, ctx)
    elif cam == "disposable90":
        out = vintage_film(out, {"look": "neg80", "strength": 80, "fade": 0}, ctx)
        out = FC.brilliance(out, {"brightness": 10, "contrast": 20, "saturation": 15, "vibrance": 0, "warmth": -5}, ctx)
        out = FC.white_balance(out, {"temperature": -5, "tint": -15}, ctx)
        out = FC.vignette(out, {"amount": -35, "size": 50, "roundness": 30, "softness": 60, "x": 50, "y": 50}, ctx)
        out = chromatic_aberration(out, {"amount": 30, "type": "radial"}, ctx)
        out = FP.grain(out, {"amount": 30, "size": 1.6, "roughness": 50, "response": "shadows", "color": True}, ctx)
    elif cam == "pinhole":
        out = C.blur(out, ctx.px(max(ctx.full_w, ctx.full_h) * 0.0015))
        out = FC.vignette(out, {"amount": -85, "size": 25, "roundness": 100, "softness": 90, "x": 50, "y": 50}, ctx)
        out = vintage_film(out, {"look": "faded_print", "strength": 60, "fade": 0}, ctx)
    return img + (out - img) * p["strength"] / 100.0


# --------------------------------------------------------------------------- instantánea
INSTANT_LOOKS = {
    "classic": "Clásica (cian en sombras, luces cálidas)",
    "sx": "Integral años 70 (verdosa)",
    "faded": "Desvaída por el sol",
    "bw": "Blanco y negro instantánea",
}
FRAMES = [("none", "Sin marco"), ("square", "Cuadrada clásica (marco blanco)"), ("wide", "Formato ancho"),
          ("mini", "Mini (vertical)"), ("black", "Marco negro"), ("film_border", "Bordes de negativo")]


@register("instant", "Fotografía instantánea", ["analog"], [
    sel("look", "Química", list(INSTANT_LOOKS.items()), "classic"),
    rng("strength", "Intensidad", 0, 100, 80),
    sel("frame", "Marco", FRAMES, "square"),
    chk("crop", "Recortar al formato del marco", True),
], "Color de película instantánea y, opcionalmente, su marco característico (cambia el tamaño).",
    resizes=True)
def instant(img, p, ctx):
    k = p["strength"] / 100.0
    look = p["look"]
    if look == "bw":
        out = FP.bw_convert(img, {"film": "portrait", "filter": "none", "brightness": 5, "contrast": -10,
                                  "structure": -20, "whites": 0, "blacks": 0}, ctx)
        out = FP.toning(out, {"type": "selenium", "strength": 30, "paper_white": True}, ctx)
    else:
        x = np.clip(img, 0, 1)
        if look == "classic":
            curves = (([0, .5, 1], [.08, .55, .97]), ([0, .5, 1], [.1, .52, .93]), ([0, .5, 1], [.16, .5, .82]))
        elif look == "sx":
            curves = (([0, .5, 1], [.06, .5, .92]), ([0, .5, 1], [.1, .55, .95]), ([0, .5, 1], [.12, .47, .85]))
        else:
            curves = (([0, .5, 1], [.2, .62, .96]), ([0, .5, 1], [.18, .58, .93]), ([0, .5, 1], [.2, .55, .88]))
        out = np.stack([C.curve(x[..., i], *curves[i]) for i in range(3)], axis=-1)
        out = C.saturate(out, 0.8 if look != "faded" else 0.55)
        out = FC.vignette(out, {"amount": -25, "size": 55, "roundness": 30, "softness": 70, "x": 50, "y": 50}, ctx)
    out = img + (out - img) * k
    frame = p["frame"]
    if frame == "none":
        return out
    h, w = out.shape[:2]
    aspects = {"square": 1.0, "wide": 4.0 / 3.0 * 1.0, "mini": 0.73, "black": 1.0, "film_border": None}
    asp = aspects.get(frame)
    if p["crop"] and asp:
        if w / h > asp:
            nw = int(round(h * asp))
            x0 = (w - nw) // 2
            out = out[:, x0:x0 + nw]
        else:
            nh = int(round(w / asp))
            y0 = (h - nh) // 2
            out = out[y0:y0 + nh]
        if ctx.alpha is not None:
            ctx.alpha = None
    h, w = out.shape[:2]
    if frame == "film_border":
        bw_ = int(round(max(h, w) * 0.035))
        canvas = np.zeros((h + 2 * bw_, w + 2 * bw_, 3), np.float32) + 0.03
        canvas[bw_:bw_ + h, bw_:bw_ + w] = out
        rg = ctx.rng(99)
        edge = C.blur(rg.standard_normal(canvas.shape[:2]).astype(np.float32), bw_ * 0.15)
        inner = np.zeros(canvas.shape[:2], np.float32)
        inner[bw_:bw_ + h, bw_:bw_ + w] = 1.0
        inner = C.blur(inner, bw_ * 0.08) + edge * 0.08
        m = np.clip(inner, 0, 1)[..., None]
        res = canvas * m + 0.03 * (1 - m)
    else:
        side = int(round(w * 0.06))
        top = side
        bottom = int(round(w * (0.22 if frame in ("square", "black") else 0.17)))
        col = np.array([0.95, 0.94, 0.91], np.float32) if frame != "black" else np.array([0.06, 0.06, 0.07], np.float32)
        res = np.empty((h + top + bottom, w + 2 * side, 3), np.float32)
        res[:] = col
        res[top:top + h, side:side + w] = out
        # leve sombra interior para que la foto parezca "dentro" del marco
        shade = np.ones(res.shape[:2], np.float32)
        shade[top:top + h, side:side + w] = 0.0
        shade = C.blur(shade, max(1.0, w * 0.004))
        region = res[top:top + h, side:side + w]
        res[top:top + h, side:side + w] = region * (1.0 - 0.25 * shade[top:top + h, side:side + w, None])
    ctx.alpha = None
    ctx.last_scale = 1.0
    return res
