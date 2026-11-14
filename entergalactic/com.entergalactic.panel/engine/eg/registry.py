"""Registro de filtros y ejecución de pilas (recetas).

Un filtro es una función f(img, p, ctx) -> img registrada con su esquema de
parámetros. El panel construye la interfaz automáticamente a partir del esquema
(`schema()`), así que añadir un filtro aquí lo añade también al panel.
"""
from __future__ import annotations

import numpy as np
import cv2

from . import core

MAX_STACK = 15

MODULES = [
    ("chroma", "Chroma", "Color cinematográfico, contraste, luz y atmósferas"),
    ("cine", "Cine", "Looks inspirados en grandes directores de fotografía"),
    ("plata", "Plata", "Blanco y negro de estética química tradicional"),
    ("analog", "Analógico", "Cámaras antiguas, fugas de luz, polvo y película vintage"),
    ("clean", "Clean", "Reducción de ruido de luminancia y color"),
    ("realce", "Realce IA", "Ampliación con IA, nitidez y limpieza"),
]

FILTERS = {}


class Filter:
    def __init__(self, fid, name, modules, params, fn, desc, resizes=False):
        self.id, self.name, self.modules, self.params = fid, name, modules, params
        self.fn, self.desc, self.resizes = fn, desc, resizes

    def defaults(self):
        return {p["id"]: p["default"] for p in self.params}

    def fill(self, given):
        out = self.defaults()
        for p in self.params:
            if given and p["id"] in given:
                v = given[p["id"]]
                if p["type"] in ("range", "hue"):
                    v = float(min(max(float(v), p["min"]), p["max"]))
                elif p["type"] == "check":
                    v = bool(v)
                elif p["type"] == "select":
                    if v not in [o[0] for o in p["options"]]:
                        v = p["default"]
                out[p["id"]] = v
        return out


def register(fid, name, modules, params, desc="", resizes=False):
    def deco(fn):
        if fid in FILTERS:
            raise ValueError("Filtro duplicado: %s" % fid)
        FILTERS[fid] = Filter(fid, name, modules, params, fn, desc, resizes)
        return fn
    return deco


# Ayudantes para declarar parámetros
def rng(pid, label, lo, hi, default, step=1, unit=""):
    return {"id": pid, "label": label, "type": "range", "min": lo, "max": hi,
            "default": default, "step": step, "unit": unit}


def hue(pid, label, default):
    return {"id": pid, "label": label, "type": "hue", "min": 0, "max": 360, "default": default, "step": 1}


def sel(pid, label, options, default=None):
    return {"id": pid, "label": label, "type": "select", "options": options,
            "default": default if default is not None else options[0][0]}


def chk(pid, label, default=False):
    return {"id": pid, "label": label, "type": "check", "default": default}


# --------------------------------------------------------------------------- ejecución
def run_stack(img, recipe, ctx, progress=None):
    """Aplica una receta {"stack": [...]} y devuelve (imagen, ctx final)."""
    stack = [it for it in (recipe.get("stack") or []) if it.get("enabled", True)]
    if len(stack) > MAX_STACK:
        raise RuntimeError("Máximo %d filtros por receta." % MAX_STACK)
    n = len(stack)
    for i, item in enumerate(stack):
        f = FILTERS.get(item.get("id"))
        if f is None:
            raise RuntimeError("Filtro desconocido: %s" % item.get("id"))
        if progress:
            progress(i / max(1, n), f.name)
        params = f.fill(item.get("params") or {})
        ctx.alpha_in = ctx.alpha
        out = f.fn(img, params, ctx)
        if out.shape != img.shape:
            # El filtro cambió el tamaño (ampliar, marco): se aplica completo.
            img = np.clip(out, 0, 1).astype(np.float32)
            ctx = ctx.resized(img.shape[0], img.shape[1], getattr(ctx, "last_scale", 1.0))
            continue
        mode = item.get("blend", "normal")
        opacity = float(item.get("opacity", 100)) / 100.0
        res = core.blend(img, np.clip(out, 0, 1), mode) if mode != "normal" else out
        mask = core.build_mask(img, item.get("mask"), ctx)
        if mask is None and opacity >= 0.999:
            img = res
        else:
            w = opacity if mask is None else (mask * opacity)[..., None]
            img = img + (res - img) * w
        img = np.clip(img, 0, 1).astype(np.float32)
    if progress:
        progress(1.0, "Listo")
    return img, ctx


def schema():
    from . import presets
    return {
        "max_stack": MAX_STACK,
        "modules": [{"id": m, "name": n, "desc": d} for m, n, d in MODULES],
        "blend_modes": [{"id": a, "name": b} for a, b in core.BLEND_MODES],
        "mask_types": [{"id": a, "name": b} for a, b in core.MASK_TYPES],
        "filters": [
            {"id": f.id, "name": f.name, "modules": f.modules, "desc": f.desc,
             "resizes": f.resizes, "params": f.params}
            for f in FILTERS.values()
        ],
        "presets": presets.PRESETS,
    }
