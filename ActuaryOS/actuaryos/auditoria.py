"""Registro de auditoría y reproducción de cálculos.

Cada corrida produce un registro JSON con la huella de los datos, el
método y su versión, los parámetros, los hallazgos y las cifras. Con ese
registro y el archivo de datos original, ``reproducir`` vuelve a calcular y
concilia cifra por cifra.
"""
from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

from . import __version__
from .datos import Hallazgo, cargar_triangulo
from .resultado import Resultado

TOLERANCIA = 1e-9


def crear_registro(resultado: Resultado, carga: dict, hallazgos: list[Hallazgo]) -> dict:
    return {
        "actuaryos": __version__,
        "fecha": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "carga": carga,
        "hallazgos_datos": [h.como_dict() for h in hallazgos],
        "resultado": resultado.como_dict(),
    }


def guardar_registro(registro: dict, ruta: str | Path) -> Path:
    ruta = Path(ruta)
    ruta.write_text(json.dumps(registro, ensure_ascii=False, indent=2), encoding="utf-8")
    return ruta


def ejecutar(metodo: str, tri, parametros: dict) -> Resultado:
    from .reservas.bornhuetter_ferguson import bornhuetter_ferguson
    from .reservas.chain_ladder import chain_ladder
    from .reservas.mack import mack

    if metodo == "chain-ladder":
        excluir = {tuple(x) for x in parametros.get("excluir", [])}
        return chain_ladder(tri, cola=parametros.get("cola", 1.0), excluir=excluir)
    if metodo == "bf":
        return bornhuetter_ferguson(
            tri, parametros["primas"], parametros["siniestralidad_esperada"],
            cola=parametros.get("cola", 1.0),
            fuente_supuesto=parametros.get("fuente_supuesto", "proporcionado por el usuario"))
    if metodo == "mack":
        return mack(tri, nivel_confianza=parametros.get("nivel_confianza", 0.95))
    raise ValueError(f"Método desconocido: {metodo}")


def reproducir(registro: dict, ruta_datos: str | Path | None = None) -> tuple[bool, list[str]]:
    """Recalcula a partir del registro y concilia. Devuelve (coincide, detalle)."""
    carga = dict(registro["carga"])
    metodo = carga.pop("metodo")
    ruta = ruta_datos or carga.pop("ruta")
    carga.pop("ruta", None)
    tri, hallazgos = cargar_triangulo(ruta, **carga)
    detalle = []
    if tri is None:
        return False, ["Los datos ya no se pueden cargar:"] + [str(h) for h in hallazgos]
    original = registro["resultado"]
    if tri.huella() != original["huella_datos"]:
        detalle.append("✘ Los datos cambiaron desde la corrida original (huella distinta).")
        return False, detalle
    detalle.append("✔ Datos idénticos (misma huella SHA-256).")
    nuevo = ejecutar(metodo, tri, original["parametros"])
    if nuevo.version_metodo != original["version_metodo"]:
        detalle.append(f"• Versión del método: {original['version_metodo']} → {nuevo.version_metodo}.")
    ok = True
    for clave, valor in original["cifras"].items():
        actual = nuevo.cifras[clave].valor if clave in nuevo.cifras else None
        if actual is None or abs(actual - valor) > TOLERANCIA * max(1.0, abs(valor)):
            ok = False
            detalle.append(f"✘ {clave}: original {valor!r}, reproducido {actual!r}")
    if ok:
        detalle.append(f"✔ Las {len(original['cifras'])} cifras se reproducen exactamente.")
    return ok, detalle
