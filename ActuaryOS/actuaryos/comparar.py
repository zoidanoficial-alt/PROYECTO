"""Comparación entre métodos o versiones de un mismo cálculo."""
from __future__ import annotations

from .resultado import Resultado

UMBRAL_DIFERENCIA = 0.10


def comparar_metodos(resultados: list[Resultado]) -> str:
    if not resultados:
        return "No hay resultados que comparar."
    origenes = [f["origen"] for f in resultados[0].tabla_origenes]
    nombres = [r.metodo.split(" (")[0] for r in resultados]
    ancho = max(14, *(len(n) for n in nombres)) + 2
    r0 = resultados[0]
    lineas = [f"Reserva por origen ({r0.unidad} de {r0.moneda})",
              "Origen".ljust(12) + "".join(n.rjust(ancho) for n in nombres)]
    for o in origenes + ["total"]:
        lineas.append(o.ljust(12) + "".join(f"{r[f'reserva:{o}']:>{ancho},.2f}" for r in resultados))
    totales = [r["reserva:total"] for r in resultados]
    base = totales[0]
    if base and len(totales) > 1:
        lineas.append("")
        for r, n, t in zip(resultados[1:], nombres[1:], totales[1:]):
            if r.metodo.startswith("Mack") and abs(t - base) < 1e-9:
                lineas.append(f"{n}: misma estimación puntual que Chain Ladder; aporta la incertidumbre.")
                continue
            dif = (t - base) / base
            alerta = "  ⚠ diferencia material: revisar supuestos" if abs(dif) > UMBRAL_DIFERENCIA else ""
            lineas.append(f"{n} vs {nombres[0]}: {t - base:+,.2f} ({dif:+.1%}){alerta}")
    return "\n".join(lineas)


def explicar_cambio(anterior: Resultado, nuevo: Resultado) -> str:
    """Explica qué cambió entre dos corridas: datos, parámetros y cifras."""
    lineas = []
    if anterior.huella_datos != nuevo.huella_datos:
        lineas.append("• Cambiaron los datos de entrada (huella distinta).")
    for k in sorted(set(anterior.parametros) | set(nuevo.parametros)):
        a, b = anterior.parametros.get(k), nuevo.parametros.get(k)
        if a != b:
            lineas.append(f"• Parámetro «{k}»: {a} → {b}.")
    if anterior.metodo != nuevo.metodo:
        lineas.append(f"• Método: {anterior.metodo} → {nuevo.metodo}.")
    if not lineas:
        lineas.append("• Mismos datos, parámetros y método: los resultados deben ser idénticos.")
    lineas.append("Cifras:")
    for k in anterior.cifras:
        if k.startswith("reserva:") and k in nuevo.cifras:
            a, b = anterior[k], nuevo[k]
            if abs(b - a) > 1e-9:
                lineas.append(f"  {k}: {a:,.4f} → {b:,.4f} ({b - a:+,.4f})")
    return "\n".join(lineas)
