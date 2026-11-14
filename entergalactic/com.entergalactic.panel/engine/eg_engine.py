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
    p.add_argument("--source-rect", type=float, nargs=4, metavar=("X0", "Y0", "X1", "Y1"),
                   help="zona de la imagen completa que representa la entrada (0..1)")
    p.add_argument("--full-size", type=int, nargs=2, metavar=("W", "H"),
                   help="tamaño en píxeles de la imagen completa original")
    p.add_argument("--serve", action="store_true", help="modo servidor: peticiones JSON por stdin")
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


def prepare_preview(rgb, mode, size, cx, cy, src_rect=None, full_size=None, seed=1, stack_scale=1):
    """Prepara la imagen de trabajo de la vista previa y su contexto geométrico.

    La entrada puede ser la imagen completa, una versión reducida exportada por
    Photoshop (src_rect = 0,0,1,1) o un recorte a 100 % (src_rect = zona). Con
    src_rect y full_size, las viñetas, degradados, etc. caen donde caerán en el
    resultado final.
    """
    import cv2
    from eg import core as C
    ih, iw = rgb.shape[:2]
    rx0, ry0, rx1, ry1 = src_rect or (0.0, 0.0, 1.0, 1.0)
    FW, FH = full_size or (int(round(iw / (rx1 - rx0))), int(round(ih / (ry1 - ry0))))
    k_in = iw / (FW * (rx1 - rx0))          # píxeles de entrada por píxel original
    size = max(64, int(size))
    if mode == "crop":
        cs = max(32, int(size / max(1, stack_scale)))
        cw, ch = min(cs, iw), min(cs, ih)
        px = (cx - rx0) / (rx1 - rx0) * iw
        py = (cy - ry0) / (ry1 - ry0) * ih
        x0 = int(min(max(0, round(px - cw / 2)), iw - cw))
        y0 = int(min(max(0, round(py - ch / 2)), ih - ch))
        work = rgb[y0:y0 + ch, x0:x0 + cw].copy()
        sx, sy = (rx1 - rx0) / iw, (ry1 - ry0) / ih
        rect = (rx0 + x0 * sx, ry0 + y0 * sy, rx0 + (x0 + cw) * sx, ry0 + (y0 + ch) * sy)
        return work, C.Context(ch, cw, k_in, rect, seed, (FW, FH))
    s = min(1.0, size / float(max(iw, ih)))
    if s < 1.0:
        work = cv2.resize(rgb, (max(1, int(round(iw * s))), max(1, int(round(ih * s)))), interpolation=cv2.INTER_AREA)
    else:
        work = rgb.copy()
    h, w = work.shape[:2]
    return work, C.Context(h, w, k_in * w / float(iw), (rx0, ry0, rx1, ry1), seed, (FW, FH))


def serve():
    """Motor persistente: evita arrancar Python (NumPy, OpenCV) en cada vista previa.

    Cada línea de stdin es una petición JSON con "id"; cada respuesta lleva el mismo "id".
    La imagen fuente y su versión reducida quedan en memoria entre peticiones.
    """
    import numpy as np
    import cv2
    import eg
    from eg import core as C
    from eg import filters_clean

    src_cache = {}      # ruta -> (mtime, rgb)
    work_cache = {}     # clave -> (work, ctx_args)
    before_written = {}  # carpeta -> clave de la imagen "antes" ya escrita

    def load(path):
        mt = os.path.getmtime(path)
        hit = src_cache.get(path)
        if hit and hit[0] == mt:
            return hit[1]
        rgb, _, _ = C.load_image(path)
        src_cache.clear()
        src_cache[path] = (mt, rgb)
        work_cache.clear()
        return rgb

    def write_jpg(path, img):
        bgr = cv2.cvtColor(C.to_u8(img), cv2.COLOR_RGB2BGR)
        cv2.imwrite(path, bgr, [cv2.IMWRITE_JPEG_QUALITY, 90])

    emit(ready=True, version=eg.__version__)
    stdin = sys.stdin.buffer
    while True:
        line = stdin.readline()
        if not line:
            return 0
        line = line.strip()
        if not line:
            continue
        rid = None
        t0 = time.time()
        try:
            req = json.loads(line.decode("utf-8"))
            rid = req.get("id")
            cmd = req.get("cmd")
            if cmd == "ping":
                emit(id=rid, ok=True)
                continue
            if cmd == "quit":
                emit(id=rid, ok=True)
                return 0
            if cmd != "preview":
                raise RuntimeError("Orden desconocida: %s" % cmd)
            if req.get("profiles_dir"):
                filters_clean.PROFILE_DIR = req["profiles_dir"]
            path = req["input"]
            recipe = req.get("recipe") or {"stack": []}
            rgb = load(path)
            mode = req.get("mode", "fit")
            size = int(req.get("size", 640))
            cx, cy = float(req.get("cx", 0.5)), float(req.get("cy", 0.5))
            rect = tuple(req["rect"]) if req.get("rect") else None
            full = tuple(req["full"]) if req.get("full") else None
            scale = _stack_scale(recipe)
            key = (path, os.path.getmtime(path), mode, size, cx, cy, rect, full, scale)
            if key not in work_cache:
                if len(work_cache) > 6:
                    work_cache.clear()
                work_cache[key] = prepare_preview(rgb, mode, size, cx, cy, rect, full, 1, scale)
            work, ctx0 = work_cache[key]
            ctx = C.Context(ctx0.h, ctx0.w, ctx0.k, ctx0.rect, ctx0.seed, (ctx0.full_w, ctx0.full_h))
            after, _ = eg.run_stack(work, recipe, ctx)
            out_dir = req["out"]
            os.makedirs(out_dir, exist_ok=True)
            pa = os.path.join(out_dir, "after_%s.jpg" % (int(rid or 0) % 2))
            write_jpg(pa, after)
            bkey = (key, after.shape)
            pb = os.path.join(out_dir, "before.jpg")
            changed = before_written.get(out_dir) != bkey
            if changed:
                write_jpg(pb, _fit_pair(work, after, np, cv2))
                before_written[out_dir] = bkey
            emit(id=rid, ok=True, preview={"before": pb, "after": pa, "before_changed": changed},
                 ms=int((time.time() - t0) * 1000))
        except Exception as exc:
            emit(id=rid, ok=False, error=str(exc), trace=traceback.format_exc())


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

        if args.serve:
            return serve()
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
            work, ctx = prepare_preview(rgb, args.preview_mode, args.preview_size, args.cx, args.cy,
                                        args.source_rect, args.full_size, args.seed, _stack_scale(recipe))
            after, _ = eg.run_stack(work, recipe, ctx, progress)
            os.makedirs(args.preview, exist_ok=True)
            pb, pa = os.path.join(args.preview, "before.png"), os.path.join(args.preview, "after.png")
            C.save_image(pb, _fit_pair(work, after, np, cv2))
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
