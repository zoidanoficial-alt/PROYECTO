"""Selector de metodología: recomienda según lo que los datos permiten.

No elige un método porque sea popular ni porque dé la cifra más
conveniente: revisa requisitos y explica por qué cada método aplica o no.
"""
from __future__ import annotations

from dataclasses import dataclass

from .triangulo import Triangulo


@dataclass(frozen=True)
class Evaluacion:
    metodo: str
    aplicable: bool
    razones: list[str]
    falta: list[str]

    def __str__(self) -> str:
        marca = "✔" if self.aplicable else "✘"
        lineas = [f"{marca} {self.metodo}"]
        lineas += [f"    · {r}" for r in self.razones]
        lineas += [f"    · Falta: {f}" for f in self.falta]
        return "\n".join(lineas)


def evaluar_metodos(tri: Triangulo, tiene_primas: bool = False, tiene_elr: bool = False) -> list[Evaluacion]:
    I, K = tri.n_origenes, tri.n_edades
    obs_por_edad = tri.observado.sum(axis=0)
    evals = []

    razones, falta = [], []
    cl_ok = I >= 2 and K >= 2 and all(obs_por_edad[j + 1] >= 1 for j in range(K - 1))
    if cl_ok:
        razones.append(f"Hay {I} orígenes y {K} edades: se pueden estimar todos los factores.")
        if I < 5:
            razones.append("Con menos de 5 orígenes los factores son frágiles; úsalo como referencia, "
                           "no como única estimación.")
    else:
        falta.append("al menos 2 orígenes con observaciones en cada par de edades consecutivas")
    evals.append(Evaluacion("Chain Ladder", cl_ok, razones, falta))

    razones, falta = [], []
    if not cl_ok:
        falta.append("un patrón de desarrollo estimable (requisito de Chain Ladder)")
    if not tiene_primas:
        falta.append("primas devengadas por origen")
    if not tiene_elr:
        falta.append("una siniestralidad esperada a priori justificada (plan de negocio, tarificación, mercado)")
    bf_ok = not falta
    if bf_ok:
        razones.append("Útil cuando los orígenes recientes tienen poco desarrollo y sus pagos son poco "
                       "representativos.")
    evals.append(Evaluacion("Bornhuetter-Ferguson", bf_ok, razones, falta))

    razones, falta = [], []
    mack_ok = cl_ok and I >= 3 and K >= 3
    if mack_ok:
        razones.append("Permite medir la incertidumbre de la reserva Chain Ladder (error estándar e intervalo).")
        if sum(obs_por_edad[1:] == 1):
            razones.append("Alguna varianza se estimará con una sola observación o se extrapolará: "
                           "interpreta el intervalo con cautela.")
    else:
        falta.append("al menos 3 orígenes y 3 edades de desarrollo")
    evals.append(Evaluacion("Mack", mack_ok, razones, falta))
    return evals


def recomendar(tri: Triangulo, tiene_primas: bool = False, tiene_elr: bool = False) -> str:
    evals = evaluar_metodos(tri, tiene_primas, tiene_elr)
    aplicables = [e.metodo for e in evals if e.aplicable]
    lineas = ["Evaluación de metodologías:"] + [str(e) for e in evals]
    if not aplicables:
        lineas.append("\nNo hay información suficiente para estimar reservas con estos métodos.")
    elif len(aplicables) == 1:
        lineas.append(f"\nRecomendación: {aplicables[0]}. No hay otro método aplicable para contrastar; "
                      "documenta esta limitación.")
    else:
        lineas.append(f"\nRecomendación: ejecutar {', '.join(aplicables)} y comparar. "
                      "Diferencias grandes entre métodos son una señal para revisar supuestos, no para "
                      "elegir la cifra más conveniente.")
    return "\n".join(lineas)
