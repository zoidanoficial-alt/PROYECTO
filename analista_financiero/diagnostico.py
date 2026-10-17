"""Etapas 4 y 6: detectar hallazgos e investigar sus causas.

No se queda en "las ventas suben pero la utilidad baja": arma un puente que
explica, peso por peso, cómo se pasó de la utilidad del periodo base a la
del periodo actual:

    utilidad base
      + efecto volumen        (vendiste más unidades)
      + efecto mezcla         (cambió la proporción de productos)
      + efecto precio         (cambió el precio por unidad)
      + efecto costo unitario (cambió lo que te cuesta cada unidad)
      + otros sin detalle     (ventas/costos sin producto)
      − aumento de cada gasto
    = utilidad actual

El puente cuadra exactamente con el estado de resultados (se verifica). Cada
hipótesis de la investigación guiada (costos, gastos, precios y mezcla,
calidad de datos) se evalúa con estos efectos: "respaldada", "parcial",
"descartada" o "sin datos". Los efectos son HECHOS calculados; los "por qué"
detrás de ellos (p. ej. "el proveedor subió su precio") son HIPÓTESIS que el
usuario debe confirmar, y se presentan separados.
"""

from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np
import pandas as pd

from .calculos import Resultados
from .modelos import Cifra, cambio_pct, fmt_dinero, fmt_pct, fmt_pts, primer_texto
from .validacion import ResultadoValidacion

TOL_CUADRE = 0.01


@dataclass
class Hipotesis:
    clave: str
    titulo: str
    pregunta: str
    estado: str = "sin_datos"  # respaldada | parcial | descartada | sin_datos
    impacto: float | None = None  # efecto sobre la utilidad de operación (actual − base)
    resumen: str = ""
    hechos: list[str] = field(default_factory=list)
    posibles_causas: list[str] = field(default_factory=list)  # hipótesis por confirmar
    que_comprobar: list[str] = field(default_factory=list)
    datos_faltantes: list[str] = field(default_factory=list)
    evidencia: list[str] = field(default_factory=list)  # claves de cifras
    detalle: dict = field(default_factory=dict)


@dataclass
class Hallazgo:
    clave: str
    titulo: str
    explicacion: str
    severidad: str  # "alta" | "media" | "positiva" | "info"
    evidencia: list[str] = field(default_factory=list)


@dataclass
class Investigacion:
    hallazgo_inicial: Hallazgo | None
    hallazgos: list[Hallazgo]
    hipotesis: list[Hipotesis]
    puente: list[dict]  # [{"etiqueta", "valor", "tipo": "total"|"efecto", "clave"}]
    modo_puente: str  # "unidades" | "porcentajes" | "global" | "sin_comparacion"
    conclusion: str
    respuesta_principal: str  # "¿cuánto estoy ganando realmente?"
    causas: list[dict]  # efectos negativos ordenados
    supuestos: list[str]


ESTADOS_TEXTO = {
    "respaldada": "Respaldada por los datos",
    "parcial": "Explica una parte",
    "descartada": "Los datos no la respaldan",
    "sin_datos": "Faltan datos para comprobarla",
}


# ---------------------------------------------------------------------------
# Puente de utilidad (descomposición precio-volumen-mezcla-costo)
# ---------------------------------------------------------------------------

def _productos_por_periodo(res: Resultados) -> tuple[pd.DataFrame, pd.DataFrame] | None:
    p = res.productos
    if p is None or p.empty:
        return None
    periodos = p.index.get_level_values(0)
    if "base" not in periodos or "actual" not in periodos:
        return None
    base, actual = p.loc["base"], p.loc["actual"]
    todos = sorted(set(base.index) | set(actual.index))
    vacio = {"ventas": 0.0, "costo": 0.0, "unidades": 0.0}
    base = base.reindex(todos)
    actual = actual.reindex(todos)
    for k, v in vacio.items():
        base[k] = base[k].where(base.index.isin(p.loc["base"].index), v)
        actual[k] = actual[k].where(actual.index.isin(p.loc["actual"].index), v)
    return base, actual


def _efectos_unidades(base: pd.DataFrame, actual: pd.DataFrame) -> dict | None:
    if base[["unidades", "costo"]].isna().any().any() or actual[["unidades", "costo"]].isna().any().any():
        return None
    qB, qA = base["unidades"], actual["unidades"]
    if qB.sum() <= 0 or qA.sum() <= 0:
        return None
    pB = (base["ventas"] / qB).where(qB > 0)
    cB = (base["costo"] / qB).where(qB > 0)
    pA = (actual["ventas"] / qA).where(qA > 0)
    cA = (actual["costo"] / qA).where(qA > 0)
    # Producto nuevo: sin referencia base, su efecto cae en volumen/mezcla.
    pB, cB = pB.fillna(pA), cB.fillna(cA)
    pA, cA = pA.fillna(pB), cA.fillna(cB)
    mB = pB - cB
    gpB = float((base["ventas"] - base["costo"]).sum())
    gpA = float((actual["ventas"] - actual["costo"]).sum())
    QB, QA = float(qB.sum()), float(qA.sum())
    mB_prom = gpB / QB
    por_producto = pd.DataFrame({
        "unidades_base": qB, "unidades_actual": qA,
        "participacion_base": qB / QB, "participacion_actual": qA / QA,
        "precio_base": pB, "precio_actual": pA, "costo_unit_base": cB, "costo_unit_actual": cA,
        "margen_unit_base": mB, "margen_unit_actual": pA - cA,
        "efecto_precio": qA * (pA - pB), "efecto_costo": -qA * (cA - cB),
        "efecto_mezcla": (qA - QA * qB / QB) * mB,
    })
    return {
        "volumen": (QA - QB) * mB_prom,
        "mezcla": float((qA * mB).sum() - QA * mB_prom),
        "precio": float(por_producto["efecto_precio"].sum()),
        "costo": float(por_producto["efecto_costo"].sum()),
        "gp_base": gpB, "gp_actual": gpA, "por_producto": por_producto,
    }


def _efectos_porcentajes(base: pd.DataFrame, actual: pd.DataFrame) -> dict | None:
    if base["costo"].isna().any() or actual["costo"].isna().any():
        return None
    VB, VA = float(base["ventas"].sum()), float(actual["ventas"].sum())
    if VB <= 0 or VA <= 0:
        return None
    mB_i = ((base["ventas"] - base["costo"]) / base["ventas"]).where(base["ventas"] > 0)
    mA_i = ((actual["ventas"] - actual["costo"]) / actual["ventas"]).where(actual["ventas"] > 0)
    mB_i, mA_i = mB_i.fillna(mA_i), mA_i.fillna(mB_i)
    wB, wA = base["ventas"] / VB, actual["ventas"] / VA
    gpB = float((base["ventas"] - base["costo"]).sum())
    gpA = float((actual["ventas"] - actual["costo"]).sum())
    mB_prom = gpB / VB
    por_producto = pd.DataFrame({
        "participacion_base": wB, "participacion_actual": wA,
        "margen_pct_base": mB_i, "margen_pct_actual": mA_i,
        "efecto_tasa": VA * wA * (mA_i - mB_i),
    })
    return {
        "volumen": (VA - VB) * mB_prom,
        "mezcla": float(VA * ((wA * mB_i).sum() - mB_prom)),
        "tasa": float(por_producto["efecto_tasa"].sum()),
        "gp_base": gpB, "gp_actual": gpA, "por_producto": por_producto,
    }


def _registrar_efecto(res: Resultados, clave: str, nombre: str, valor: float, formula: str,
                      origen: list[str], supuestos: list[str] | None = None) -> None:
    res.libro.agregar(Cifra(
        f"efecto.{clave}", nombre, float(valor), "dinero", formula,
        f"{res.periodos.etiqueta('actual')} vs {res.periodos.etiqueta('base')}",
        origen=origen, depende_de=["dif.utilidad_bruta"], supuestos=supuestos or [],
        confianza=res.confianza, concepto=f"efecto_{clave}"))


def construir_puente(res: Resultados) -> tuple[list[dict], str, dict]:
    lib = res.libro
    if "utilidad_operativa.base" not in lib:
        return [], "sin_comparacion", {}
    uo_b, uo_a = lib.valor("utilidad_operativa.base"), lib.valor("utilidad_operativa.actual")
    d_ub = lib.valor("utilidad_bruta.actual") - lib.valor("utilidad_bruta.base")
    origen_prod = []
    if res.productos is not None and not res.productos.empty:
        for col in ("filas_venta", "filas_costo"):
            for filas in res.productos[col]:
                origen_prod.extend(filas)

    efectos: list[tuple[str, str, float]] = []
    datos: dict = {}
    pares = _productos_por_periodo(res)
    modo = "global"
    if pares is not None:
        e = _efectos_unidades(*pares)
        if e is not None:
            modo, datos = "unidades", e
            sup = ["Suma unidades de productos distintos: el efecto volumen usa el margen promedio por unidad del periodo base."]
            for clave, nombre, formula in (
                ("volumen", "Volumen", "(unidades actual − base) × margen unitario promedio base"),
                ("mezcla", "Cambio en la mezcla de productos", "Σ (unidades actual − unidades actual × participación base) × margen unitario base"),
                ("precio", "Cambio en precios", "Σ unidades actual × (precio actual − precio base)"),
                ("costo", "Cambio en el costo por unidad", "−Σ unidades actual × (costo unitario actual − base)"),
            ):
                if clave == "volumen":
                    nombre = "Más unidades vendidas" if e[clave] >= 0 else "Menos unidades vendidas"
                _registrar_efecto(res, clave, nombre, e[clave], formula, origen_prod, sup if clave == "volumen" else None)
                efectos.append((clave, nombre, e[clave]))
        else:
            e = _efectos_porcentajes(*pares)
            if e is not None:
                modo, datos = "porcentajes", e
                for clave, nombre, formula in (
                    ("volumen", "Crecimiento de ventas", "(ventas actual − base) × margen bruto % base"),
                    ("mezcla", "Cambio en la mezcla de productos", "ventas actual × (Σ participación actual × margen % base − margen % base promedio)"),
                    ("tasa", "Cambio de margen por producto (precio o costo)", "Σ ventas actual del producto × (margen % actual − margen % base)"),
                ):
                    _registrar_efecto(res, clave, nombre, e[clave], formula, origen_prod)
                    efectos.append((clave, nombre, e[clave]))
    if modo == "global":
        vb, va = lib.valor("ventas.base"), lib.valor("ventas.actual")
        mb_b = lib.valor("margen_bruto.base") or 0.0
        mb_a = lib.valor("margen_bruto.actual") or 0.0
        e = {"volumen": (va - vb) * mb_b, "tasa": (mb_a - mb_b) * va}
        datos = e
        _registrar_efecto(res, "volumen", "Crecimiento de ventas", e["volumen"],
                          "(ventas actual − base) × margen bruto base", [])
        _registrar_efecto(res, "tasa", "Cambio en el margen bruto", e["tasa"],
                          "(margen bruto actual − base) × ventas actual", [])
        efectos += [("volumen", "Crecimiento de ventas", e["volumen"]),
                    ("tasa", "Cambio en el margen bruto", e["tasa"])]

    explicado = sum(v for _, _, v in efectos)
    residuo = d_ub - explicado
    if abs(residuo) > 0.5:
        _registrar_efecto(res, "otros", "Ventas o costos sin detalle por producto", residuo,
                          "cambio en utilidad bruta − efectos explicados por producto", [])
        efectos.append(("otros", "Ventas o costos sin detalle por producto", residuo))

    puente = [{"etiqueta": f"Utilidad {res.periodos.etiqueta('base')}", "valor": uo_b,
               "tipo": "total", "clave": "utilidad_operativa.base"}]
    for clave, nombre, valor in efectos:
        puente.append({"etiqueta": nombre, "valor": valor, "tipo": "efecto", "clave": f"efecto.{clave}"})

    g = res.gastos_categoria
    if g is not None and not g.empty:
        orden = g.reindex(g["cambio"].abs().sort_values(ascending=False).index)
        principales, resto = orden.iloc[:4], orden.iloc[4:]
        for cat, fila in principales.iterrows():
            if abs(fila["cambio"]) < 0.5:
                continue
            clave = f"gasto.{cat}"
            res.libro.agregar(Cifra(
                f"efecto.{clave}", f"Cambio en gasto: {cat}", -float(fila["cambio"]), "dinero",
                "−(gasto actual − gasto base)", f"{res.periodos.etiqueta('actual')} vs {res.periodos.etiqueta('base')}",
                depende_de=["dif.gastos_operativos"], confianza=res.confianza, concepto="gastos_operativos"))
            puente.append({"etiqueta": f"Gasto: {cat}", "valor": -float(fila["cambio"]),
                           "tipo": "efecto", "clave": f"efecto.{clave}"})
        if len(resto) and abs(resto["cambio"].sum()) >= 0.5:
            puente.append({"etiqueta": "Otros gastos", "valor": -float(resto["cambio"].sum()),
                           "tipo": "efecto", "clave": "dif.gastos_operativos"})
    puente.append({"etiqueta": f"Utilidad {res.periodos.etiqueta('actual')}", "valor": uo_a,
                   "tipo": "total", "clave": "utilidad_operativa.actual"})

    suma = puente[0]["valor"] + sum(p["valor"] for p in puente if p["tipo"] == "efecto")
    if abs(suma - uo_a) > TOL_CUADRE * max(1.0, abs(uo_a)):
        raise AssertionError(f"El puente no cuadra: {suma} vs {uo_a}")
    return puente, modo, datos


# ---------------------------------------------------------------------------
# Evaluación de hipótesis
# ---------------------------------------------------------------------------

def _estado(impacto: float | None, total_negativo: float) -> str:
    if impacto is None:
        return "sin_datos"
    if impacto >= 0 or total_negativo <= 0:
        return "descartada"
    peso = -impacto / total_negativo
    if peso >= 0.25:
        return "respaldada"
    if peso >= 0.10:
        return "parcial"
    return "descartada"


def _hip_costos(res: Resultados, modo: str, datos: dict, total_neg: float) -> Hipotesis:
    h = Hipotesis("costos", "Costos", "¿Subieron los costos por unidad?")
    if modo == "unidades":
        h.impacto = datos["costo"]
        h.evidencia = ["efecto.costo"]
        pp = datos["por_producto"].sort_values("efecto_costo")
        for prod, f in pp.iterrows():
            if abs(f["efecto_costo"]) < 1 or f["unidades_actual"] == 0:
                continue
            cambio = cambio_pct(f["costo_unit_actual"], f["costo_unit_base"])
            verbo = "subió" if f["costo_unit_actual"] > f["costo_unit_base"] else "bajó"
            h.hechos.append(
                f"El costo por unidad de {prod} {verbo} de {fmt_dinero(f['costo_unit_base'], decimales=2)} a "
                f"{fmt_dinero(f['costo_unit_actual'], decimales=2)} ({fmt_pct(cambio, signo=True)}). Con las "
                f"{f['unidades_actual']:,.0f} unidades vendidas eso significa {fmt_dinero(f['efecto_costo'])} "
                "en la utilidad.")
        h.detalle["por_producto"] = pp
        peores = [p for p, f in pp.iterrows() if f["efecto_costo"] < -1][:2]
        for p in peores:
            h.que_comprobar.append(f"Facturas de tu proveedor de {p}: ¿subió el precio del insumo o cambió la presentación?")
        h.posibles_causas = ["Aumento de precio del proveedor o del insumo principal",
                             "Más merma, desperdicio o devoluciones",
                             "Compras urgentes o en lotes pequeños (sin descuento por volumen)"]
        h.que_comprobar.append("Si hubo más merma o producto dañado en el periodo reciente.")
    elif modo in ("porcentajes", "global"):
        h.impacto = datos.get("tasa")
        h.evidencia = ["efecto.tasa"]
        h.datos_faltantes.append("Cantidad vendida por producto: sin ella no puedo separar si subió el costo o bajó el precio.")
        mb_b, mb_a = res.libro.valor("margen_bruto.base"), res.libro.valor("margen_bruto.actual")
        h.hechos.append(f"El margen bruto pasó de {fmt_pct(mb_b)} a {fmt_pct(mb_a)} ({fmt_pts((mb_a or 0) - (mb_b or 0))}).")
        h.que_comprobar.append("Compara el precio de tus principales insumos entre ambos periodos.")
    est = _estado(h.impacto, total_neg)
    # Sin unidades no se puede afirmar que fue el costo y no el precio.
    h.estado = "parcial" if modo != "unidades" and est == "respaldada" else est
    h.resumen = _resumen(h, "lo que te cuesta cada unidad")
    return h


def _hip_gastos(res: Resultados, total_neg: float) -> Hipotesis:
    h = Hipotesis("gastos", "Gastos", "¿Crecieron más rápido que las ventas?")
    lib = res.libro
    if "dif.gastos_operativos" not in lib:
        h.datos_faltantes.append("Dos periodos con gastos para compararlos.")
        return h
    h.impacto = -lib.valor("dif.gastos_operativos")
    h.evidencia = ["var.gastos_operativos", "var.ventas"]
    vg, vv = lib.valor("var.gastos_operativos"), lib.valor("var.ventas")
    h.hechos.append(f"Los gastos de operación cambiaron {fmt_pct(vg, signo=True)} mientras las ventas "
                    f"cambiaron {fmt_pct(vv, signo=True)}.")
    gb, ga = lib.valor("gastos_operativos.base"), lib.valor("gastos_operativos.actual")
    vb, va = lib.valor("ventas.base"), lib.valor("ventas.actual")
    if vb and va:
        h.hechos.append(f"Por cada $100 vendidos, los gastos pasaron de ${gb / vb * 100:,.1f} a ${ga / va * 100:,.1f}.")
    g = res.gastos_categoria
    if g is not None and not g.empty:
        for cat, f in g[g["cambio"] > 0.5].head(3).iterrows():
            txt = (f"«{cat}» pasó de {fmt_dinero(f['base'])} a {fmt_dinero(f['actual'])} "
                   f"({fmt_pct(f['cambio_pct'], signo=True) if pd.notna(f['cambio_pct']) else 'nuevo'}).")
            if f.get("inusual_actual", 0) > 0:
                txt += f" Incluye {fmt_dinero(f['inusual_actual'])} en partidas inusuales."
            h.hechos.append(txt)
            h.que_comprobar.append(f"¿El aumento en «{cat}» es permanente (contrato, contratación) o de una sola vez?")
        h.detalle["por_categoria"] = g
    h.posibles_causas = ["Aumento de renta o servicios", "Contrataciones o aumentos de sueldo",
                         "Gastos de una sola vez (reparaciones, multas, eventos)"]
    h.estado = _estado(h.impacto, total_neg)
    h.resumen = _resumen(h, "los gastos de operación")
    if vg is not None and vv is not None and vg <= vv and h.impacto < 0:
        # La pregunta literal ("¿más rápido que las ventas?") sería "no", pero en pesos sí restan.
        h.resumen += (" Crecieron menos que las ventas, pero como cada venta ahora deja menos margen, "
                      "el aumento ya no se alcanza a cubrir.")
    return h


def _hip_precios_mezcla(res: Resultados, modo: str, datos: dict, total_neg: float) -> Hipotesis:
    h = Hipotesis("precios_mezcla", "Precios y mezcla", "¿Se venden más productos de menor margen?")
    if modo == "global":
        h.datos_faltantes.append("Producto de cada venta y de cada costo, para medir la mezcla.")
        h.resumen = "Sin el detalle por producto no puedo saber si cambió la mezcla de lo que vendes."
        return h
    pp = datos["por_producto"]
    if modo == "unidades":
        h.impacto = datos["precio"] + datos["mezcla"]
        h.evidencia = ["efecto.precio", "efecto.mezcla"]
        h.hechos.append(f"Efecto de la mezcla de productos: {fmt_dinero(datos['mezcla'])}; efecto de precios: "
                        f"{fmt_dinero(datos['precio'])}.")
        mu = "margen_unit_base"
        for prod, f in pp.sort_values("efecto_mezcla").iterrows():
            if abs(f["participacion_actual"] - f["participacion_base"]) < 0.03:
                continue
            h.hechos.append(
                f"{prod} pasó de {fmt_pct(f['participacion_base'], 0)} a {fmt_pct(f['participacion_actual'], 0)} "
                f"de las unidades vendidas; deja {fmt_dinero(f[mu], decimales=2)} por unidad.")
        for prod, f in pp.iterrows():
            cp = cambio_pct(f["precio_actual"], f["precio_base"])
            if cp is not None and abs(cp) >= 0.02 and f["unidades_actual"] > 0:
                h.hechos.append(f"El precio promedio de {prod} cambió {fmt_pct(cp, signo=True)} "
                                f"({fmt_dinero(f['precio_base'], decimales=2)} → {fmt_dinero(f['precio_actual'], decimales=2)}).")
    else:
        h.impacto = datos["mezcla"]
        h.evidencia = ["efecto.mezcla"]
        h.hechos.append(f"Efecto de la mezcla de productos: {fmt_dinero(datos['mezcla'])}.")
        for prod, f in pp.iterrows():
            if abs(f["participacion_actual"] - f["participacion_base"]) >= 0.03:
                h.hechos.append(f"{prod} pasó de {fmt_pct(f['participacion_base'], 0)} a "
                                f"{fmt_pct(f['participacion_actual'], 0)} de las ventas (margen base {fmt_pct(f['margen_pct_base'], 0)}).")
        h.datos_faltantes.append("Cantidad vendida, para separar el efecto de los precios.")
    h.detalle["por_producto"] = pp
    h.posibles_causas = ["Promociones o descuentos que empujan productos de menor margen",
                         "Clientes que cambian a productos más baratos",
                         "Precios que no se ajustaron cuando subieron los costos"]
    h.que_comprobar = ["¿Hubo promociones o descuentos en el periodo reciente?",
                       "¿Qué productos impulsa tu equipo de ventas y por qué?"]
    h.estado = _estado(h.impacto, total_neg)
    h.resumen = _resumen(h, "los precios y la mezcla de productos")
    return h


def _hip_calidad(res: Resultados, val: ResultadoValidacion | None, total_neg: float) -> Hipotesis:
    h = Hipotesis("calidad_datos", "Calidad de datos", "¿Hay errores o partidas extraordinarias?")
    h.impacto = 0.0
    if val is None:
        h.estado = "sin_datos"
        return h
    df = val.limpio
    mes = df["fecha"].dt.to_period("M").astype("string")
    inus = df[df["inusual"] & df["tipo"].isin(["costo", "gasto"])]
    en_act = inus[mes.loc[inus.index].isin(res.periodos.actual)]["importe"].sum()
    en_base = inus[mes.loc[inus.index].isin(res.periodos.base)]["importe"].sum()
    h.impacto = -float(en_act - en_base)
    for _, f in inus[mes.loc[inus.index].isin(res.periodos.actual)].iterrows():
        h.hechos.append(f"Partida inusual: «{primer_texto(f['concepto'], f['categoria'])}» por {fmt_dinero(f['importe'])} ({f['origen']}).")
    advert = val.advertencias
    afectado = sum(p.importe_afectado for p in advert)
    for p in advert:
        h.hechos.append(f"{p.titulo}. {p.accion_tomada}")
    ventas_act = res.libro.valor("ventas.actual") or res.libro.valor("ventas.total") or 1
    h.estado = _estado(h.impacto, total_neg)
    if h.estado == "descartada" and afectado / ventas_act > 0.02:
        h.estado = "parcial"
        h.resumen = (f"Hay {len(advert)} problema(s) de datos que afectan {fmt_dinero(afectado)}; "
                     "si se corrigen, las cifras pueden cambiar. Confírmalos antes de decidir.")
    else:
        h.resumen = _resumen(h, "partidas extraordinarias")
    h.posibles_causas = ["Gastos de una sola vez que no se repetirán", "Errores de captura o duplicados"]
    h.que_comprobar = ["Confirma con tu contador las partidas marcadas como inusuales.",
                       "Revisa los problemas de datos señalados en la validación."]
    return h


def _resumen(h: Hipotesis, que: str) -> str:
    if h.impacto is None:
        return f"Faltan datos para saber si {que} explican el cambio."
    if h.estado == "respaldada":
        return f"Sí: el cambio en {que} restó {fmt_dinero(-h.impacto)} a la utilidad; es de las causas principales."
    if h.estado == "parcial":
        return f"En parte: el cambio en {que} restó {fmt_dinero(-h.impacto)}, pero no es lo principal."
    if h.impacto >= 0:
        return f"No: {que} no restaron utilidad (efecto {fmt_dinero(h.impacto)})."
    return f"Poco: el cambio en {que} restó apenas {fmt_dinero(-h.impacto)}."


# ---------------------------------------------------------------------------
# Hallazgos e investigación completa
# ---------------------------------------------------------------------------

def _hallazgos(res: Resultados) -> tuple[Hallazgo | None, list[Hallazgo]]:
    lib = res.libro
    hall: list[Hallazgo] = []
    inicial = None
    if "var.ventas" in lib:
        vv, vu = lib.valor("var.ventas"), lib.valor("var.utilidad_operativa")
        dv, du = lib.valor("dif.ventas"), lib.valor("dif.utilidad_operativa")
        ev = ["var.ventas", "var.utilidad_operativa"]
        if dv > 0 and du < 0:
            inicial = Hallazgo("ventas_suben_utilidad_cae", "Las ventas crecen, pero la utilidad cae",
                               f"Vendiste {fmt_pct(vv, signo=True)} más, pero la utilidad de operación cambió "
                               f"{fmt_pct(vu, signo=True)} ({fmt_dinero(du)}). Hay una variación que necesita explicación.",
                               "alta", ev)
        elif dv < 0 and du < 0:
            inicial = Hallazgo("ventas_y_utilidad_caen", "Las ventas y la utilidad caen",
                               f"Las ventas cambiaron {fmt_pct(vv, signo=True)} y la utilidad {fmt_dinero(du)}.",
                               "alta", ev)
        elif du >= 0:
            inicial = Hallazgo("utilidad_crece", "La utilidad mejora",
                               f"La utilidad de operación cambió {fmt_dinero(du, )} con ventas {fmt_pct(vv, signo=True)}. "
                               "Vale la pena entender qué la impulsa para repetirlo.", "positiva", ev)
        else:
            inicial = Hallazgo("utilidad_cae", "La utilidad cae", f"La utilidad cambió {fmt_dinero(du)}.", "alta", ev)
        dmb = lib.valor("var.margen_bruto")
        if dmb is not None and dmb <= -0.01:
            hall.append(Hallazgo("margen_bruto_cae", "Cada venta deja menos",
                                 f"El margen bruto bajó {abs(dmb) * 100:.1f} puntos: de cada $100 vendidos te quedan "
                                 f"${lib.valor('margen_bruto.actual') * 100:,.1f} después de pagar el producto, "
                                 f"antes eran ${lib.valor('margen_bruto.base') * 100:,.1f}.", "alta", ["var.margen_bruto"]))
        vg = lib.valor("var.gastos_operativos")
        if vg is not None and vv is not None and vg > vv + 0.02:
            hall.append(Hallazgo("gastos_mas_rapido", "Los gastos crecen más rápido que las ventas",
                                 f"Gastos {fmt_pct(vg, signo=True)} contra ventas {fmt_pct(vv, signo=True)}.",
                                 "media", ["var.gastos_operativos", "var.ventas"]))
    uo_t = lib.valor("utilidad_operativa.total")
    if uo_t is not None and uo_t < 0:
        hall.append(Hallazgo("perdida", "La operación pierde dinero",
                             f"En el periodo completo la utilidad de operación es {fmt_dinero(uo_t)}.", "alta",
                             ["utilidad_operativa.total"]))
    fo = lib.valor("flujo_operativo.total")
    if fo is not None and uo_t is not None and uo_t > 0 and fo < 0.8 * uo_t:
        hall.append(Hallazgo("utilidad_sin_efectivo", "Ganas, pero el dinero no llega completo a la caja",
                             f"La utilidad del periodo es {fmt_dinero(uo_t)}, pero el efectivo que generó la operación "
                             f"fue {fmt_dinero(fo)}. Tienes {fmt_dinero(lib.valor('cxc.final'))} por cobrar.",
                             "alta" if fo < 0 else "media", ["flujo_operativo.total", "utilidad_operativa.total", "cxc.final"]))
    dc = lib.valor("dias_cobro.total")
    if dc is not None and dc > 45:
        hall.append(Hallazgo("cobro_lento", "Tardas en cobrar",
                             f"En promedio cobras {dc:,.0f} días después de vender: financias a tus clientes.",
                             "media", ["dias_cobro.total"]))
    pe, vm = lib.valor("punto_equilibrio.mensual"), lib.valor("ventas.mensual")
    if pe is not None and vm is not None and vm < pe * 1.15:
        hall.append(Hallazgo("cerca_equilibrio", "Vendes cerca de tu punto de equilibrio",
                             f"Necesitas vender {fmt_dinero(pe)} al mes para no perder y vendes {fmt_dinero(vm)}. "
                             "Hay poco margen de seguridad.", "media", ["punto_equilibrio.mensual", "ventas.mensual"]))
    return inicial, hall


def respuesta_cuanto_gano(res: Resultados) -> str:
    lib = res.libro
    v, uo, mo = lib.valor("ventas.total"), lib.valor("utilidad_operativa.total"), lib.valor("margen_operativo.total")
    meses = len(res.periodos.meses) or 1
    if v is None or mo is None:
        return "Aún no tengo ventas suficientes para responder cuánto ganas."
    txt = (f"En {res.periodos.etiqueta('total')} vendiste {fmt_dinero(v)} y te quedaron {fmt_dinero(uo)} de utilidad "
           f"de operación (unos {fmt_dinero(uo / meses)} al mes). De cada $100 que vendiste, te quedaron "
           f"${mo * 100:,.1f}.")
    fo = lib.valor("flujo_operativo.total")
    if fo is not None:
        txt += f" En efectivo, la operación generó {fmt_dinero(fo)}."
    else:
        txt += " Ojo: eso es utilidad, no necesariamente dinero en el banco (falta saber cuándo cobraste y pagaste)."
    return txt


def investigar(res: Resultados, validacion: ResultadoValidacion | None = None) -> Investigacion:
    inicial, hallazgos = _hallazgos(res)
    puente, modo, datos = construir_puente(res)
    supuestos = list(res.supuestos)
    if not puente:
        return Investigacion(inicial, hallazgos, [], [], "sin_comparacion",
                             "Necesito al menos dos meses de datos para investigar qué cambió.",
                             respuesta_cuanto_gano(res), [], supuestos)

    efectos = [p for p in puente if p["tipo"] == "efecto"]
    total_neg = -sum(p["valor"] for p in efectos if p["valor"] < 0)
    hipotesis = [
        _hip_costos(res, modo, datos, total_neg),
        _hip_gastos(res, total_neg),
        _hip_precios_mezcla(res, modo, datos, total_neg),
        _hip_calidad(res, validacion, total_neg),
    ]
    causas = sorted([p for p in efectos if p["valor"] < 0], key=lambda p: p["valor"])
    for c in causas:
        c["peso"] = -c["valor"] / total_neg if total_neg else 0.0

    lib = res.libro
    du = lib.valor("dif.utilidad_operativa")
    partes = [f"La utilidad de operación pasó de {fmt_dinero(lib.valor('utilidad_operativa.base'))} "
              f"({res.periodos.etiqueta('base')}) a {fmt_dinero(lib.valor('utilidad_operativa.actual'))} "
              f"({res.periodos.etiqueta('actual')}), una diferencia de {fmt_dinero(du)}, con ventas "
              f"{fmt_pct(lib.valor('var.ventas'), signo=True)}."]
    if causas:
        top = causas[:3]
        lista = "; ".join(f"{c['etiqueta'].lower()} ({fmt_dinero(c['valor'])}, {fmt_pct(c['peso'], 0)} de lo que restó)" for c in top)
        partes.append(f"Lo que más restó: {lista}.")
    positivos = sorted([p for p in efectos if p["valor"] > 0], key=lambda p: -p["valor"])
    if positivos:
        partes.append(f"A favor: {positivos[0]['etiqueta'].lower()} sumó {fmt_dinero(positivos[0]['valor'])}.")
    partes.append("Estas cifras son hechos calculados de tus datos; los motivos detrás (por ejemplo, un "
                  "aumento del proveedor) son hipótesis que debes confirmar.")
    if res.confianza != "confiable":
        partes.append("Resultado PROVISIONAL: hay problemas de datos sin confirmar.")
    return Investigacion(inicial, hallazgos, hipotesis, puente, modo, " ".join(partes),
                         respuesta_cuanto_gano(res), causas, supuestos)


def coherente(puente: list[dict]) -> bool:
    if not puente:
        return True
    suma = puente[0]["valor"] + sum(p["valor"] for p in puente if p["tipo"] == "efecto")
    return bool(np.isclose(suma, puente[-1]["valor"], atol=1.0))
