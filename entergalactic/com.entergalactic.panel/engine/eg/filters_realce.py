"""ENTERGALACTIC Realce IA: ampliación por super-resolución y enfoque de salida."""
import os

import numpy as np
import cv2

from . import core as C
from .registry import register, rng, sel

MODELS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "models")
MODEL_FILES = {
    "fast": ("fsrcnn", "FSRCNN_x{s}.pb"),
    "balance": ("espcn", "ESPCN_x{s}.pb"),
    "quality": ("edsr", "EDSR_x{s}.pb"),
}


def model_path(model, scale):
    return os.path.join(MODELS_DIR, MODEL_FILES[model][1].format(s=scale))


def available_models():
    return {k: [s for s in (2, 3, 4) if os.path.isfile(model_path(k, s))] for k in MODEL_FILES}


def _upscale_ai(rgb, scale, model, tile=192, overlap=16):
    if not hasattr(cv2, "dnn_superres"):
        raise RuntimeError("OpenCV no tiene dnn_superres. Instala 'opencv-contrib-python'.")
    path = model_path(model, scale)
    if not os.path.isfile(path):
        raise RuntimeError("Falta el modelo %s. Ejecuta: python download_models.py%s" % (
            os.path.basename(path), " --quality" if model == "quality" else ""))
    sr = cv2.dnn_superres.DnnSuperResImpl_create()
    sr.readModel(path)
    sr.setModel(MODEL_FILES[model][0], scale)
    h, w = rgb.shape[:2]
    src8 = cv2.cvtColor(C.to_u8(rgb), cv2.COLOR_RGB2BGR)
    out = np.zeros((h * scale, w * scale, 3), np.float32)
    for y in range(0, h, tile):
        for x in range(0, w, tile):
            y0, x0 = max(0, y - overlap), max(0, x - overlap)
            y1, x1 = min(h, y + tile + overlap), min(w, x + tile + overlap)
            patch = sr.upsample(src8[y0:y1, x0:x1])
            cy0, cx0 = (y - y0) * scale, (x - x0) * scale
            th, tw = min(tile, h - y) * scale, min(tile, w - x) * scale
            out[y * scale:y * scale + th, x * scale:x * scale + tw] = patch[cy0:cy0 + th, cx0:cx0 + tw].astype(np.float32) / 255.0
    out = cv2.cvtColor(out, cv2.COLOR_BGR2RGB)
    base = cv2.resize(rgb, (w * scale, h * scale), interpolation=cv2.INTER_LANCZOS4)
    s = scale * 0.8
    return np.clip(C.blur(base, s) + (out - C.blur(out, s)), 0, 1)


@register("upscale", "Ampliar con IA", ["realce"], [
    sel("scale", "Escala", [("2", "2×"), ("3", "3×"), ("4", "4×")], "2"),
    sel("model", "Modelo", [("fast", "IA rápida (FSRCNN)"), ("balance", "IA equilibrada (ESPCN)"),
                            ("quality", "IA calidad (EDSR, lento)"), ("classic", "Clásico (Lanczos)")], "fast"),
], "Multiplica la resolución reconstruyendo detalle con redes neuronales (cambia el tamaño).", resizes=True)
def upscale(img, p, ctx):
    s = int(p["scale"])
    h, w = img.shape[:2]
    if p["model"] == "classic":
        out = cv2.resize(img, (w * s, h * s), interpolation=cv2.INTER_LANCZOS4)
    else:
        out = _upscale_ai(img, s, p["model"])
    if ctx.alpha is not None and ctx.alpha.shape == (h, w):
        ctx.alpha = cv2.resize(ctx.alpha, (w * s, h * s), interpolation=cv2.INTER_LANCZOS4)
    ctx.last_scale = float(s)
    return out


@register("sharpen", "Enfoque de salida", ["realce", "clean", "chroma", "plata"], [
    rng("amount", "Cantidad", 0, 100, 40),
    rng("radius", "Radio", 0.3, 5, 1.0, step=0.1, unit="px"),
    rng("threshold", "Umbral (proteger ruido)", 0, 100, 20),
], "Máscara de enfoque sobre la luminancia con control de halos.")
def sharpen(img, p, ctx):
    l = C.luminance(img)
    r = ctx.px(p["radius"])
    d = l - C.blur(l, r)
    thr = p["threshold"] / 100.0 * 0.02
    d = np.sign(d) * np.maximum(np.abs(d) - thr, 0)
    nl = l + d * p["amount"] / 100.0 * 2.5
    ks = int(max(3, round(r * 2)) | 1)
    kern = np.ones((ks, ks), np.uint8)
    nl = np.clip(nl, cv2.erode(l, kern) - 0.03, cv2.dilate(l, kern) + 0.03)
    return C.set_luminance(img, np.clip(nl, 0, 1))
