"""Método de Mack (1993): error estándar de la reserva Chain Ladder.

Para cada edad k (0-indexada) con factores f_k y n_k observaciones:

    σ²_k = 1/(n_k − 1) · Σ_i C[i,k] · (C[i,k+1]/C[i,k] − f_k)²

Si la última edad sólo tiene una observación se usa la regla de Mack:
    σ²_k = min(σ⁴_{k−1} / σ²_{k−2}, σ²_{k−2}, σ²_{k−1})

    mse(R_i) = Ĉ²_{i,U} · Σ_{k ≥ a_i} (σ²_k / f²_k) · (1/Ĉ_{i,k} + 1/S_k)
    mse(R)   = Σ_i [ mse(R_i) + Ĉ_{i,U} · (Σ_{j>i} Ĉ_{j,U}) · Σ_{k ≥ a_i} 2σ²_k / (f²_k · S_k) ]

donde a_i es la última edad observada del origen i, Ĉ son los valores
proyectados con Chain Ladder y S_k = Σ C[i,k] sobre los orígenes que
participan en f_k.

Referencia: Mack, T. (1993). "Distribution-free calculation of the standard
error of chain ladder reserve estimates". ASTIN Bulletin 23(2).
"""
from __future__ import annotations

import math
from statistics import NormalDist

import numpy as np

from ..datos import ADVERTENCIA, Hallazgo
from ..resultado import Cifra, Explicacion, Resultado
from ..triangulo import Triangulo
from .chain_ladder import MetodoNoAplicable, chain_ladder, factores_desarrollo

VERSION = "1.0.0"


def sigmas_mack(tri: Triangulo, f: np.ndarray, n: np.ndarray) -> tuple[np.ndarray, list[int]]:
    """σ²_k por edad y lista de edades cuyo σ² se extrapoló."""
    v, obs = tri.valores, tri.observado
    k = len(f)
    s2 = np.full(k, np.nan)
    for j in range(k):
        if n[j] >= 2:
            pares = obs[:, j] & obs[:, j + 1]
            c, d = v[pares, j], v[pares, j + 1]
            s2[j] = np.sum(c * (d / c - f[j]) ** 2) / (n[j] - 1)
    extrapolados = []
    for j in range(k):
        if np.isnan(s2[j]):
            if j < 2 or np.isnan(s2[j - 1]) or np.isnan(s2[j - 2]):
                raise MetodoNoAplicable(
                    f"No hay suficientes datos para estimar la varianza del factor "
                    f"{tri.edades[j]}→{tri.edades[j + 1]}.")
            a, b = s2[j - 2], s2[j - 1]
            s2[j] = min(b ** 2 / a if a > 0 else 0.0, a, b)
            extrapolados.append(j)
    return s2, extrapolados


def mack(tri: Triangulo, nivel_confianza: float = 0.95) -> Resultado:
    if tri.n_origenes < 3 or tri.n_edades < 3:
        raise MetodoNoAplicable("Mack necesita al menos 3 orígenes y 3 edades de desarrollo.")
    cl = chain_ladder(tri)
    f, _, den, n = factores_desarrollo(tri)
    s2, extrapolados = sigmas_mack(tri, f, n)

    # Triángulo completado con Chain Ladder
    I, K = tri.n_origenes, tri.n_edades
    ultimo_idx = tri.indice_ultimo()
    C = tri.valores.copy()
    for i in range(I):
        for j in range(ultimo_idx[i] + 1, K):
            C[i, j] = C[i, j - 1] * f[j - 1]
    ult = C[:, -1]

    mse = np.zeros(I)
    termino_param = np.zeros(I)
    for i in range(I):
        for k in range(ultimo_idx[i], K - 1):
            mse[i] += s2[k] / f[k] ** 2 * (1 / C[i, k] + 1 / den[k])
            termino_param[i] += 2 * s2[k] / (f[k] ** 2 * den[k])
        mse[i] *= ult[i] ** 2
    mse_total = mse.sum() + sum(
        ult[i] * ult[i + 1:].sum() * termino_param[i] for i in range(I))
    se = np.sqrt(mse)
    se_total = math.sqrt(mse_total)

    advertencias = list(cl.advertencias)
    if extrapolados:
        advertencias.append(Hallazgo(
            ADVERTENCIA, "SIGMA_EXTRAPOLADA",
            "La varianza de " + ", ".join(f"{tri.edades[j]}→{tri.edades[j + 1]}" for j in extrapolados)
            + " se extrapoló con la regla de Mack (sólo hay una observación).",
            "Valida la extrapolación; con pocas observaciones la incertidumbre está subestimada."))

    z = NormalDist().inv_cdf(0.5 + nivel_confianza / 2)
    pct = f"{nivel_confianza:.0%}"
    supuestos = cl.supuestos + [
        "Los orígenes son independientes entre sí.",
        "La varianza del siguiente pago es proporcional al acumulado actual (supuesto de Mack).",
        f"El intervalo de {pct} usa una distribución lognormal con la misma media y error estándar.",
    ]
    limit = [
        "Mide el error de estimación y de proceso del modelo Chain Ladder, no el riesgo de que el modelo sea "
        "inadecuado (riesgo de modelo).",
        "Con triángulos pequeños el error estándar es muy incierto.",
    ]

    def intervalo(media: float, de: float) -> tuple[float, float]:
        if media <= 0 or de <= 0:
            return media, media
        s = math.sqrt(math.log(1 + (de / media) ** 2))
        mu = math.log(media) - s ** 2 / 2
        return math.exp(mu - z * s), math.exp(mu + z * s)

    cifras = {k: c for k, c in cl.cifras.items()}
    tabla_o = []
    for i, fila in enumerate(cl.tabla_origenes):
        o, res = fila["origen"], fila["reserva"]
        cv = se[i] / res if res > 0 else float("nan")
        bajo, alto = intervalo(res, se[i])
        tabla_o.append({**fila, "error_estandar": float(se[i]), "cv": cv,
                        "intervalo_inferior": bajo, "intervalo_superior": alto})
        edades_fut = [f"{tri.edades[k]}→{tri.edades[k + 1]}" for k in range(ultimo_idx[i], K - 1)]
        cifras[f"error_estandar:{o}"] = Cifra(
            f"error_estandar:{o}", f"el error estándar de la reserva de {o}", float(se[i]),
            Explicacion(
                formula="ee(R_i) = Ĉ_i,U · √( Σ_k σ²_k/f²_k · (1/Ĉ_i,k + 1/S_k) )",
                insumos={"Costo último Ĉ_i,U": float(ult[i]),
                         **{f"σ²({tri.edades[k]}→{tri.edades[k + 1]})": float(s2[k])
                            for k in range(ultimo_idx[i], K - 1)}},
                pasos=([f"Se suman las contribuciones de las edades pendientes: {', '.join(edades_fut)}.",
                        f"mse = {mse[i]:,.6f}; ee = √mse = {se[i]:,.4f}."]
                       if edades_fut else ["El origen ya está totalmente desarrollado: error estándar 0."]),
                supuestos=supuestos, limitaciones=limit,
                sencilla=(f"La reserva de {o} ({res:,.2f}) podría razonablemente variar en ± {se[i]:,.2f} "
                          f"{tri.unidad}. Entre más reciente el año, más incertidumbre."),
            ))

    total = cl["reserva:total"]
    bajo, alto = intervalo(total, se_total)
    cifras["error_estandar:total"] = Cifra(
        "error_estandar:total", "el error estándar de la reserva total", se_total,
        Explicacion(
            formula="mse(R) = Σ_i mse(R_i) + Σ_i Ĉ_i,U · Σ_{j>i} Ĉ_j,U · Σ_k 2σ²_k/(f²_k·S_k)",
            insumos={"Σ mse(R_i)": float(mse.sum()), "mse(R) total": float(mse_total)},
            pasos=["Se suman los errores cuadráticos de cada origen.",
                   "Se añade la covarianza entre orígenes: todos usan los mismos factores estimados.",
                   f"ee total = √{mse_total:,.4f} = {se_total:,.4f}."],
            supuestos=supuestos, limitaciones=limit,
            sencilla=(f"La reserva total estimada es {total:,.2f} {tri.unidad}, con un error estándar de "
                      f"{se_total:,.2f} (coeficiente de variación {se_total / total:.1%})."),
        ))
    cifras["intervalo:total:inferior"] = Cifra(
        "intervalo:total:inferior", f"el límite inferior del intervalo de {pct}", bajo,
        Explicacion("Lognormal(μ, s): exp(μ − z·s)",
                    {"Reserva": total, "Error estándar": se_total, "z": z},
                    [f"s = √ln(1 + CV²); μ = ln(R) − s²/2; límite = {bajo:,.4f}."], supuestos, limit))
    cifras["intervalo:total:superior"] = Cifra(
        "intervalo:total:superior", f"el límite superior del intervalo de {pct}", alto,
        Explicacion("Lognormal(μ, s): exp(μ + z·s)",
                    {"Reserva": total, "Error estándar": se_total, "z": z},
                    [f"s = √ln(1 + CV²); μ = ln(R) − s²/2; límite = {alto:,.4f}."], supuestos, limit))

    tabla_f = [{**fila, "sigma2": float(s2[j]), "sigma2_extrapolada": j in extrapolados}
               for j, fila in enumerate(cl.tabla_factores)]
    return Resultado(
        metodo="Mack (Chain Ladder con error estándar)",
        version_metodo=VERSION,
        huella_datos=tri.huella(),
        parametros={"nivel_confianza": nivel_confianza, "cola": 1.0},
        unidad=tri.unidad, moneda=tri.moneda,
        cifras=cifras, tabla_factores=tabla_f, tabla_origenes=tabla_o,
        supuestos=supuestos, advertencias=advertencias,
    )
