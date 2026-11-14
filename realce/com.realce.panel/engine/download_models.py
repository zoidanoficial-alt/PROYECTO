#!/usr/bin/env python3
"""Descarga los modelos de super-resolución usados por Realce IA.

    python download_models.py            # rápido + equilibrado (FSRCNN, ESPCN), ~0.5 MB
    python download_models.py --quality  # además EDSR (mejor calidad, ~115 MB)
"""
import argparse
import os
import sys
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
MODELS_DIR = os.path.join(HERE, "models")

SOURCES = {
    "FSRCNN": "https://raw.githubusercontent.com/Saafke/FSRCNN_Tensorflow/master/models/FSRCNN_x{s}.pb",
    "ESPCN": "https://raw.githubusercontent.com/fannymonori/TF-ESPCN/master/export/ESPCN_x{s}.pb",
    "EDSR": "https://raw.githubusercontent.com/Saafke/EDSR_Tensorflow/master/models/EDSR_x{s}.pb",
}


def fetch(url, dest):
    if os.path.isfile(dest) and os.path.getsize(dest) > 0:
        print("  ya existe  %s" % os.path.basename(dest))
        return
    print("  descargando %s ..." % os.path.basename(dest), end="", flush=True)
    tmp = dest + ".part"
    urllib.request.urlretrieve(url, tmp)
    os.replace(tmp, dest)
    print(" %.1f MB" % (os.path.getsize(dest) / 1e6))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--quality", action="store_true", help="incluir EDSR (grande)")
    args = ap.parse_args()
    os.makedirs(MODELS_DIR, exist_ok=True)
    families = ["FSRCNN", "ESPCN"] + (["EDSR"] if args.quality else [])
    for fam in families:
        print(fam)
        for s in (2, 3, 4):
            fetch(SOURCES[fam].format(s=s), os.path.join(MODELS_DIR, "%s_x%d.pb" % (fam, s)))
    print("Listo. Modelos en:", MODELS_DIR)


if __name__ == "__main__":
    sys.exit(main())
