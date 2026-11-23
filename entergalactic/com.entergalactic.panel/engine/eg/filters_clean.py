"""ENTERGALACTIC Clean: reducción de ruido de luminancia y color con perfiles de cámara.

Perfil de ruido: nivel de ruido medido por zonas tonales (sombras, medios, luces)
para la luminancia y para el color. Se puede medir automáticamente en cada foto
o guardar uno por cámara/ISO y reutilizarlo.
"""
import json
import os

import numpy as np
import cv2

from . import core as C
from .registry import register, rng, sel, chk

PROFILE_DIR = os.environ.get("EG_PROFILE_DIR", "")


# --------------------------------------------------------------------------- medición
def measure_noise(img):
    """Estima el ruido (sigma en escala 0..1) por zona tonal, en luminancia y en color.

    Usa la mediana de la desviación absoluta de un filtro paso alto, sólo en
    bloques lisos (donde no hay textura real), separando sombras/medios/luces.
    """
    lab = C.to_lab(img)
    L = lab[..., 0] / 100.0
    ab = lab[..., 1:] / 128.0
    h, w = L.shape
    k = np.array([[1, -2, 1], [-2, 4, -2], [1, -2, 1]], np.float32)
    # El laplaciano de este núcleo amplifica el ruido gaussiano por 6 (sqrt(36)).
    hpL = cv2.filter2D(L, -1, k) / 6.0
    hpA = (np.abs(cv2.filter2D(ab[..., 0], -1, k)) + np.abs(cv2.filter2D(ab[..., 1], -1, k))) / 12.0
    texture = C.blur(np.abs(L - C.blur(L, 2.0)), 4.0)
    bands = [(0.0, 0.33), (0.33, 0.66), (0.66, 1.01)]
    base = C.blur(L, 2.0)
    luma, chroma = [], []
    for lo, hi in bands:
        m = (base >= lo) & (base < hi)
        if m.sum() < 200:
            luma.append(None)
            chroma.append(None)
            continue
        thr = np.percentile(texture[m], 30)
        flat = m & (texture <= thr)
        if flat.sum() < 100:
            flat = m
        luma.append(float(1.4826 * np.median(np.abs(hpL[flat]))))
        chroma.append(float(1.4826 * np.median(hpA[flat]) * 1.2))

    def fill(v):
        known = [x for x in v if x is not None]
        d = float(np.median(known)) if known else 0.01
        return [x if x is not None else d for x in v]

    return {"luma": fill(luma), "chroma": fill(chroma)}


def list_profiles():
    if not PROFILE_DIR or not os.path.isdir(PROFILE_DIR):
        return []
    out = []
    for f in sorted(os.listdir(PROFILE_DIR)):
        if f.lower().endswith(".json"):
            out.append(os.path.splitext(f)[0])
    return out


def load_profile(name):
    path = os.path.join(PROFILE_DIR, name + ".json")
    with open(path, "r", encoding="utf-8") as fh:
        return json.load(fh)


def save_profile(name, prof):
    if not PROFILE_DIR:
        raise RuntimeError("No hay carpeta de perfiles configurada.")
    os.makedirs(PROFILE_DIR, exist_ok=True)
    safe = "".join(ch for ch in name if ch.isalnum() or ch in " -_.()").strip() or "perfil"
    path = os.path.join(PROFILE_DIR, safe + ".json")
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(dict(prof, name=safe), fh, ensure_ascii=False, indent=2)
    return safe


# --------------------------------------------------------------------------- filtrado
def _band_interp(L, vals):
    return np.interp(L, [0.0, 0.165, 0.5, 0.835, 1.0], [vals[0], vals[0], vals[1], vals[2], vals[2]]).astype(np.float32)


@register("denoise", "Reducción de ruido", ["clean", "realce"], [
    {"id": "profile", "label": "Perfil de ruido", "type": "profile", "default": "auto",
     "options": [["auto", "Automático (medir en esta foto)"], ["manual", "Manual (sin perfil)"]]},
    rng("luma", "Ruido de luminancia", 0, 100, 50),
    rng("chroma", "Ruido de color", 0, 100, 70),
    rng("detail", "Conservar detalle", 0, 100, 50),
    rng("contrast", "Conservar contraste", 0, 100, 40),
    rng("shadows", "Extra en sombras", 0, 100, 0),
    chk("jpeg", "Reducir artefactos JPEG", False),
], "Limpia el grano digital por separado en luminancia y en color, adaptado al ruido medido.")
def denoise(img, p, ctx):
    prof_name = p["profile"]
    prof = None
    if prof_name == "auto":
        prof = measure_noise(img)
    elif prof_name != "manual":
        try:
            prof = load_profile(prof_name)
        except Exception:
            prof = measure_noise(img)

    lab = C.to_lab(img)
    L = lab[..., 0] / 100.0
    out_lab = lab.copy()

    # ---- color: el ruido cromático se elimina con fuerza (el ojo no ve el detalle de color)
    kc = p["chroma"] / 100.0
    if kc > 0:
        csig = max(prof["chroma"]) if prof else 0.03
        r = ctx.px(1.5 + 6.0 * kc * min(1.0, csig / 0.03 + 0.3))
        guide = C.to_u8(L)
        for ch in (1, 2):
            a = lab[..., ch]
            sm = cv2.bilateralFilter(a.astype(np.float32), d=-1, sigmaColor=6.0 + 20.0 * kc, sigmaSpace=r)
            sm = C.blur(sm, r * 0.5)
            out_lab[..., ch] = a + (sm - a) * min(1.0, kc * 1.2)
        del guide

    # ---- luminancia: medias no locales con fuerza adaptada a cada zona tonal
    kl = p["luma"] / 100.0
    if kl > 0:
        if prof:
            sig_map = _band_interp(L, prof["luma"])
            sig_max = float(max(prof["luma"]))
        else:
            sig_map = np.full_like(L, 0.02)
            sig_map = sig_map * (1.0 + (1.0 - C.smoothstep(0.0, 0.4, L)) * 0.5)
            sig_max = float(sig_map.max())
        sig_map = sig_map * (1.0 + (1.0 - C.smoothstep(0.0, 0.35, L)) * p["shadows"] / 100.0 * 1.5)
        sig_max = float(sig_map.max())
        h = max(2.0, min(40.0, sig_max * 255.0 * (0.8 + 1.6 * kl)))
        L8 = C.to_u8(L)
        den = cv2.fastNlMeansDenoising(L8, None, h=h, templateWindowSize=7, searchWindowSize=21)
        diff = (den.astype(np.float32) - L8.astype(np.float32)) / 255.0
        w = np.clip(sig_map / max(sig_max, 1e-4), 0.35, 1.0) ** 0.5 * min(1.0, 0.25 + kl)
        newL = L + diff * w
        dk = p["detail"] / 100.0
        if dk > 0:
            hf = L - newL
            noise_s = np.maximum(sig_map, 1e-3)
            # Sólo vuelve lo que claramente supera el nivel de ruido (bordes, textura real).
            keep = C.smoothstep(2.0, 4.0, np.abs(hf) / noise_s)
            newL = newL + hf * keep * dk * 0.8
        ck = p["contrast"] / 100.0
        if ck > 0:
            lost = C.blur(L, ctx.px(8)) - C.blur(newL, ctx.px(8))
            newL = newL + lost * ck
        out_lab[..., 0] = np.clip(newL, 0, 1) * 100.0

    out = C.from_lab(out_lab)
    if p["jpeg"]:
        out8 = C.to_u8(out)
        sm = cv2.bilateralFilter(out8, 5, 18, 3).astype(np.float32) / 255.0
        edges = C.smoothstep(0.02, 0.1, C.blur(np.abs(C.luminance(out) - C.blur(C.luminance(out), 1.5)), 2))
        out = out + (sm - out) * (1.0 - edges)[..., None] * 0.7
    return np.clip(out, 0, 1)


@register("color_noise_only", "Sólo ruido de color", ["clean"], [
    rng("strength", "Intensidad", 0, 100, 80),
    rng("radius", "Radio", 1, 20, 5, unit="px"),
], "Elimina manchas de color sin tocar la nitidez (ideal para fotos de ISO medio).")
def color_noise_only(img, p, ctx):
    lab = C.to_lab(img)
    r = ctx.px(p["radius"])
    k = p["strength"] / 100.0
    for ch in (1, 2):
        a = lab[..., ch]
        sm = cv2.bilateralFilter(a, d=-1, sigmaColor=8 + 20 * k, sigmaSpace=r)
        lab[..., ch] = a + (sm - a) * k
    return C.from_lab(lab)


@register("hot_pixels", "Píxeles calientes", ["clean"], [
    rng("threshold", "Sensibilidad", 0, 100, 50),
], "Elimina puntos aislados muy brillantes (exposiciones largas, sensores calientes).")
def hot_pixels(img, p, ctx):
    med = cv2.medianBlur(C.to_u8(img), 3).astype(np.float32) / 255.0
    diff = (img - med).max(axis=2)
    t = 0.35 - 0.3 * p["threshold"] / 100.0
    m = (diff > t).astype(np.float32)
    m = cv2.dilate(m, np.ones((3, 3), np.uint8))[..., None]
    return img * (1 - m) + med * m
