"""Resultados explicables: cada cifra lleva su «¿Por qué?».

Un ``Resultado`` nunca nace aprobado. Queda en estado «borrador» hasta que
un actuario lo revisa y lo aprueba explícitamente; la aprobación queda
registrada con nombre, fecha y comentario.
"""
from __future__ import annotations

from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone

from .datos import Hallazgo

BORRADOR = "borrador — requiere revisión actuarial"
APROBADO = "aprobado"
RECHAZADO = "rechazado"


@dataclass
class Explicacion:
    formula: str
    insumos: dict[str, float | str]
    pasos: list[str]
    supuestos: list[str] = field(default_factory=list)
    limitaciones: list[str] = field(default_factory=list)
    sencilla: str = ""

    def texto(self, modo: str = "experto") -> str:
        lineas = []
        if modo == "principiante":
            lineas.append(self.sencilla or self.pasos[-1])
            if self.supuestos:
                lineas.append("\nLo que estamos suponiendo:")
                lineas += [f"  • {s}" for s in self.supuestos]
            if self.limitaciones:
                lineas.append("\nTen en cuenta:")
                lineas += [f"  • {s}" for s in self.limitaciones]
            return "\n".join(lineas)
        lineas.append(f"Fórmula: {self.formula}")
        lineas.append("Datos utilizados:")
        lineas += [f"  {k} = {v:,.6f}" if isinstance(v, float) else f"  {k} = {v}"
                   for k, v in self.insumos.items()]
        lineas.append("Pasos:")
        lineas += [f"  {n}. {p}" for n, p in enumerate(self.pasos, 1)]
        if self.supuestos:
            lineas.append("Supuestos:")
            lineas += [f"  • {s}" for s in self.supuestos]
        if self.limitaciones:
            lineas.append("Limitaciones:")
            lineas += [f"  • {s}" for s in self.limitaciones]
        return "\n".join(lineas)


@dataclass
class Cifra:
    clave: str
    etiqueta: str
    valor: float
    explicacion: Explicacion


@dataclass
class Revision:
    estado: str
    revisor: str
    comentario: str
    fecha: str


@dataclass
class Resultado:
    metodo: str
    version_metodo: str
    huella_datos: str
    parametros: dict
    unidad: str
    moneda: str
    cifras: dict[str, Cifra]
    tabla_factores: list[dict]
    tabla_origenes: list[dict]
    supuestos: list[str]
    advertencias: list[Hallazgo] = field(default_factory=list)
    estado: str = BORRADOR
    revisiones: list[Revision] = field(default_factory=list)

    def __getitem__(self, clave: str) -> float:
        return self.cifras[clave].valor

    def por_que(self, clave: str, modo: str = "experto") -> str:
        if clave not in self.cifras:
            disponibles = ", ".join(self.cifras)
            raise KeyError(f"No hay una cifra «{clave}». Disponibles: {disponibles}")
        c = self.cifras[clave]
        unidad = "" if clave.startswith("factor:") else f" ({self.unidad} de {self.moneda})"
        return f"¿Por qué {c.etiqueta} = {c.valor:,.4f}{unidad}?\n" + c.explicacion.texto(modo)

    def _revisar(self, estado: str, revisor: str, comentario: str) -> None:
        if not revisor.strip():
            raise ValueError("La revisión debe identificar a la persona que revisa.")
        self.estado = estado
        self.revisiones.append(Revision(
            estado, revisor, comentario, datetime.now(timezone.utc).isoformat(timespec="seconds")))

    def aprobar(self, revisor: str, comentario: str = "") -> None:
        self._revisar(APROBADO, revisor, comentario)

    def rechazar(self, revisor: str, comentario: str) -> None:
        self._revisar(RECHAZADO, revisor, comentario)

    def como_dict(self) -> dict:
        return {
            "metodo": self.metodo,
            "version_metodo": self.version_metodo,
            "huella_datos": self.huella_datos,
            "parametros": self.parametros,
            "unidad": self.unidad,
            "moneda": self.moneda,
            "estado": self.estado,
            "cifras": {k: c.valor for k, c in self.cifras.items()},
            "tabla_factores": self.tabla_factores,
            "tabla_origenes": self.tabla_origenes,
            "supuestos": self.supuestos,
            "advertencias": [h.como_dict() for h in self.advertencias],
            "revisiones": [asdict(r) for r in self.revisiones],
        }
