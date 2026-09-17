import numpy as np
import pandas as pd
import pytest

from cassandra_bmv.multiples import compute_stretch


def _flat_price_series(price: float, n: int = 220) -> pd.Series:
    dates = pd.date_range("2025-01-01", periods=n, freq="D")
    return pd.Series([price] * n, index=dates)


def test_flat_calm_prices_have_low_stretch_score():
    prices = _flat_price_series(100.0)
    info = {"trailingPE": 12.0, "priceToBook": 2.0}
    result = compute_stretch(
        "TEST.MX", prices, info, pe_normal_range=(8, 20), pb_normal_range=(1, 3.5)
    )
    assert result.stretch_score < 0.5
    assert result.breaches == []


def test_price_spike_above_sma_triggers_price_breach():
    dates = pd.date_range("2025-01-01", periods=220, freq="D")
    base = np.random.default_rng(42).normal(loc=100, scale=1.0, size=219).tolist()
    prices = pd.Series(base + [140.0], index=dates)  # spike al final
    info = {}
    result = compute_stretch(
        "TEST.MX", prices, info, pe_normal_range=(8, 20), pb_normal_range=(1, 3.5)
    )
    assert result.price_z_score > 2
    assert any("SMA" in b for b in result.breaches)
    assert result.stretch_score > 0


def test_pe_overshoot_triggers_breach():
    prices = _flat_price_series(100.0)
    info = {"trailingPE": 45.0}  # muy por encima del rango normal (8, 20)
    result = compute_stretch(
        "TEST.MX", prices, info, pe_normal_range=(8, 20), pb_normal_range=(1, 3.5)
    )
    assert result.pe_overshoot > 0
    assert any("P/U" in b for b in result.breaches)


def test_missing_fundamentals_does_not_crash():
    prices = _flat_price_series(50.0)
    info = {}
    result = compute_stretch(
        "TEST.MX", prices, info, pe_normal_range=(8, 20), pb_normal_range=(1, 3.5)
    )
    assert result.trailing_pe is None
    assert result.price_to_book is None
    assert result.stretch_score >= 0


def test_empty_price_history_raises():
    with pytest.raises(ValueError):
        compute_stretch(
            "TEST.MX",
            pd.Series([], dtype=float),
            {},
            pe_normal_range=(8, 20),
            pb_normal_range=(1, 3.5),
        )
