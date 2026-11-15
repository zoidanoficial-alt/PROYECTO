"""ENTERGALACTIC Pop: serigrafía pop, repetición en cuadrícula y trama de puntos.

Inspirado en la técnica documentada de las serigrafías de Andy Warhol: primero
se pinta el lienzo con zonas planas de color y después se imprime la foto encima
con tinta negra; el pequeño desajuste (misregistro) entre ambas capas es parte
del estilo. Todas las operaciones son deterministas salvo la textura de tinta,
y el motor JavaScript del móvil las reproduce igual.
"""
import numpy as np
import cv2

from . import core as C
from .registry import register, rng, sel, chk

# nombre, luces, cálido (piel), frío (fondo), acento (rojos), tinta
PALETTES = {
    "pink_turq":     ("Rosa y turquesa", "#ffe25a", "#f6a3c4", "#29c3c0", "#e5283c", "#141414"),
    "yellow":        ("Amarillo eléctrico", "#fff3a0", "#ffd21f", "#ff4f9a", "#1fa3ff", "#1a1a1a"),
    "violet_orange": ("Violeta y naranja", "#ffb347", "#ff7a2f", "#7b3fd1", "#ffe14d", "#161018"),
    "lime":          ("Lima y azul", "#f2ff8a", "#b6f03c", "#2f6bff", "#ff3d7f", "#121a12"),
    "blue_peach":    ("Azul y melocotón", "#ffe7c2", "#ffb08a", "#1f4fd6", "#ff2f6d", "#10131c"),
    "red_silver":    ("Rojo y plata", "#eeeef2", "#c9c9d1", "#9a9aa6", "#d7192a", "#121212"),
    "bw":            ("Blanco y negro", "#f2f2f2", "#bdbdbd", "#8a8a8a", "#5e5e5e", "#111111"),
}
COLOR_PALETTES = [k for k in PALETTES if k != "bw"]


def _classes(img, p, ctx):
    """Mapa de zonas planas (0 luces, 1 cálido, 2 frío, 3 acento) y capa de tinta."""
    sm = C.blur(img, ctx.px(p["simplify"])) if p["simplify"] > 0 else img
    l = C.luminance(sm)
    hsv = C.to_hsv(sm)
    h, s = hsv[..., 0], hsv[..., 1]
    accent = (s > 0.45) & (C.hue_weight(h, 355.0, 22.0) > 0.5)
    warm = (C.hue_weight(h, 25.0, 40.0) > 0.35) & (s > 0.12)
    # Umbrales relativos a cada foto: «Tinta» = % de la imagen impresa en negro,
    # «Zona de luces» = percentil a partir del cual se usa el color de luces.
    hi = l > np.percentile(l, p["highlights"])
    cls = np.full(l.shape, 2, np.int32)
    cls[warm] = 1
    cls[hi] = 0
    cls[accent] = 3
    t = float(np.percentile(l, p["ink"]))
    ink = (l < t).astype(np.float32)   # la plancha imprime tinta o no la imprime
    return cls, ink, l


def _shift(a, dx, dy):
    """Desplaza un mapa (dx, dy píxeles enteros) repitiendo el borde."""
    h, w = a.shape[:2]
    ys = np.clip(np.arange(h) - dy, 0, h - 1)
    xs = np.clip(np.arange(w) - dx, 0, w - 1)
    return a[ys][:, xs]


def _render(cls, ink, l, palette, p, ctx):
    pal = PALETTES[palette]
    cols = np.array([C.hex_color(c) for c in pal[1:5]], np.float32)
    ink_col = C.hex_color(pal[5])
    flat = cols[cls]
    d = p["detail"] / 100.0
    if d:
        flat = flat * (1.0 - d + d * np.clip(0.5 + l, 0.0, 1.5))[..., None]
    off = p["offset"] / 1000.0 * max(ctx.full_w, ctx.full_h) * ctx.k
    dx, dy = int(round(off)), int(round(off * 0.6))
    ink_s = _shift(ink, dx, dy)
    if p["texture"]:
        n = C.blur(ctx.rng(31).standard_normal(ink.shape).astype(np.float32), ctx.px(1.2))
        n = n / (n.std() + 1e-6)
        ink_s = np.clip(ink_s * (1.0 - p["texture"] / 100.0 * 0.25 * np.clip(n, 0.0, 3.0)), 0.0, 1.0)
    out = flat * (1.0 - ink_s[..., None]) + ink_col * ink_s[..., None]
    return np.clip(out, 0.0, 1.0)


POP_PARAMS = [
    sel("palette", "Paleta", [(k, v[0]) for k, v in PALETTES.items()], "pink_turq"),
    rng("ink", "Tinta negra (% de la imagen)", 0, 60, 22),
    rng("highlights", "Zona de luces (percentil)", 50, 98, 85),
    rng("simplify", "Simplificar formas", 0, 10, 2, step=0.5, unit="px"),
    rng("offset", "Desajuste de capas", 0, 30, 8),
    rng("detail", "Detalle de la foto", 0, 100, 15),
    rng("texture", "Textura de tinta", 0, 100, 30),
]


@register("pop_silkscreen", "Serigrafía pop", ["pop"], POP_PARAMS,
          "Zonas planas de color con la foto impresa encima en tinta negra y ligeramente desplazada.")
def pop_silkscreen(img, p, ctx):
    cls, ink, l = _classes(img, p, ctx)
    return _render(cls, ink, l, p["palette"], p, ctx)


GRIDS = [("1x2", "Díptico (1 × 2)"), ("2x2", "2 × 2"), ("3x3", "3 × 3"), ("2x3", "2 × 3 (vertical)"), ("4x4", "4 × 4")]


@register("pop_grid", "Repetición pop", ["pop"], [
    sel("grid", "Cuadrícula", GRIDS, "2x2"),
    sel("palette", "Paleta inicial", [(k, v[0]) for k, v in PALETTES.items()], "pink_turq"),
    chk("rotate", "Cambiar de paleta en cada copia", True),
    chk("diptych_bw", "Última columna en blanco y negro", False),
    rng("gap", "Separación", 0, 30, 6),
] + POP_PARAMS[1:],
    "Repite la imagen en cuadrícula, como una serie serigrafiada, con otra paleta en cada copia.")
def pop_grid(img, p, ctx):
    h, w = img.shape[:2]
    if tuple(ctx.rect) != (0.0, 0.0, 1.0, 1.0):
        return pop_silkscreen(img, p, ctx)          # vista de detalle: sin cuadrícula
    rows, cols = {"1x2": (1, 2), "2x2": (2, 2), "3x3": (3, 3), "2x3": (2, 3), "4x4": (4, 4)}[p["grid"]]
    gap = int(round(p["gap"] / 1000.0 * max(w, h)))
    tw = max(4, (w - gap * (cols + 1)) // cols)
    th = max(4, (h - gap * (rows + 1)) // rows)
    # recorte centrado con la proporción de cada copia
    ta = tw / float(th)
    if w / float(h) > ta:
        cw, ch = int(round(h * ta)), h
    else:
        cw, ch = w, int(round(w / ta))
    x0, y0 = (w - cw) // 2, (h - ch) // 2
    src = img[y0:y0 + ch, x0:x0 + cw]
    tile = cv2.resize(src, (tw, th), interpolation=cv2.INTER_AREA) if (tw, th) != (cw, ch) else src.copy()
    tctx = C.Context(th, tw, ctx.k * tw / float(cw), (0, 0, 1, 1), ctx.seed, (tw, th))
    tctx.k = ctx.k * tw / float(cw)
    cls, ink, l = _classes(tile, p, tctx)
    bg = np.array([0.97, 0.96, 0.93], np.float32)
    out = np.empty_like(img)
    out[:] = bg
    start = COLOR_PALETTES.index(p["palette"]) if p["palette"] in COLOR_PALETTES else 0
    i = 0
    for r in range(rows):
        for c in range(cols):
            if p["diptych_bw"] and c == cols - 1:
                pal = "bw"
            elif p["palette"] == "bw" and not p["rotate"]:
                pal = "bw"
            else:
                pal = COLOR_PALETTES[(start + (i if p["rotate"] else 0)) % len(COLOR_PALETTES)]
            tctx2 = C.Context(th, tw, tctx.k, (0, 0, 1, 1), ctx.seed + i, (tw, th))
            tctx2.k = tctx.k
            rendered = _render(cls, ink, l, pal, p, tctx2)
            ox, oy = gap + c * (tw + gap), gap + r * (th + gap)
            out[oy:oy + th, ox:ox + tw] = rendered
            i += 1
    return out


@register("halftone", "Trama de puntos", ["pop", "analog"], [
    rng("size", "Tamaño del punto", 3, 40, 10, unit="px"),
    rng("angle", "Ángulo", 0, 90, 45, unit="°"),
    sel("mode", "Color", [("ink", "Tinta negra sobre el color"), ("cmy", "Puntos de color (cuatricromía)"),
                          ("mono", "Puntos negros sobre blanco")], "ink"),
    rng("contrast", "Contraste", 0, 100, 50),
], "Trama de puntos de imprenta, como en el cómic y el cartel pop.")
def halftone(img, p, ctx):
    h, w = img.shape[:2]
    u, v = ctx.grid()
    cell = max(2.0, p["size"] * ctx.k)
    # coordenadas en píxeles de la imagen de trabajo, rotadas
    fx = (u - ctx.rect[0]) / (ctx.rect[2] - ctx.rect[0]) * w
    fy = (v - ctx.rect[1]) / (ctx.rect[3] - ctx.rect[1]) * h
    sm = C.blur(img, cell * 0.5)
    k = 1.0 + p["contrast"] / 100.0 * 1.5

    def dots(dark, ang_deg):
        a = np.deg2rad(ang_deg)
        rx = fx * np.cos(a) + fy * np.sin(a)
        ry = -fx * np.sin(a) + fy * np.cos(a)
        cx = (np.floor(rx / cell) + 0.5) * cell - rx
        cy = (np.floor(ry / cell) + 0.5) * cell - ry
        dist = np.sqrt(cx * cx + cy * cy) / cell
        rad = np.sqrt(np.clip(dark, 0.0, 1.0)) * 0.72
        t = np.clip((dist - (rad - 0.04)) / 0.08, 0.0, 1.0)
        return 1.0 - t * t * (3.0 - 2.0 * t)

    def inv(ch):
        return 0.5 + (0.5 - ch) * k

    if p["mode"] == "cmy":
        c = dots(inv(sm[..., 0]), p["angle"] + 15)
        m = dots(inv(sm[..., 1]), p["angle"] + 75)
        y = dots(inv(sm[..., 2]), p["angle"])
        return np.clip(np.stack([1 - c, 1 - m, 1 - y], axis=-1), 0, 1).astype(np.float32)
    lum = C.luminance(sm)
    if p["mode"] == "mono":
        d = dots(inv(lum), p["angle"])[..., None]
        return np.repeat((1.0 - d), 3, axis=2).astype(np.float32)
    # Tinta sobre color: sólo sombras y medios tonos llevan puntos; las luces quedan limpias.
    d = dots((0.7 - lum) * k, p["angle"])[..., None]
    base = C.saturate(np.clip(sm * 1.1, 0, 1), 1.3)
    return (base * (1.0 - d * 0.85)).astype(np.float32)
