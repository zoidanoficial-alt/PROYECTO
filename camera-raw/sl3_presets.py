#!/usr/bin/env python3
"""Versión de los presets Óscar ajustada a la Canon EOS Rebel SL3 (EOS 250D),
con el 50 mm y el EF-S 18-55 mm f/4-5.6 IS STM.

Qué cambia respecto a la versión general:
  * Calibración de color para el sensor Canon con el perfil Adobe Standard
    (piel menos rosada, verdes menos amarillos y azules más limpios y profundos).
    Los perfiles «Camera Neutral» de Canon no existen en Camera Raw 10 para esta
    cámara, así que se compensa desde el panel de calibración.
  * Enfoque pensado para un sensor de 24 MP con filtro antialiasing, y reducción
    de ruido de color para el procesador DIGIC 8.
  * Luces más protegidas: el rango dinámico de la SL3 es menor que el de una cámara de cine.
  * Corrección de perfil de lente (ambos lentes tienen perfil en Camera Raw).

Además crea tres «complementos de ISO»: presets parciales que solo tocan la
reducción de ruido y el enfoque. Se aplican después del look, según el ISO de la foto.

Uso:  python sl3_presets.py
"""
import os
import unicodedata
import uuid
from xml.sax.saxutils import escape

import oscar_presets as O
from referencia_a_preset import to_xmp

HERE = os.path.dirname(os.path.abspath(__file__))
OUT_LOOKS = os.path.join(HERE, "presets", "FOTONEANDO Oscar SL3")
OUT_ISO = os.path.join(HERE, "presets", "FOTONEANDO SL3 Ajustes")
GROUP_LOOKS = "FOTONEANDO · Óscar SL3"
GROUP_ISO = "FOTONEANDO · SL3 Ajustes"

# Base para la SL3: sustituye a la base APS-C genérica.
SL3_BASE = {
    "LensProfileEnable": "1", "AutoLateralCA": "1",
    # Detalle: 24 MP con filtro antialiasing.
    "Sharpness": "32", "SharpenRadius": "+0.8", "SharpenDetail": "18", "SharpenEdgeMasking": "30",
    "LuminanceSmoothing": "10", "ColorNoiseReduction": "28",
    # Tono: proteger luces y abrir sombras sin perder negros.
    "Highlights2012": "-42", "Shadows2012": "+18", "Whites2012": "-14", "Blacks2012": "-6",
    # Calibración del sensor Canon con Adobe Standard.
    "RedHue": "+5", "RedSaturation": "-4",
    "GreenHue": "-6", "GreenSaturation": "-2",
    "BlueHue": "-8", "BlueSaturation": "+12",
    "ShadowTint": "+2",
}

# Complementos de ISO (presets parciales: solo ruido y enfoque).
ISO_PRESETS = [
    ("SL3 · ISO 100-400 (limpio)", "ISO bajo: casi sin reducción de ruido, enfoque fino.",
     {"LuminanceSmoothing": "5", "ColorNoiseReduction": "20", "Sharpness": "35", "SharpenRadius": "+0.8",
      "SharpenDetail": "20", "SharpenEdgeMasking": "30"}),
    ("SL3 · ISO 800-1600", "ISO medio: limpia el ruido de color y suaviza un poco el de luminancia.",
     {"LuminanceSmoothing": "18", "LuminanceNoiseReductionDetail": "50", "ColorNoiseReduction": "35",
      "Sharpness": "30", "SharpenRadius": "+0.9", "SharpenDetail": "15", "SharpenEdgeMasking": "40"}),
    ("SL3 · ISO 3200-6400 (noche)", "ISO alto: reducción de ruido fuerte, enfoque solo en los bordes.",
     {"LuminanceSmoothing": "32", "LuminanceNoiseReductionDetail": "40", "ColorNoiseReduction": "45",
      "ColorNoiseReductionDetail": "40", "Sharpness": "25", "SharpenRadius": "+1.0", "SharpenDetail": "10",
      "SharpenEdgeMasking": "55"}),
]


def ascii_name(name):
    return unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode().replace("  ", " - ")


def partial_xmp(name, group, desc, attrs):
    """Preset parcial: Camera Raw solo cambia los ajustes incluidos."""
    head = {"PresetType": "Normal", "Cluster": "", "UUID": uuid.uuid4().hex.upper(),
            "SupportsAmount": "False", "SupportsColor": "True", "SupportsMonochrome": "True",
            "SupportsHighDynamicRange": "True", "SupportsNormalDynamicRange": "True",
            "SupportsSceneReferred": "True", "SupportsOutputReferred": "True",
            "CameraModelRestriction": "", "Copyright": "", "ContactInfo": "", "Version": "10.0",
            "HasSettings": "True"}
    head.update(attrs)
    body = "\n".join('   crs:%s="%s"' % kv for kv in head.items())

    def alt(tag, text):
        return ('   <crs:%s>\n    <rdf:Alt>\n     <rdf:li xml:lang="x-default">%s</rdf:li>\n    </rdf:Alt>\n   </crs:%s>\n'
                % (tag, escape(text), tag))
    return ('<x:xmpmeta xmlns:x="adobe:ns:meta/" x:xmptk="Adobe XMP Core 5.6-c140">\n'
            ' <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">\n'
            '  <rdf:Description rdf:about=""\n    xmlns:crs="http://ns.adobe.com/camera-raw-settings/1.0/"\n'
            + body + '>\n' + alt("Name", name) + alt("ShortName", "") + alt("SortName", "")
            + alt("Group", group) + alt("Description", desc)
            + '  </rdf:Description>\n </rdf:RDF>\n</x:xmpmeta>\n')


def build():
    os.makedirs(OUT_LOOKS, exist_ok=True)
    os.makedirs(OUT_ISO, exist_ok=True)
    for look in O.LOOKS:
        s = O.settings(look)
        extra = dict(SL3_BASE)
        extra.update(look.get("extra", {}))         # los ajustes propios del look mandan
        s["extra"] = extra
        name = "SL3 %d %s · %s" % (look["year"], look["dp"].split()[-1], look["name"])
        desc = ("Versión para Canon Rebel SL3 / 250D. Inspirado en %s (%s, Óscar a Mejor Fotografía %d). %s "
                "Interpretación libre, no es el etalonaje oficial." % (look["film"], look["dp"], look["year"], look["desc"]))
        with open(os.path.join(OUT_LOOKS, ascii_name(name) + ".xmp"), "w", encoding="utf-8") as fh:
            fh.write(to_xmp(s, name, GROUP_LOOKS, desc))
    for name, desc, attrs in ISO_PRESETS:
        with open(os.path.join(OUT_ISO, ascii_name(name) + ".xmp"), "w", encoding="utf-8") as fh:
            fh.write(partial_xmp(name, GROUP_ISO, desc, attrs))
    return len(O.LOOKS), len(ISO_PRESETS)


if __name__ == "__main__":
    n, m = build()
    print("%d looks SL3 y %d complementos de ISO" % (n, m))
