#!/usr/bin/env python3
"""Regenera client/schema.json (catálogo de filtros y recetas que lee el panel)."""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import eg  # noqa: E402

OUT = os.path.join(HERE, "..", "client", "schema.json")

if __name__ == "__main__":
    with open(OUT, "w", encoding="utf-8") as fh:
        json.dump(eg.schema(), fh, ensure_ascii=False, indent=1)
        fh.write("\n")
    print("Escrito", os.path.normpath(OUT))
