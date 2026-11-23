#!/usr/bin/env python3
"""Paquete «FOTONEANDO · Reels»: presets transcritos de los ajustes de Lightroom que
aparecen en capturas de reels, adaptados a Camera Raw 10 (Photoshop CC 2018).

Lo que Camera Raw 10 no tiene se traduce así:
  * Gradación de color (3 ruedas) → Dividir tonos para sombras y luces, y las curvas
    Rojo/Verde/Azul para los medios tonos.
  * Temperatura/Matiz «+N» (relativos, de un JPG) → curvas Rojo/Verde/Azul, para que
    funcione igual en RAW/DNG y en JPG.
  * Textura (no existe en Camera Raw 10) → se omite (los valores eran 0 o −4).
  * «Glow» de Lightroom (no existe en Camera Raw) → más Claridad negativa y la nota
    para terminarlo en Photoshop.

Cada look sale en dos versiones:
  * «RL Nombre»: sin Exposición, para que no cambie el brillo de tu foto.
  * «RL Nombre (valores exactos)»: con la Exposición del reel.

Uso:  python reels_presets.py
"""
import os
import unicodedata

from referencia_a_preset import BANDS, monotone, to_xmp

GROUP = "FOTONEANDO · Reels"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "presets", "FOTONEANDO Reels")


def curve_from_graph(pts):
    return monotone([(float(x), float(y)) for x, y in pts])


def tint_curves(offsets):
    """offsets: {canal: [(x, delta), ...]} → curvas RGB con esos desplazamientos."""
    ch = {}
    for c in "rgb":
        pts = [(0.0, 0.0), (1.0, 1.0)]
        for x, d in offsets.get(c, []):
            pts = [p for p in pts if abs(p[0] - x) > 0.04]
            base = 1.0 if x >= 1.0 else (0.0 if x <= 0 else x)
            pts.append((x, min(1.0, max(0.0, base + d))))
        ch[c] = monotone(pts)
    return ch


def hue_rgb(h):
    """Color puro de un tono (0–360°) como (r, g, b)."""
    import colorsys
    return colorsys.hsv_to_rgb((h % 360) / 360.0, 1.0, 1.0)


def grade_offsets(temp=0, tint=0, mid=None):
    """Temperatura/Matiz relativos y rueda de medios tonos → desplazamientos de las curvas RGB."""
    d = {"r": 0.0, "g": 0.0, "b": 0.0}
    d["r"] += 0.0012 * temp + 0.0003 * tint
    d["b"] += -0.0018 * temp + 0.0003 * tint
    d["g"] += -0.0011 * tint
    if mid and mid[1]:
        rgb = hue_rgb(mid[0])
        lum = 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]
        k = mid[1] / 100.0 * 0.15
        for c, v in zip("rgb", rgb):
            d[c] += k * (v - lum)
    return {c: [(0.25, v * 0.6), (0.5, v), (0.75, v * 0.6)] for c, v in d.items()}


def split(sh, hi):
    return {"SplitToningShadowHue": str(sh[0]), "SplitToningShadowSaturation": str(sh[1]),
            "SplitToningHighlightHue": str(hi[0]), "SplitToningHighlightSaturation": str(hi[1]),
            "SplitToningBalance": "0"}


def basic(exp, con, hi, sh, wh, bl):
    f = lambda v: "%+d" % v
    return {"Exposure2012": "%+.2f" % exp, "Contrast2012": f(con), "Highlights2012": f(hi), "Shadows2012": f(sh),
            "Whites2012": f(wh), "Blacks2012": f(bl)}


# HSL común a varios looks del mismo autor (Twin Peaks, Pacific Northwest, Succession).
HSL_PNW = {"Red": (10, -15, 0), "Orange": (-13, -29, 13), "Yellow": (0, -25, 9), "Green": (9, -71, 0),
           "Aqua": (0, -36, 0), "Blue": (-22, -30, -35), "Purple": (0, -22, 0), "Magenta": (0, -15, 0)}
CURVE_FADE = [(0, 0.055), (0.214, 0.219), (0.746, 0.73), (1, 0.924)]

LOOKS = [
    dict(
        key="Glow", name="Glow",
        desc="Brillo suave y difuso: sombras abiertas, negros lavados, luces contenidas, verdes y amarillos apagados, "
             "aguas giradas hacia el azul y sombras con tinte azul.",
        basic={"Exposure2012": "+0.90", "Contrast2012": "+55", "Highlights2012": "-76", "Shadows2012": "+83",
               "Whites2012": "+31", "Blacks2012": "+48"},
        vibrance=24, saturation=31, clarity=-49, dehaze=-22, vignette=-18, grain=0,
        # Curva leída del gráfico del reel (RGB).
        curve=[(0, 0.16), (0.275, 0.216), (0.445, 0.329), (0.743, 0.69), (0.89, 0.864), (1, 1)],
        hsl={"Red": (4, -1, 0), "Orange": (-13, -25, -2), "Yellow": (0, -34, 0), "Green": (3, -68, -5),
             "Aqua": (49, -32, 0), "Blue": (-20, -19, -4), "Purple": (0, -21, 1), "Magenta": (-3, -17, 1)},
        split={"SplitToningShadowHue": "245", "SplitToningShadowSaturation": "20",
               "SplitToningHighlightHue": "195", "SplitToningHighlightSaturation": "7", "SplitToningBalance": "0"},
        # Matiz +16 (magenta) y Temperatura +4 → curvas.
        rgb={"g": [(0.5, -0.018)], "r": [(0.5, 0.004)], "b": [(0.5, 0.002)]},
    ),
    dict(
        key="Weirdcore", name="Weirdcore",
        desc="Look onírico y extraño: muy luminoso y lavado, poco contraste, saturación muy alta con tinte magenta, "
             "morados girados al azul, aguas intensas, medios tonos amarillentos, luces violetas y mucho grano.",
        basic={"Exposure2012": "+1.15", "Contrast2012": "-37", "Highlights2012": "-75", "Shadows2012": "+34",
               "Whites2012": "+20", "Blacks2012": "+60"},
        vibrance=-3, saturation=87, clarity=-65, dehaze=-15, vignette=0, grain=72,
        curve=[(0, 0.18), (0.27, 0.23), (0.43, 0.33), (0.72, 0.62), (0.84, 0.80), (1, 0.93)],
        hsl={"Red": (6, -9, 0), "Orange": (0, 1, 7), "Yellow": (6, -12, 0), "Green": (-21, -11, 0),
             "Aqua": (27, 15, 0), "Blue": (0, 0, 8), "Purple": (-100, 39, 0), "Magenta": (0, 0, 0)},
        split={"SplitToningShadowHue": "267", "SplitToningShadowSaturation": "3",
               "SplitToningHighlightHue": "285", "SplitToningHighlightSaturation": "19", "SplitToningBalance": "0"},
        # Matiz +39 y Temperatura +15 → curvas; medios tonos de la gradación (tono 54, sat 20) → amarillo en medios.
        rgb={"r": [(0.5, 0.03)], "g": [(0.5, -0.025)], "b": [(0.5, -0.055)]},
    ),
    dict(
        key="TwinPeaks", name="Twin Peaks",
        desc="Bosque húmedo y misterioso: verdes casi apagados, azules oscuros, sombras magenta, luces doradas, "
             "negros y blancos suaves y grano de película.",
        basic=basic(0, 13, -25, 35, 38, -5), vibrance=-49, saturation=23, clarity=-43, dehaze=-32, vignette=-14,
        grain=56, curve=CURVE_FADE, hsl=HSL_PNW, split=split((302, 29), (64, 55)),
        rgb=grade_offsets(temp=-4, tint=17, mid=(109, 11)),
    ),
    dict(
        key="ResidentEvil", name="Resident Evil",
        desc="Noche de nieve con farolas: sombras muy azules, luces y medios tonos amarillos de sodio, negros "
             "levantados, azules luminosos y grano.",
        basic=basic(0.16, 30, -39, 35, 41, 73), vibrance=0, saturation=17, clarity=0, dehaze=-15, vignette=0,
        grain=54, curve=[(0, 0.08), (0.218, 0.196), (0.748, 0.723), (1, 0.926)],
        hsl={"Red": (10, -15, 0), "Orange": (-13, -13, 13), "Yellow": (0, -25, 11), "Green": (18, -71, 0),
             "Aqua": (-13, -36, 0), "Blue": (-24, -25, 29), "Purple": (0, -22, 0), "Magenta": (-9, -15, 0)},
        split=split((225, 81), (57, 49)), rgb=grade_offsets(temp=1, tint=12, mid=(64, 21)),
    ),
    dict(
        key="PacificNorthwest", name="Pacific Northwest",
        desc="Bosque del noroeste con niebla: sombras abiertas y muy azules, medios turquesa, verdes apagados, "
             "contraste suave y grano.",
        basic=basic(0, 28, -65, 75, 32, -18), vibrance=-49, saturation=23, clarity=-43, dehaze=-32, vignette=-14,
        grain=56, curve=[(0, 0.053), (0.214, 0.219), (0.746, 0.729), (1, 0.924)], hsl=HSL_PNW,
        split=split((222, 86), (0, 0)), rgb=grade_offsets(temp=11, tint=6, mid=(191, 28)),
    ),
    dict(
        key="Succession", name="Succession",
        desc="Ciudad nublada y corporativa: sombras azul acero, luces cálidas, sombras muy abiertas, verdes "
             "apagados y un grano discreto.",
        basic=basic(-0.85, 16, -48, 87, 64, -18), vibrance=-43, saturation=24, clarity=6, dehaze=-7, vignette=-14,
        grain=56, curve=[(0, 0.058), (0.215, 0.221), (0.749, 0.728), (1, 0.927)], hsl=HSL_PNW,
        split=split((213, 79), (50, 43)), rgb=grade_offsets(temp=-9, tint=20, mid=(198, 8)),
    ),
    dict(
        key="Winter", name="Winter",
        desc="Invierno nevado: mucho contraste con negros lavados, verdes girados al azul y casi sin color, "
             "aguas azules y un toque frío en las sombras.",
        basic=basic(0, 80, -55, 49, 58, -3), vibrance=-9, saturation=34, clarity=-30, dehaze=-22, vignette=-18,
        grain=0, curve=[(0, 0.194), (0.271, 0.238), (0.436, 0.343), (0.714, 0.62), (1, 0.993)],
        hsl={"Red": (22, -1, 0), "Orange": (-31, -25, -2), "Yellow": (0, -34, 0), "Green": (-46, -68, -5),
             "Aqua": (49, -32, 0), "Blue": (-13, -19, -4), "Purple": (0, -21, 1), "Magenta": (-3, -17, 1)},
        split=split((210, 9), (37, 5)), rgb=grade_offsets(temp=-4, tint=5, mid=(308, 2)),
    ),
    dict(
        key="Anime", name="Anime",
        desc="Look de anime de día: sombras muy abiertas y azul cielo, blancos contenidos, colores limpios con "
             "verdes apagados, contraste suave por la curva y grano.",
        basic=basic(0.30, 44, -42, 84, -12, 26), vibrance=0, saturation=-1, clarity=-33, dehaze=-7, vignette=0,
        grain=56, curve=[(0, 0.046), (0.196, 0.205), (0.756, 0.744), (1, 0.926)], hsl=HSL_PNW,
        split=split((203, 26), (0, 0)), rgb=grade_offsets(temp=7, tint=20),
    ),
    dict(
        key="ViceCity", name="GTA Vice City",
        desc="Noche de neón de los 80: cálido y luminoso, sombras magenta, luces turquesa, negros lavados por la "
             "curva, aguas giradas al azul y grano.",
        basic=basic(0.65, 36, -40, 87, 31, 48), vibrance=24, saturation=2, clarity=-22, dehaze=-22, vignette=-18,
        grain=45, curve=[(0, 0.221), (0.253, 0.234), (0.431, 0.331), (0.724, 0.624), (1, 1)],
        hsl={"Red": (4, -1, 0), "Orange": (-13, -25, -2), "Yellow": (0, -34, 0), "Green": (3, -68, -5),
             "Aqua": (49, -32, 0), "Blue": (-20, -19, -4), "Purple": (0, -21, 1), "Magenta": (-3, -17, 1)},
        split=split((294, 33), (191, 40)), rgb=grade_offsets(temp=24, tint=-3),
    ),
    dict(
        key="Retro", name="Retro",
        desc="Foto de película de los 70: muy lavada y suave, luces muy contenidas, sombras abiertas, verdes "
             "apagados, un toque cálido y grano.",
        basic=basic(0.30, -2, -74, 89, 49, 57), vibrance=0, saturation=17, clarity=-17, dehaze=-5, vignette=0,
        grain=54, curve=[(0, 0.057), (0.205, 0.198), (0.753, 0.74), (1, 0.947)],
        hsl={"Red": (10, -15, 0), "Orange": (-13, -13, 13), "Yellow": (0, -25, 11), "Green": (18, -71, 0),
             "Aqua": (0, -36, 0), "Blue": (-21, -10, -7), "Purple": (0, -22, 0), "Magenta": (-9, -15, 0)},
        split=split((47, 7), (0, 0)), rgb=grade_offsets(temp=5, tint=18),
    ),
    dict(
        key="Spiderman", name="Marvel's Spider-Man",
        desc="Ciudad al atardecer de videojuego: mucho contraste, negros lavados, luces cálidas doradas, "
             "verdes girados al azul y aguas intensas.",
        basic=basic(0, 68, -33, 60, 43, 36), vibrance=17, saturation=12, clarity=-8, dehaze=-15, vignette=0,
        grain=0, curve=[(0, 0.181), (0.267, 0.226), (0.431, 0.337), (0.708, 0.67), (1, 1)],
        hsl={"Red": (22, -1, 0), "Orange": (-31, -25, -2), "Yellow": (0, -34, 0), "Green": (-46, -68, -5),
             "Aqua": (49, -32, 0), "Blue": (-13, -19, -4), "Purple": (0, -21, 1), "Magenta": (-3, -17, 1)},
        split=split((210, 9), (61, 14)), rgb=grade_offsets(temp=15, tint=22, mid=(308, 2)),
    ),
]


def settings(look, exact):
    extra = dict(look["basic"])
    if not exact or float(extra["Exposure2012"]) == 0:
        extra.pop("Exposure2012")
    extra.update(look["split"])
    extra.update({"PostCropVignetteMidpoint": "50", "PostCropVignetteFeather": "50", "PostCropVignetteRoundness": "0"})
    return {
        "curve": curve_from_graph(look["curve"]),
        "channels": tint_curves(look["rgb"]),
        "saturation": look["saturation"], "Vibrance": look["vibrance"],
        "Clarity2012": look["clarity"], "Dehaze": look["dehaze"],
        "grain": look["grain"], "vignette": look["vignette"], "bw": False,
        "hsl": {k: look["hsl"].get(k, (0, 0, 0)) for k, _ in BANDS},
        "extra": extra,
    }


def build(out=OUT):
    os.makedirs(out, exist_ok=True)
    n = 0
    for look in LOOKS:
        has_exp = float(look["basic"]["Exposure2012"]) != 0
        for exact in ((False, True) if has_exp else (False,)):
            name = "RL %s%s" % (look["name"], " (valores exactos)" if exact else "")
            desc = look["desc"] + (" Incluye la Exposición del reel (%s)." % look["basic"]["Exposure2012"] if exact
                                   else (" Sin Exposición: ajústala en cada foto." if has_exp else ""))
            fname = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode()
            with open(os.path.join(out, fname + ".xmp"), "w", encoding="utf-8") as fh:
                fh.write(to_xmp(settings(look, exact), name, GROUP, desc))
            n += 1
    return n


if __name__ == "__main__":
    print("%d presets en %s" % (build(), OUT))
