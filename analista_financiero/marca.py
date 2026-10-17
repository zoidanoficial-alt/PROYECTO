"""Identidad de CIFRAS Consultores y datos del consultor.

Los datos de contacto que aparecen en los informes se guardan en la carpeta
de trabajo del usuario (no en el programa), para que sobrevivan a
actualizaciones del ejecutable.
"""

from __future__ import annotations

import base64
import json
import sys
from pathlib import Path

NOMBRE = "CIFRAS Consultores"
LEMA = "Decisiones respaldadas por cifras"
TINTA = "#0E1A2B"
COBRE = "#B4532A"
PAPEL = "#F4F2EE"

CAMPOS_CONTACTO = {
    "consultor": "Nombre del consultor",
    "puesto": "Puesto",
    "correo": "Correo",
    "telefono": "Teléfono / WhatsApp",
    "web": "Sitio web o LinkedIn",
    "ciudad": "Ciudad",
}


def _recursos() -> Path:
    base = Path(getattr(sys, "_MEIPASS", Path(__file__).resolve().parent.parent))
    return base / "analista_financiero" / "recursos"


def svg(nombre: str) -> str:
    """Contenido de un SVG de marca: 'logo-claro', 'logo-oscuro' o 'icono'."""
    return (_recursos() / f"{nombre}.svg").read_text(encoding="utf-8")


def svg_data_uri(nombre: str) -> str:
    return "data:image/svg+xml;base64," + base64.b64encode(svg(nombre).encode()).decode()


def carpeta_trabajo() -> Path:
    """Documentos/CIFRAS Consultores (o la carpeta personal si no hay Documentos)."""
    documentos = Path.home() / "Documents"
    if not documentos.exists():
        documentos = Path.home() / "Documentos" if (Path.home() / "Documentos").exists() else Path.home()
    carpeta = documentos / NOMBRE
    carpeta.mkdir(parents=True, exist_ok=True)
    return carpeta


def _ruta_config(base: Path | None = None) -> Path:
    return (base or carpeta_trabajo()) / "configuracion.json"


def cargar_config(base: Path | None = None) -> dict:
    try:
        datos = json.loads(_ruta_config(base).read_text(encoding="utf-8"))
    except (OSError, ValueError):
        datos = {}
    return {k: str(datos.get(k, "")) for k in CAMPOS_CONTACTO}


def guardar_config(datos: dict, base: Path | None = None) -> None:
    limpio = {k: str(datos.get(k, "")).strip() for k in CAMPOS_CONTACTO}
    _ruta_config(base).write_text(json.dumps(limpio, ensure_ascii=False, indent=2), encoding="utf-8")


def linea_contacto(config: dict) -> str:
    partes = [config.get(k, "") for k in ("consultor", "correo", "telefono", "web", "ciudad")]
    return " · ".join(p for p in partes if p)
