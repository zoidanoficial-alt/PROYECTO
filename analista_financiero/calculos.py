"""Etapa 3: cálculos deterministas (estado de resultados, márgenes, variaciones, flujo).

Todo lo que se calcula aquí se registra como `Cifra` en un `Libro`, con su
fórmula, periodo, filas de origen y supuestos. Nada de esto lo estima un
modelo de lenguaje.

Estructura (siguiendo "Financial Intelligence", partes 2 y 4):

    Ventas
  − Costo de ventas          (lo que cuesta producir/comprar lo vendido)
  = Utilidad bruta           → margen bruto = utilidad bruta / ventas
  − Gastos de operación      (renta, nómina, publicidad...)
  = Utilidad de operación    → margen de operación

Y por separado el efectivo: la utilidad es una estimación contable; el
efectivo es lo que realmente entró y salió del banco.
"""

from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np
import pandas as pd

from .modelos import Cifra, Libro, cambio_pct

METRICAS = {
    "ventas": ("Ventas", "dinero", "suma de importes de ventas"),
    "costo_ventas": ("Costo de ventas", "dinero", "suma de importes de costos de venta"),
    "utilidad_bruta": ("Utilidad bruta", "dinero", "ventas − costo de ventas"),
    "margen_bruto": ("Margen bruto", "pct", "utilidad bruta ÷ ventas"),
    "gastos_operativos": ("Gastos de operación", "dinero", "suma de importes de gastos"),
    "utilidad_operativa": ("Utilidad de operación", "dinero", "utilidad bruta − gastos de operación"),
    "margen_operativo": ("Margen de operación", "pct", "utilidad de operación ÷ ventas"),
}


@dataclass
class Periodos:
    meses: list[str]
    base: list[str]
    actual: list[str]
    excluidos: list[str] = field(default_factory=list)  # mes intermedio si el número es impar

    def etiqueta(self, cual: str) -> str:
        meses = {"base": self.base, "actual": self.actual, "total": self.meses}[cual]
        if not meses:
            return "s/d"
        return meses[0] if len(meses) == 1 else f"{meses[0]} a {meses[-1]}"


@dataclass
class Resultados:
    libro: Libro
    periodos: Periodos
    mensual: pd.DataFrame
    productos: pd.DataFrame  # índice (periodo, producto)
    gastos_categoria: pd.DataFrame  # índice categoría; columnas base, actual, cambio
    flujo: pd.DataFrame | None
    faltantes: list[str]
    confianza: str
    supuestos: list[str]
    moneda: str = "MXN"


def definir_periodos(meses: list[str]) -> Periodos:
    """Compara periodos equivalentes: primera mitad contra segunda mitad."""
    meses = sorted(meses)
    n = len(meses)
    if n < 2:
        return Periodos(meses, [], meses)
    k = n // 2
    excluidos = meses[k:n - k]
    return Periodos(meses, meses[:k], meses[n - k:], excluidos)


def _suma(df: pd.DataFrame, tipo: str) -> tuple[float, list[str]]:
    sub = df[df["tipo"] == tipo]
    return float(sub["importe"].sum()), sub["origen"].tolist()


def _estado(df: pd.DataFrame) -> dict:
    v, _ = _suma(df, "venta")
    c, _ = _suma(df, "costo")
    g, _ = _suma(df, "gasto")
    ub = v - c
    uo = ub - g
    return {"ventas": v, "costo_ventas": c, "utilidad_bruta": ub,
            "margen_bruto": ub / v if v else np.nan, "gastos_operativos": g,
            "utilidad_operativa": uo, "margen_operativo": uo / v if v else np.nan}


def _registrar_estado(libro: Libro, df: pd.DataFrame, sufijo: str, periodo: str,
                      confianza: str, supuestos: list[str]) -> None:
    est = _estado(df)
    origen = {t: df.loc[df["tipo"] == t, "origen"].tolist() for t in ("venta", "costo", "gasto")}
    deps = {
        "ventas": [], "costo_ventas": [], "gastos_operativos": [],
        "utilidad_bruta": ["ventas", "costo_ventas"],
        "margen_bruto": ["utilidad_bruta", "ventas"],
        "utilidad_operativa": ["utilidad_bruta", "gastos_operativos"],
        "margen_operativo": ["utilidad_operativa", "ventas"],
    }
    orig_map = {"ventas": origen["venta"], "costo_ventas": origen["costo"],
                "gastos_operativos": origen["gasto"]}
    for clave, (nombre, unidad, formula) in METRICAS.items():
        valor = est[clave]
        libro.agregar(Cifra(
            clave=f"{clave}.{sufijo}", nombre=nombre,
            valor=None if pd.isna(valor) else float(valor), unidad=unidad, formula=formula,
            periodo=periodo, origen=orig_map.get(clave, []),
            depende_de=[f"{d}.{sufijo}" for d in deps[clave]],
            supuestos=list(supuestos) if clave == "utilidad_operativa" else [],
            confianza=confianza, concepto=clave,
        ))


def _tabla_productos(df: pd.DataFrame, periodos: Periodos) -> pd.DataFrame:
    filas = []
    for cual, meses in (("base", periodos.base), ("actual", periodos.actual)):
        sub = df[df["mes"].isin(meses)]
        ventas = sub[sub["tipo"] == "venta"]
        costos = sub[sub["tipo"] == "costo"]
        for prod in sorted(set(ventas["producto"].dropna()) | set(costos["producto"].dropna())):
            v = ventas[ventas["producto"] == prod]
            c = costos[costos["producto"] == prod]
            unidades = float(v["cantidad"].sum()) if v["cantidad"].notna().all() and len(v) else np.nan
            filas.append({
                "periodo": cual, "producto": prod,
                "ventas": float(v["importe"].sum()),
                "costo": float(c["importe"].sum()) if len(c) else np.nan,
                "unidades": unidades,
                "filas_venta": v["origen"].tolist(), "filas_costo": c["origen"].tolist(),
            })
    t = pd.DataFrame(filas, columns=["periodo", "producto", "ventas", "costo", "unidades",
                                     "filas_venta", "filas_costo"])
    if t.empty:
        return t.set_index(["periodo", "producto"])
    t["margen"] = t["ventas"] - t["costo"]
    t["margen_pct"] = t["margen"] / t["ventas"].replace(0, np.nan)
    t["precio_unitario"] = t["ventas"] / t["unidades"].replace(0, np.nan)
    t["costo_unitario"] = t["costo"] / t["unidades"].replace(0, np.nan)
    t["margen_unitario"] = t["precio_unitario"] - t["costo_unitario"]
    return t.set_index(["periodo", "producto"])


def _tabla_gastos(df: pd.DataFrame, periodos: Periodos) -> pd.DataFrame:
    g = df[df["tipo"] == "gasto"].copy()
    g["categoria"] = g["categoria"].fillna(g["concepto"]).fillna("(sin categoría)")
    base = g[g["mes"].isin(periodos.base)].groupby("categoria")["importe"].sum()
    actual = g[g["mes"].isin(periodos.actual)].groupby("categoria")["importe"].sum()
    inusual = g[g["mes"].isin(periodos.actual) & g["inusual"]].groupby("categoria")["importe"].sum()
    t = pd.DataFrame({"base": base, "actual": actual, "inusual_actual": inusual}).fillna(0.0)
    t["cambio"] = t["actual"] - t["base"]
    t["cambio_pct"] = t["cambio"] / t["base"].replace(0, np.nan)
    return t.sort_values("cambio", ascending=False)


def _flujo(df: pd.DataFrame, libro: Libro, periodos: Periodos, confianza: str,
           supuestos: list[str]) -> tuple[pd.DataFrame | None, list[str]]:
    """Flujo de efectivo con base en la fecha real de cobro/pago, si existe."""
    if not df["fecha_liquidacion"].notna().any():
        return None, ["Fecha en que se cobró cada venta y se pagó cada costo/gasto "
                      "(sin ella no puedo distinguir utilidad de efectivo)."]
    d = df.copy()
    tipos_con_dato = set(d.loc[d["fecha_liquidacion"].notna(), "tipo"])
    sin_dato = d["tipo"].isin(set(d["tipo"]) - tipos_con_dato)
    if sin_dato.any():
        d.loc[sin_dato, "fecha_liquidacion"] = d.loc[sin_dato, "fecha"]
        supuestos.append("Para " + ", ".join(sorted(set(d.loc[sin_dato, "tipo"]))) +
                         " no hay fecha de pago; asumí que se pagaron el mismo día.")
    d["mes_liq"] = d["fecha_liquidacion"].dt.to_period("M").astype("string")
    ultimo = df["fecha"].max()
    pendiente = d["fecha_liquidacion"].isna() | (d["fecha_liquidacion"] > ultimo)

    meses = periodos.meses
    filas = []
    for m in meses:
        liq = d[(d["mes_liq"] == m) & ~pendiente]
        cobros = float(liq.loc[liq["tipo"] == "venta", "importe"].sum())
        pagos = float(liq.loc[liq["tipo"].isin(["costo", "gasto"]), "importe"].sum())
        filas.append({"mes": m, "cobros": cobros, "pagos": pagos, "flujo_operativo": cobros - pagos})
    flujo = pd.DataFrame(filas).set_index("mes")
    flujo["flujo_acumulado"] = flujo["flujo_operativo"].cumsum()

    ventas = d[d["tipo"] == "venta"]
    egresos = d[d["tipo"].isin(["costo", "gasto"])]
    cxc = ventas[pendiente.loc[ventas.index]]
    cxp = egresos[pendiente.loc[egresos.index]]

    def dias_promedio(sub: pd.DataFrame) -> float | None:
        s = sub[sub["fecha_liquidacion"].notna()]
        if s.empty or s["importe"].sum() == 0:
            return None
        dias = (s["fecha_liquidacion"] - s["fecha"]).dt.days.clip(lower=0)
        return float(np.average(dias, weights=s["importe"].abs()))

    for clave, nombre, valor, unidad, formula, origen, concepto in (
        ("cobros.total", "Cobros", float(flujo["cobros"].sum()), "dinero",
         "suma de ventas cobradas, por fecha de cobro", ventas.loc[~pendiente.loc[ventas.index], "origen"].tolist(), "flujo_efectivo"),
        ("pagos.total", "Pagos", float(flujo["pagos"].sum()), "dinero",
         "suma de costos y gastos pagados, por fecha de pago", egresos.loc[~pendiente.loc[egresos.index], "origen"].tolist(), "flujo_efectivo"),
        ("cxc.final", "Ventas por cobrar al cierre", float(cxc["importe"].sum()), "dinero",
         "ventas sin fecha de cobro o cobradas después del último dato", cxc["origen"].tolist(), "cuentas_por_cobrar"),
        ("cxp.final", "Pagos pendientes al cierre", float(cxp["importe"].sum()), "dinero",
         "costos/gastos sin fecha de pago o pagados después del último dato", cxp["origen"].tolist(), "cuentas_por_pagar"),
        ("dias_cobro.total", "Días promedio de cobro", dias_promedio(ventas), "dias",
         "promedio ponderado por importe de (fecha de cobro − fecha de venta)", ventas["origen"].tolist(), "dias_cobro"),
        ("dias_pago.total", "Días promedio de pago", dias_promedio(egresos), "dias",
         "promedio ponderado por importe de (fecha de pago − fecha del costo/gasto)", egresos["origen"].tolist(), "dias_pago"),
    ):
        libro.agregar(Cifra(clave, nombre, valor, unidad, formula, periodos.etiqueta("total"),
                            origen=origen, confianza=confianza, concepto=concepto))
    libro.agregar(Cifra(
        "flujo_operativo.total", "Flujo de efectivo de la operación",
        float(flujo["flujo_operativo"].sum()), "dinero", "cobros − pagos",
        periodos.etiqueta("total"), depende_de=["cobros.total", "pagos.total"],
        supuestos=["No incluye impuestos, préstamos ni compras de equipo que no estén en el archivo."],
        confianza=confianza, concepto="flujo_efectivo"))
    if periodos.actual:
        liq_act = flujo.loc[periodos.actual, "flujo_operativo"].sum()
        libro.agregar(Cifra(
            "flujo_operativo.actual", "Flujo de efectivo de la operación", float(liq_act), "dinero",
            "cobros − pagos", periodos.etiqueta("actual"), depende_de=["cobros.total", "pagos.total"],
            confianza=confianza, concepto="flujo_efectivo"))
    return flujo, []


def calcular(limpio: pd.DataFrame, confianza: str = "confiable", supuestos: list[str] | None = None,
             moneda: str = "MXN") -> Resultados:
    supuestos = list(supuestos or [])
    supuestos_uo = ["Es utilidad antes de impuestos e intereses, salvo que vengan como gastos en tus datos.",
                    "No incluye depreciación ni compras de equipo si no están en el archivo."]
    df = limpio.copy()
    df["mes"] = df["fecha"].dt.to_period("M").astype("string")
    periodos = definir_periodos(sorted(df["mes"].dropna().unique().tolist()))
    libro = Libro()
    faltantes: list[str] = []

    # Estado de resultados: total, base, actual y cada mes
    _registrar_estado(libro, df, "total", periodos.etiqueta("total"), confianza, supuestos_uo)
    mensual = []
    for m in periodos.meses:
        sub = df[df["mes"] == m]
        _registrar_estado(libro, sub, m, m, confianza, supuestos_uo)
        mensual.append({"mes": m, **_estado(sub)})
    mensual_df = pd.DataFrame(mensual).set_index("mes") if mensual else pd.DataFrame()

    if periodos.base:
        for cual in ("base", "actual"):
            sub = df[df["mes"].isin(getattr(periodos, cual))]
            _registrar_estado(libro, sub, cual, periodos.etiqueta(cual), confianza, supuestos_uo)
        for clave, (nombre, unidad, _) in METRICAS.items():
            b, a = libro.valor(f"{clave}.base"), libro.valor(f"{clave}.actual")
            if unidad == "pct":
                libro.agregar(Cifra(
                    f"var.{clave}", f"Cambio en {nombre.lower()}",
                    None if a is None or b is None else a - b, "pts",
                    f"{nombre.lower()} actual − {nombre.lower()} base",
                    f"{periodos.etiqueta('actual')} vs {periodos.etiqueta('base')}",
                    depende_de=[f"{clave}.actual", f"{clave}.base"], confianza=confianza, concepto=clave))
            else:
                libro.agregar(Cifra(
                    f"var.{clave}", f"Cambio en {nombre.lower()}", cambio_pct(a, b), "pct",
                    f"({nombre.lower()} actual − base) ÷ |base|",
                    f"{periodos.etiqueta('actual')} vs {periodos.etiqueta('base')}",
                    depende_de=[f"{clave}.actual", f"{clave}.base"], confianza=confianza, concepto=clave))
                libro.agregar(Cifra(
                    f"dif.{clave}", f"Diferencia en {nombre.lower()}",
                    None if a is None or b is None else a - b, "dinero",
                    f"{nombre.lower()} actual − base",
                    f"{periodos.etiqueta('actual')} vs {periodos.etiqueta('base')}",
                    depende_de=[f"{clave}.actual", f"{clave}.base"], confianza=confianza, concepto=clave))
        if periodos.excluidos:
            supuestos.append(f"Para comparar periodos del mismo tamaño, {', '.join(periodos.excluidos)} "
                             "no entra en la comparación base vs actual (sí en los totales).")
    else:
        faltantes.append("Al menos dos meses de datos para comparar periodos.")

    # Punto de equilibrio mensual con la estructura del periodo actual
    ref = "actual" if periodos.actual else "total"
    meses_ref = len(periodos.actual) or len(periodos.meses) or 1
    mb, gastos = libro.valor(f"margen_bruto.{ref}"), libro.valor(f"gastos_operativos.{ref}")
    if mb and mb > 0 and gastos is not None:
        libro.agregar(Cifra(
            "punto_equilibrio.mensual", "Ventas mensuales para no perder", gastos / meses_ref / mb,
            "dinero", "gastos de operación mensuales promedio ÷ margen bruto", periodos.etiqueta(ref),
            depende_de=[f"gastos_operativos.{ref}", f"margen_bruto.{ref}"],
            supuestos=["Supone que el margen bruto y los gastos fijos se mantienen como en el periodo."],
            confianza=confianza, concepto="punto_equilibrio"))
        libro.agregar(Cifra(
            "ventas.mensual", "Ventas mensuales promedio", libro.valor(f"ventas.{ref}") / meses_ref,
            "dinero", "ventas del periodo ÷ meses", periodos.etiqueta(ref),
            depende_de=[f"ventas.{ref}"], confianza=confianza, concepto="ventas"))

    productos = _tabla_productos(df, periodos) if periodos.base else pd.DataFrame()
    if not df["producto"].notna().any():
        faltantes.append("Producto o servicio de cada venta (para saber cuáles dejan más).")
    elif not df.loc[df["tipo"] == "venta", "cantidad"].notna().any():
        faltantes.append("Cantidad vendida (para separar efecto precio de efecto volumen).")
    if (df["tipo"] == "costo").any() and not df.loc[df["tipo"] == "costo", "producto"].notna().any():
        faltantes.append("Producto al que corresponde cada costo (para el margen por producto).")
    gastos_cat = _tabla_gastos(df, periodos) if periodos.base else pd.DataFrame()

    flujo, falta_flujo = _flujo(df, libro, periodos, confianza, supuestos)
    faltantes += falta_flujo

    return Resultados(libro, periodos, mensual_df, productos, gastos_cat, flujo,
                      faltantes, confianza, supuestos, moneda)
