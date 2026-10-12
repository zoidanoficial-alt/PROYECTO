"""Generador de entregables: informes con cifras vinculadas al motor de cálculo.

Todas las cifras del informe salen del objeto ``Resultado``; el texto sólo
las acomoda y redacta conclusiones condicionadas a ellas.
"""
from __future__ import annotations

from .datos import Hallazgo
from .resultado import BORRADOR, Resultado
from .triangulo import Triangulo

ESCALAS = {"unidades": 1, "pesos": 1, "miles": 1_000, "millones": 1_000_000}


def a_moneda(valor: float, unidad: str, moneda: str) -> str:
    """Convierte de la unidad de cálculo a la moneda de presentación."""
    escala = ESCALAS.get(unidad.lower())
    if escala is None:
        return f"{valor:,.2f} {unidad}"
    return f"${valor * escala:,.2f} {moneda}"


def informe_markdown(
    tri: Triangulo,
    resultados: list[Resultado],
    hallazgos: list[Hallazgo],
    titulo: str = "Estimación de reservas de siniestros",
) -> str:
    principal = resultados[0]
    m = lambda x: a_moneda(x, tri.unidad, tri.moneda)  # noqa: E731
    L = [f"# {titulo}", ""]
    estados = {r.estado for r in resultados}
    if any(e != "aprobado" for e in estados):
        L += [f"> **Estado: {BORRADOR}.** Las cifras provienen del motor de cálculo, pero no han sido "
              "aprobadas por un actuario responsable.", ""]

    L += ["## Resumen", ""]
    total = principal["reserva:total"]
    corto = lambda r: r.metodo.split(" (")[0]  # noqa: E731
    L.append(f"- **Reserva estimada total ({corto(principal)}): {m(total)}**")
    for r in resultados[1:]:
        if "error_estandar:total" in r.cifras and abs(r["reserva:total"] - total) < 1e-9:
            continue
        dif = r["reserva:total"] - total
        L.append(f"- {r.metodo}: {m(r['reserva:total'])} ({dif / total:+.1%} vs. {corto(principal)})")
    if "error_estandar:total" in principal.cifras or any("error_estandar:total" in r.cifras for r in resultados):
        rm = next(r for r in resultados if "error_estandar:total" in r.cifras)
        L.append(f"- Error estándar (Mack): {m(rm['error_estandar:total'])}; intervalo de "
                 f"{rm.parametros['nivel_confianza']:.0%}: {m(rm['intervalo:total:inferior'])} – "
                 f"{m(rm['intervalo:total:superior'])}")
    filas = sorted(principal.tabla_origenes, key=lambda f: -f["reserva"])
    if total > 0 and filas:
        mayor = filas[0]
        L.append(f"- El origen {mayor['origen']} concentra el {mayor['reserva'] / total:.0%} de la reserva; "
                 f"es el de menor desarrollo ({mayor['edad_actual']} meses) y el más sensible a los supuestos.")
    L.append("")

    L += ["## Datos utilizados", "",
          f"- Fuente: `{tri.fuente or 'sin archivo'}`",
          f"- Tipo: {tri.tipo}; unidad de cálculo: {tri.unidad} de {tri.moneda}",
          f"- Huella SHA-256: `{tri.huella()}`", "",
          "```", tri.como_tabla(), "```", ""]

    relevantes = [h for h in hallazgos if h.severidad != "info"]
    L += ["## Validación de datos", ""]
    if relevantes:
        L += [f"- **{h.severidad}** `{h.codigo}` {h.ubicacion}: {h.mensaje} {h.sugerencia}".rstrip()
              for h in relevantes]
    else:
        L.append("- Sin hallazgos: estructura triangular completa, montos no negativos y acumulados crecientes.")
    L.append("")

    L += ["## Factores de desarrollo", "", "| Periodo | Factor | Factor acumulado | Orígenes usados |",
          "|---|---:|---:|---|"]
    for f in principal.tabla_factores:
        L.append(f"| {f['desde']} → {f['hasta']} meses | {f['factor']:.5f} | {f['fda']:.5f} | "
                 f"{', '.join(f['origenes_usados'])} |")
    L.append("")

    for r in resultados:
        L += [f"## Resultados: {r.metodo}", "",
              "| Origen | Pagado | Costo último estimado | Reserva |" +
              (" Error estándar |" if "error_estandar" in r.tabla_origenes[0] else ""),
              "|---|---:|---:|---:|" + ("---:|" if "error_estandar" in r.tabla_origenes[0] else "")]
        for f in r.tabla_origenes:
            linea = f"| {f['origen']} | {m(f['pagado'])} | {m(f['ultimo'])} | {m(f['reserva'])} |"
            if "error_estandar" in f:
                linea += f" {m(f['error_estandar'])} |"
            L.append(linea)
        total_fila = f"| **Total** | | {m(r['ultimo:total'])} | **{m(r['reserva:total'])}** |"
        if "error_estandar:total" in r.cifras:
            total_fila += f" {m(r['error_estandar:total'])} |"
        L.append(total_fila)
        L.append("")
        L += ["Supuestos:", ""] + [f"- {s}" for s in r.supuestos] + [""]
        if r.advertencias:
            L += ["Advertencias del método:", ""] + [f"- {h.mensaje} {h.sugerencia}".rstrip()
                                                     for h in r.advertencias] + [""]
        if r.revisiones:
            L += ["Revisión:", ""] + [f"- {v.fecha} — {v.estado} por {v.revisor}: {v.comentario}"
                                       for v in r.revisiones] + [""]

    L += ["## Trazabilidad", "",
          "Cada cifra puede reproducirse con `python -m actuaryos reproducir <registro.json>` y "
          "explicarse con `--por-que <clave>`.", "",
          "| Método | Versión | Parámetros |", "|---|---|---|"]
    for r in resultados:
        params = {k: v for k, v in r.parametros.items() if k not in ("primas",)}
        L.append(f"| {r.metodo} | {r.version_metodo} | `{params}` |")
    L.append("")
    return "\n".join(L)
