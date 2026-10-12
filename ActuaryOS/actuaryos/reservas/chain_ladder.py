"""Chain Ladder clásico con factores de desarrollo ponderados por volumen.

    f_k = Σ_i C[i, k+1] / Σ_i C[i, k]    (sólo orígenes con ambas edades)
    FDA_k = f_k · f_{k+1} · … · cola     (factor de desarrollo acumulado)
    Último_i = C[i, último observado] · FDA
    Reserva_i = Último_i − C[i, último observado]
"""
from __future__ import annotations

import numpy as np

from ..datos import ADVERTENCIA, Hallazgo
from ..resultado import Cifra, Explicacion, Resultado
from ..triangulo import Triangulo

VERSION = "1.0.0"


class MetodoNoAplicable(ValueError):
    """Los datos no cumplen los requisitos mínimos del método."""


def factores_desarrollo(tri: Triangulo, excluir: set[tuple[str, int]] | None = None):
    """Devuelve (factores, numeradores, denominadores, n_usados) por edad.

    ``excluir`` contiene pares (origen, edad_inicial) cuyo factor individual
    no participa en el promedio ponderado (exclusión justificada por el actuario).
    """
    excluir = excluir or set()
    v, obs = tri.valores, tri.observado
    k = tri.n_edades - 1
    num, den, n = np.zeros(k), np.zeros(k), np.zeros(k, dtype=int)
    for j in range(k):
        for i in range(tri.n_origenes):
            if obs[i, j] and obs[i, j + 1] and (tri.origenes[i], tri.edades[j]) not in excluir:
                num[j] += v[i, j + 1]
                den[j] += v[i, j]
                n[j] += 1
    with np.errstate(divide="ignore", invalid="ignore"):
        f = np.where(den > 0, num / den, np.nan)
    return f, num, den, n


def chain_ladder(
    tri: Triangulo,
    cola: float = 1.0,
    excluir: set[tuple[str, int]] | None = None,
) -> Resultado:
    if tri.n_origenes < 2 or tri.n_edades < 2:
        raise MetodoNoAplicable("Chain Ladder necesita al menos 2 orígenes y 2 edades de desarrollo.")
    if cola < 1.0:
        raise MetodoNoAplicable("El factor de cola debe ser ≥ 1 para pagos acumulados.")

    f, num, den, n = factores_desarrollo(tri, excluir)
    advertencias: list[Hallazgo] = []
    sin_datos = [f"{tri.edades[j]}→{tri.edades[j + 1]}" for j in range(len(f)) if np.isnan(f[j])]
    if sin_datos:
        raise MetodoNoAplicable(f"No hay datos para estimar los factores {', '.join(sin_datos)}.")
    for j in range(len(f)):
        if n[j] == 1:
            unico = next(o for i, o in enumerate(tri.origenes)
                         if tri.observado[i, j] and tri.observado[i, j + 1]
                         and (o, tri.edades[j]) not in (excluir or set()))
            advertencias.append(Hallazgo(
                ADVERTENCIA, "FACTOR_CON_UNA_OBSERVACION",
                f"El factor {tri.edades[j]}→{tri.edades[j + 1]} se basa en un solo origen "
                f"({unico}); es poco robusto.",
                "Considera un factor de referencia de mercado o un ajuste de curva y documenta la decisión."))

    # fda[j] = producto de factores desde la edad j hasta el final (incluye cola)
    fda = np.ones(tri.n_edades)
    fda[-1] = cola
    for j in range(tri.n_edades - 2, -1, -1):
        fda[j] = f[j] * fda[j + 1]

    ultimo_idx = tri.indice_ultimo()
    pagado = tri.diagonal()
    u = tri.unidad
    supuestos = [
        "El patrón de desarrollo observado en el pasado se repetirá en los orígenes recientes.",
        "Los factores son promedios ponderados por volumen de todos los orígenes disponibles"
        + (f", excepto {len(excluir)} factor(es) excluido(s) por el actuario." if excluir else "."),
        (f"El origen más antiguo alcanzó su desarrollo final a {tri.edades[-1]} meses (factor de cola = 1)."
         if cola == 1.0 else
         f"Después de {tri.edades[-1]} meses aún falta desarrollo: factor de cola = {cola:g} (supuesto del usuario)."),
    ]
    limit_comunes = [
        "Es una estimación puntual: no mide la incertidumbre (ver método de Mack).",
        "Sensible a factores tempranos inestables, sobre todo en el origen más reciente.",
    ]

    cifras: dict[str, Cifra] = {}
    tabla_f = []
    for j in range(tri.n_edades - 1):
        a, b = tri.edades[j], tri.edades[j + 1]
        usados = [o for i, o in enumerate(tri.origenes)
                  if tri.observado[i, j] and tri.observado[i, j + 1]
                  and (o, a) not in (excluir or set())]
        tabla_f.append({"desde": a, "hasta": b, "factor": float(f[j]), "fda": float(fda[j]),
                        "origenes_usados": usados})
        cifras[f"factor:{a}-{b}"] = Cifra(
            f"factor:{a}-{b}", f"el factor {a}→{b} meses", float(f[j]),
            Explicacion(
                formula=f"f({a}→{b}) = Σ C({b}m) / Σ C({a}m)",
                insumos={f"Σ C({b}m) de {', '.join(usados)}": float(num[j]),
                         f"Σ C({a}m) de {', '.join(usados)}": float(den[j])},
                pasos=[f"Se suman los acumulados a {b} meses de los orígenes que tienen ambas edades: "
                       f"{num[j]:,.4f}.",
                       f"Se suman sus acumulados a {a} meses: {den[j]:,.4f}.",
                       f"Factor = {num[j]:,.4f} / {den[j]:,.4f} = {f[j]:.6f}."],
                supuestos=supuestos[:2],
                limitaciones=([f"Se basa en {n[j]} observación(es)."] if n[j] < 3 else []),
                sencilla=(f"En los años con datos, lo pagado a {b} meses fue {f[j]:.3f} veces lo "
                          f"pagado a {a} meses. Usamos esa proporción para proyectar los años recientes."),
            ))

    tabla_o = []
    total_ult = total_res = 0.0
    for i, o in enumerate(tri.origenes):
        j = ultimo_idx[i]
        factor = float(fda[j])
        ult = float(pagado[i] * factor)
        res = ult - float(pagado[i])
        total_ult += ult
        total_res += res
        futuros = [f"{tabla_f[k]['factor']:.6f}" for k in range(j, tri.n_edades - 1)]
        if cola != 1.0:
            futuros.append(f"{cola:g} (cola)")
        producto = " × ".join(futuros) if futuros else "1 (sin desarrollo pendiente)"
        tabla_o.append({"origen": o, "edad_actual": tri.edades[j], "pagado": float(pagado[i]),
                        "fda": factor, "ultimo": ult, "reserva": res})
        base = dict(
            insumos={f"Pagado acumulado {o} a {tri.edades[j]}m": float(pagado[i]),
                     "Factor de desarrollo acumulado": factor},
            supuestos=supuestos,
            limitaciones=limit_comunes,
        )
        cifras[f"ultimo:{o}"] = Cifra(
            f"ultimo:{o}", f"el costo último de {o}", ult,
            Explicacion(
                formula="Último = Pagado actual × FDA",
                pasos=[f"Último pagado observado de {o}: {pagado[i]:,.4f} a {tri.edades[j]} meses.",
                       f"FDA = {producto} = {factor:.6f}.",
                       f"Último = {pagado[i]:,.4f} × {factor:.6f} = {ult:,.4f}."],
                sencilla=(f"A {tri.edades[j]} meses se han pagado {pagado[i]:,.2f} {u} por los siniestros "
                          f"de {o}. Según el patrón histórico, el total final será unas {factor:.3f} "
                          f"veces eso: {ult:,.2f} {u}."),
                **base))
        cifras[f"reserva:{o}"] = Cifra(
            f"reserva:{o}", f"la reserva de {o}", res,
            Explicacion(
                formula="Reserva = Último − Pagado actual",
                pasos=[f"Último estimado de {o}: {ult:,.4f} (Pagado {pagado[i]:,.4f} × FDA {factor:.6f}).",
                       f"Reserva = {ult:,.4f} − {pagado[i]:,.4f} = {res:,.4f}."],
                sencilla=(f"Para {o} se estima que todavía falta pagar {res:,.2f} {u}: la diferencia entre "
                          f"el costo final estimado ({ult:,.2f}) y lo ya pagado ({pagado[i]:,.2f})."),
                **base))

    cifras["reserva:total"] = Cifra(
        "reserva:total", "la reserva total", total_res,
        Explicacion(
            formula="Reserva total = Σ_origen (Último − Pagado actual)",
            insumos={f"Reserva {r['origen']}": r["reserva"] for r in tabla_o},
            pasos=["Se calculan factores ponderados por volumen para cada par de edades consecutivas.",
                   "Se multiplica cada último pagado por el producto de los factores que le faltan.",
                   "Se resta lo ya pagado para obtener la reserva por origen.",
                   " + ".join(f"{r['reserva']:,.4f}" for r in tabla_o) + f" = {total_res:,.4f}."],
            supuestos=supuestos, limitaciones=limit_comunes,
            sencilla=(f"Se estima que la aseguradora todavía debe pagar {total_res:,.2f} {u} de "
                      f"{tri.moneda} por siniestros ya ocurridos. Es la suma de lo que falta por "
                      f"pagar en cada año."),
        ))
    cifras["ultimo:total"] = Cifra(
        "ultimo:total", "el costo último total", total_ult,
        Explicacion("Σ Último", {r["origen"]: r["ultimo"] for r in tabla_o},
                    ["Suma de los costos últimos por origen."], supuestos, limit_comunes))

    return Resultado(
        metodo="Chain Ladder (ponderado por volumen)",
        version_metodo=VERSION,
        huella_datos=tri.huella(),
        parametros={"cola": cola,
                    "excluir": sorted([list(x) for x in (excluir or set())])},
        unidad=tri.unidad, moneda=tri.moneda,
        cifras=cifras, tabla_factores=tabla_f, tabla_origenes=tabla_o,
        supuestos=supuestos, advertencias=advertencias,
    )


__all__ = ["chain_ladder", "factores_desarrollo", "MetodoNoAplicable", "VERSION"]
