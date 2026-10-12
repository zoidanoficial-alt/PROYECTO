"""Detector de errores: cada problema típico debe reconocerse y explicarse."""
from pathlib import Path

import numpy as np
import pytest

from actuaryos.datos import cargar_triangulo, validar_triangulo
from actuaryos.selector import evaluar_metodos
from actuaryos.triangulo import Triangulo

ERRORES = Path(__file__).resolve().parents[1] / "casos" / "caso1_seguros_horizonte" / "con_errores"
nan = np.nan


def codigos(hallazgos):
    return {h.codigo for h in hallazgos}


def cargar(nombre, **kw):
    kw.setdefault("unidad", "miles")
    kw.setdefault("moneda", "MXN")
    return cargar_triangulo(ERRORES / nombre, **kw)


def test_hueco_intermedio_bloquea_el_calculo():
    tri, h = cargar("hueco_intermedio.csv")
    assert tri is None
    assert "PERIODO_INCOMPLETO" in codigos(h)
    assert "origen 2021" in next(x for x in h if x.codigo == "PERIODO_INCOMPLETO").ubicacion


def test_numeros_con_formato_no_se_corrigen_en_silencio():
    tri, h = cargar("numeros_con_formato.csv")
    assert tri is None
    assert {"NUMERO_CON_FORMATO", "SEPARADOR_AMBIGUO"} <= codigos(h)


def test_limpieza_explicita_queda_registrada_pero_no_resuelve_ambiguedad():
    tri, h = cargar("numeros_con_formato.csv", limpiar_formato=True)
    assert "FORMATO_NUMERICO_LIMPIADO" in codigos(h)
    assert "SEPARADOR_AMBIGUO" in codigos(h)  # «1,96» sigue siendo ambiguo
    assert tri is None


def test_datos_incrementales_detectados_y_acumulables():
    tri, h = cargar("datos_incrementales.csv")
    assert tri is None
    assert "POSIBLES_DATOS_INCREMENTALES" in codigos(h)
    tri, h = cargar("datos_incrementales.csv", incremental=True)
    assert tri is not None
    assert "ACUMULADO_DESDE_INCREMENTALES" in codigos(h)
    assert tri.diagonal().tolist() == [200, 201, 196, 160]


def test_formato_largo_duplicados_y_monedas_mezcladas():
    tri, h = cargar("formato_largo_duplicados_monedas.csv", formato="largo", moneda="sin especificar")
    assert tri is None
    assert {"CELDA_DUPLICADA", "MONEDAS_MEZCLADAS"} <= codigos(h)


def test_factor_atipico_es_advertencia_no_error():
    tri, h = cargar("factor_atipico.csv")
    assert tri is not None
    atipicos = [x for x in h if x.codigo == "FACTOR_ATIPICO"]
    assert len(atipicos) == 1 and atipicos[0].ubicacion == "origen 2023"


def test_mapeo_de_columnas_formato_largo(tmp_path):
    p = tmp_path / "largo.csv"
    p.write_text("anio,meses,pagado\n2023,12,100\n2023,24,150\n2024,12,120\n", encoding="utf-8")
    tri, h = cargar_triangulo(p, formato="largo", unidad="miles", moneda="MXN",
                              columnas={"origen": "anio", "desarrollo": "meses", "valor": "pagado"})
    assert tri is not None, h
    assert tri.edades == (12, 24)
    tri, h = cargar_triangulo(p, formato="largo")
    assert tri is None and "COLUMNA_FALTANTE" in codigos(h)


CASO1 = [[100, 150, 180, 200], [120, 168, 201, nan], [140, 196, nan, nan], [160, nan, nan, nan]]


def test_valor_negativo():
    v = [fila[:] for fila in CASO1]
    v[3][0] = -160
    t = Triangulo(("2021", "2022", "2023", "2024"), (12, 24, 36, 48), v, "miles", "MXN")
    assert "VALOR_NEGATIVO" in codigos(validar_triangulo(t))


def test_acumulado_decreciente_aislado_es_advertencia():
    v = [fila[:] for fila in CASO1]
    v[0][3] = 175  # posible recobro
    t = Triangulo(("2021", "2022", "2023", "2024"), (12, 24, 36, 48), v, "miles", "MXN")
    h = validar_triangulo(t)
    assert "ACUMULADO_DECRECIENTE" in codigos(h)
    assert "POSIBLES_DATOS_INCREMENTALES" not in codigos(h)


def test_unidad_no_declarada():
    t = Triangulo(("2023", "2024"), (12, 24), [[100, 150], [120, nan]])
    assert "UNIDAD_NO_DECLARADA" in codigos(validar_triangulo(t))


def test_selector_explica_lo_que_falta():
    t = Triangulo(("2023", "2024"), (12, 24), [[100, 150], [120, nan]], "miles", "MXN")
    evals = {e.metodo: e for e in evaluar_metodos(t)}
    assert evals["Chain Ladder"].aplicable
    assert not evals["Mack"].aplicable
    bf = evals["Bornhuetter-Ferguson"]
    assert not bf.aplicable
    assert any("primas" in f for f in bf.falta) and any("siniestralidad" in f for f in bf.falta)


@pytest.mark.parametrize("encabezado,edad", [("12", 12), ("24 meses", 24), ("36m", 36)])
def test_encabezados_de_edad(tmp_path, encabezado, edad):
    p = tmp_path / "t.csv"
    p.write_text(f"origen,{encabezado},notas\n2024,100,x\n", encoding="utf-8")
    tri, h = cargar_triangulo(p, unidad="miles", moneda="MXN")
    assert tri.edades == (edad,)
    assert "COLUMNA_IGNORADA" in codigos(h)
