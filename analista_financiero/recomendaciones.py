"""Etapa 7: convertir el diagnóstico en decisiones.

Cada causa respaldada por los datos genera acciones concretas. Cada acción
se simula con el motor de escenarios (no con estimaciones del modelo de
lenguaje), y se presenta con su impacto mensual en utilidad y en caja,
supuestos, riesgos, esfuerzo y si conviene revisión profesional.
"""

from __future__ import annotations

from dataclasses import dataclass, field

import pandas as pd

from .diagnostico import Investigacion
from .escenarios import BaseMensual, Palancas, resultado_mensual, simular
from .modelos import fmt_dinero, fmt_pct

ELASTICIDAD_SUPUESTA = -0.8


@dataclass
class Accion:
    titulo: str
    descripcion: str
    causa: str
    palancas: Palancas
    impacto_utilidad_mes: float = 0.0
    impacto_caja_unico: float = 0.0
    supuestos: list[str] = field(default_factory=list)
    riesgos: list[str] = field(default_factory=list)
    esfuerzo: str = "medio"  # bajo | medio | alto
    plazo: str = "1-3 meses"
    sensibilidad: dict[str, float] = field(default_factory=dict)  # variante -> impacto mensual
    requiere_experto: bool = False
    primer_paso: str = ""


def _impacto(base: BaseMensual, pal: Palancas) -> float:
    return float(resultado_mensual(base, pal)["utilidad_operativa"] - resultado_mensual(base)["utilidad_operativa"])


def recomendar(inv: Investigacion, base: BaseMensual, flujo_disponible: bool = False) -> list[Accion]:
    acciones: list[Accion] = []
    hip = {h.clave: h for h in inv.hipotesis}

    # 1. Costos por unidad que subieron
    h = hip.get("costos")
    if h and h.estado in ("respaldada", "parcial") and "por_producto" in h.detalle:
        pp = h.detalle["por_producto"]
        for prod, f in pp[pp["efecto_costo"] < 0].sort_values("efecto_costo").head(2).iterrows():
            aumento = f["costo_unit_actual"] / f["costo_unit_base"] - 1
            # a) recuperar la mitad del aumento negociando
            pal = Palancas(costo_por_producto={prod: (1 + aumento / 2) / (1 + aumento) - 1})
            acciones.append(Accion(
                f"Renegociar el costo de {prod}",
                f"El costo por unidad subió {fmt_pct(aumento, signo=True)}. Pide cotizaciones a otros proveedores "
                "y usa esas ofertas para negociar; o compra en mayor volumen si tienes dónde guardar y con qué pagar.",
                "costos", pal, _impacto(base, pal),
                supuestos=[f"Recuperas la mitad del aumento ({fmt_pct(aumento / 2, signo=True)} sobre el costo base)."],
                riesgos=["Un proveedor más barato puede fallar en calidad o tiempos de entrega.",
                         "Comprar más volumen inmoviliza efectivo en inventario."],
                esfuerzo="medio", plazo="1-2 meses",
                sensibilidad={"recuperas 25%": _impacto(base, Palancas(costo_por_producto={prod: (1 + aumento * .75) / (1 + aumento) - 1})),
                              "recuperas 100%": _impacto(base, Palancas(costo_por_producto={prod: 1 / (1 + aumento) - 1}))},
                primer_paso=f"Pide 2 cotizaciones nuevas de {prod} esta semana."))
            # b) trasladar el aumento al precio
            precio_actual = f["precio_actual"]
            subida = (f["costo_unit_actual"] - f["costo_unit_base"]) / precio_actual if precio_actual else 0
            if subida > 0:
                pal = Palancas(precio_por_producto={prod: subida}, elasticidad=ELASTICIDAD_SUPUESTA)
                acciones.append(Accion(
                    f"Ajustar el precio de {prod} {fmt_pct(subida, signo=True)}",
                    f"Subir el precio lo justo para trasladar el aumento de costo ({fmt_dinero(f['costo_unit_actual'] - f['costo_unit_base'], decimales=2)} por unidad).",
                    "costos", pal, _impacto(base, pal),
                    supuestos=[f"Por cada 1% que sube el precio pierdes {abs(ELASTICIDAD_SUPUESTA):.1f}% de unidades (supuesto; pruébalo antes)."],
                    riesgos=["Clientes sensibles al precio pueden irse con la competencia."],
                    esfuerzo="bajo", plazo="inmediato",
                    sensibilidad={"clientes no reaccionan (elasticidad 0)": _impacto(base, Palancas(precio_por_producto={prod: subida})),
                                  "clientes muy sensibles (elasticidad −2)": _impacto(base, Palancas(precio_por_producto={prod: subida}, elasticidad=-2.0))},
                    primer_paso=f"Prueba el nuevo precio de {prod} con un grupo de clientes o un canal durante 2 semanas."))

    # 2. Mezcla de productos
    h = hip.get("precios_mezcla")
    if h and h.estado in ("respaldada", "parcial") and "por_producto" in h.detalle:
        pp = h.detalle["por_producto"]
        col = "margen_unit_actual" if "margen_unit_actual" in pp else "margen_pct_actual"
        vivos = pp[pp.get("participacion_actual", 0) > 0]
        if len(vivos) >= 2:
            mejor, peor = vivos[col].idxmax(), vivos[col].idxmin()
            if mejor != peor:
                pal = Palancas(desplazar_mezcla=(peor, mejor, 0.10))
                acciones.append(Accion(
                    f"Impulsar {mejor} frente a {peor}",
                    f"{mejor} es el producto que más deja y {peor} el que menos. Muévelo con exhibición, "
                    "incentivos al equipo de ventas o paquetes, en vez de descuentos generalizados.",
                    "precios_mezcla", pal, _impacto(base, pal),
                    supuestos=[f"Logras que 10% de lo que hoy se vende de {peor} se venda como {mejor}."],
                    riesgos=[f"Si {peor} atrae clientes que luego compran otras cosas, bajarlo puede costar ventas."],
                    esfuerzo="medio", plazo="1-3 meses",
                    sensibilidad={"mueves 5%": _impacto(base, Palancas(desplazar_mezcla=(peor, mejor, 0.05))),
                                  "mueves 20%": _impacto(base, Palancas(desplazar_mezcla=(peor, mejor, 0.20)))},
                    primer_paso="Revisa qué promociones o comisiones empujan hoy los productos de menor margen."))

    # 3. Gastos que crecieron
    h = hip.get("gastos")
    if h and h.estado in ("respaldada", "parcial") and "por_categoria" in h.detalle:
        g: pd.DataFrame = h.detalle["por_categoria"]
        propuestas = 0
        for cat, f in g[g["cambio"] > 0].iterrows():
            if cat not in base.gastos or propuestas >= 2:
                continue
            # "cambio" compara periodos completos; se lleva a un mes y se quitan partidas inusuales.
            recurrente_mes = (f["cambio"] - f.get("inusual_actual", 0)) / _meses(base)
            if recurrente_mes <= 0:
                continue
            pal = Palancas(gastos_monto={cat: -recurrente_mes / 2})
            propuestas += 1
            acciones.append(Accion(
                f"Revisar el gasto en «{cat}»",
                f"Subió {fmt_dinero(f['cambio'])} entre periodos. Separa qué parte es permanente y qué parte se puede "
                "renegociar, posponer o eliminar.",
                "gastos", pal, _impacto(base, pal),
                supuestos=["Logras recortar la mitad del aumento recurrente (sin contar partidas inusuales)."],
                riesgos=["Recortar gastos que sostienen las ventas (personal, publicidad) puede reducir ingresos."],
                esfuerzo="medio", plazo="1-3 meses",
                requiere_experto="renta" in cat.lower() or "arrend" in cat.lower(),
                primer_paso=f"Lista los pagos de «{cat}» del periodo reciente y marca cuáles son recurrentes."))

    # 4. Cobranza
    if flujo_disponible and base.dias_cobro > 30:
        objetivo = max(15.0, base.dias_cobro - 15)
        sim0 = simular(base, Palancas(meses=3))
        sim1 = simular(base, Palancas(meses=3, dias_cobro=objetivo))
        liberado = sim1.proyeccion["saldo"].iloc[-1] - sim0.proyeccion["saldo"].iloc[-1]
        acciones.append(Accion(
            f"Cobrar más rápido: de {base.dias_cobro:.0f} a {objetivo:.0f} días",
            "No cambia la utilidad, pero libera efectivo que hoy está prestado a tus clientes: "
            "factura el mismo día, ofrece pago con tarjeta o un pequeño descuento por pronto pago.",
            "efectivo", Palancas(dias_cobro=objetivo), 0.0, impacto_caja_unico=float(liberado),
            supuestos=["Los clientes aceptan los nuevos plazos sin dejar de comprar."],
            riesgos=["Plazos más estrictos pueden molestar a clientes grandes."],
            esfuerzo="bajo", plazo="1-2 meses",
            primer_paso="Lista tus 10 cuentas por cobrar más grandes y llama a las vencidas."))

    # 5. Datos dudosos
    h = hip.get("calidad_datos")
    if h and h.estado in ("respaldada", "parcial"):
        acciones.append(Accion(
            "Confirmar los datos dudosos antes de decidir",
            "Hay partidas inusuales o problemas en los datos que podrían cambiar la conclusión.",
            "calidad_datos", Palancas(), 0.0, esfuerzo="bajo", plazo="esta semana",
            requiere_experto=True,
            primer_paso="Revisa con tu contador la lista de problemas de la sección de calidad de datos."))

    acciones.sort(key=lambda a: -(a.impacto_utilidad_mes + a.impacto_caja_unico / 12))
    return acciones


def _meses(base: BaseMensual) -> int:
    texto = base.meses_referencia
    if " a " in texto:
        a, b = texto.split(" a ")
        pa, pb = pd.Period(a, "M"), pd.Period(b, "M")
        return (pb - pa).n + 1
    return 1
