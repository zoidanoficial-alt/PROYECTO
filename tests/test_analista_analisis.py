"""Etapas 3-7: cálculos, investigación, escenarios y recomendaciones."""

from datetime import date

import pandas as pd
import pytest

from analista_financiero import Sesion
from analista_financiero.diagnostico import coherente
from analista_financiero.demo import generar_excel
from analista_financiero.escenarios import Palancas, precio_para_recuperar_margen, simular


def _ledger(filas):
    return pd.DataFrame(filas, columns=["Fecha", "Tipo", "Producto", "Cantidad", "Importe", "Categoría", "Fecha de cobro"])


def _sesion_df(df):
    s = Sesion(hoy=date(2026, 10, 17))
    s.cargar_dataframe(df, "datos")
    s.aceptar_sugerencias()
    s.confirmar_problemas()
    return s


@pytest.fixture(scope="module")
def demo(tmp_path_factory):
    s = Sesion(hoy=date(2026, 10, 17))
    s.cargar_archivo(generar_excel(tmp_path_factory.mktemp("d") / "demo.xlsx"))
    s.aceptar_sugerencias()
    s.fijar_tipo_cambio("USD", 18.5)
    s.confirmar_problemas()
    return s


def _simple(precio_b=10, precio_a=10, costo_b=6, costo_a=6, q_b=100, q_a=100, gasto_b=200, gasto_a=200,
            sin_cantidad=False, sin_producto=False):
    filas = []
    for mes, (p, c, q, g) in {"2026-01": (precio_b, costo_b, q_b, gasto_b), "2026-02": (precio_a, costo_a, q_a, gasto_a)}.items():
        prod = None if sin_producto else "A"
        cant = None if sin_cantidad else q
        filas.append([f"{mes}-05", "venta", prod, cant, p * q, "Ventas", None])
        filas.append([f"{mes}-06", "costo", prod, cant, c * q, "Costo", None])
        filas.append([f"{mes}-07", "gasto", None, None, g, "Renta", None])
    return _ledger(filas)


def test_estado_de_resultados_exacto():
    s = _sesion_df(_simple())
    lib = s.analizar().libro
    assert lib.valor("ventas.base") == 1000
    assert lib.valor("utilidad_bruta.base") == 400
    assert lib.valor("margen_bruto.base") == pytest.approx(0.4)
    assert lib.valor("utilidad_operativa.base") == 200
    assert lib.valor("punto_equilibrio.mensual") == pytest.approx(200 / 0.4)
    # trazabilidad: la utilidad depende de utilidad bruta y gastos, y éstas de filas reales
    arbol = lib.rastrear("utilidad_operativa.base")
    assert {h["clave"] for h in arbol["depende_de"]} == {"utilidad_bruta.base", "gastos_operativos.base"}
    assert lib["ventas.base"].origen == ["datos › fila 2"]


def test_puente_solo_precio():
    s = _sesion_df(_simple(precio_a=11))
    inv = s.investigar()
    efectos = {p["clave"]: p["valor"] for p in inv.puente if p["tipo"] == "efecto"}
    assert inv.modo_puente == "unidades"
    assert efectos["efecto.precio"] == pytest.approx(100)
    assert efectos["efecto.costo"] == pytest.approx(0)
    assert efectos["efecto.volumen"] == pytest.approx(0)


def test_puente_costo_y_volumen_y_gastos():
    s = _sesion_df(_simple(costo_a=7, q_a=150, gasto_a=260))
    inv = s.investigar()
    ef = {p["clave"]: p["valor"] for p in inv.puente if p["tipo"] == "efecto"}
    assert ef["efecto.volumen"] == pytest.approx(50 * 4)
    assert ef["efecto.costo"] == pytest.approx(-150)
    assert ef["efecto.gasto.Renta"] == pytest.approx(-60)
    assert coherente(inv.puente)


@pytest.mark.parametrize("kwargs,modo", [({"sin_cantidad": True}, "porcentajes"), ({"sin_producto": True}, "global")])
def test_puente_cuadra_sin_detalle(kwargs, modo):
    s = _sesion_df(_simple(costo_a=7, q_a=150, gasto_a=260, **kwargs))
    inv = s.investigar()
    assert inv.modo_puente == modo
    assert coherente(inv.puente)
    costos = next(h for h in inv.hipotesis if h.clave == "costos")
    assert costos.datos_faltantes  # dice qué dato falta para separar precio de costo
    assert costos.estado != "respaldada"  # sin unidades no puede afirmarlo


def test_mezcla_detecta_producto_de_bajo_margen():
    filas = []
    for mes, (qa, qb) in {"2026-01": (100, 10), "2026-02": (100, 100)}.items():
        filas += [[f"{mes}-05", "venta", "Alto", qa, qa * 10, "V", None], [f"{mes}-06", "costo", "Alto", qa, qa * 4, "C", None],
                  [f"{mes}-05", "venta", "Bajo", qb, qb * 10, "V", None], [f"{mes}-06", "costo", "Bajo", qb, qb * 9, "C", None]]
    s = _sesion_df(_ledger(filas))
    inv = s.investigar()
    ef = {p["clave"]: p["valor"] for p in inv.puente}
    assert ef["efecto.mezcla"] < 0 and ef["efecto.precio"] == pytest.approx(0)
    assert coherente(inv.puente)


def test_demo_cuenta_la_historia(demo):
    inv = demo.investigar()
    assert inv.hallazgo_inicial.clave == "ventas_suben_utilidad_cae"
    assert coherente(inv.puente)
    estados = {h.clave: h.estado for h in inv.hipotesis}
    assert estados["costos"] == "respaldada"
    assert estados["gastos"] == "respaldada"
    assert estados["precios_mezcla"] == "parcial"
    assert estados["calidad_datos"] in ("parcial", "respaldada")
    assert inv.causas[0]["clave"] == "efecto.costo"
    assert "hipótesis" in inv.conclusion  # separa hechos de hipótesis
    claves = {h.clave for h in inv.hallazgos}
    assert {"margen_bruto_cae", "utilidad_sin_efectivo"} <= claves


def test_flujo_y_dias_de_cobro():
    filas = [["2026-01-01", "venta", None, None, 1000, "V", "2026-01-31"],
             ["2026-02-01", "venta", None, None, 1000, "V", None],
             ["2026-02-02", "gasto", None, None, 300, "G", "2026-02-02"]]
    s = _sesion_df(_ledger(filas))
    lib = s.analizar().libro
    assert lib.valor("dias_cobro.total") == pytest.approx(30)
    assert lib.valor("cxc.final") == 1000
    assert lib.valor("flujo_operativo.total") == pytest.approx(1000 - 300)


def test_escenario_precio_sin_elasticidad(demo):
    base = demo.base_mensual()
    e0 = simular(base, Palancas())
    e1 = simular(base, Palancas(cambio_precio_pct=0.10))
    assert e1.mensual["ventas"] == pytest.approx(e0.mensual["ventas"] * 1.10)
    assert e1.utilidad_mensual - e0.utilidad_mensual == pytest.approx(e0.mensual["ventas"] * 0.10)
    # con elasticidad, menos unidades: también baja el costo
    e2 = simular(base, Palancas(cambio_precio_pct=0.10, elasticidad=-1.0))
    assert e2.mensual["costo_ventas"] == pytest.approx(e0.mensual["costo_ventas"] * 0.9)


def test_rezago_de_cobro_y_necesidad_de_financiamiento(demo):
    base = demo.base_mensual()
    contado = simular(base, Palancas(dias_cobro=0, dias_pago=0, meses=3))
    a_30 = simular(base, Palancas(dias_cobro=30, dias_pago=0, meses=3))
    # todas las ventas de un mes tardan un mes: la transición cuesta la diferencia de un mes de ventas
    v_base = contado.mensual["ventas"]
    assert contado.proyeccion["cobros"].iloc[0] == pytest.approx(v_base)
    assert a_30.proyeccion["cobros"].iloc[1] == pytest.approx(v_base)
    perdida = simular(base, Palancas(cambio_gastos_pct=1.0, meses=3, saldo_inicial=0))
    assert perdida.necesidad_financiamiento > 0
    assert perdida.necesidad_financiamiento == pytest.approx(-perdida.proyeccion["saldo"].min())


def test_precio_para_recuperar_margen(demo):
    base = demo.base_mensual()
    objetivo = demo.analizar().libro.valor("margen_bruto.base")
    x = precio_para_recuperar_margen(base, objetivo)
    assert x is not None and 0 < x < 0.5
    from analista_financiero.escenarios import resultado_mensual
    assert resultado_mensual(base, Palancas(cambio_precio_pct=x))["margen_bruto"] == pytest.approx(objetivo, abs=1e-6)


def test_recomendaciones_simuladas_y_ordenadas(demo):
    acciones = demo.recomendar()
    titulos = [a.titulo for a in acciones]
    assert any("Renegociar el costo de Café" in t for t in titulos)
    assert any("precio de Café" in t for t in titulos)
    assert any("Impulsar" in t for t in titulos)
    impactos = [a.impacto_utilidad_mes for a in acciones if a.causa != "calidad_datos"]
    assert impactos == sorted(impactos, reverse=True)
    reneg = next(a for a in acciones if a.titulo.startswith("Renegociar"))
    # recuperar la mitad del aumento de $35 en 420 unidades/mes
    assert reneg.impacto_utilidad_mes == pytest.approx(35 / 2 * 420)
    assert reneg.sensibilidad["recuperas 100%"] == pytest.approx(35 * 420)


def test_siguiente_paso_avanza(tmp_path):
    s = Sesion(hoy=date(2026, 10, 17))
    assert s.siguiente_paso().etapa == 1
    s.cargar_archivo(generar_excel(tmp_path / "d.xlsx"))
    assert s.siguiente_paso().etapa == 2  # columna desconocida
    s.aceptar_sugerencias()
    assert s.siguiente_paso().etapa == 3  # tipo de cambio pendiente
    s.fijar_tipo_cambio("USD", 18.5)
    for p in s.preguntas_pendientes():
        s.responder(p.id, "18.5")
    assert s.siguiente_paso().etapa == 3  # advertencias sin revisar
    s.confirmar_problemas()
    assert s.siguiente_paso().etapa == 4
    s.investigar()
    assert s.siguiente_paso().etapa == 6
    s.recomendar()
    assert s.siguiente_paso().etapa == 7
    s.simular(Palancas(cambio_precio_pct=0.05))
    assert s.siguiente_paso().etapa == 8


def test_captura_manual():
    s = Sesion()
    s.cargar_manual([{"mes": "2026-01", "ventas": 1000, "costo_ventas": 600, "gastos": 300},
                     {"mes": "2026-02", "ventas": 1200, "costo_ventas": 780, "gastos": 320}])
    s.confirmar_problemas()
    lib = s.analizar().libro
    assert lib.valor("utilidad_operativa.base") == 100
    assert lib.valor("utilidad_operativa.actual") == 100
    assert s.investigar().modo_puente == "global"
    assert coherente(s.investigar().puente)


def test_resultados_viejos_no_sobreviven_a_confirmar(tmp_path):
    """La interfaz puede dejar guardado un resultado calculado antes de confirmar los problemas."""
    s = Sesion(hoy=date(2026, 10, 17))
    s.cargar_archivo(generar_excel(tmp_path / "d.xlsx"))
    s.aceptar_sugerencias()
    s.fijar_tipo_cambio("USD", 18.5)
    viejo = s.analizar()
    inv_vieja = s.investigar()
    assert viejo.confianza == "provisional"
    s.confirmar_problemas()
    s.resultados, s.investigacion = viejo, inv_vieja  # escritura tardía de una ejecución anterior
    assert s.analizar().confianza == "confiable"
    assert s.investigar() is not inv_vieja
    assert s.recomendar() and s.base_mensual() is s.base_mensual()
