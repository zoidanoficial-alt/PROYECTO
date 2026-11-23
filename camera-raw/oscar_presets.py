#!/usr/bin/env python3
"""Genera el paquete «FOTONEANDO · Óscar»: 15 presets de Camera Raw inspirados en las
películas ganadoras del Óscar a Mejor Fotografía (ceremonias 2012–2026).

Cada look es una interpretación propia del color y la textura de la película.
No es el LUT ni el etalonaje oficial.

Todos llevan además una «base cine para APS-C» que hace parte del trabajo de una
cámara de cine o de una lente de alta gama:
  * corrección de perfil de lente y de aberración cromática
  * luces que se apagan suavemente, como en la película (sin blancos quemados)
  * menos enfoque digital y un poco de reducción de ruido, para quitar el aspecto «de video»
  * grano fino de película, que da textura y disimula el ruido del sensor
  * una viñeta suave, como la de las lentes de cine

Uso:  python oscar_presets.py   (escribe los .xmp en presets/FOTONEANDO Oscar)
"""
import os
import unicodedata

from referencia_a_preset import BANDS, monotone, to_xmp

GROUP = "FOTONEANDO · Óscar"
TINT_GAIN = 1.6   # intensidad general de los tintes de color
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "presets", "FOTONEANDO Oscar")

# Base «cine para APS-C»: se aplica a todos los looks (cada look puede cambiar sus valores).
BASE = {
    "LensProfileEnable": "1", "AutoLateralCA": "1",
    "Sharpness": "28", "SharpenRadius": "+1.0", "SharpenDetail": "20", "SharpenEdgeMasking": "25",
    "LuminanceSmoothing": "8", "ColorNoiseReduction": "25",
    "Highlights2012": "-35", "Shadows2012": "+15", "Whites2012": "-10", "Blacks2012": "-5",
}

# Cada look: curva maestra, tintes por zona (sombras, medios, luces) en las curvas RGB,
# saturación, intensidad, HSL (tono, saturación, luminancia), claridad, neblina, grano,
# viñeta y, si hace falta, blanco y negro con su mezcla de canales.
LOOKS = [
    dict(year=2012, dp="Robert Richardson", film="Hugo", name="Reloj de ámbar",
         desc="Ámbar y oro de lámpara con azules verdosos en las sombras; luz que brilla con suavidad.",
         curve=[(0, 0.03), (0.25, 0.23), (0.5, 0.52), (0.75, 0.8), (1, 0.97)],
         tints=[(0.12, -0.015, 0.006, 0.02), (0.5, 0.02, 0.006, -0.02), (0.85, 0.03, 0.012, -0.035)],
         sat=6, vib=12, clarity=-14, dehaze=-4, grain=14, vig=-18,
         hsl={"Orange": (-2, 12, 4), "Yellow": (-8, 10, 0), "Aqua": (6, 14, -6), "Blue": (-10, 8, -10), "Green": (14, -20, -8)}),
    dict(year=2013, dp="Claudio Miranda", film="Life of Pi", name="Océano luminoso",
         desc="Color limpio y luminoso, con aguas y cielos turquesa intensos, como una pintura brillante.",
         curve=[(0, 0.01), (0.25, 0.24), (0.5, 0.52), (0.75, 0.79), (1, 0.98)],
         tints=[(0.12, -0.006, 0.0, 0.012), (0.85, 0.008, 0.004, -0.004)],
         sat=10, vib=25, clarity=6, dehaze=6, grain=6, vig=-10,
         hsl={"Aqua": (-4, 28, 4), "Blue": (-6, 22, -6), "Orange": (0, 6, 4), "Purple": (-6, 14, 0), "Green": (8, 6, 0)}),
    dict(year=2014, dp="Emmanuel Lubezki", film="Gravity", name="Órbita",
         desc="Negros profundos y luz dura y limpia, como la del sol en el espacio; tonos fríos y metálicos.",
         curve=[(0, 0), (0.22, 0.16), (0.5, 0.5), (0.78, 0.84), (1, 1)],
         tints=[(0.12, -0.008, 0.0, 0.014), (0.5, -0.006, 0.0, 0.008), (0.85, 0.004, 0.004, 0.006)],
         sat=-14, vib=0, clarity=10, dehaze=4, grain=4, vig=-22, extra={"Highlights2012": "-45", "Blacks2012": "-15"},
         hsl={"Orange": (0, 4, 4), "Blue": (-6, 10, -10), "Aqua": (-4, -10, 0), "Yellow": (0, -20, 0), "Green": (0, -30, -10)}),
    dict(year=2015, dp="Emmanuel Lubezki", film="Birdman", name="Tras bambalinas",
         desc="Pasillos de teatro con luz de tungsteno: medios cálidos y verdosos, azules apagados y grano visible.",
         curve=[(0, 0.02), (0.22, 0.17), (0.5, 0.5), (0.78, 0.82), (1, 0.97)],
         tints=[(0.12, 0.0, 0.01, 0.004), (0.5, 0.018, 0.016, -0.03), (0.85, 0.02, 0.012, -0.03)],
         sat=-4, vib=0, clarity=8, dehaze=0, grain=24, vig=-24,
         hsl={"Orange": (2, -6, 0), "Yellow": (-10, -12, -6), "Blue": (-8, -30, -12), "Aqua": (0, -24, 0), "Red": (4, 10, -6)}),
    dict(year=2016, dp="Emmanuel Lubezki", film="The Revenant", name="Luz natural de invierno",
         desc="Solo luz natural: invierno frío y desaturado, nieve gris azulada, verdes apagados y luces suaves.",
         curve=[(0, 0.025), (0.25, 0.24), (0.5, 0.49), (0.75, 0.75), (1, 0.95)],
         tints=[(0.12, -0.01, 0.0, 0.016), (0.5, -0.012, 0.0, 0.014), (0.85, -0.008, 0.0, 0.012)],
         sat=-24, vib=-4, clarity=4, dehaze=6, grain=10, vig=-16, extra={"Highlights2012": "-55", "Shadows2012": "+25"},
         hsl={"Green": (12, -35, -12), "Yellow": (6, -30, -6), "Orange": (0, -6, 2), "Blue": (-6, -10, -6), "Aqua": (-6, -14, 0)}),
    dict(year=2017, dp="Linus Sandgren", film="La La Land", name="Hora mágica musical",
         desc="Cielos de hora mágica en violeta y magenta, colores primarios saturados y grano de película de 35 mm.",
         curve=[(0, 0.03), (0.25, 0.24), (0.5, 0.52), (0.75, 0.79), (1, 0.97)],
         tints=[(0.12, 0.012, -0.006, 0.022), (0.5, 0.012, 0.0, 0.0), (0.85, 0.02, 0.006, -0.012)],
         sat=8, vib=22, clarity=-10, dehaze=-3, grain=18, vig=-14,
         hsl={"Purple": (-10, 30, -4), "Magenta": (0, 20, 0), "Blue": (8, 24, -8), "Yellow": (-6, 16, 2), "Red": (0, 12, 0), "Green": (8, 0, -6)}),
    dict(year=2018, dp="Roger Deakins", film="Blade Runner 2049", name="Bruma naranja",
         desc="Ciudad cubierta de bruma naranja: casi monocromo, contraste bajo y luces que se disuelven.",
         curve=[(0, 0.05), (0.25, 0.26), (0.5, 0.5), (0.75, 0.74), (1, 0.93)],
         tints=[(0.12, 0.03, 0.008, -0.02), (0.5, 0.06, 0.012, -0.08), (0.85, 0.045, 0.012, -0.09), (1.0, 0.0, -0.01, -0.07)],
         sat=-6, vib=0, clarity=-12, dehaze=-14, grain=10, vig=-12,
         hsl={"Orange": (-4, 18, 6), "Yellow": (-18, 6, 0), "Red": (10, -10, 0), "Blue": (-40, -60, -20), "Aqua": (-40, -60, 0), "Green": (-40, -60, 0), "Purple": (0, -60, 0)}),
    dict(year=2019, dp="Alfonso Cuarón", film="Roma", name="Plata nítida",
         desc="Blanco y negro digital y limpio, con mucho detalle en luces y sombras: gris plateado y sin grano.",
         curve=[(0, 0.02), (0.25, 0.23), (0.5, 0.5), (0.75, 0.78), (1, 0.98)],
         tints=[], sat=0, vib=0, clarity=12, dehaze=4, grain=0, vig=-8, bw=True,
         extra={"Highlights2012": "-50", "Shadows2012": "+30"},
         gray={"Red": 10, "Orange": 14, "Yellow": 8, "Green": -6, "Aqua": -10, "Blue": -14, "Purple": 0, "Magenta": 4}),
    dict(year=2020, dp="Roger Deakins", film="1917", name="Trinchera",
         desc="Naturalismo de guerra: verdes y amarillos apagados, piel natural, cielos grises y contraste moderado.",
         curve=[(0, 0.025), (0.25, 0.23), (0.5, 0.5), (0.75, 0.77), (1, 0.96)],
         tints=[(0.12, -0.004, 0.002, 0.008), (0.5, 0.004, 0.002, -0.004), (0.85, 0.0, 0.0, 0.004)],
         sat=-14, vib=0, clarity=6, dehaze=3, grain=8, vig=-14,
         hsl={"Green": (-6, -32, -10), "Yellow": (-8, -30, -6), "Orange": (0, -4, 2), "Blue": (-4, -18, -6), "Aqua": (0, -20, 0)}),
    dict(year=2021, dp="Erik Messerschmidt", film="Mank", name="Noche de estudio",
         desc="Blanco y negro de estudio de los años 30 y 40: negros densos, brillo en las luces, grano y viñeta.",
         curve=[(0, 0.01), (0.22, 0.14), (0.5, 0.5), (0.78, 0.84), (1, 0.98)],
         tints=[], sat=0, vib=0, clarity=-16, dehaze=0, grain=32, vig=-28, bw=True,
         extra={"Highlights2012": "-25", "Blacks2012": "-20"},
         gray={"Red": 20, "Orange": 22, "Yellow": 10, "Green": -10, "Aqua": -16, "Blue": -24, "Purple": -6, "Magenta": 8}),
    dict(year=2022, dp="Greig Fraser", film="Dune", name="Arena y especia",
         desc="Desierto de arena ocre: contraste suave, color contenido, sombras ligeramente frías y luces cremosas.",
         curve=[(0, 0.035), (0.25, 0.25), (0.5, 0.5), (0.75, 0.75), (1, 0.95)],
         tints=[(0.12, -0.006, 0.0, 0.01), (0.5, 0.016, 0.008, -0.018), (0.85, 0.018, 0.01, -0.02)],
         sat=-18, vib=0, clarity=-6, dehaze=-6, grain=10, vig=-14,
         hsl={"Orange": (-2, 4, 6), "Yellow": (-10, -14, -4), "Blue": (-4, -24, -10), "Aqua": (0, -30, -6), "Green": (-10, -40, -10)}),
    dict(year=2023, dp="James Friend", film="All Quiet on the Western Front", name="Frente gris",
         desc="Guerra fría y sucia: casi sin color, gris acero azulado, barro marrón y una textura áspera.",
         curve=[(0, 0.02), (0.22, 0.17), (0.5, 0.49), (0.78, 0.8), (1, 0.95)],
         tints=[(0.12, -0.01, 0.0, 0.016), (0.5, -0.01, 0.0, 0.012), (0.85, -0.006, 0.0, 0.01)],
         sat=-40, vib=-6, clarity=18, dehaze=6, grain=20, vig=-20,
         hsl={"Orange": (0, 10, 0), "Red": (0, 6, -6), "Green": (0, -30, -10), "Yellow": (0, -30, -8), "Blue": (0, -10, -10)}),
    dict(year=2024, dp="Hoyte van Hoytema", film="Oppenheimer", name="Película gran formato",
         desc="Película de gran formato: piel cálida y rica, negros profundos, color natural y grano finísimo.",
         curve=[(0, 0.012), (0.22, 0.18), (0.5, 0.51), (0.78, 0.82), (1, 0.97)],
         tints=[(0.12, 0.0, 0.004, 0.006), (0.5, 0.012, 0.006, -0.012), (0.85, 0.016, 0.01, -0.016)],
         sat=0, vib=8, clarity=4, dehaze=2, grain=12, vig=-16,
         hsl={"Orange": (-2, 8, 4), "Red": (4, 6, -4), "Yellow": (-6, -4, 0), "Blue": (-4, -6, -8), "Aqua": (0, -12, 0), "Green": (8, -16, -6)}),
    dict(year=2025, dp="Lol Crawley", film="The Brutalist", name="Hormigón cálido",
         desc="Película de los años 50: tonos terrosos y apagados, negros algo lavados, luces cremosas y grano.",
         curve=[(0, 0.045), (0.25, 0.25), (0.5, 0.5), (0.75, 0.76), (1, 0.94)],
         tints=[(0.12, 0.004, 0.006, 0.0), (0.5, 0.012, 0.008, -0.012), (0.85, 0.016, 0.012, -0.02)],
         sat=-14, vib=0, clarity=-6, dehaze=-3, grain=22, vig=-18,
         hsl={"Orange": (-2, 0, 4), "Yellow": (-8, -16, -4), "Green": (10, -30, -10), "Blue": (-6, -24, -8), "Aqua": (0, -24, 0), "Red": (4, -8, -4)}),
    dict(year=2026, dp="Autumn Durald Arkapaw", film="Sinners", name="Delta del Misisipi",
         desc="Película de gran formato en el sur de EE. UU.: piel dorada y profunda, negros ricos, verdes húmedos y noches azules.",
         curve=[(0, 0.01), (0.22, 0.17), (0.5, 0.51), (0.78, 0.83), (1, 0.97)],
         tints=[(0.12, -0.006, 0.002, 0.014), (0.5, 0.016, 0.008, -0.014), (0.85, 0.02, 0.012, -0.02)],
         sat=4, vib=14, clarity=4, dehaze=2, grain=14, vig=-18,
         hsl={"Orange": (-2, 12, 2), "Red": (4, 10, -6), "Yellow": (-10, 0, -4), "Green": (12, -6, -14), "Aqua": (-6, 6, -6), "Blue": (-8, 14, -12)}),
]


def tint(s, x, dr, dg, db):
    """Suma un tinte (0..1) a las curvas RGB alrededor del tono x."""
    for c, d in zip("rgb", (dr, dg, db)):
        pts = [p for p in s["channels"][c] if abs(p[0] - x) >= 0.06]
        base = x
        for p in s["channels"][c]:
            if abs(p[0] - x) < 0.06:
                base = p[1]
        pts.append((x, base + d))
        s["channels"][c] = monotone(pts)


def settings(look):
    s = {"curve": look["curve"], "channels": {c: [(0.0, 0.0), (1.0, 1.0)] for c in "rgb"},
         "saturation": look["sat"], "Vibrance": look["vib"], "Clarity2012": look["clarity"], "Dehaze": look["dehaze"],
         "grain": look["grain"], "vignette": look["vig"], "bw": look.get("bw", False),
         "hsl": {k: look.get("hsl", {}).get(k, (0, 0, 0)) for k, _ in BANDS}}
    for x, dr, dg, db in look["tints"]:
        tint(s, x, dr * TINT_GAIN, dg * TINT_GAIN, db * TINT_GAIN)
    if "gray" in look:
        s["gray"] = look["gray"]
    extra = dict(BASE)
    extra.update(look.get("extra", {}))
    s["extra"] = extra
    return s


def preset_name(look):
    return "OS %d %s · %s" % (look["year"], look["dp"].split()[-1], look["name"])


def build(out=OUT):
    os.makedirs(out, exist_ok=True)
    for look in LOOKS:
        name = preset_name(look)
        desc = "Inspirado en %s (%s, Óscar a Mejor Fotografía %d). %s Interpretación libre, no es el etalonaje oficial." % (
            look["film"], look["dp"], look["year"], look["desc"])
        # Nombre de archivo sin acentos (Windows y los .zip se llevan mejor así);
        # dentro de Camera Raw el preset conserva su nombre con acentos.
        fname = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode().replace("  ", " - ")
        with open(os.path.join(out, fname + ".xmp"), "w", encoding="utf-8") as fh:
            fh.write(to_xmp(settings(look), name, GROUP, desc))
    return len(LOOKS)


if __name__ == "__main__":
    print("%d presets en %s" % (build(), OUT))
