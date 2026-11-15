#!/usr/bin/env python3
"""Genera web/schema.json para la app Android a partir del catálogo del motor de Photoshop.

La app móvil lleva sólo lo necesario: módulos Cine, Pop, Chroma, Plata y Analógico
(sin Clean ni Realce IA, que necesitan OpenCV/modelos de IA). Así hay un único
catálogo de filtros y recetas para las dos plataformas.
"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, "..", ".."))
ENGINE = os.path.join(ROOT, "entergalactic", "com.entergalactic.panel", "engine")
OUT = os.path.join(HERE, "..", "web", "schema.json")

MOBILE_MODULES = ["cine", "pop", "chroma", "plata", "analog"]
# Filtros que dependen de OpenCV/IA y no se incluyen en el móvil.
EXCLUDED = {"denoise", "color_noise_only", "hot_pixels", "upscale"}


def build():
    sys.path.insert(0, ENGINE)
    import eg  # noqa: E402
    s = eg.schema()
    filters = []
    for f in s["filters"]:
        if f["id"] in EXCLUDED:
            continue
        mods = [m for m in f["modules"] if m in MOBILE_MODULES]
        if f["id"] == "sharpen":
            mods = ["chroma", "plata"]
        if not mods:
            continue
        filters.append(dict(f, modules=mods))
    ids = {f["id"] for f in filters}
    presets = []
    for p in s["presets"]:
        if p["module"] not in MOBILE_MODULES:
            continue
        missing = [it["id"] for it in p["stack"] if it["id"] not in ids]
        if missing:
            raise SystemExit("La receta %r usa filtros no incluidos: %s" % (p["name"], missing))
        presets.append(p)
    order = {m: i for i, m in enumerate(MOBILE_MODULES)}
    modules = sorted([m for m in s["modules"] if m["id"] in MOBILE_MODULES], key=lambda m: order[m["id"]])
    presets.sort(key=lambda p: order[p["module"]])
    # Las máscaras inteligentes (cielo, piel, sujeto…) sólo existen en el motor de escritorio.
    from eg import core as _core
    masks = [m for m in s["mask_types"] if m["id"] in _core.BASIC_MASK_TYPES]
    return dict(s, modules=modules, filters=filters, presets=presets, mask_types=masks)


if __name__ == "__main__":
    sch = build()
    with open(OUT, "w", encoding="utf-8") as fh:
        json.dump(sch, fh, ensure_ascii=False, separators=(",", ":"))
    print("schema.json: %d filtros, %d recetas, módulos %s" % (
        len(sch["filters"]), len(sch["presets"]), [m["id"] for m in sch["modules"]]))
