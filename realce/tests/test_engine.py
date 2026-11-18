"""Tests del motor de Realce IA: python -m pytest realce/tests"""
import os
import sys

import numpy as np
import pytest

cv2 = pytest.importorskip("cv2")
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "com.realce.panel", "engine"))
import realce_engine as eng  # noqa: E402


def _test_image(h=120, w=160, seed=0):
    img = np.full((h, w, 3), 0.7, np.float32)
    cv2.circle(img, (50, 60), 30, (0.15, 0.35, 0.8), -1)
    cv2.rectangle(img, (95, 25), (145, 95), (0.1, 0.6, 0.25), -1)
    noisy = np.clip(img + np.random.default_rng(seed).normal(0, 0.07, img.shape), 0, 1).astype(np.float32)
    return img, noisy


def _psnr(a, b):
    return cv2.PSNR((a * 255).astype(np.float64), (b * 255).astype(np.float64))


def test_denoise_improves_psnr():
    clean, noisy = _test_image()
    out = eng.denoise(noisy, 50, 50)
    assert _psnr(clean, out) > _psnr(clean, noisy) + 5


def test_zero_strength_is_identity():
    _, noisy = _test_image()
    assert np.array_equal(eng.denoise(noisy, 0, 50), noisy)
    assert np.array_equal(eng.sharpen(noisy, 0, 1.0), noisy)
    assert eng.upscale(noisy, 1, "fast") is noisy


def test_sharpen_increases_edge_contrast_without_big_halos():
    clean, _ = _test_image()
    soft = cv2.GaussianBlur(clean, (0, 0), 1.5)
    out = eng.sharpen(soft, 80, 1.5)
    grad = lambda x: np.abs(cv2.Sobel(x, cv2.CV_32F, 1, 0)).mean()
    assert grad(out) > grad(soft)
    assert out.min() >= 0 and out.max() <= 1
    # control de halos: no sobrepasa los extremos de la imagen original más el margen
    assert out.max() <= soft.max() + 0.031


def test_classic_upscale_size():
    _, noisy = _test_image()
    out = eng.upscale(noisy, 3, "classic")
    assert out.shape == (360, 480, 3)


@pytest.mark.skipif(not os.path.isfile(eng.model_path("fast", 2)), reason="modelos no descargados")
def test_ai_upscale_tiles_have_no_seams():
    _, noisy = _test_image()
    a = eng.upscale_ai(noisy, 2, "fast", tile=48)
    b = eng.upscale_ai(noisy, 2, "fast", tile=1000)
    assert a.shape == (240, 320, 3)
    assert np.abs(a - b).max() < 2 / 255.0


def test_cli_roundtrip_16bit_with_alpha(tmp_path):
    _, noisy = _test_image()
    rgba = np.dstack([noisy, np.ones(noisy.shape[:2], np.float32)])
    rgba[:10, :10, 3] = 0
    src = tmp_path / "in.png"
    dst = tmp_path / "out.png"
    cv2.imwrite(str(src), (rgba * 65535).astype(np.uint16))
    rc = eng.main(["-i", str(src), "-o", str(dst), "--scale", "2", "--model", "classic",
                   "--denoise", "30", "--sharpen", "20"])
    assert rc == 0
    out = cv2.imread(str(dst), cv2.IMREAD_UNCHANGED)
    assert out.dtype == np.uint16 and out.shape == (240, 320, 4)
    assert out[0, 0, 3] == 0 and out[100, 100, 3] == 65535


def test_cli_preview(tmp_path):
    _, noisy = _test_image()
    src = tmp_path / "in.png"
    cv2.imwrite(str(src), (noisy * 255).astype(np.uint8))
    rc = eng.main(["-i", str(src), "--preview", str(tmp_path / "p"), "--preview-size", "100",
                   "--scale", "2", "--model", "classic", "--denoise", "40"])
    assert rc == 0
    before = cv2.imread(str(tmp_path / "p" / "before.png"))
    after = cv2.imread(str(tmp_path / "p" / "after.png"))
    assert before.shape == after.shape == (100, 100, 3)


def test_missing_input_reports_error(capsys):
    assert eng.main(["-i", "no_existe.png", "-o", "x.png"]) == 1
    assert '"ok": false' in capsys.readouterr().out
