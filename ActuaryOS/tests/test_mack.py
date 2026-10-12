"""Mack contra la referencia publicada: Mack (1993), triángulo de Taylor & Ashe."""
from pathlib import Path

import numpy as np
import pytest

from actuaryos.datos import cargar_triangulo
from actuaryos.reservas import MetodoNoAplicable, chain_ladder, mack
from actuaryos.triangulo import Triangulo

REF = Path(__file__).parent / "referencias" / "genins_taylor_ashe.csv"

# Mack (1993), ASTIN Bulletin 23(2): reserva y error estándar por año de origen.
MACK_1993_EE = [0, 75_535, 121_699, 133_549, 261_406, 411_010, 558_317, 875_328, 971_258, 1_363_155]
MACK_1993_EE_TOTAL = 2_447_095
MACK_1993_RESERVA_TOTAL = 18_680_856


@pytest.fixture(scope="module")
def genins():
    t, h = cargar_triangulo(REF, unidad="unidades", moneda="sin moneda")
    assert t is not None, h
    return t


def test_reserva_total_publicada(genins):
    assert mack(genins)["reserva:total"] == pytest.approx(MACK_1993_RESERVA_TOTAL, abs=1)


def test_error_estandar_por_origen_publicado(genins):
    r = mack(genins)
    obtenido = [round(f["error_estandar"]) for f in r.tabla_origenes]
    assert obtenido == MACK_1993_EE


def test_error_estandar_total_publicado(genins):
    assert round(mack(genins)["error_estandar:total"]) == MACK_1993_EE_TOTAL


def test_intervalo_contiene_la_reserva(genins):
    r = mack(genins)
    assert r["intervalo:total:inferior"] < r["reserva:total"] < r["intervalo:total:superior"]


def test_coincide_con_chainladder_python(genins):
    cl = pytest.importorskip("chainladder")
    ref = cl.Chainladder().fit(cl.load_sample("genins"))
    esperado = np.asarray(ref.ultimate_.values).ravel()
    obtenido = [f["ultimo"] for f in chain_ladder(genins).tabla_origenes]
    assert obtenido == pytest.approx(esperado, rel=1e-10)


def test_extrapolacion_de_sigma_documentada():
    nan = np.nan
    t = Triangulo(("2021", "2022", "2023", "2024"), (12, 24, 36, 48),
                  [[100, 150, 180, 200], [120, 168, 201, nan], [140, 196, nan, nan], [160, nan, nan, nan]],
                  "miles", "MXN")
    r = mack(t)
    assert "SIGMA_EXTRAPOLADA" in [h.codigo for h in r.advertencias]
    assert r.tabla_factores[-1]["sigma2_extrapolada"] is True
    assert r["error_estandar:2021"] == 0


def test_mack_requiere_datos_suficientes():
    t = Triangulo(("2023", "2024"), (12, 24), [[100, 150], [120, np.nan]], "miles", "MXN")
    with pytest.raises(MetodoNoAplicable):
        mack(t)
