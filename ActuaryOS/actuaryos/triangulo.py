"""Triángulo de desarrollo: la estructura de datos central de las reservas.

Un triángulo guarda montos acumulados por periodo de origen (año del
siniestro) y edad de desarrollo (12, 24, 36... meses). Las celdas aún no
observadas se guardan como ``NaN``: un hueco significa "todavía no lo
sabemos", nunca "cero".
"""
from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass, field

import numpy as np


@dataclass(frozen=True)
class Triangulo:
    origenes: tuple[str, ...]
    edades: tuple[int, ...]
    valores: np.ndarray
    unidad: str = "sin especificar"
    moneda: str = "sin especificar"
    tipo: str = "pagos acumulados"
    fuente: str = ""
    metadatos: dict = field(default_factory=dict, compare=False)

    def __post_init__(self):
        v = np.asarray(self.valores, dtype=float)
        if v.shape != (len(self.origenes), len(self.edades)):
            raise ValueError(
                f"La matriz tiene forma {v.shape}, pero hay {len(self.origenes)} "
                f"orígenes y {len(self.edades)} edades."
            )
        v = v.copy()
        v.setflags(write=False)
        object.__setattr__(self, "valores", v)

    @property
    def n_origenes(self) -> int:
        return len(self.origenes)

    @property
    def n_edades(self) -> int:
        return len(self.edades)

    @property
    def observado(self) -> np.ndarray:
        return ~np.isnan(self.valores)

    def indice_ultimo(self) -> np.ndarray:
        """Índice de la última edad observada en cada origen (-1 si no hay)."""
        idx = np.full(self.n_origenes, -1)
        for i in range(self.n_origenes):
            obs = np.flatnonzero(self.observado[i])
            if obs.size:
                idx[i] = obs[-1]
        return idx

    def diagonal(self) -> np.ndarray:
        """Último valor observado de cada origen (la "diagonal actual")."""
        idx = self.indice_ultimo()
        return np.array(
            [self.valores[i, j] if j >= 0 else np.nan for i, j in enumerate(idx)]
        )

    def incremental(self) -> np.ndarray:
        inc = self.valores.copy()
        inc[:, 1:] = self.valores[:, 1:] - self.valores[:, :-1]
        return inc

    def huella(self) -> str:
        """SHA-256 del contenido: identifica exactamente qué datos se usaron."""
        contenido = {
            "origenes": list(self.origenes),
            "edades": list(self.edades),
            "valores": [[None if np.isnan(x) else round(float(x), 10) for x in fila]
                        for fila in self.valores],
            "unidad": self.unidad,
            "moneda": self.moneda,
            "tipo": self.tipo,
        }
        crudo = json.dumps(contenido, sort_keys=True, ensure_ascii=False)
        return hashlib.sha256(crudo.encode("utf-8")).hexdigest()

    def como_tabla(self, decimales: int = 2) -> str:
        ancho = max(10, *(len(o) for o in self.origenes))
        cab = "Origen".ljust(ancho) + "".join(f"{str(e) + 'm':>12}" for e in self.edades)
        filas = [cab]
        for o, fila in zip(self.origenes, self.valores):
            celdas = "".join(
                f"{'—':>12}" if np.isnan(x) else f"{x:>12,.{decimales}f}" for x in fila
            )
            filas.append(o.ljust(ancho) + celdas)
        return "\n".join(filas)
