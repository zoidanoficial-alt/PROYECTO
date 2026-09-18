import numpy as np
import pandas as pd

from cassandra_bmv.analysis import compute_quant_report
from cassandra_bmv.multiples import compute_stretch


def _trending_series(start=100.0, drift=0.15, n=280, seed=7) -> pd.Series:
    rng = np.random.default_rng(seed)
    noise = rng.normal(0, 0.5, n)
    values = start + np.cumsum(np.full(n, drift)) + noise
    dates = pd.date_range("2025-01-01", periods=n, freq="D")
    return pd.Series(values, index=dates)


def test_report_uptrend_has_bullish_structure_and_positive_returns():
    prices = _trending_series(drift=0.2)
    info = {"trailingPE": 14.0, "priceToBook": 2.5, "dividendYield": 0.025, "marketCap": 5e9}
    stretch = compute_stretch(
        "TEST.MX", prices, info, pe_normal_range=(8, 20), pb_normal_range=(1, 3.5)
    )
    report = compute_quant_report("TEST.MX", prices, info, stretch)

    assert "alcista" in report.trend_label
    assert report.cross_signal == "cruce dorado (SMA50 > SMA200)"
    assert report.returns_pct["1m"] > 0
    assert report.returns_pct["1y"] > 0
    assert report.dividend_yield_pct == 2.5  # normalizado a porcentaje
    assert report.market_cap == 5e9


def test_report_downtrend_has_bearish_structure_and_negative_returns():
    prices = _trending_series(drift=-0.2)
    info = {}
    stretch = compute_stretch(
        "TEST.MX", prices, info, pe_normal_range=(8, 20), pb_normal_range=(1, 3.5)
    )
    report = compute_quant_report("TEST.MX", prices, info, stretch)

    assert "bajista" in report.trend_label
    assert report.cross_signal == "cruce de la muerte (SMA50 < SMA200)"
    assert report.returns_pct["1m"] < 0


def test_rsi_is_bounded_between_0_and_100():
    prices = _trending_series(drift=0.3, seed=3)
    info = {}
    stretch = compute_stretch(
        "TEST.MX", prices, info, pe_normal_range=(8, 20), pb_normal_range=(1, 3.5)
    )
    report = compute_quant_report("TEST.MX", prices, info, stretch)
    assert report.rsi14 is not None
    assert 0 <= report.rsi14 <= 100


def test_drawdown_is_zero_at_new_high():
    dates = pd.date_range("2025-01-01", periods=280, freq="D")
    prices = pd.Series(np.linspace(50, 150, 280), index=dates)  # nuevo máximo en el último dato
    info = {}
    stretch = compute_stretch(
        "TEST.MX", prices, info, pe_normal_range=(8, 20), pb_normal_range=(1, 3.5)
    )
    report = compute_quant_report("TEST.MX", prices, info, stretch)
    assert report.drawdown_52w_pct == 0.0


def test_short_history_returns_none_for_missing_windows():
    dates = pd.date_range("2025-01-01", periods=10, freq="D")
    prices = pd.Series(np.linspace(100, 105, 10), index=dates)
    info = {}
    stretch = compute_stretch(
        "TEST.MX", prices, info, pe_normal_range=(8, 20), pb_normal_range=(1, 3.5)
    )
    report = compute_quant_report("TEST.MX", prices, info, stretch)
    # sma20 requiere una ventana completa de 20 datos, que no hay
    assert report.sma20 is None
    assert report.returns_pct["1y"] is None
    assert report.rsi14 is None
