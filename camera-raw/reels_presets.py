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
]


def settings(look, exact):
    extra = dict(look["basic"])
    if not exact:
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
        for exact in (False, True):
            name = "RL %s%s" % (look["name"], " (valores exactos)" if exact else "")
            desc = look["desc"] + (" Incluye la Exposición del reel (%s)." % look["basic"]["Exposure2012"] if exact
                                   else " Sin Exposición: ajústala en cada foto.")
            fname = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode()
            with open(os.path.join(out, fname + ".xmp"), "w", encoding="utf-8") as fh:
                fh.write(to_xmp(settings(look, exact), name, GROUP, desc))
            n += 1
    return n


if __name__ == "__main__":
    print("%d presets en %s" % (build(), OUT))
