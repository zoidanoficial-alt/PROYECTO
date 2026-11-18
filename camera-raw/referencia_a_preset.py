#!/usr/bin/env python3
"""Crea presets de Camera Raw (.xmp) a partir de imágenes de referencia.

Uso:
    python referencia_a_preset.py foto1.jpg [foto2.webp ...] [--fuerza 70] [--grupo FOTONEANDO]
                                  [--salida CARPETA] [--instalar] [--antes mi_foto.jpg]

Qué analiza de cada referencia:
  * Curva de tonos: punto negro (negros lavados o aplastados), punto blanco
    (luces apagadas), contraste y brillo de medios tonos.
  * Dominantes de color en sombras, medios y luces. Se miden sólo sobre los píxeles
    casi neutros, para no confundir el color de los objetos (un cielo azul, unas
    flores amarillas) con el «tinte» de la película o del revelado. Se guardan como
    curvas Rojo / Verde / Azul.
  * Saturación global y por color (panel HSL: rojos, naranjas, amarillos, verdes,
    aguas, azules, morados y magentas).
  * Grano y viñeta.
  * Blanco y negro (si la referencia casi no tiene color).

Con --antes se compara contra una foto tuya sin editar (más fiel). Sin ella se
compara contra una foto digital «neutra» típica.

Funciona con Camera Raw 10 (Photoshop CC 2018) y posteriores. Requiere numpy y
opencv-python (los mismos que el plugin ENTERGALACTIC).
"""
import argparse
import os
import sys
import uuid

import cv2
import numpy as np

# Percentiles de luminancia de una foto digital neutra típica (bien expuesta, sin look).
PCTS = [0.5, 5, 25, 50, 75, 95, 99.5]
PRIOR_L = [0.015, 0.06, 0.22, 0.42, 0.62, 0.86, 0.975]
PRIOR_SAT = 0.30          # saturación media (HSV) de una foto neutra
# Bandas del panel HSL de Camera Raw: nombre, centro del tono (grados).
BANDS = [("Red", 0), ("Orange", 30), ("Yellow", 60), ("Green", 120),
         ("Aqua", 180), ("Blue", 240), ("Purple", 275), ("Magenta", 315)]
BAND_NAMES_ES = {"Red": "rojos", "Orange": "naranjas", "Yellow": "amarillos", "Green": "verdes",
                 "Aqua": "aguas", "Blue": "azules", "Purple": "morados", "Magenta": "magentas"}
REC709 = np.array([0.2126, 0.7152, 0.0722], np.float32)


# ----------------------------------------------------------------------------- lectura
def load(path, max_side=1200):
    """Lee JPG/PNG/WEBP/TIFF (también rutas con acentos en Windows) → RGB float 0..1."""
    data = np.fromfile(path, dtype=np.uint8)
    im = cv2.imdecode(data, cv2.IMREAD_COLOR | cv2.IMREAD_IGNORE_ORIENTATION)
    if im is None:
        raise SystemExit("No se pudo leer la imagen: %s" % path)
    h, w = im.shape[:2]
    s = min(1.0, max_side / max(h, w))
    if s < 1:
        im = cv2.resize(im, (round(w * s), round(h * s)), interpolation=cv2.INTER_AREA)
    return im[:, :, ::-1].astype(np.float32) / 255.0


def hue_dist(h, c):
    d = np.abs(h - c) % 360
    return np.minimum(d, 360 - d)


# ----------------------------------------------------------------------------- análisis
def stats(im):
    L = im @ REC709
    hsv = cv2.cvtColor(im, cv2.COLOR_RGB2HSV)
    lab = cv2.cvtColor(im, cv2.COLOR_RGB2LAB)
    chroma = np.hypot(lab[..., 1], lab[..., 2])
    out = {"L": L, "hsv": hsv, "chroma": chroma, "im": im}
    out["pct"] = np.percentile(L, PCTS)
    out["sat"] = float(hsv[..., 1].mean())
    out["chan_lo"] = np.percentile(im.reshape(-1, 3), 0.5, axis=0)
    out["chan_hi"] = np.percentile(im.reshape(-1, 3), 99.5, axis=0)
    # Dominante de cada zona tonal, medida en los píxeles más neutros de esa zona.
    zones = []
    for lo, hi in [(0.0, 0.22), (0.22, 0.6), (0.6, 1.01)]:
        m = (L >= lo) & (L < hi)
        if m.sum() < 200:
            zones.append(None)
            continue
        c = chroma[m]
        keep = c <= np.percentile(c, 40)
        px = im[m][keep]
        rgb = np.median(px, axis=0)
        zones.append({"x": float(np.median(L[m][keep])), "delta": rgb - rgb @ REC709})
    out["zones"] = zones
    # Color por banda: cantidad de píxeles, saturación alta (p80), luminosidad y tono medio.
    h, s, v = hsv[..., 0], hsv[..., 1], hsv[..., 2]
    colored = (s > 0.18) & (v > 0.12)
    bands = {}
    for name, ctr in BANDS:
        m = colored & (hue_dist(h, ctr) < 22)
        if m.sum() < 0.004 * h.size:
            continue
        hh = h[m]
        ang = np.deg2rad(hh)
        mean_h = np.rad2deg(np.arctan2(np.sin(ang).mean(), np.cos(ang).mean())) % 360
        bands[name] = {"sat": float(np.percentile(s[m], 80)), "val": float(np.median(v[m])),
                       "hue": float(mean_h), "frac": float(m.mean())}
    out["bands"] = bands
    # Grano: ruido de alta frecuencia en zonas lisas de medios tonos.
    g = L
    blur = cv2.GaussianBlur(g, (0, 0), 1.2)
    hp = g - blur
    grad = cv2.GaussianBlur(np.abs(cv2.Sobel(blur, cv2.CV_32F, 1, 0)) + np.abs(cv2.Sobel(blur, cv2.CV_32F, 0, 1)), (0, 0), 2)
    flat = (grad < np.percentile(grad, 30)) & (g > 0.15) & (g < 0.85)
    out["noise"] = float(hp[flat].std()) if flat.sum() > 500 else 0.0
    # Viñeta: esquinas contra centro.
    H, W = L.shape
    yy, xx = np.mgrid[0:H, 0:W]
    r = np.hypot((xx - W / 2) / (W / 2), (yy - H / 2) / (H / 2))
    out["vig"] = float(np.median(L[r > 1.05]) / max(1e-3, np.median(L[r < 0.5])))
    return out


def monotone(points):
    pts = sorted(points)
    res = []
    for x, y in pts:
        y = min(1.0, max(0.0, y))
        if res and x - res[-1][0] < 0.04:
            continue
        if res and y < res[-1][1]:
            y = res[-1][1]
        res.append((x, y))
    return res


def analyze(ref, before=None, strength=0.7):
    """Devuelve un diccionario con los ajustes de Camera Raw."""
    k = strength
    base_pct = before["pct"] if before else np.array(PRIOR_L)
    base_sat = before["sat"] if before else PRIOR_SAT
    p = ref["pct"]
    s = {}
    # --- curva maestra: lleva los percentiles «neutros» a los de la referencia.
    pts = [(0.0, k * p[0])]                      # negros lavados
    for i in (2, 3, 4):                          # cuartiles y mediana
        x = float(base_pct[i])
        y = x + k * 0.6 * (p[i] - x)             # el contenido de la escena pesa: se suaviza
        pts.append((x, y))
    hi = p[-1] if p[-1] < 0.985 else 1.0
    pts.append((1.0, 1.0 - k * (1.0 - hi)))      # luces apagadas
    s["curve"] = monotone(pts)
    # --- curvas de color: punto negro/blanco por canal y dominante por zona.
    ch = {}
    for c, nm in enumerate("rgb"):
        lo_d = ref["chan_lo"][c] - ref["chan_lo"].mean()
        hi_d = ref["chan_hi"][c] - ref["chan_hi"].mean()
        cp = [(0.0, max(0.0, k * 0.8 * lo_d)), (1.0, min(1.0, 1.0 + k * 0.8 * min(0.0, hi_d)))]
        for z, zb in zip(ref["zones"], before["zones"] if before else [None] * 3):
            if z is None:
                continue
            d = z["delta"][c] - (zb["delta"][c] if zb else 0.0)
            cp.append((z["x"], z["x"] + k * 0.8 * d))
        ch[nm] = monotone(cp)
    s["channels"] = ch
    # --- saturación global.
    s["saturation"] = int(np.clip(round(k * 80 * (ref["sat"] / base_sat - 1)), -40, 40))
    # --- HSL por banda.
    hsl = {}
    for name, ctr in BANDS:
        b = ref["bands"].get(name)
        if not b:
            continue
        bb = before["bands"].get(name) if before else None
        sat0 = bb["sat"] if bb else 0.55
        val0 = bb["val"] if bb else 0.6
        dh = ((b["hue"] - ctr + 180) % 360) - 180 - ((((bb["hue"] - ctr + 180) % 360) - 180) if bb else 0)
        hsl[name] = (int(np.clip(round(k * 0.5 * dh), -15, 15)),
                     int(np.clip(round(k * 90 * (b["sat"] - sat0)), -40, 40)),
                     int(np.clip(round(k * 70 * (b["val"] - val0)), -30, 25)))
    s["hsl"] = hsl
    # --- blanco y negro, grano y viñeta.
    s["bw"] = ref["sat"] < 0.04
    noise0 = before["noise"] if before else 0.006
    s["grain"] = int(np.clip(round((ref["noise"] - noise0) * 2500), 0, 45))
    vig0 = before["vig"] if before else 0.9
    s["vignette"] = int(np.clip(round(k * 60 * (ref["vig"] - vig0)), -20, 0))
    return s


# ----------------------------------------------------------------------------- XMP
def _seq(tag, pts):
    li = "".join("\n     <rdf:li>%d, %d</rdf:li>" % (round(x * 255), round(y * 255)) for x, y in pts)
    return "   <crs:%s>\n    <rdf:Seq>%s\n    </rdf:Seq>\n   </crs:%s>\n" % (tag, li, tag)


def _alt(tag, text):
    from xml.sax.saxutils import escape
    return ('   <crs:%s>\n    <rdf:Alt>\n     <rdf:li xml:lang="x-default">%s</rdf:li>\n    </rdf:Alt>\n   </crs:%s>\n'
            % (tag, escape(text), tag))


def to_xmp(s, name, group="", description=""):
    attrs = {
        "PresetType": "Normal", "Cluster": "", "UUID": uuid.uuid4().hex.upper(),
        "SupportsAmount": "False", "SupportsColor": "True", "SupportsMonochrome": "True",
        "SupportsHighDynamicRange": "True", "SupportsNormalDynamicRange": "True",
        "SupportsSceneReferred": "True", "SupportsOutputReferred": "True",
        "CameraModelRestriction": "", "Copyright": "", "ContactInfo": "",
        "Version": "10.0", "HasSettings": "True",
        "ToneCurveName2012": "Custom",
        "Saturation": "%+d" % s["saturation"],
        "ConvertToGrayscale": "True" if s["bw"] else "False",
        "GrainAmount": str(s["grain"]), "GrainSize": "25", "GrainFrequency": "50",
        "PostCropVignetteAmount": "%+d" % s["vignette"], "PostCropVignetteMidpoint": "40",
        "PostCropVignetteFeather": "70", "PostCropVignetteRoundness": "0",
        "PostCropVignetteStyle": "1", "PostCropVignetteHighlightContrast": "0",
    }
    for k2 in ("Vibrance", "Clarity2012", "Contrast2012", "Highlights2012", "Shadows2012"):
        if k2 in s:
            attrs[k2] = "%+d" % s[k2]
    for name_b, _ in BANDS:
        h, sa, l = s["hsl"].get(name_b, (0, 0, 0))
        attrs["HueAdjustment" + name_b] = "%+d" % h
        attrs["SaturationAdjustment" + name_b] = "%+d" % sa
        attrs["LuminanceAdjustment" + name_b] = "%+d" % l
    body = "\n".join('   crs:%s="%s"' % kv for kv in attrs.items())
    xmp = ('<x:xmpmeta xmlns:x="adobe:ns:meta/" x:xmptk="Adobe XMP Core 5.6-c140">\n'
           ' <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">\n'
           '  <rdf:Description rdf:about=""\n    xmlns:crs="http://ns.adobe.com/camera-raw-settings/1.0/"\n'
           + body + '>\n')
    xmp += _alt("Name", name) + _alt("ShortName", "") + _alt("SortName", "")
    xmp += _alt("Group", group) + _alt("Description", description)
    xmp += _seq("ToneCurvePV2012", s["curve"])
    for nm, tag in (("r", "Red"), ("g", "Green"), ("b", "Blue")):
        xmp += _seq("ToneCurvePV2012" + tag, s["channels"][nm])
    xmp += "  </rdf:Description>\n </rdf:RDF>\n</x:xmpmeta>\n"
    return xmp


# ----------------------------------------------------------------------------- vista previa aproximada
def _curve_lut(pts):
    xs = np.array([p[0] for p in pts]); ys = np.array([p[1] for p in pts])
    if len(xs) < 3:
        return lambda v: np.interp(v, xs, ys)
    from numpy import interp
    # Spline monótono (Fritsch–Carlson), parecido al de Camera Raw.
    d = np.diff(ys) / np.maximum(np.diff(xs), 1e-6)
    m = np.concatenate([[d[0]], (d[:-1] + d[1:]) / 2, [d[-1]]])
    m[1:-1][d[:-1] * d[1:] <= 0] = 0
    grid = np.linspace(0, 1, 1025)
    i = np.clip(np.searchsorted(xs, grid) - 1, 0, len(xs) - 2)
    hseg = xs[i + 1] - xs[i]
    t = np.clip((grid - xs[i]) / np.maximum(hseg, 1e-6), 0, 1)
    h00 = 2 * t**3 - 3 * t**2 + 1; h10 = t**3 - 2 * t**2 + t; h01 = -2 * t**3 + 3 * t**2; h11 = t**3 - t**2
    lut = h00 * ys[i] + h10 * hseg * m[i] + h01 * ys[i + 1] + h11 * hseg * m[i + 1]
    lut = np.clip(lut, 0, 1)
    return lambda v: interp(v, grid, lut)


def simulate(im, s, seed=1):
    """Aproximación del resultado en Camera Raw (sólo para las vistas previas)."""
    out = _curve_lut(s["curve"])(im)
    for c, nm in enumerate("rgb"):
        out[..., c] = _curve_lut(s["channels"][nm])(out[..., c])
    hsv = cv2.cvtColor(out.astype(np.float32), cv2.COLOR_RGB2HSV)
    h, sat, v = hsv[..., 0], hsv[..., 1], hsv[..., 2]
    sat *= 1 + s["saturation"] / 100.0
    if s["hsl"]:
        dh = np.zeros_like(h); ds = np.zeros_like(h); dl = np.zeros_like(h); wsum = np.zeros_like(h)
        for name, ctr in BANDS:
            w = np.clip(1 - hue_dist(h, ctr) / 40.0, 0, 1)
            a, b, c = s["hsl"].get(name, (0, 0, 0))
            dh += w * a; ds += w * b; dl += w * c; wsum += w
        wsum = np.maximum(wsum, 1)
        h[:] = (h + dh / wsum) % 360
        sat *= 1 + ds / wsum / 100.0
        v *= 1 + (dl / wsum / 100.0) * np.clip(sat * 2, 0, 1) * 0.6
    hsv[..., 1] = np.clip(sat, 0, 1)
    out = cv2.cvtColor(hsv, cv2.COLOR_HSV2RGB)
    if s["bw"]:
        out = np.repeat((out @ REC709)[..., None], 3, axis=2)
    H, W = out.shape[:2]
    if s["vignette"]:
        yy, xx = np.mgrid[0:H, 0:W]
        r = np.hypot((xx - W / 2) / (W / 2), (yy - H / 2) / (H / 2)) / 1.414
        out *= (1 + s["vignette"] / 100.0 * np.clip((r - 0.35) / 0.65, 0, 1) ** 1.6)[..., None]
    if s["grain"]:
        rng = np.random.default_rng(seed)
        g = cv2.GaussianBlur(rng.standard_normal((H, W)).astype(np.float32), (0, 0), 0.7)
        L = out @ REC709
        out += (g * s["grain"] / 100.0 * 0.12 * (1 - np.abs(L * 2 - 1) ** 2))[..., None]
    return np.clip(out, 0, 1)


def describe(s):
    parts = []
    c = s["curve"]
    if c[0][1] > 0.03:
        parts.append("negros lavados")
    if c[-1][1] < 0.95:
        parts.append("luces apagadas")
    mid = [p for p in c if 0.3 < p[0] < 0.7]
    if s["bw"]:
        parts.append("blanco y negro")
    if s["saturation"] > 8:
        parts.append("color saturado")
    elif s["saturation"] < -8:
        parts.append("color contenido")
    strong = [BAND_NAMES_ES[n] for n, v in s["hsl"].items() if v[1] >= 15]
    if strong:
        parts.append("realza " + ", ".join(strong))
    if s["grain"]:
        parts.append("grano")
    return ", ".join(parts) if parts else "look suave"


def _avg_curve(curves):
    xs = np.linspace(0, 1, 7)
    ys = np.mean([np.interp(xs, [p[0] for p in c], [p[1] for p in c]) for c in curves], axis=0)
    return monotone(list(zip(xs.tolist(), ys.tolist())))


def average(items):
    """Promedia varios análisis en uno (para un look de serie)."""
    s = {"curve": _avg_curve([i["curve"] for i in items]),
         "channels": {c: _avg_curve([i["channels"][c] for i in items]) for c in "rgb"},
         "saturation": int(round(np.mean([i["saturation"] for i in items]))),
         "bw": all(i["bw"] for i in items),
         "grain": int(round(np.mean([i["grain"] for i in items]))),
         "vignette": int(round(np.mean([i["vignette"] for i in items]))), "hsl": {}}
    for name, _ in BANDS:
        vals = [i["hsl"].get(name, (0, 0, 0)) for i in items]
        s["hsl"][name] = tuple(int(round(v)) for v in np.mean(vals, axis=0))
    return s


def settings_dir():
    if sys.platform.startswith("win"):
        return os.path.join(os.environ.get("APPDATA", ""), "Adobe", "CameraRaw", "Settings")
    return os.path.expanduser("~/Library/Application Support/Adobe/CameraRaw/Settings")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("imagenes", nargs="+")
    ap.add_argument("--fuerza", type=float, default=85, help="0–100 (por defecto 85)")
    ap.add_argument("--grupo", default="Mis referencias")
    ap.add_argument("--salida", default=None, help="carpeta para los .xmp (por defecto junto a cada imagen)")
    ap.add_argument("--instalar", action="store_true", help="copiar directo a la carpeta de presets de Camera Raw")
    ap.add_argument("--antes", default=None, help="una foto tuya sin editar, para comparar (más fiel)")
    ap.add_argument("--combinar", default=None, metavar="NOMBRE",
                    help="crear UN solo preset con el promedio de todas las imágenes")
    a = ap.parse_args()
    before = stats(load(a.antes)) if a.antes else None
    out_dir = settings_dir() if a.instalar else a.salida
    if out_dir:
        os.makedirs(out_dir, exist_ok=True)
    if a.combinar:
        s = average([analyze(stats(load(p)), before, a.fuerza / 100.0) for p in a.imagenes])
        dest = os.path.join(out_dir or os.path.dirname(os.path.abspath(a.imagenes[0])), a.combinar + ".xmp")
        with open(dest, "w", encoding="utf-8") as fh:
            fh.write(to_xmp(s, a.combinar, a.grupo, "Promedio de %d referencias: %s." % (len(a.imagenes), describe(s))))
        print("✓ %d imágenes → %s (%s)" % (len(a.imagenes), dest, describe(s)))
        return
    for path in a.imagenes:
        ref = stats(load(path))
        s = analyze(ref, before, a.fuerza / 100.0)
        name = os.path.splitext(os.path.basename(path))[0]
        xmp = to_xmp(s, name, a.grupo, "Creado desde la referencia %s: %s." % (os.path.basename(path), describe(s)))
        dest = os.path.join(out_dir or os.path.dirname(os.path.abspath(path)), name + ".xmp")
        with open(dest, "w", encoding="utf-8") as fh:
            fh.write(xmp)
        print("✓ %s → %s (%s)" % (os.path.basename(path), dest, describe(s)))
    if a.instalar:
        print("\nListo. Reinicia Photoshop: los presets están en Camera Raw › Ajustes preestablecidos › «%s»." % a.grupo)


if __name__ == "__main__":
    main()
