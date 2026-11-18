#!/usr/bin/env python3
"""Realce IA - motor de mejora de imagen.

Pasos (en este orden): reducir ruido -> ampliar (super-resolución) -> enfocar.

Uso desde línea de comandos:
    python realce_engine.py --check
    python realce_engine.py -i entrada.png -o salida.png --scale 2 --model fast \
        --denoise 40 --detail 50 --sharpen 30 --radius 1.2
    python realce_engine.py -i entrada.png --preview previa_dir --scale 2 ...

Escribe el progreso en stdout como líneas JSON: {"progress": 0.4, "stage": "..."}
y termina con {"ok": true, ...} o {"ok": false, "error": "..."}.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
import traceback

import numpy as np

try:
    import cv2
except ImportError:  # pragma: no cover - se informa al panel
    cv2 = None

ENGINE_DIR = os.path.dirname(os.path.abspath(__file__))
MODELS_DIR = os.path.join(ENGINE_DIR, "models")

# Modelos de super-resolución de OpenCV (dnn_superres).
#   fast    -> FSRCNN (muy rápido, buena calidad)
#   balance -> ESPCN  (rápido)
#   quality -> EDSR   (lento en CPU, la mejor calidad)
MODEL_FILES = {
    "fast": ("fsrcnn", "FSRCNN_x{s}.pb"),
    "balance": ("espcn", "ESPCN_x{s}.pb"),
    "quality": ("edsr", "EDSR_x{s}.pb"),
}
SUPPORTED_SCALES = (2, 3, 4)


# --------------------------------------------------------------------------- utilidades
def emit(**data):
    sys.stdout.write(json.dumps(data) + "\n")
    sys.stdout.flush()


class Progress:
    """Reparte el progreso 0..1 entre las etapas activas."""

    def __init__(self, weights):
        total = float(sum(w for _, w in weights)) or 1.0
        self.spans = {}
        acc = 0.0
        for name, w in weights:
            self.spans[name] = (acc / total, (acc + w) / total)
            acc += w

    def report(self, stage, frac, label):
        a, b = self.spans.get(stage, (0.0, 1.0))
        emit(progress=round(a + (b - a) * max(0.0, min(1.0, frac)), 4), stage=label)


def load_image(path):
    img = cv2.imread(path, cv2.IMREAD_UNCHANGED)
    if img is None:
        raise RuntimeError("No se pudo leer la imagen: %s" % path)
    if img.dtype == np.uint16:
        maxv = 65535.0
    elif img.dtype == np.uint8:
        maxv = 255.0
    elif img.dtype == np.float32:
        maxv = 1.0
    else:
        raise RuntimeError("Profundidad de bits no soportada: %s" % img.dtype)
    if img.ndim == 2:
        img = cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)
    alpha = None
    if img.shape[2] == 4:
        alpha = img[:, :, 3].astype(np.float32) / maxv
        img = img[:, :, :3]
    rgb = img.astype(np.float32) / maxv
    return rgb, alpha, img.dtype


def save_image(path, rgb, alpha, dtype):
    maxv = 65535.0 if dtype == np.uint16 else 255.0
    out = np.clip(rgb, 0.0, 1.0)
    if alpha is not None:
        out = np.dstack([out, np.clip(alpha, 0.0, 1.0)])
    out = np.round(out * maxv).astype(np.uint16 if dtype == np.uint16 else np.uint8)
    d = os.path.dirname(os.path.abspath(path))
    os.makedirs(d, exist_ok=True)
    if not cv2.imwrite(path, out):
        raise RuntimeError("No se pudo guardar la imagen: %s" % path)


def to_u8(x):
    return np.round(np.clip(x, 0.0, 1.0) * 255.0).astype(np.uint8)


# --------------------------------------------------------------------------- reducir ruido
def denoise(rgb, strength, detail, report=None):
    """Reducción de ruido por medias no locales (NLM) separando luminancia y color.

    strength: 0..100  fuerza del filtrado
    detail:   0..100  cuánto detalle original se recupera (texturas finas)
    El filtrado se hace en 8 bits, pero se aplica como diferencia sobre la imagen
    original en coma flotante, así una imagen de 16 bits conserva su precisión.
    """
    if strength <= 0:
        return rgb
    h_luma = 2.0 + strength * 0.16      # 2 .. 18
    h_color = 3.0 + strength * 0.20     # 3 .. 23
    src8 = to_u8(rgb)
    if report:
        report(0.1)
    den8 = cv2.fastNlMeansDenoisingColored(src8, None, h_luma, h_color, 7, 21)
    if report:
        report(0.9)
    diff = (den8.astype(np.float32) - src8.astype(np.float32)) / 255.0
    out = rgb + diff
    if detail > 0:
        # Devuelve parte del detalle de alta frecuencia que el NLM eliminó,
        # pero sólo en luminancia (el ruido de color no vuelve).
        keep = (detail / 100.0) * 0.6
        lum_orig = cv2.cvtColor(rgb, cv2.COLOR_BGR2YCrCb)[:, :, 0]
        lum_den = cv2.cvtColor(np.clip(out, 0, 1), cv2.COLOR_BGR2YCrCb)[:, :, 0]
        hf = (lum_orig - lum_den)
        # Atenúa la parte de mayor amplitud (ruido) y deja pasar textura suave.
        sigma = 0.02 + 0.05 * (1.0 - strength / 100.0)
        hf = hf * np.exp(-(hf * hf) / (2 * sigma * sigma))
        out = out + (keep * hf)[:, :, None]
    if report:
        report(1.0)
    return np.clip(out, 0.0, 1.0)


# --------------------------------------------------------------------------- ampliar
def model_path(model, scale):
    _, pattern = MODEL_FILES[model]
    return os.path.join(MODELS_DIR, pattern.format(s=scale))


def available_models():
    found = {}
    for key in MODEL_FILES:
        found[key] = [s for s in SUPPORTED_SCALES if os.path.isfile(model_path(key, s))]
    return found


def _make_sr(model, scale):
    if not hasattr(cv2, "dnn_superres"):
        raise RuntimeError(
            "OpenCV no tiene dnn_superres. Instala 'opencv-contrib-python' "
            "(no 'opencv-python')."
        )
    path = model_path(model, scale)
    if not os.path.isfile(path):
        raise RuntimeError(
            "Falta el modelo %s. Ejecuta: python download_models.py%s" % (
                os.path.basename(path), " --quality" if model == "quality" else "")
        )
    sr = cv2.dnn_superres.DnnSuperResImpl_create()
    sr.readModel(path)
    sr.setModel(MODEL_FILES[model][0], scale)
    return sr


def upscale_classic(rgb, scale):
    h, w = rgb.shape[:2]
    return cv2.resize(rgb, (w * scale, h * scale), interpolation=cv2.INTER_LANCZOS4)


def upscale_ai(rgb, scale, model, tile=192, overlap=16, report=None):
    """Super-resolución por mosaicos (tiles) para no agotar memoria con fotos grandes.

    Cada mosaico se procesa con un margen de solapamiento y sólo se copia la
    parte central, así no se notan las costuras.
    """
    sr = _make_sr(model, scale)
    h, w = rgb.shape[:2]
    src8 = to_u8(rgb)
    out = np.zeros((h * scale, w * scale, 3), np.float32)
    ys = list(range(0, h, tile))
    xs = list(range(0, w, tile))
    total = len(ys) * len(xs)
    n = 0
    for y in ys:
        for x in xs:
            y0, x0 = max(0, y - overlap), max(0, x - overlap)
            y1, x1 = min(h, y + tile + overlap), min(w, x + tile + overlap)
            patch = sr.upsample(src8[y0:y1, x0:x1])
            cy0, cx0 = (y - y0) * scale, (x - x0) * scale
            th, tw = min(tile, h - y) * scale, min(tile, w - x) * scale
            out[y * scale:y * scale + th, x * scale:x * scale + tw] = (
                patch[cy0:cy0 + th, cx0:cx0 + tw].astype(np.float32) / 255.0
            )
            n += 1
            if report:
                report(n / total)
    # El modelo trabaja en 8 bits: recuperamos los tonos suaves de la versión
    # Lanczos (alta precisión) y nos quedamos con el detalle del modelo.
    base = upscale_classic(rgb, scale)
    blur_ai = cv2.GaussianBlur(out, (0, 0), scale * 0.8)
    blur_base = cv2.GaussianBlur(base, (0, 0), scale * 0.8)
    return np.clip(blur_base + (out - blur_ai), 0.0, 1.0)


def upscale(rgb, scale, model, report=None):
    if scale <= 1:
        return rgb
    if model == "classic":
        return upscale_classic(rgb, scale)
    if scale not in SUPPORTED_SCALES:
        raise RuntimeError("Escala no soportada: %s" % scale)
    return upscale_ai(rgb, scale, model, report=report)


# --------------------------------------------------------------------------- enfocar
def sharpen(rgb, amount, radius, report=None):
    """Máscara de enfoque sobre luminancia con control de halos.

    amount: 0..100, radius: píxeles (0.3..5).
    Sólo se enfoca la luminancia (no aparece ruido de color) y el resultado se
    limita al mínimo/máximo local para evitar halos blancos/negros en los bordes.
    """
    if amount <= 0:
        return rgb
    ycc = cv2.cvtColor(rgb, cv2.COLOR_BGR2YCrCb)
    y = ycc[:, :, 0]
    blur = cv2.GaussianBlur(y, (0, 0), max(0.3, radius))
    detail = y - blur
    # Umbral suave: no amplifica variaciones diminutas (ruido residual).
    thr = 0.004
    detail = np.sign(detail) * np.maximum(np.abs(detail) - thr, 0.0)
    k = amount / 100.0 * 2.5
    sharp = y + k * detail
    if report:
        report(0.6)
    ksize = int(max(3, round(radius * 2)) | 1)
    kernel = np.ones((ksize, ksize), np.uint8)
    lo = cv2.erode(y, kernel)
    hi = cv2.dilate(y, kernel)
    margin = 0.03
    sharp = np.clip(sharp, lo - margin, hi + margin)
    ycc[:, :, 0] = np.clip(sharp, 0.0, 1.0)
    out = cv2.cvtColor(ycc, cv2.COLOR_YCrCb2BGR)
    if report:
        report(1.0)
    return np.clip(out, 0.0, 1.0)


# --------------------------------------------------------------------------- tubería
def process(rgb, alpha, opts, emit_progress=True):
    scale = int(opts.get("scale", 1))
    model = opts.get("model", "fast")
    dn = float(opts.get("denoise", 0))
    detail = float(opts.get("detail", 50))
    sh = float(opts.get("sharpen", 0))
    radius = float(opts.get("radius", 1.0))

    weights = []
    if dn > 0:
        weights.append(("denoise", 3))
    if scale > 1:
        weights.append(("upscale", 6 if model != "classic" else 1))
    if sh > 0:
        weights.append(("sharpen", 1))
    prog = Progress(weights or [("none", 1)])

    def rep(stage, label):
        if not emit_progress:
            return None
        return lambda f: prog.report(stage, f, label)

    out = denoise(rgb, dn, detail, rep("denoise", "Reduciendo ruido"))
    out = upscale(out, scale, model, rep("upscale", "Ampliando x%d" % scale))
    # Tras ampliar, el radio de enfoque se ajusta a la nueva escala.
    out = sharpen(out, sh, radius * (scale ** 0.5 if scale > 1 else 1), rep("sharpen", "Enfocando"))
    if alpha is not None and scale > 1:
        h, w = alpha.shape[:2]
        alpha = cv2.resize(alpha, (w * scale, h * scale), interpolation=cv2.INTER_LANCZOS4)
    return out, alpha


def center_crop(img, cx, cy, size):
    h, w = img.shape[:2]
    sw, sh = min(size, w), min(size, h)
    x0 = int(round(cx * w - sw / 2.0))
    y0 = int(round(cy * h - sh / 2.0))
    x0 = max(0, min(w - sw, x0))
    y0 = max(0, min(h - sh, y0))
    return img[y0:y0 + sh, x0:x0 + sw]


def run_preview(args, opts):
    rgb, alpha, dtype = load_image(args.input)
    scale = int(opts.get("scale", 1))
    # El recorte de entrada es más pequeño cuando se amplía, para que la
    # vista previa final tenga siempre unos `preview_size` píxeles.
    crop_in = max(32, int(args.preview_size / max(1, scale)))
    crop = center_crop(rgb, args.cx, args.cy, crop_in)
    a_crop = center_crop(alpha, args.cx, args.cy, crop_in) if alpha is not None else None
    after, a_after = process(crop, a_crop, opts)
    before = crop
    if scale > 1:
        h, w = crop.shape[:2]
        # "Antes" = ampliación por vecino más cercano: se ve como en Photoshop al hacer zoom.
        before = cv2.resize(crop, (w * scale, h * scale), interpolation=cv2.INTER_NEAREST)
    os.makedirs(args.preview, exist_ok=True)
    pb = os.path.join(args.preview, "before.png")
    pa = os.path.join(args.preview, "after.png")
    save_image(pb, before, None, np.uint8)
    save_image(pa, after, None, np.uint8)
    return {"before": pb, "after": pa}


def run_check():
    info = {
        "python": sys.version.split()[0],
        "numpy": np.__version__,
        "opencv": cv2.__version__ if cv2 is not None else None,
        "dnn_superres": bool(cv2 is not None and hasattr(cv2, "dnn_superres")),
        "models": available_models() if cv2 is not None else {},
        "models_dir": MODELS_DIR,
    }
    return info


def parse_args(argv=None):
    p = argparse.ArgumentParser(description="Realce IA - motor de mejora de imagen")
    p.add_argument("--check", action="store_true", help="comprobar instalación")
    p.add_argument("-i", "--input")
    p.add_argument("-o", "--output")
    p.add_argument("--scale", type=int, default=1, choices=[1, 2, 3, 4])
    p.add_argument("--model", default="fast", choices=["fast", "balance", "quality", "classic"])
    p.add_argument("--denoise", type=float, default=0)
    p.add_argument("--detail", type=float, default=50)
    p.add_argument("--sharpen", type=float, default=0)
    p.add_argument("--radius", type=float, default=1.0)
    p.add_argument("--preview", help="carpeta donde guardar before.png / after.png")
    p.add_argument("--preview-size", type=int, default=420)
    p.add_argument("--cx", type=float, default=0.5, help="centro de la vista previa (0..1)")
    p.add_argument("--cy", type=float, default=0.5)
    return p.parse_args(argv)


def main(argv=None):
    args = parse_args(argv)
    t0 = time.time()
    try:
        if cv2 is None:
            raise RuntimeError("Falta OpenCV. Ejecuta: pip install -r requirements.txt")
        if args.check:
            emit(ok=True, check=run_check())
            return 0
        if not args.input:
            raise RuntimeError("Falta --input")
        opts = {
            "scale": args.scale, "model": args.model, "denoise": args.denoise,
            "detail": args.detail, "sharpen": args.sharpen, "radius": args.radius,
        }
        if args.preview:
            res = run_preview(args, opts)
            emit(ok=True, preview=res, seconds=round(time.time() - t0, 2))
            return 0
        if not args.output:
            raise RuntimeError("Falta --output")
        emit(progress=0.0, stage="Leyendo imagen")
        rgb, alpha, dtype = load_image(args.input)
        out, alpha = process(rgb, alpha, opts)
        emit(progress=1.0, stage="Guardando")
        save_image(args.output, out, alpha, dtype)
        h, w = out.shape[:2]
        emit(ok=True, output=args.output, width=w, height=h, seconds=round(time.time() - t0, 2))
        return 0
    except Exception as exc:  # se informa al panel de forma legible
        emit(ok=False, error=str(exc), trace=traceback.format_exc())
        return 1


if __name__ == "__main__":
    sys.exit(main())
