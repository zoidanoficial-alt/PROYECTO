"""Pronósticos y escenarios: "¿qué pasa si...?"

Parte del ritmo mensual del periodo actual (la "base") y aplica palancas:
precio, volumen, costo por unidad, gastos, mezcla y días de cobro/pago.
Proyecta ventas, utilidad y caja mes a mes, y calcula si en algún momento
faltaría efectivo (necesidad de financiamiento).

Todos los supuestos se devuelven en texto junto con el resultado: un
escenario es tan bueno como sus supuestos, y el usuario debe verlos.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field

import numpy as np
import pandas as pd

from .calculos import Resultados
from .modelos import fmt_dinero, fmt_pct


@dataclass
class Linea:
    nombre: str
    ventas: float  # mensual
    costo: float  # mensual
    unidades: float | None = None


@dataclass
class BaseMensual:
    lineas: list[Linea]
    gastos: dict[str, float]  # por categoría, mensual
    dias_cobro: float
    dias_pago: float
    crecimiento: float  # mensual, fracción, usado en la proyección
    tendencia_historica: float  # mensual, solo informativa
    crecimiento_r2: float | None
    meses_referencia: str
    supuestos: list[str] = field(default_factory=list)

    @property
    def ventas(self) -> float:
        return sum(lin.ventas for lin in self.lineas)


@dataclass
class Palancas:
    cambio_precio_pct: float = 0.0
    precio_por_producto: dict[str, float] = field(default_factory=dict)
    elasticidad: float = 0.0  # % de cambio en unidades por cada 1% de cambio en precio (normalmente negativa)
    cambio_volumen_pct: float = 0.0
    volumen_por_producto: dict[str, float] = field(default_factory=dict)
    cambio_costo_unitario_pct: float = 0.0
    costo_por_producto: dict[str, float] = field(default_factory=dict)
    cambio_gastos_pct: float = 0.0
    gastos_por_categoria: dict[str, float] = field(default_factory=dict)  # % por categoría
    gastos_monto: dict[str, float] = field(default_factory=dict)  # cambio mensual en pesos
    desplazar_mezcla: tuple[str, str, float] | None = None  # (de, a, fracción de unidades)
    dias_cobro: float | None = None
    dias_pago: float | None = None
    crecimiento_mensual: float | None = None
    meses: int = 6
    saldo_inicial: float | None = None

    def describir(self) -> list[str]:
        d = []
        if self.cambio_precio_pct:
            d.append(f"Precios {fmt_pct(self.cambio_precio_pct, signo=True)} en todos los productos")
        for p, v in self.precio_por_producto.items():
            d.append(f"Precio de {p} {fmt_pct(v, signo=True)}")
        if (self.cambio_precio_pct or self.precio_por_producto) and self.elasticidad:
            d.append(f"Elasticidad {self.elasticidad:+.1f}: por cada 1% que sube el precio, las unidades cambian {self.elasticidad:+.1f}%")
        if self.cambio_volumen_pct:
            d.append(f"Volumen {fmt_pct(self.cambio_volumen_pct, signo=True)}")
        for p, v in self.volumen_por_producto.items():
            d.append(f"Unidades de {p} {fmt_pct(v, signo=True)}")
        if self.cambio_costo_unitario_pct:
            d.append(f"Costo por unidad {fmt_pct(self.cambio_costo_unitario_pct, signo=True)}")
        for p, v in self.costo_por_producto.items():
            d.append(f"Costo por unidad de {p} {fmt_pct(v, signo=True)}")
        if self.cambio_gastos_pct:
            d.append(f"Gastos {fmt_pct(self.cambio_gastos_pct, signo=True)}")
        for c, v in self.gastos_por_categoria.items():
            d.append(f"Gasto «{c}» {fmt_pct(v, signo=True)}")
        for c, v in self.gastos_monto.items():
            d.append(f"Gasto «{c}» {fmt_dinero(v)} al mes")
        if self.desplazar_mezcla:
            de, a, f = self.desplazar_mezcla
            d.append(f"Mover {fmt_pct(f, 0)} de las ventas de {de} hacia {a}")
        if self.dias_cobro is not None:
            d.append(f"Cobrar a {self.dias_cobro:.0f} días")
        if self.dias_pago is not None:
            d.append(f"Pagar a proveedores a {self.dias_pago:.0f} días")
        if self.crecimiento_mensual is not None:
            d.append(f"Crecimiento mensual {fmt_pct(self.crecimiento_mensual, signo=True)}")
        return d or ["Sin cambios (continuar como hasta ahora)"]


@dataclass
class Escenario:
    nombre: str
    palancas: Palancas
    mensual: dict  # mes "típico" con las palancas, sin crecimiento
    proyeccion: pd.DataFrame
    supuestos: list[str]

    @property
    def utilidad_mensual(self) -> float:
        return self.mensual["utilidad_operativa"]

    @property
    def caja_final(self) -> float:
        return float(self.proyeccion["saldo"].iloc[-1])

    @property
    def necesidad_financiamiento(self) -> float:
        return float(max(0.0, -self.proyeccion["saldo"].min()))


# ---------------------------------------------------------------------------
# Base
# ---------------------------------------------------------------------------

def tendencia(serie: pd.Series) -> tuple[float, float | None]:
    """Crecimiento mensual por regresión lineal sobre las ventas (y su R²)."""
    y = serie.dropna().astype(float).values
    if len(y) < 4 or y.mean() <= 0:
        return 0.0, None
    x = np.arange(len(y))
    pendiente, intercepto = np.polyfit(x, y, 1)
    ajuste = pendiente * x + intercepto
    ss_res = float(((y - ajuste) ** 2).sum())
    ss_tot = float(((y - y.mean()) ** 2).sum()) or 1.0
    return float(pendiente / y.mean()), 1 - ss_res / ss_tot


def base_desde_resultados(res: Resultados) -> BaseMensual:
    meses = res.periodos.actual or res.periodos.meses
    n = len(meses) or 1
    supuestos = [f"Punto de partida: promedio mensual de {res.periodos.etiqueta('actual' if res.periodos.actual else 'total')}."]
    lineas: list[Linea] = []
    p = res.productos
    lib = res.libro
    clave = "actual" if res.periodos.actual else "total"
    ventas_tot = lib.valor(f"ventas.{clave}") or 0.0
    costo_tot = lib.valor(f"costo_ventas.{clave}") or 0.0
    if p is not None and not p.empty and "actual" in p.index.get_level_values(0):
        act = p.loc["actual"]
        for prod, f in act.iterrows():
            costo = 0.0 if pd.isna(f["costo"]) else f["costo"]
            lineas.append(Linea(prod, f["ventas"] / n, costo / n,
                                None if pd.isna(f["unidades"]) else f["unidades"] / n))
        resto_v = ventas_tot - float(act["ventas"].sum())
        resto_c = costo_tot - float(act["costo"].fillna(0).sum())
        if abs(resto_v) > 0.5 or abs(resto_c) > 0.5:
            lineas.append(Linea("(sin producto)", resto_v / n, resto_c / n))
    else:
        lineas.append(Linea("Ventas", ventas_tot / n, costo_tot / n))

    gastos: dict[str, float] = {}
    g = res.gastos_categoria
    if g is not None and not g.empty:
        gastos = {cat: float(v) / n for cat, v in g["actual"].items() if v}
    else:
        gastos = {"Gastos de operación": (lib.valor(f"gastos_operativos.{clave}") or 0.0) / n}

    dc, dp = lib.valor("dias_cobro.total"), lib.valor("dias_pago.total")
    if dc is None:
        dc = 0.0
        supuestos.append("Sin fechas de cobro: se asume que cobras de contado.")
    if dp is None:
        dp = 0.0
        supuestos.append("Sin fechas de pago: se asume que pagas de contado.")
    serie = res.mensual["ventas"] if not res.mensual.empty else pd.Series(dtype=float)
    crec, r2 = tendencia(serie)
    # Proyección conservadora: no se asume que la tendencia continúe salvo que el usuario lo pida.
    if r2 is None:
        supuestos.append("Pocos meses para estimar tendencia: la proyección asume ventas constantes.")
    else:
        crec = float(np.clip(crec, -0.10, 0.10))
        confiable = "consistente" if r2 >= 0.6 else "poco consistente"
        supuestos.append(f"Las ventas venían cambiando {fmt_pct(crec, signo=True)} al mes (tendencia {confiable}, "
                         f"R²={r2:.2f}); la proyección NO asume que siga: usa el mes típico reciente. "
                         "Puedes simular crecimiento explícitamente.")
    supuestos.append("Los gastos de operación se tratan como fijos: no crecen con las ventas.")
    supuestos.append("Los gastos se pagan el mismo mes; los costos de venta según los días de pago.")
    supuestos.append("No incluye impuestos, intereses, préstamos ni compras de equipo.")
    return BaseMensual(lineas, gastos, float(dc), float(dp), 0.0, crec, r2,
                       res.periodos.etiqueta("actual" if res.periodos.actual else "total"), supuestos)


# ---------------------------------------------------------------------------
# Simulación
# ---------------------------------------------------------------------------

def _aplicar(base: BaseMensual, pal: Palancas) -> tuple[list[Linea], dict[str, float]]:
    lineas = []
    for lin in base.lineas:
        dp = pal.precio_por_producto.get(lin.nombre, pal.cambio_precio_pct)
        dq = (1 + pal.cambio_volumen_pct) * (1 + pal.volumen_por_producto.get(lin.nombre, 0.0)) * (1 + pal.elasticidad * dp) - 1
        dc = (1 + pal.cambio_costo_unitario_pct) * (1 + pal.costo_por_producto.get(lin.nombre, 0.0)) - 1
        f_q = max(0.0, 1 + dq)
        lineas.append(Linea(lin.nombre, lin.ventas * f_q * (1 + dp), lin.costo * f_q * (1 + dc),
                            None if lin.unidades is None else lin.unidades * f_q))
    if pal.desplazar_mezcla:
        de, a, frac = pal.desplazar_mezcla
        origen = next((x for x in lineas if x.nombre == de), None)
        destino = next((x for x in lineas if x.nombre == a), None)
        if origen and destino and origen.ventas > 0:
            movido_v = origen.ventas * frac
            # el destino conserva su precio y costo relativos: escala por valor vendido
            factor = movido_v / destino.ventas if destino.ventas else 0.0
            origen_c = origen.costo * frac
            origen.ventas -= movido_v
            origen.costo -= origen_c
            if origen.unidades is not None:
                origen.unidades *= (1 - frac)
            destino.costo += destino.costo * factor
            if destino.unidades is not None:
                destino.unidades *= (1 + factor)
            destino.ventas += movido_v
    gastos = {}
    for cat, monto in base.gastos.items():
        m = monto * (1 + pal.cambio_gastos_pct) * (1 + pal.gastos_por_categoria.get(cat, 0.0))
        gastos[cat] = m + pal.gastos_monto.get(cat, 0.0)
    for cat, m in pal.gastos_monto.items():
        if cat not in base.gastos:
            gastos[cat] = m
    return lineas, gastos


def resultado_mensual(base: BaseMensual, pal: Palancas | None = None) -> dict:
    lineas, gastos = _aplicar(base, pal or Palancas())
    v = sum(x.ventas for x in lineas)
    c = sum(x.costo for x in lineas)
    g = sum(gastos.values())
    return {"ventas": v, "costo_ventas": c, "utilidad_bruta": v - c, "gastos_operativos": g,
            "utilidad_operativa": v - c - g, "margen_operativo": (v - c - g) / v if v else math.nan,
            "margen_bruto": (v - c) / v if v else math.nan,
            "por_linea": {x.nombre: {"ventas": x.ventas, "costo": x.costo, "unidades": x.unidades} for x in lineas},
            "gastos": gastos}


def _con_rezago(historia: float, serie: list[float], dias: float) -> list[float]:
    """Reparte cada mes de la serie según los días de rezago (cobro o pago)."""
    rezago = max(0.0, dias) / 30.0
    k, frac = int(rezago), rezago - int(rezago)
    completo = [historia] * (k + 1) + serie
    off = k + 1
    return [(1 - frac) * completo[off + t - k] + frac * completo[off + t - k - 1] for t in range(len(serie))]


def simular(base: BaseMensual, pal: Palancas | None = None, nombre: str = "Escenario") -> Escenario:
    pal = pal or Palancas()
    m = resultado_mensual(base, pal)
    m0 = resultado_mensual(base, Palancas())
    g = base.crecimiento if pal.crecimiento_mensual is None else pal.crecimiento_mensual
    meses = max(1, pal.meses)
    factor = [(1 + g) ** (t + 1) for t in range(meses)]
    ventas = [m["ventas"] * f for f in factor]
    costos = [m["costo_ventas"] * f for f in factor]
    gastos = [m["gastos_operativos"]] * meses
    dc = base.dias_cobro if pal.dias_cobro is None else pal.dias_cobro
    dp = base.dias_pago if pal.dias_pago is None else pal.dias_pago
    # La historia previa es la situación actual (sin palancas): cambiar plazos genera transición.
    cobros = _con_rezago(m0["ventas"], ventas, dc)
    pagos_c = _con_rezago(m0["costo_ventas"], costos, dp)
    saldo0 = pal.saldo_inicial or 0.0
    filas, saldo = [], saldo0
    for t in range(meses):
        flujo = cobros[t] - pagos_c[t] - gastos[t]
        saldo += flujo
        filas.append({"mes": t + 1, "ventas": ventas[t], "costo_ventas": costos[t], "gastos": gastos[t],
                      "utilidad_operativa": ventas[t] - costos[t] - gastos[t],
                      "cobros": cobros[t], "pagos": pagos_c[t] + gastos[t], "flujo": flujo, "saldo": saldo})
    proy = pd.DataFrame(filas).set_index("mes")
    supuestos = list(base.supuestos) + pal.describir()
    if pal.saldo_inicial is None:
        supuestos.append("Sin saldo inicial de caja: el saldo muestra solo lo que la operación genera o consume desde hoy.")
    return Escenario(nombre, pal, m, proy, supuestos)


def comparar(base: BaseMensual, escenarios: list[tuple[str, Palancas]]) -> pd.DataFrame:
    sims = [simular(base, Palancas(meses=escenarios[0][1].meses if escenarios else 6,
                                   saldo_inicial=escenarios[0][1].saldo_inicial if escenarios else None),
                    "Seguir igual")]
    sims += [simular(base, p, n) for n, p in escenarios]
    ref = sims[0]
    filas = []
    for s in sims:
        filas.append({
            "escenario": s.nombre,
            "ventas_mes": s.mensual["ventas"],
            "utilidad_mes": s.utilidad_mensual,
            "margen_operativo": s.mensual["margen_operativo"],
            "cambio_utilidad_mes": s.utilidad_mensual - ref.utilidad_mensual,
            "utilidad_periodo": float(s.proyeccion["utilidad_operativa"].sum()),
            "caja_final": s.caja_final,
            "necesidad_financiamiento": s.necesidad_financiamiento,
        })
    return pd.DataFrame(filas).set_index("escenario")


def precio_para_recuperar_margen(base: BaseMensual, margen_objetivo: float, elasticidad: float = 0.0) -> float | None:
    """Aumento de precio (fracción) para alcanzar un margen bruto objetivo (búsqueda binaria)."""
    lo, hi = -0.5, 1.0
    f = lambda x: resultado_mensual(base, Palancas(cambio_precio_pct=x, elasticidad=elasticidad))["margen_bruto"]  # noqa: E731
    if math.isnan(f(hi)) or f(hi) < margen_objetivo:
        return None
    for _ in range(60):
        mid = (lo + hi) / 2
        if f(mid) < margen_objetivo:
            lo = mid
        else:
            hi = mid
    return hi
