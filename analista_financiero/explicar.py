"""Principios 2 y 5: traducir finanzas a lenguaje humano y enseñar sin obligar a estudiar.

Cada concepto tiene: qué es, cómo se calcula, por qué importa, qué revisar
y un ejemplo armado con las cifras del propio usuario. Las explicaciones
son plantillas deterministas; el asistente de IA puede reformularlas, pero
nunca cambia los números.
"""

from __future__ import annotations

from .modelos import Cifra, Libro, fmt_dinero

GLOSARIO: dict[str, dict[str, str]] = {
    "ventas": {
        "nombre": "Ventas (ingresos)",
        "que_es": "Todo lo que facturaste o cobraste por vender, antes de restar cualquier costo.",
        "calculo": "Suma de todas las ventas del periodo (las devoluciones restan).",
        "importa": "Vender mucho no significa ganar mucho: lo que importa es cuánto queda después de pagar todo.",
        "revisar": "Que no estén incluidos anticipos, préstamos o aportaciones de socios: eso no es venta.",
    },
    "costo_ventas": {
        "nombre": "Costo de ventas",
        "que_es": "Lo que te cuesta directamente lo que vendiste: mercancía, materia prima, maquila.",
        "calculo": "Suma de los costos ligados a los productos vendidos en el periodo.",
        "importa": "Si sube y no ajustas precios, cada venta te deja menos.",
        "revisar": "Que solo incluya lo vendido, no todo lo que compraste para inventario.",
    },
    "utilidad_bruta": {
        "nombre": "Utilidad bruta",
        "que_es": "Lo que te queda de las ventas después de pagar lo que cuesta el producto.",
        "calculo": "Ventas − costo de ventas.",
        "importa": "Con esto pagas renta, sueldos y todo lo demás. Si no alcanza, el negocio pierde.",
        "revisar": "Que ventas y costos correspondan al mismo periodo.",
    },
    "margen_bruto": {
        "nombre": "Margen bruto",
        "que_es": "De cada $100 que vendes, cuántos te quedan después de pagar el producto.",
        "calculo": "Utilidad bruta ÷ ventas.",
        "importa": "Mide qué tan rentable es lo que vendes. Si baja, revisa costos, precios y descuentos.",
        "revisar": "Compáralo por producto: un promedio puede esconder productos que pierden dinero.",
    },
    "gastos_operativos": {
        "nombre": "Gastos de operación",
        "que_es": "Lo que cuesta mantener el negocio funcionando, venda o no venda: renta, sueldos, luz, publicidad.",
        "calculo": "Suma de todos los gastos que no son costo directo del producto.",
        "importa": "Muchos son fijos: si crecen más rápido que las ventas, la utilidad se encoge.",
        "revisar": "Qué gastos son permanentes y cuáles fueron de una sola vez.",
    },
    "utilidad_operativa": {
        "nombre": "Utilidad de operación",
        "que_es": "Lo que realmente gana la operación del negocio, antes de impuestos e intereses.",
        "calculo": "Utilidad bruta − gastos de operación.",
        "importa": "Es la respuesta a «¿cuánto estoy ganando realmente?» con la actividad del negocio.",
        "revisar": "Que no falten gastos (por ejemplo, tu propio sueldo si trabajas en el negocio).",
    },
    "margen_operativo": {
        "nombre": "Margen de operación",
        "que_es": "De cada $100 que vendes, cuántos te quedan después de pagar producto y gastos.",
        "calculo": "Utilidad de operación ÷ ventas.",
        "importa": "Permite comparar meses de distinto tamaño y ver si el negocio se vuelve más o menos eficiente.",
        "revisar": "Si cae aunque las ventas suban, algo se está comiendo la ganancia.",
    },
    "flujo_efectivo": {
        "nombre": "Flujo de efectivo",
        "que_es": "El dinero que realmente entró y salió de tu banco.",
        "calculo": "Cobros − pagos del periodo, según la fecha real de cada movimiento.",
        "importa": "La utilidad es una estimación contable; el efectivo es lo que paga la nómina. Puedes ganar y quedarte sin dinero.",
        "revisar": "Ventas a crédito que no has cobrado y compras de inventario grandes.",
    },
    "cuentas_por_cobrar": {
        "nombre": "Cuentas por cobrar",
        "que_es": "Ventas que ya hiciste pero que tus clientes todavía no te pagan.",
        "calculo": "Suma de ventas sin fecha de cobro al cierre.",
        "importa": "Es dinero tuyo financiando a tus clientes.",
        "revisar": "Las más antiguas: entre más viejas, más difícil cobrarlas.",
    },
    "cuentas_por_pagar": {
        "nombre": "Cuentas por pagar",
        "que_es": "Compras y gastos que ya recibiste pero aún no pagas.",
        "calculo": "Suma de costos/gastos sin fecha de pago al cierre.",
        "importa": "Es financiamiento de tus proveedores; ayuda a la caja si se paga a tiempo.",
        "revisar": "Que no haya pagos vencidos que generen recargos o pongan en riesgo el abasto.",
    },
    "dias_cobro": {
        "nombre": "Días de cobro",
        "que_es": "Cuántos días tardas, en promedio, en cobrar una venta.",
        "calculo": "Promedio ponderado por importe de (fecha de cobro − fecha de venta).",
        "importa": "Cada día de más es efectivo que no tienes. Reducirlo libera caja sin vender más.",
        "revisar": "Qué clientes pagan más tarde y si tus condiciones de crédito se respetan.",
    },
    "dias_pago": {
        "nombre": "Días de pago",
        "que_es": "Cuántos días tardas, en promedio, en pagar a tus proveedores.",
        "calculo": "Promedio ponderado por importe de (fecha de pago − fecha del costo).",
        "importa": "Si cobras a 45 días y pagas a 15, necesitas efectivo para cubrir la diferencia.",
        "revisar": "Si puedes negociar plazos más largos sin perder descuentos.",
    },
    "punto_equilibrio": {
        "nombre": "Punto de equilibrio",
        "que_es": "Cuánto necesitas vender al mes para no ganar ni perder.",
        "calculo": "Gastos de operación mensuales ÷ margen bruto.",
        "importa": "Te dice cuánto colchón tienes: qué tanto pueden caer las ventas antes de perder.",
        "revisar": "Si tus gastos fijos o tu margen cambian, el punto de equilibrio cambia.",
    },
    "efecto_volumen": {
        "nombre": "Efecto volumen",
        "que_es": "Cuánta utilidad ganaste (o perdiste) por vender más (o menos) unidades.",
        "calculo": "(Unidades actuales − unidades base) × lo que dejaba cada unidad en el periodo base.",
        "importa": "Separa «vendí más» de «cada venta deja menos».",
        "revisar": "Que el crecimiento venga de productos rentables.",
    },
    "efecto_mezcla": {
        "nombre": "Efecto mezcla",
        "que_es": "Lo que cambia tu utilidad porque ahora vendes una proporción distinta de productos.",
        "calculo": "Compara lo que dejarían las unidades actuales con los márgenes de antes, contra el margen promedio de antes.",
        "importa": "Si crecen los productos que menos dejan, puedes vender más y ganar menos.",
        "revisar": "Promociones, comisiones o descuentos que empujan productos de bajo margen.",
    },
    "efecto_precio": {
        "nombre": "Efecto precio",
        "que_es": "Lo que ganaste o perdiste porque cambió el precio promedio de cada producto.",
        "calculo": "Unidades actuales × (precio actual − precio base), por producto.",
        "importa": "Muestra si estás cobrando lo mismo, más o menos por lo mismo.",
        "revisar": "Descuentos no autorizados o listas de precios desactualizadas.",
    },
    "efecto_costo": {
        "nombre": "Efecto costo unitario",
        "que_es": "Lo que perdiste o ganaste porque cambió lo que te cuesta cada unidad.",
        "calculo": "−Unidades actuales × (costo unitario actual − costo unitario base), por producto.",
        "importa": "Suele ser la causa silenciosa de que la utilidad caiga aunque se venda más.",
        "revisar": "Facturas del proveedor, merma y desperdicio.",
    },
    "efecto_tasa": {
        "nombre": "Cambio de margen por producto",
        "que_es": "Lo que cambió la utilidad porque cada producto deja un porcentaje distinto que antes.",
        "calculo": "Ventas actuales de cada producto × (margen % actual − margen % base).",
        "importa": "Indica que subieron costos o bajaron precios; con las cantidades vendidas se puede separar.",
        "revisar": "Agrega la cantidad vendida a tus datos para separar precio de costo.",
    },
    "efecto_otros": {
        "nombre": "Otros sin detalle por producto",
        "que_es": "Cambios en ventas o costos que no tienen producto asignado.",
        "calculo": "Cambio en utilidad bruta − efectos explicados por producto.",
        "importa": "Entre más grande, menos sabemos de dónde viene el cambio.",
        "revisar": "Asigna un producto a esas ventas o costos.",
    },
    "necesidad_financiamiento": {
        "nombre": "Necesidad de financiamiento",
        "que_es": "El dinero que te faltaría en el peor momento de la proyección.",
        "calculo": "El saldo de caja más negativo de la proyección (si nunca es negativo, es cero).",
        "importa": "Saber con anticipación cuánto y cuándo te faltará permite negociar mejor un crédito.",
        "revisar": "Antes de pedir un crédito, consulta a un profesional sobre costo y condiciones.",
    },
    "elasticidad": {
        "nombre": "Elasticidad precio",
        "que_es": "Qué tanto cambian tus ventas en unidades cuando cambias el precio.",
        "calculo": "% de cambio en unidades ÷ % de cambio en precio. −0.8 significa: subes 10% el precio, vendes 8% menos unidades.",
        "importa": "Define si subir precios aumenta o reduce la utilidad.",
        "revisar": "Pruébalo con un grupo pequeño de clientes antes de cambiar todos los precios.",
    },
}


def concepto(clave: str) -> dict[str, str] | None:
    return GLOSARIO.get(clave)


def explicar_cifra(c: Cifra, libro: Libro | None = None) -> str:
    """Explicación en lenguaje sencillo de una cifra concreta, con su valor."""
    g = GLOSARIO.get(c.concepto or "", {})
    partes = [f"{c.nombre} ({c.periodo}): {c.texto()}."]
    if c.unidad == "pct" and c.valor is not None and c.concepto in ("margen_bruto", "margen_operativo"):
        partes.append(f"De cada $100 que vendiste, te quedaron ${c.valor * 100:,.1f}"
                      + (" después de pagar el producto." if c.concepto == "margen_bruto" else " después de pagar producto y gastos."))
    elif g.get("que_es"):
        partes.append(g["que_es"])
    partes.append(f"Cómo se calcula: {c.formula}.")
    if g.get("importa"):
        partes.append(f"Por qué importa: {g['importa']}")
    if c.origen:
        partes.append(f"Viene de {len(c.origen)} fila(s) de tus datos (p. ej. {c.origen[0]}).")
    if c.supuestos:
        partes.append("Supuestos: " + " ".join(c.supuestos))
    if c.confianza != "confiable":
        partes.append("Ojo: es una cifra PROVISIONAL hasta confirmar los problemas de datos.")
    return " ".join(partes)


def explicar_variacion(libro: Libro, metrica: str) -> str:
    """Traduce "el margen bajó X pts" a qué significa, qué lo causa y qué revisar."""
    var, base, act = libro.get(f"var.{metrica}"), libro.get(f"{metrica}.base"), libro.get(f"{metrica}.actual")
    if var is None or var.valor is None:
        return "No hay dos periodos comparables para esta cifra."
    g = GLOSARIO.get(metrica, {})
    direccion = "subió" if var.valor > 0 else "bajó" if var.valor < 0 else "no cambió"
    txt = f"{g.get('nombre', metrica)} {direccion}: pasó de {base.texto()} a {act.texto()} ({var.texto()})."
    if metrica in ("margen_bruto", "margen_operativo") and base.valor is not None and act.valor is not None and base.valor:
        ventas_act = libro.valor("ventas.actual") or 0
        perdido = (act.valor - base.valor) * ventas_act
        txt += (f" En la práctica: con las ventas del periodo actual, esa diferencia equivale a "
                f"{fmt_dinero(perdido)} de utilidad.")
    if g.get("revisar"):
        txt += f" Qué revisar: {g['revisar']}"
    return txt


def leccion(clave: str) -> str:
    """Tarjeta corta para aprender un concepto mientras se resuelve el problema."""
    g = GLOSARIO.get(clave)
    if not g:
        return ""
    return (f"{g['nombre']}\n  Qué es: {g['que_es']}\n  Cómo se calcula: {g['calculo']}\n"
            f"  Por qué importa: {g['importa']}\n  Qué revisar: {g['revisar']}")
