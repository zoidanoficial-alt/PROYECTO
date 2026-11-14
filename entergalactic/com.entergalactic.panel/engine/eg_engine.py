#!/usr/bin/env python3
"""ENTERGALACTIC - motor de efectos para Photoshop.

    python eg_engine.py --check
    python eg_engine.py --schema
    python eg_engine.py -i entrada.png -o salida.png --recipe receta.json
    python eg_engine.py -i entrada.png --recipe receta.json --preview carpeta [--preview-mode fit|crop]
    python eg_engine.py -i entrada.png --measure-noise [--save-profile "Mi cámara ISO 3200"]

La receta es un JSON {"stack": [{"id": "glow", "opacity": 80, "blend": "normal",
"mask": {"type": "highlights"}, "params": {...}}, ...]} con hasta 15 filtros.
Escribe el progreso como líneas JSON en stdout y termina con {"ok": true|false, ...}.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
import traceback


def emit(**data):
    sys.stdout.write(json.dumps(data, ensure_ascii=False) + "\n")
    sys.stdout.flush()


def parse_args(argv=None):
    p = argparse.ArgumentParser(description="ENTERGALACTIC - motor de efectos")
    p.add_argument("--check", action="store_true")
    p.add_argument("--schema", action="store_true")
    p.add_argument("-i", "--input")
    p.add_argument("-o", "--output")
    p.add_argument("--recipe", help="ruta a la receta JSON")
    p.add_argument("--recipe-json", help="receta JSON en línea")
    p.add_argument("--preview", help="carpeta donde guardar before.png / after.png")
    p.add_argument("--preview-mode", default="fit", choices=["fit", "crop"])
    p.add_argument("--preview-size", type=int, default=640)
    p.add_argument("--cx", type=float, default=0.5)
    p.add_argument("--cy", type=float, default=0.5)
    p.add_argument("--seed", type=int, default=1)
    p.add_argument("--measure-noise", action="store_true")
    p.add_argument("--save-profile")
    p.add_argument("--profiles-dir")
    return p.parse_args(argv)


def _load_recipe(args):
    if args.recipe_json:
        return json.loads(args.recipe_json)
    if args.recipe:
        with open(args.recipe, "r", encoding="utf-8") as fh:
            return json.load(fh)
    return {"stack": []}


def _stack_scale(recipe):
    s = 1
    for it in recipe.get("stack") or []:
        if it.get("enabled", True) and it.get("id") == "upscale":
            s *= int((it.get("params") or {}).get("scale", 2))
    return s


def _fit_pair(before, after, np, cv2):
    """Ajusta 'antes' al tamaño de 'después' para el comparador."""
    if before.shape == after.shape:
        return before
    bh, bw = before.shape[:2]
    ah, aw = after.shape[:2]
    if abs(bw / bh - aw / ah) < 0.01:
        return cv2.resize(before, (aw, ah), interpolation=cv2.INTER_NEAREST)
    s = min(aw / bw, ah / bh)
    nb = cv2.resize(before, (max(1, int(bw * s)), max(1, int(bh * s))), interpolation=cv2.INTER_AREA)
    canvas = np.full_like(after, 0.18)
    y0, x0 = (ah - nb.shape[0]) // 2, (aw - nb.shape[1]) // 2
    canvas[y0:y0 + nb.shape[0], x0:x0 + nb.shape[1]] = nb
    return canvas


def main(argv=None):
    args = parse_args(argv)
    t0 = time.time()
    try:
        try:
            import numpy as np
            import cv2
        except ImportError as exc:
            raise RuntimeError("Faltan dependencias (%s). Ejecuta: pip install -r requirements.txt" % exc)
        if args.profiles_dir:
            os.environ["EG_PROFILE_DIR"] = args.profiles_dir
        import eg
        from eg import core as C
        from eg import filters_clean, filters_realce
        if args.profiles_dir:
            filters_clean.PROFILE_DIR = args.profiles_dir

        if args.check:
            emit(ok=True, check={
                "version": eg.__version__, "python": sys.version.split()[0], "numpy": np.__version__,
                "opencv": cv2.__version__, "dnn_superres": hasattr(cv2, "dnn_superres"),
                "models": filters_realce.available_models(), "filters": len(eg.FILTERS),
                "profiles": filters_clean.list_profiles(),
            })
            return 0
        if args.schema:
            emit(ok=True, schema=eg.schema())
            return 0
        if not args.input:
            raise RuntimeError("Falta --input")

        rgb, alpha, dtype = C.load_image(args.input)
        H, W = rgb.shape[:2]

        if args.measure_noise:
            prof = filters_clean.measure_noise(rgb)
            res = {"profile": prof}
            if args.save_profile:
                res["saved"] = filters_clean.save_profile(args.save_profile, prof)
            emit(ok=True, seconds=round(time.time() - t0, 2), **res)
            return 0

        recipe = _load_recipe(args)

        def progress(frac, label):
            emit(progress=round(frac, 4), stage=label)

        if args.preview:
            size = max(64, args.preview_size)
            if args.preview_mode == "crop":
                cs = max(32, int(size / _stack_scale(recipe)))
                cw, ch = min(cs, W), min(cs, H)
                x0 = int(min(max(0, round(args.cx * W - cw / 2)), W - cw))
                y0 = int(min(max(0, round(args.cy * H - ch / 2)), H - ch))
                work = rgb[y0:y0 + ch, x0:x0 + cw].copy()
                ctx = C.Context(ch, cw, 1.0, (x0 / W, y0 / H, (x0 + cw) / W, (y0 + ch) / H), args.seed, (W, H))
            else:
                k = min(1.0, size / float(max(W, H)))
                pw, ph = max(1, int(round(W * k))), max(1, int(round(H * k)))
                work = cv2.resize(rgb, (pw, ph), interpolation=cv2.INTER_AREA) if k < 1 else rgb.copy()
                ctx = C.Context(ph, pw, pw / float(W), (0, 0, 1, 1), args.seed, (W, H))
            after, _ = eg.run_stack(work, recipe, ctx, progress)
            before = _fit_pair(work, after, np, cv2)
            os.makedirs(args.preview, exist_ok=True)
            pb, pa = os.path.join(args.preview, "before.png"), os.path.join(args.preview, "after.png")
            C.save_image(pb, before)
            C.save_image(pa, after)
            emit(ok=True, preview={"before": pb, "after": pa}, seconds=round(time.time() - t0, 2))
            return 0

        if not args.output:
            raise RuntimeError("Falta --output")
        ctx = C.Context(H, W, 1.0, (0, 0, 1, 1), args.seed, (W, H))
        ctx.alpha = alpha
        out, ctx = eg.run_stack(rgb, recipe, ctx, progress)
        out_alpha = ctx.alpha if (ctx.alpha is not None and ctx.alpha.shape == out.shape[:2]) else None
        emit(progress=1.0, stage="Guardando")
        C.save_image(args.output, out, out_alpha, dtype)
        h, w = out.shape[:2]
        emit(ok=True, output=args.output, width=w, height=h, resized=(w != W or h != H),
             seconds=round(time.time() - t0, 2))
        return 0
    except Exception as exc:
        emit(ok=False, error=str(exc), trace=traceback.format_exc())
        return 1


if __name__ == "__main__":
    sys.exit(main())
