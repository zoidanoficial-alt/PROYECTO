"""Bornhuetter-Ferguson: combina el desarrollo observado con una expectativa a priori.

    Último_i = Pagado_i + Prima_i · ELR_i · (1 − 1/FDA_i)

El patrón de desarrollo (FDA) viene de Chain Ladder; la siniestralidad
esperada (ELR) es un supuesto que debe proporcionar el actuario. La app no
lo inventa: si falta, el método no se ejecuta.
"""
from __future__ import annotations

from ..resultado import Cifra, Explicacion, Resultado
from ..triangulo import Triangulo
from .chain_ladder import MetodoNoAplicable, chain_ladder

VERSION = "1.0.0"


def bornhuetter_ferguson(
    tri: Triangulo,
    primas: dict[str, float],
    siniestralidad_esperada: float | dict[str, float],
    cola: float = 1.0,
    fuente_supuesto: str = "proporcionado por el usuario",
) -> Resultado:
    faltan = [o for o in tri.origenes if o not in primas]
    if faltan:
        raise MetodoNoAplicable(
            f"Bornhuetter-Ferguson necesita la prima devengada de cada origen; faltan: {', '.join(faltan)}.")
    if isinstance(siniestralidad_esperada, dict):
        faltan = [o for o in tri.origenes if o not in siniestralidad_esperada]
        if faltan:
            raise MetodoNoAplicable(
                f"Falta la siniestralidad esperada de: {', '.join(faltan)}.")
        elr = {o: float(siniestralidad_esperada[o]) for o in tri.origenes}
    else:
        elr = {o: float(siniestralidad_esperada) for o in tri.origenes}
    if any(not (0 < x < 5) for x in elr.values()):
        raise MetodoNoAplicable("La siniestralidad esperada debe ser un cociente positivo (p. ej. 0.70 = 70%).")

    cl = chain_ladder(tri, cola=cola)
    u = tri.unidad
    supuestos = [
        "El patrón de desarrollo histórico (Chain Ladder) indica qué porcentaje del costo falta por desarrollar.",
        cl.supuestos[2],
        "Siniestralidad esperada a priori: "
        + (f"{next(iter(elr.values())):.2%} para todos los orígenes"
           if len(set(elr.values())) == 1 else
           ", ".join(f"{o}: {x:.2%}" for o, x in elr.items()))
        + f" ({fuente_supuesto}).",
        "Las primas devengadas por origen son correctas y están en la misma unidad que los pagos.",
    ]
    limit = [
        "El resultado depende directamente de la siniestralidad a priori: si está sesgada, la reserva también.",
        "No reacciona a la experiencia reciente del origen tanto como Chain Ladder (es su propósito).",
    ]

    cifras: dict[str, Cifra] = {}
    tabla_o = []
    total_res = total_ult = 0.0
    for fila in cl.tabla_origenes:
        o = fila["origen"]
        fda, pagado = fila["fda"], fila["pagado"]
        pct_pendiente = 1 - 1 / fda
        esperado = primas[o] * elr[o]
        res = esperado * pct_pendiente
        ult = pagado + res
        total_res += res
        total_ult += ult
        tabla_o.append({"origen": o, "edad_actual": fila["edad_actual"], "pagado": pagado,
                        "prima": float(primas[o]), "elr": elr[o], "fda": fda,
                        "pct_pendiente": pct_pendiente, "ultimo": ult, "reserva": res})
        cifras[f"reserva:{o}"] = Cifra(
            f"reserva:{o}", f"la reserva BF de {o}", res,
            Explicacion(
                formula="Reserva = Prima × ELR × (1 − 1/FDA)",
                insumos={"Prima devengada": float(primas[o]), "ELR": elr[o], "FDA (Chain Ladder)": fda},
                pasos=[f"Siniestros esperados a priori = {primas[o]:,.4f} × {elr[o]:.4f} = {esperado:,.4f}.",
                       f"Porcentaje aún no desarrollado = 1 − 1/{fda:.6f} = {pct_pendiente:.6f}.",
                       f"Reserva = {esperado:,.4f} × {pct_pendiente:.6f} = {res:,.4f}."],
                supuestos=supuestos, limitaciones=limit,
                sencilla=(f"Con la prima de {o} esperábamos siniestros por {esperado:,.2f} {u}. Según el "
                          f"patrón histórico, falta por desarrollar el {pct_pendiente:.1%}, así que reservamos "
                          f"{res:,.2f} {u}."),
            ))
        cifras[f"ultimo:{o}"] = Cifra(
            f"ultimo:{o}", f"el costo último BF de {o}", ult,
            Explicacion("Último = Pagado + Reserva BF",
                        {"Pagado": pagado, "Reserva BF": res},
                        [f"Último = {pagado:,.4f} + {res:,.4f} = {ult:,.4f}."], supuestos, limit))

    cifras["reserva:total"] = Cifra(
        "reserva:total", "la reserva BF total", total_res,
        Explicacion("Σ Prima × ELR × (1 − 1/FDA)",
                    {f"Reserva {r['origen']}": r["reserva"] for r in tabla_o},
                    [" + ".join(f"{r['reserva']:,.4f}" for r in tabla_o) + f" = {total_res:,.4f}."],
                    supuestos, limit,
                    sencilla=f"Por el método BF, falta por pagar {total_res:,.2f} {u} de {tri.moneda}."))
    cifras["ultimo:total"] = Cifra(
        "ultimo:total", "el costo último BF total", total_ult,
        Explicacion("Σ Último", {r["origen"]: r["ultimo"] for r in tabla_o},
                    ["Suma de los costos últimos por origen."], supuestos, limit))

    return Resultado(
        metodo="Bornhuetter-Ferguson",
        version_metodo=VERSION,
        huella_datos=tri.huella(),
        parametros={"cola": cola, "primas": dict(primas), "siniestralidad_esperada": elr,
                    "fuente_supuesto": fuente_supuesto},
        unidad=tri.unidad, moneda=tri.moneda,
        cifras=cifras, tabla_factores=cl.tabla_factores, tabla_origenes=tabla_o,
        supuestos=supuestos, advertencias=list(cl.advertencias),
    )
