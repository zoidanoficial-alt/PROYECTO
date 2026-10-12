"""Caso 1 — Seguros Horizonte: el motor debe reproducir los resultados esperados."""
import json
from fractions import Fraction
from pathlib import Path

import numpy as np
import pytest

from actuaryos.datos import cargar_triangulo
from actuaryos.informe import a_moneda, informe_markdown
from actuaryos.reservas import MetodoNoAplicable, bornhuetter_ferguson, chain_ladder
from actuaryos.resultado import APROBADO, BORRADOR
from actuaryos.triangulo import Triangulo

CASO = Path(__file__).resolve().parents[1] / "casos" / "caso1_seguros_horizonte"
ESPERADO = json.loads((CASO / "esperado.json").read_text(encoding="utf-8"))
TOL = ESPERADO["tolerancia"]
PRIMAS = {"2021": 270.0, "2022": 300.0, "2023": 340.0, "2024": 390.0}


@pytest.fixture
def tri():
    t, hallazgos = cargar_triangulo(CASO / "pagos_acumulados.csv", unidad="miles", moneda="MXN")
    assert t is not None, hallazgos
    assert hallazgos == []
    return t


def test_carga_respeta_huecos_como_no_observados(tri):
    assert tri.origenes == ("2021", "2022", "2023", "2024")
    assert tri.edades == (12, 24, 36, 48)
    assert np.isnan(tri.valores[3, 1])  # «—» no es cero
    assert tri.diagonal().tolist() == [200, 201, 196, 160]


def test_factores_ponderados_por_volumen(tri):
    r = chain_ladder(tri)
    for periodo, fraccion in ESPERADO["chain_ladder"]["factores_fraccion"].items():
        assert r[f"factor:{periodo}"] == pytest.approx(float(Fraction(fraccion)), abs=1e-12)
        assert r[f"factor:{periodo}"] == pytest.approx(ESPERADO["chain_ladder"]["factores"][periodo], abs=TOL)


def test_ultimos_y_reservas(tri):
    r = chain_ladder(tri)
    for o, v in ESPERADO["chain_ladder"]["ultimo"].items():
        assert r[f"ultimo:{o}"] == pytest.approx(v, abs=TOL)
    for o, v in ESPERADO["chain_ladder"]["reserva"].items():
        assert r[f"reserva:{o}"] == pytest.approx(v, abs=TOL)
    assert r["reserva:total"] == pytest.approx(ESPERADO["chain_ladder"]["reserva_total"], abs=TOL)


def test_presentacion_en_pesos(tri):
    r = chain_ladder(tri)
    assert a_moneda(r["reserva:total"], tri.unidad, tri.moneda) == ESPERADO["chain_ladder"]["presentacion_total"]


def test_cola_es_supuesto_explicito(tri):
    base = chain_ladder(tri)
    con_cola = chain_ladder(tri, cola=1.05)
    assert con_cola["reserva:2021"] == pytest.approx(200 * 0.05)
    for o in tri.origenes:
        assert con_cola[f"ultimo:{o}"] == pytest.approx(base[f"ultimo:{o}"] * 1.05)
    assert any("1.05" in s for s in con_cola.supuestos)
    with pytest.raises(MetodoNoAplicable):
        chain_ladder(tri, cola=0.9)


def test_exclusion_de_factor_documentada(tri):
    r = chain_ladder(tri, excluir={("2021", 12)})
    assert r["factor:12-24"] == pytest.approx((168 + 196) / (120 + 140))
    assert r.parametros["excluir"] == [["2021", 12]]
    assert "excluido" in r.supuestos[1]


def test_advierte_factor_con_una_observacion(tri):
    r = chain_ladder(tri)
    codigos = [h.codigo for h in r.advertencias]
    assert codigos == ["FACTOR_CON_UNA_OBSERVACION"]
    assert "2021" in r.advertencias[0].mensaje


def test_bornhuetter_ferguson(tri):
    r = bornhuetter_ferguson(tri, PRIMAS, 0.75, fuente_supuesto="plan sintético")
    f = [Fraction(200, 180), Fraction(381, 318) * Fraction(200, 180),
         Fraction(514, 360) * Fraction(381, 318) * Fraction(200, 180)]
    esperado = {o: float(Fraction(PRIMAS[o]) * Fraction(3, 4) * (1 - 1 / fda))
                for o, fda in zip(["2022", "2023", "2024"], f)}
    for o, v in esperado.items():
        assert r[f"reserva:{o}"] == pytest.approx(v, abs=1e-9)
    assert r["reserva:2021"] == 0
    assert r["reserva:total"] == pytest.approx(ESPERADO["bornhuetter_ferguson"]["reserva_total"], abs=TOL)
    assert any("plan sintético" in s for s in r.supuestos)


def test_bf_no_inventa_supuestos(tri):
    with pytest.raises(MetodoNoAplicable, match="prima"):
        bornhuetter_ferguson(tri, {"2021": 270.0}, 0.75)
    with pytest.raises(MetodoNoAplicable, match="siniestralidad"):
        bornhuetter_ferguson(tri, PRIMAS, {"2021": 0.7})


def test_por_que_muestra_datos_formula_y_supuestos(tri):
    r = chain_ladder(tri)
    experto = r.por_que("reserva:2024")
    assert "Reserva = Último − Pagado actual" in experto
    assert "160.0000" in experto and "304.1137" in experto
    assert "Supuestos" in experto and "Limitaciones" in experto
    principiante = r.por_que("reserva:2024", modo="principiante")
    assert "falta pagar 144.11 miles" in principiante
    assert "Fórmula" not in principiante
    factor = r.por_que("factor:12-24")
    assert "514.0000" in factor and "360.0000" in factor
    with pytest.raises(KeyError):
        r.por_que("reserva:1999")


def test_resultado_nace_como_borrador_y_requiere_revisor(tri):
    r = chain_ladder(tri)
    assert r.estado == BORRADOR
    with pytest.raises(ValueError):
        r.aprobar("  ")
    r.aprobar("Actuaria responsable", "Factores revisados contra experiencia de la cartera")
    assert r.estado == APROBADO
    assert r.revisiones[0].revisor == "Actuaria responsable"


def test_triangulo_inmutable(tri):
    with pytest.raises(ValueError):
        tri.valores[0, 0] = 0
    otro = Triangulo(tri.origenes, tri.edades, tri.valores, tri.unidad, tri.moneda)
    assert otro.huella() == tri.huella()


def test_informe_usa_cifras_del_motor(tri):
    cl = chain_ladder(tri)
    md = informe_markdown(tri, [cl], [])
    assert "$231,369.44 MXN" in md
    assert "borrador" in md
    assert tri.huella() in md
    assert "2024 concentra el 62%" in md
