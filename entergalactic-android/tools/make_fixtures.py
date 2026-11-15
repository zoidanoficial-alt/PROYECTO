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
    # Pop sin textura de tinta (aleatoria) para comparar píxel a píxel.
    for st in ({"id": "pop_silkscreen", "params": {"texture": 0}},
               {"id": "pop_silkscreen", "params": {"texture": 0, "palette": "lime", "simplify": 0, "offset": 20}},
               {"id": "pop_grid", "params": {"texture": 0}},
               {"id": "pop_grid", "params": {"texture": 0, "grid": "1x2", "diptych_bw": True}},
               {"id": "pop_grid", "params": {"texture": 0, "grid": "3x3", "palette": "bw", "rotate": False}},
               {"id": "halftone", "params": {"mode": "cmy"}}, {"id": "halftone", "params": {"mode": "mono"}}):
        cases.append({"name": "pop:" + st["id"] + json.dumps(st["params"], sort_keys=True), "recipe": {"stack": [st]}})
    # Cada perfil de película sin grano (aleatorio) para comparar la emulsión píxel a píxel.
    from eg.film_profiles import PROFILES
    for pr in PROFILES:
        if pr["kind"] == "auto":
            continue
        for hal in (0, 100):
            if hal and not pr["hal"]:
                continue
            cases.append({"name": "perfil:%s:hal%d" % (pr["id"], hal), "recipe": {"stack": [{"id": "film_profile", "params": {
                "profile": pr["id"], "grain": 0, "halation": hal}}]}})
    for st in ({"id": "film_profile", "params": {"profile": "cine500t", "grain": 0, "exposure": 1.5}},
               {"id": "film_profile", "params": {"profile": "portrait400", "grain": 0, "print": "print3513"}},
               {"id": "paper_sim", "params": {"texture": 0, "paper": "fiber_warm"}},
               {"id": "optical_filter", "params": {"type": "star6", "threshold": 60}},
               {"id": "optical_filter", "params": {"type": "fog"}},
               {"id": "lens_character", "params": {"distortion": -60, "swirl": 70}},
               {"id": "lens_flare", "params": {"auto": False, "x": 30, "y": 20, "style": "rainbow"}},
               {"id": "glass", "params": {"type": "crystal"}}, {"id": "glass", "params": {"type": "rainbow"}},
               {"id": "color_correction", "params": {"auto": "white", "lift": 40}},
               {"id": "color_correction", "params": {"auto": "levels", "gain": 30}}):
        cases.append({"name": "opt:" + st["id"] + json.dumps(st["params"], sort_keys=True), "recipe": {"stack": [st]}})
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
