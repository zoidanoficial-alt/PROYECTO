"""Tests del motor ENTERGALACTIC: python -m pytest entergalactic/tests"""
import json
import os
import sys

import numpy as np
import pytest

cv2 = pytest.importorskip("cv2")
ENGINE = os.path.join(os.path.dirname(__file__), "..", "com.entergalactic.panel", "engine")
sys.path.insert(0, ENGINE)
import eg  # noqa: E402
import eg_engine  # noqa: E402
from eg import core as C, filters_clean  # noqa: E402


def photo(h=120, w=160, seed=0):
    rng = np.random.default_rng(seed)
    img = np.zeros((h, w, 3), np.float32)
    img[: h // 2] = [0.3, 0.5, 0.9]                       # cielo
    img[h // 2:] = [0.25, 0.55, 0.2]                      # hierba
    cv2.circle(img, (w // 2, h // 2), h // 5, (0.85, 0.6, 0.45), -1)  # tono piel
    return np.clip(img + rng.normal(0, 0.01, img.shape), 0, 1).astype(np.float32)


def ctx_for(img, k=1.0, rect=(0, 0, 1, 1)):
    h, w = img.shape[:2]
    return C.Context(h, w, k, rect, 1)


@pytest.mark.parametrize("fid", sorted(eg.FILTERS))
def test_every_filter_runs_with_defaults(fid):
    if fid == "upscale" and not os.path.isfile(eg.filters_realce.model_path("fast", 2)):
        pytest.skip("modelos no descargados")
    img = photo()
    out, _ = eg.run_stack(img, {"stack": [{"id": fid}]}, ctx_for(img))
    assert np.isfinite(out).all()
    assert out.min() >= 0 and out.max() <= 1
    if not eg.FILTERS[fid].resizes:
        assert out.shape == img.shape


def test_every_preset_is_valid():
    ids = set(eg.FILTERS)
    for pr in eg.schema()["presets"]:
        assert pr["module"] in {m["id"] for m in eg.schema()["modules"]}
        assert 0 < len(pr["stack"]) <= eg.registry.MAX_STACK
        for it in pr["stack"]:
            assert it["id"] in ids, (pr["name"], it["id"])
            known = {p["id"] for p in eg.FILTERS[it["id"]].params}
            assert set(it["params"]) <= known, (pr["name"], it["id"], set(it["params"]) - known)


def test_stack_limit_of_15():
    img = photo()
    stack = [{"id": "vignette"}] * 16
    with pytest.raises(RuntimeError):
        eg.run_stack(img, {"stack": stack}, ctx_for(img))
    out, _ = eg.run_stack(img, {"stack": stack[:15]}, ctx_for(img))
    assert out.shape == img.shape


def test_opacity_zero_and_disabled_do_nothing():
    img = photo()
    out, _ = eg.run_stack(img, {"stack": [{"id": "bleach_bypass", "opacity": 0},
                                          {"id": "dramatic", "enabled": False}]}, ctx_for(img))
    assert np.allclose(out, img, atol=1e-6)


def test_tone_mask_limits_effect_to_shadows():
    img = np.zeros((10, 20, 3), np.float32)
    img[:, :10] = 0.05
    img[:, 10:] = 0.95
    out, _ = eg.run_stack(img, {"stack": [{"id": "photo_filter", "params": {"type": "red", "density": 100, "preserve": False},
                                           "mask": {"type": "shadows", "softness": 0}}]}, ctx_for(img))
    assert np.abs(out[:, :10] - img[:, :10]).max() > 0.01
    assert np.abs(out[:, 10:] - img[:, 10:]).max() < 0.01


def test_bw_conversion_is_neutral_gray():
    img = photo()
    out, _ = eg.run_stack(img, {"stack": [{"id": "bw_convert"}]}, ctx_for(img))
    assert np.allclose(out[..., 0], out[..., 1]) and np.allclose(out[..., 1], out[..., 2])


def test_color_filter_changes_bw_rendering_of_sky():
    img = photo()
    red, _ = eg.run_stack(img, {"stack": [{"id": "bw_convert", "params": {"filter": "red"}}]}, ctx_for(img))
    blue, _ = eg.run_stack(img, {"stack": [{"id": "bw_convert", "params": {"filter": "blue"}}]}, ctx_for(img))
    assert red[5, 5, 0] < blue[5, 5, 0] - 0.1     # filtro rojo oscurece el cielo azul


def test_preview_geometry_matches_full_resolution():
    """Viñeta: la vista previa reducida debe parecerse a la versión completa reducida."""
    img = photo(240, 320)
    full, _ = eg.run_stack(img, {"stack": [{"id": "vignette", "params": {"amount": -90}}]}, ctx_for(img))
    small = cv2.resize(img, (80, 60), interpolation=cv2.INTER_AREA)
    prev, _ = eg.run_stack(small, {"stack": [{"id": "vignette", "params": {"amount": -90}}]},
                           C.Context(60, 80, 0.25, (0, 0, 1, 1), 1, (320, 240)))
    assert np.abs(cv2.resize(full, (80, 60), interpolation=cv2.INTER_AREA) - prev).mean() < 0.01


def test_noise_profile_is_measured_accurately():
    img = photo(200, 260)
    noisy = np.clip(img + np.random.default_rng(3).normal(0, 0.04, img.shape[:2] + (1,)), 0, 1).astype(np.float32)
    prof = filters_clean.measure_noise(noisy)
    assert 0.03 < np.median(prof["luma"]) < 0.05


def test_denoise_improves_psnr():
    img = photo(200, 260)
    rng = np.random.default_rng(4)
    # Ruido parecido al de un sensor: grano de luminancia + manchas de color.
    noise = rng.normal(0, 0.05, img.shape[:2] + (1,)) + C.blur(rng.normal(0, 0.075, img.shape).astype(np.float32), 1.5)
    noisy = np.clip(img + noise, 0, 1).astype(np.float32)
    out, _ = eg.run_stack(noisy, {"stack": [{"id": "denoise", "params": {"luma": 60, "chroma": 80}}]}, ctx_for(noisy))
    psnr = lambda a: cv2.PSNR((img * 255).astype(np.float64), (a * 255).astype(np.float64))
    assert psnr(out) > psnr(noisy) + 3.5  # medido: +3.9 dB


def test_instant_frame_changes_size_and_drops_alpha():
    img = photo(120, 160)
    c = ctx_for(img)
    c.alpha = np.ones(img.shape[:2], np.float32)
    out, c2 = eg.run_stack(img, {"stack": [{"id": "instant", "params": {"frame": "square", "crop": True}}]}, c)
    assert out.shape[0] > out.shape[1] and c2.alpha is None


def test_cli_roundtrip_16bit_and_preview(tmp_path):
    img = photo()
    src = tmp_path / "in.png"
    cv2.imwrite(str(src), (cv2.cvtColor(img, cv2.COLOR_RGB2BGR) * 65535).astype(np.uint16))
    recipe = json.dumps({"stack": [{"id": "cinematic"}, {"id": "grain"}]})
    assert eg_engine.main(["-i", str(src), "-o", str(tmp_path / "o.png"), "--recipe-json", recipe]) == 0
    out = cv2.imread(str(tmp_path / "o.png"), cv2.IMREAD_UNCHANGED)
    assert out.dtype == np.uint16 and out.shape == (120, 160, 3)
    for mode in ("fit", "crop"):
        assert eg_engine.main(["-i", str(src), "--preview", str(tmp_path / mode), "--preview-mode", mode,
                               "--preview-size", "64", "--recipe-json", recipe]) == 0
        assert (tmp_path / mode / "after.png").exists()


def test_cli_saves_camera_profile(tmp_path):
    img = photo()
    src = tmp_path / "in.png"
    cv2.imwrite(str(src), (img * 255).astype(np.uint8))
    assert eg_engine.main(["-i", str(src), "--measure-noise", "--save-profile", "Cámara X ISO 800",
                           "--profiles-dir", str(tmp_path / "p")]) == 0
    assert (tmp_path / "p" / "Cámara X ISO 800.json").exists()


def test_schema_json_is_up_to_date():
    path = os.path.join(ENGINE, "..", "client", "schema.json")
    with open(path, encoding="utf-8") as fh:
        assert json.load(fh) == json.loads(json.dumps(eg.schema())), \
            "Ejecuta: python engine/build_schema.py"


# ---------------------------------------------------------------------- Cine y vista previa ligera
def test_cine_module_has_presets_with_descriptions():
    cine = [p for p in eg.schema()["presets"] if p["module"] == "cine"]
    assert len(cine) >= 15
    assert all(p.get("desc") for p in cine)
    for name in ("Arkapaw", "Crawley", "Hoytema", "Fraser", "Lubezki"):
        assert any(p["name"].startswith(name) for p in cine), name


def test_limited_palette_never_turns_blue_sky_green_or_magenta():
    sky = np.zeros((20, 20, 3), np.float32) + np.array([0.3, 0.5, 0.9], np.float32)
    out, _ = eg.run_stack(sky, {"stack": [{"id": "limited_palette", "params": {"target": 35, "strength": 100}}]},
                          ctx_for(sky))
    r, g, b = out[10, 10]
    assert not (g > r + 0.05 and g > b + 0.05), "cielo verde"
    assert not (r > g + 0.05 and b > g + 0.05), "cielo magenta"


def test_letterbox_keeps_size_and_adds_bars():
    img = photo(120, 160)                         # 1.33:1 -> bandas arriba/abajo para 2.39
    out, _ = eg.run_stack(img, {"stack": [{"id": "letterbox", "params": {"ratio": "2.39"}}]}, ctx_for(img))
    assert out.shape == img.shape
    assert out[0].max() == 0 and out[-1].max() == 0 and out[60].max() > 0


def test_preview_from_photoshop_downscale_matches_full_source():
    """La vista previa desde la exportación reducida de Photoshop debe coincidir con la hecha desde el original."""
    full = photo(400, 600)
    small = cv2.resize(full, (300, 200), interpolation=cv2.INTER_AREA)
    recipe = {"stack": [{"id": "vignette", "params": {"amount": -90}}, {"id": "graduated"}]}
    w1, c1 = eg_engine.prepare_preview(full, "fit", 150, 0.5, 0.5)
    w2, c2 = eg_engine.prepare_preview(small, "fit", 150, 0.5, 0.5, (0, 0, 1, 1), (600, 400))
    a1, _ = eg.run_stack(w1, recipe, c1)
    a2, _ = eg.run_stack(w2, recipe, c2)
    assert a1.shape == a2.shape and abs(c1.k - c2.k) < 1e-6
    assert np.abs(a1 - a2).mean() < 0.01


def test_preview_from_photoshop_crop_keeps_full_frame_geometry():
    full = photo(400, 600)
    x0, y0 = 300, 100
    crop = full[y0:y0 + 200, x0:x0 + 200]
    rect = (x0 / 600, y0 / 400, (x0 + 200) / 600, (y0 + 200) / 400)
    w, c = eg_engine.prepare_preview(crop, "crop", 100, 0.66, 0.5, rect, (600, 400))
    recipe = {"stack": [{"id": "vignette", "params": {"amount": -90}}]}
    prev, _ = eg.run_stack(w, recipe, c)
    ref, _ = eg.run_stack(full, recipe, ctx_for(full))
    X0, Y0 = int(round(c.rect[0] * 600)), int(round(c.rect[1] * 400))
    assert np.abs(prev - ref[Y0:Y0 + 100, X0:X0 + 100]).mean() < 0.005


def test_serve_mode_answers_requests(tmp_path):
    import subprocess
    img = photo()
    src = tmp_path / "in.png"
    cv2.imwrite(str(src), (cv2.cvtColor(img, cv2.COLOR_RGB2BGR) * 255).astype(np.uint8))
    proc = subprocess.Popen([sys.executable, os.path.join(ENGINE, "eg_engine.py"), "--serve"],
                            stdin=subprocess.PIPE, stdout=subprocess.PIPE, text=True)
    try:
        assert json.loads(proc.stdout.readline())["ready"]
        for i, size in enumerate((80, 40)):
            proc.stdin.write(json.dumps({"id": i + 1, "cmd": "preview", "input": str(src), "size": size,
                                         "recipe": {"stack": [{"id": "cinematic"}]}, "out": str(tmp_path / "p")}) + "\n")
            proc.stdin.flush()
            r = json.loads(proc.stdout.readline())
            assert r["id"] == i + 1 and r["ok"], r
            assert os.path.exists(r["preview"]["after"])
        proc.stdin.write(json.dumps({"id": 9, "cmd": "preview", "input": "no_existe.png", "out": str(tmp_path)}) + "\n")
        proc.stdin.flush()
        r = json.loads(proc.stdout.readline())
        assert r["id"] == 9 and r["ok"] is False      # un error no tumba el motor
    finally:
        proc.stdin.close()
        proc.wait(timeout=10)
