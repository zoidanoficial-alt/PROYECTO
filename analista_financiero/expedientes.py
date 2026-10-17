"""Expedientes de clientes: una carpeta por cliente con sus datos y entregas.

    Documentos/CIFRAS Consultores/Clientes/<Cliente>/
        cliente.json          datos del cliente
        datos/                archivos que entregó el cliente (copias, nunca se modifican)
        entregas/AAAA-MM-DD_HHMM/
            informe.html      informe entregado
            trazabilidad.json cifras con su origen
            bitacora.txt      decisiones tomadas durante el análisis
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

from .marca import carpeta_trabajo


@dataclass
class Cliente:
    nombre: str
    carpeta: Path
    contacto: str = ""
    giro: str = ""
    notas: str = ""

    @property
    def datos(self) -> Path:
        return self.carpeta / "datos"

    @property
    def entregas(self) -> Path:
        return self.carpeta / "entregas"


def _carpeta_clientes(base: Path | None = None) -> Path:
    c = (base or carpeta_trabajo()) / "Clientes"
    c.mkdir(parents=True, exist_ok=True)
    return c


def _nombre_carpeta(nombre: str) -> str:
    limpio = re.sub(r'[<>:"/\\|?*\x00-\x1f]', "", nombre).strip().rstrip(".")
    return limpio[:80] or "Cliente"


def listar(base: Path | None = None) -> list[Cliente]:
    clientes = []
    for d in sorted(_carpeta_clientes(base).iterdir()):
        if d.is_dir():
            clientes.append(abrir(d))
    return clientes


def abrir(carpeta: Path) -> Cliente:
    try:
        info = json.loads((carpeta / "cliente.json").read_text(encoding="utf-8"))
    except (OSError, ValueError):
        info = {}
    return Cliente(info.get("nombre", carpeta.name), carpeta, info.get("contacto", ""),
                   info.get("giro", ""), info.get("notas", ""))


def crear(nombre: str, contacto: str = "", giro: str = "", notas: str = "", base: Path | None = None) -> Cliente:
    nombre = nombre.strip()
    if not nombre:
        raise ValueError("El cliente necesita un nombre")
    carpeta = _carpeta_clientes(base) / _nombre_carpeta(nombre)
    carpeta.mkdir(parents=True, exist_ok=True)
    cliente = Cliente(nombre, carpeta, contacto.strip(), giro.strip(), notas.strip())
    guardar(cliente)
    cliente.datos.mkdir(exist_ok=True)
    cliente.entregas.mkdir(exist_ok=True)
    return cliente


def guardar(cliente: Cliente) -> None:
    info = {"nombre": cliente.nombre, "contacto": cliente.contacto, "giro": cliente.giro, "notas": cliente.notas}
    (cliente.carpeta / "cliente.json").write_text(json.dumps(info, ensure_ascii=False, indent=2), encoding="utf-8")


def guardar_archivo(cliente: Cliente, nombre: str, contenido: bytes) -> Path:
    """Guarda una copia del archivo del cliente; si ya existe uno igual con ese nombre, lo reutiliza."""
    cliente.datos.mkdir(parents=True, exist_ok=True)
    destino = cliente.datos / Path(nombre).name
    if destino.exists() and destino.read_bytes() == contenido:
        return destino
    if destino.exists():
        sello = datetime.now().strftime("%Y%m%d_%H%M%S")
        destino = destino.with_name(f"{destino.stem}_{sello}{destino.suffix}")
    destino.write_bytes(contenido)
    return destino


def archivos(cliente: Cliente) -> list[Path]:
    if not cliente.datos.exists():
        return []
    return sorted((p for p in cliente.datos.iterdir() if p.suffix.lower() in (".xlsx", ".xls", ".csv")),
                  key=lambda p: p.stat().st_mtime, reverse=True)


def registrar_entrega(cliente: Cliente, sesion, nombre_empresa: str | None = None, contacto: dict | None = None) -> Path:
    """Genera el informe y la trazabilidad dentro del expediente."""
    carpeta = cliente.entregas / datetime.now().strftime("%Y-%m-%d_%H%M%S")
    carpeta.mkdir(parents=True, exist_ok=True)
    sesion.informe(carpeta / "informe.html", nombre_empresa or cliente.nombre, contacto)
    sesion.exportar_json(carpeta / "trazabilidad.json")
    (carpeta / "bitacora.txt").write_text("\n".join(sesion.bitacora), encoding="utf-8")
    return carpeta


def entregas(cliente: Cliente) -> list[Path]:
    if not cliente.entregas.exists():
        return []
    return sorted((p for p in cliente.entregas.iterdir() if (p / "informe.html").exists()), reverse=True)
