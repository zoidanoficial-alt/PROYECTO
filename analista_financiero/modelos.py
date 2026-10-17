"""Estructuras compartidas: cifras trazables, problemas de datos y preguntas al usuario.

Principio 3 ("Demostrar cada conclusión"): toda cifra que el sistema muestra
es una `Cifra` registrada en un `Libro`, con su fórmula, periodo, supuestos,
las cifras de las que depende y las filas originales que la alimentan. Así
cualquier número del informe se puede rastrear hasta el Excel del usuario.
"""

from __future__ import annotations

import math
import unicodedata
from dataclasses import asdict, dataclass, field
from typing import Any


# ---------------------------------------------------------------------------
# Utilidades de texto y formato
# ---------------------------------------------------------------------------

def normalizar_texto(valor: Any) -> str:
    """minúsculas, sin acentos, solo letras/dígitos separados por un espacio."""
    if valor is None or (isinstance(valor, float) and math.isnan(valor)):
        return ""
    texto = unicodedata.normalize("NFKD", str(valor))
    texto = "".join(c for c in texto if not unicodedata.combining(c)).lower()
    limpio = "".join(c if c.isalnum() else " " for c in texto)
    return " ".join(limpio.split())


def primer_texto(*valores) -> str:
    """Primer valor con texto (ignora None y NaN)."""
    for v in valores:
        if v is not None and not (isinstance(v, float) and math.isnan(v)) and str(v).strip():
            return str(v).strip()
    return ""


def fmt_dinero(valor: float | None, moneda: str = "MXN", decimales: int = 0) -> str:
    if valor is None or (isinstance(valor, float) and math.isnan(valor)):
        return "s/d"
    signo = "-" if valor < 0 else ""
    return f"{signo}${abs(valor):,.{decimales}f}"


def fmt_pct(valor: float | None, decimales: int = 1, signo: bool = False) -> str:
    if valor is None or (isinstance(valor, float) and math.isnan(valor)):
        return "s/d"
    s = f"{valor * 100:+.{decimales}f}%" if signo else f"{valor * 100:.{decimales}f}%"
    return s


def fmt_pts(valor: float | None, decimales: int = 1) -> str:
    """Diferencia entre dos porcentajes, en puntos porcentuales."""
    if valor is None or (isinstance(valor, float) and math.isnan(valor)):
        return "s/d"
    return f"{valor * 100:+.{decimales}f} pts"


def cambio_pct(actual: float | None, base: float | None) -> float | None:
    if actual is None or base is None or base == 0:
        return None
    return (actual - base) / abs(base)


# ---------------------------------------------------------------------------
# Cifras trazables
# ---------------------------------------------------------------------------

@dataclass
class Cifra:
    clave: str
    nombre: str
    valor: float | None
    unidad: str  # "dinero" | "pct" | "pts" | "unidades" | "dias" | "veces"
    formula: str
    periodo: str
    origen: list[str] = field(default_factory=list)  # filas de los datos originales
    depende_de: list[str] = field(default_factory=list)  # claves de otras cifras
    supuestos: list[str] = field(default_factory=list)
    confianza: str = "confiable"  # "confiable" | "provisional" | "insuficiente"
    concepto: str | None = None  # clave del glosario para explicarla

    def texto(self, moneda: str = "MXN") -> str:
        if self.valor is None:
            return "s/d"
        if self.unidad == "dinero":
            return fmt_dinero(self.valor, moneda)
        if self.unidad == "pct":
            return fmt_pct(self.valor)
        if self.unidad == "pts":
            return fmt_pts(self.valor)
        if self.unidad == "dias":
            return f"{self.valor:,.0f} días"
        if self.unidad == "unidades":
            return f"{self.valor:,.0f} u."
        return f"{self.valor:,.2f}"

    def a_dict(self) -> dict:
        return asdict(self)


class Libro:
    """Registro de todas las cifras calculadas en un análisis."""

    def __init__(self) -> None:
        self._cifras: dict[str, Cifra] = {}

    def agregar(self, cifra: Cifra) -> Cifra:
        self._cifras[cifra.clave] = cifra
        return cifra

    def get(self, clave: str) -> Cifra | None:
        return self._cifras.get(clave)

    def __getitem__(self, clave: str) -> Cifra:
        return self._cifras[clave]

    def __contains__(self, clave: str) -> bool:
        return clave in self._cifras

    def valor(self, clave: str) -> float | None:
        c = self._cifras.get(clave)
        return None if c is None else c.valor

    def todas(self) -> list[Cifra]:
        return list(self._cifras.values())

    def rastrear(self, clave: str, _visto: set[str] | None = None) -> dict:
        """Árbol de dependencias de una cifra, hasta las filas originales."""
        visto = _visto if _visto is not None else set()
        c = self._cifras.get(clave)
        if c is None:
            return {"clave": clave, "error": "cifra desconocida"}
        visto.add(clave)
        hijos = [self.rastrear(d, visto) for d in c.depende_de if d not in visto]
        return {
            "clave": c.clave,
            "nombre": c.nombre,
            "valor": c.valor,
            "texto": c.texto(),
            "formula": c.formula,
            "periodo": c.periodo,
            "supuestos": c.supuestos,
            "confianza": c.confianza,
            "filas_origen": len(c.origen),
            "muestra_origen": c.origen[:10],
            "depende_de": hijos,
        }


# ---------------------------------------------------------------------------
# Calidad de datos y diálogo con el usuario
# ---------------------------------------------------------------------------

SEVERIDADES = ("bloqueante", "advertencia", "info")


@dataclass
class Problema:
    codigo: str
    severidad: str
    titulo: str
    explicacion: str
    filas: list[str] = field(default_factory=list)
    sugerencia: str = ""
    accion_tomada: str = ""
    importe_afectado: float = 0.0


@dataclass
class Pregunta:
    """Algo que el sistema no puede decidir solo y necesita confirmar."""

    id: str
    tipo: str
    texto: str
    por_que: str
    opciones: list[str] = field(default_factory=list)
    sugerida: str | None = None
    contexto: dict = field(default_factory=dict)
    respuesta: str | None = None


@dataclass
class Paso:
    """Principio 1: siempre hay un siguiente paso recomendado."""

    etapa: int
    titulo: str
    que_hacer: str
    por_que: str
    falta: list[str] = field(default_factory=list)
    opciones: list[str] = field(default_factory=list)
