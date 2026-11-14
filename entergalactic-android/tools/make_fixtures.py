#!/usr/bin/env python3
"""Genera casos de prueba con el motor Python para verificar el port a JavaScript."""
import json, os, sys
import numpy as np, cv2
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from build_web import build, ENGINE  # noqa
sys.path.insert(0, ENGINE)
import eg  # noqa
from eg import core as C  # noqa

def main(photo, out_dir):
    os.makedirs(out_dir, exist_ok=True)
    rgb, _, _ = C.load_image(photo)
    rgb = cv2.resize(rgb, (160, 120), interpolation=cv2.INTER_AREA).astype(np.float32)
    rgb.tofile(os.path.join(out_dir, "input.bin"))
    sch = build()
    cases = [{"name": "filtro:" + f["id"], "recipe": {"stack": [{"id": f["id"]}]}} for f in sch["filters"]]
    cases += [{"name": "receta:" + p["name"], "recipe": p} for p in sch["presets"]]
    cases += [{"name": "mascara:" + m, "recipe": {"stack": [{"id": "photo_filter", "params": {"type": "red", "density": 80},
               "mask": {"type": m, "softness": 40}, "opacity": 70, "blend": b}]}}
              for m, b in [("shadows", "normal"), ("highlights", "multiply"), ("midtones", "screen"), ("color", "overlay"),
                           ("center", "soft_light"), ("edges", "luminosity"), ("top", "color"), ("bottom", "darken")]]
    index = []
    for i, c in enumerate(cases):
        ctx = C.Context(120, 160, 1.0, (0, 0, 1, 1), 1, (160, 120))
        out, _ = eg.run_stack(rgb.copy(), c["recipe"], ctx)
        fn = "out_%03d.bin" % i
        out.astype(np.float32).tofile(os.path.join(out_dir, fn))
        index.append({"name": c["name"], "recipe": c["recipe"], "file": fn, "w": out.shape[1], "h": out.shape[0]})
    with open(os.path.join(out_dir, "index.json"), "w", encoding="utf-8") as fh:
        json.dump(index, fh, ensure_ascii=False)
    print(len(index), "casos")

if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
