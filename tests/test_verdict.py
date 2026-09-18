import numpy as np
import pandas as pd

from cassandra_bmv.analysis import compute_quant_report
from cassandra_bmv.multiples import compute_stretch
from cassandra_bmv.verdict import compute_value_verdict


def _flat_series(price: float, n: int = 280) -> pd.Series:
    dates = pd.date_range("2025-01-01", periods=n, freq="D")
    return pd.Series([price] * n, index=dates)


def _build(price, info, pe_range=(8, 20), pb_range=(1, 3.5)):
    prices = _flat_series(price)
    stretch = compute_stretch("TEST.MX", prices, info, pe_range, pb_range)
    report = compute_quant_report("TEST.MX", prices, info, stretch)
    verdict = compute_value_verdict("TEST.MX", report, stretch, info, pe_range, pb_range)
    return verdict


def test_cheap_quality_low_debt_scores_as_buy():
    info = {
        "trailingPE": 8.0,  # en el piso del rango -> barata
        "priceToBook": 1.0,
        "returnOnEquity": 0.28,
        "profitMargins": 0.22,
        "debtToEquity": 20.0,
        "freeCashflow": 8e8,
        "marketCap": 5e9,  # FCF yield 16%
    }
    verdict = _build(100.0, info)
    assert verdict.overall_score is not None
    assert verdict.overall_score >= 70
    assert verdict.label.startswith("COMPRA")


def test_expensive_low_quality_scores_as_avoid():
    info = {
        "trailingPE": 60.0,  # muy por encima del rango
        "priceToBook": 8.0,
        "returnOnEquity": 0.02,
        "profitMargins": 0.01,
        "debtToEquity": 250.0,
    }
    verdict = _build(100.0, info)
    assert verdict.overall_score is not None
    assert verdict.overall_score < 50
    assert verdict.label.startswith("EVITAR")


def test_missing_all_fundamentals_is_insufficient_data():
    verdict = _build(100.0, {})
    assert verdict.insufficient_data is True
    assert verdict.overall_score is None
    assert verdict.label == "SIN DATOS SUFICIENTES"


def test_stretched_price_penalizes_an_otherwise_good_score():
    info = {
        "trailingPE": 8.0,
        "priceToBook": 1.0,
        "returnOnEquity": 0.28,
        "profitMargins": 0.22,
        "debtToEquity": 20.0,
    }
    calm = _build(100.0, info)

    # Ahora simulamos que el precio se disparó muy por encima de su tendencia
    dates = pd.date_range("2025-01-01", periods=280, freq="D")
    values = [100.0] * 279 + [250.0]
    prices = pd.Series(values, index=dates)
    stretch = compute_stretch("TEST.MX", prices, info, (8, 20), (1, 3.5))
    report = compute_quant_report("TEST.MX", prices, info, stretch)
    stretched = compute_value_verdict("TEST.MX", report, stretch, info, (8, 20), (1, 3.5))

    assert stretched.stretch_penalty > calm.stretch_penalty
    assert stretched.overall_score < calm.overall_score
