"""Etapas 1-2: carga, identificación de columnas y validación."""

from datetime import date

import numpy as np
import openpyxl
import pandas as pd
import pytest

from analista_financiero import Sesion
from analista_financiero.demo import generar_csv, generar_excel
from analista_financiero.ingesta import (IGNORAR, convertir_fecha, convertir_importe, leer_archivo,
                                         proponer_mapeo, tabla_desde_dataframe)
from analista_financiero.validacion import OpcionesValidacion, validar


@pytest.fixture(scope="module")
def excel(tmp_path_factory):
    return generar_excel(tmp_path_factory.mktemp("demo") / "demo.xlsx")


def _sesion(ruta, **tc):
    s = Sesion(hoy=date(2026, 10, 17))
    s.cargar_archivo(ruta)
    s.aceptar_sugerencias()
    for m, v in tc.items():
        s.fijar_tipo_cambio(m, v)
    return s


@pytest.mark.parametrize("texto,esperado", [
    ("$1,234.50", 1234.5), ("1.234,50", 1234.5), ("(1,200)", -1200.0), ("USD 300", 300.0),
    ("-45", -45.0), ("1,5", 1.5), ("12,345", 12345.0), ("", np.nan), ("abc", np.nan), (None, np.nan),
])
def test_convertir_importe(texto, esperado):
    r = convertir_importe(texto)
    assert (np.isnan(r) and np.isnan(esperado)) or r == pytest.approx(esperado)


def test_convertir_fecha_dia_primero_serial_e_invalidas():
    assert convertir_fecha("03/04/2026") == pd.Timestamp("2026-04-03")
    assert convertir_fecha("2026-04-03 00:00:00") == pd.Timestamp("2026-04-03")
    assert convertir_fecha("46115") == pd.Timestamp("2026-04-03")  # número de serie de Excel
    assert pd.isna(convertir_fecha("31/02/2026"))
    assert pd.isna(convertir_fecha("mañana"))


def test_mapeo_de_columnas_y_tipo_por_hoja(excel):
    tablas = {t.hoja: t for t in leer_archivo(excel)}
    ventas = proponer_mapeo(tablas["Ventas"])
    assert ventas.mapeo["Fecha"] == "fecha"
    assert ventas.mapeo["Fecha de cobro"] == "fecha_liquidacion"  # no se confunde con "fecha"
    assert ventas.mapeo["Importe"] == "importe"
    assert ventas.mapeo["Notas internas"] == IGNORAR
    assert "Notas internas" in ventas.desconocidas
    assert ventas.tipo_hoja == "venta"
    assert proponer_mapeo(tablas["Costo de ventas"]).tipo_hoja == "costo"
    assert proponer_mapeo(tablas["Gastos"]).tipo_hoja == "gasto"


def test_detecta_titulo_y_conserva_fila_real(excel):
    """El origen de cada registro apunta a la fila real del Excel (trazabilidad)."""
    s = _sesion(excel)
    mov = s.validar() and s.movimientos
    wb = openpyxl.load_workbook(excel)
    for _, fila in mov.sample(10, random_state=1).iterrows():
        archivo, hoja, num = [p.strip() for p in fila["origen"].split("›")]
        celdas = [c.value for c in wb[hoja][int(num.split()[-1])]]
        assert fila["importe_texto"] in [str(c) for c in celdas] or float(fila["importe"]) in [
            convertir_importe(c) for c in celdas if c is not None]


def test_pregunta_lo_dudoso():
    df = pd.DataFrame({"Fecha": ["01/04/2026"], "Monto": ["100"], "Cosa rara": ["x"]})
    s = Sesion()
    preguntas = s.cargar_dataframe(df, "ventas_abril.csv")
    tipos = {p.tipo for p in preguntas}
    assert "mapeo_columna" in tipos  # «Cosa rara»
    assert s.mapeos["ventas_abril.csv"].tipo_hoja == "venta"  # deducido del nombre del archivo


def test_validacion_detecta_errores_sembrados(excel):
    s = _sesion(excel)
    v = s.validar()
    codigos = {p.codigo for p in v.problemas}
    assert {"total_no_cuadra", "fila_total", "fecha_invalida", "monedas_mezcladas",
            "signo_egreso", "duplicado", "partida_inusual"} <= codigos
    assert v.calidad == "provisional"
    motivos = set(v.excluido["motivo"])
    assert {"fila de total/subtotal", "fecha inválida", "duplicado", "moneda USD sin tipo de cambio"} <= motivos
    # nunca se suma la fila de total ni el duplicado
    assert not v.limpio["producto"].fillna("").str.contains("TOTAL").any()
    total = next(p for p in v.problemas if p.codigo == "total_no_cuadra")
    assert total.importe_afectado == pytest.approx(3500)
    assert "TOTAL VENTAS JUNIO" in total.explicacion
    # pide el tipo de cambio en vez de adivinarlo
    assert any(p.tipo == "tipo_cambio" for p in s.preguntas_pendientes())


def test_tipo_de_cambio_convierte(excel):
    s = _sesion(excel, USD=18.5)
    v = s.validar()
    fila = v.limpio[v.limpio["concepto"] == "Suscripción software contable"]
    assert fila["importe"].iloc[0] == pytest.approx(49 * 18.5)
    assert fila["moneda"].iloc[0] == "MXN"
    assert "monedas_mezcladas" not in {p.codigo for p in v.problemas}


def test_conservar_duplicados_si_el_usuario_lo_pide(excel):
    s = _sesion(excel)
    s.excluir_duplicados = False
    s._invalidar()
    assert "duplicado" not in set(s.validar().excluido["motivo"])


def test_csv_libro_de_movimientos_da_mismo_resultado(excel, tmp_path):
    a = _sesion(excel, USD=18.5)
    b = _sesion(generar_csv(tmp_path / "demo.csv"), USD=18.5)
    for clave in ("ventas.total", "utilidad_operativa.total", "flujo_operativo.total"):
        assert a.analizar().libro.valor(clave) == pytest.approx(b.analizar().libro.valor(clave))


def test_sin_ventas_es_bloqueante():
    df = pd.DataFrame({"Fecha": ["01/04/2026"], "Tipo": ["gasto"], "Importe": ["100"]})
    s = Sesion()
    s.cargar_dataframe(df)
    s.aceptar_sugerencias()
    assert s.validar().calidad == "insuficiente"
    with pytest.raises(ValueError):
        s.analizar()
    assert s.siguiente_paso().etapa == 3


def test_meses_sin_ventas_y_venta_negativa():
    t = tabla_desde_dataframe(pd.DataFrame({
        "Fecha": ["01/01/2026", "01/03/2026", "05/03/2026"], "Tipo": ["venta"] * 3,
        "Importe": ["100", "200", "-50"]}))
    from analista_financiero.ingesta import construir_movimientos
    mov = construir_movimientos([t], {t.nombre: proponer_mapeo(t)})
    v = validar(mov, OpcionesValidacion(hoy=date(2026, 10, 1)))
    codigos = {p.codigo for p in v.problemas}
    assert "mes_sin_ventas" in codigos and "venta_negativa" in codigos
    assert v.limpio["importe"].sum() == pytest.approx(250)  # la devolución resta
