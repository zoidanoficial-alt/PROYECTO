"""Cálculo de múltiplos y de qué tan "estirada" está una emisora.

"Estirado" aquí se refiere a sobreextensión al alza: precio muy por encima de
su propia tendencia y/o múltiplos de valuación muy por encima de un rango
"normal" configurado. Es la señal que dispara la profecía de Casandra.
"""

from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np
import pandas as pd


@dataclass
class StretchResult:
    ticker: str
    price: float
    sma_short: float | None
    sma_long: float | None
    price_z_score: float
    price_vs_sma_long_pct: float | None
    trailing_pe: float | None
    forward_pe: float | None
    price_to_book: float | None
    pe_overshoot: float
    pb_overshoot: float
    stretch_score: float
    breaches: list[str] = field(default_factory=list)

    @property
    def is_stretched_by(self) -> bool:
        return bool(self.breaches)


def _overshoot(value: float | None, normal_range: tuple[float, float]) -> float:
    """Qué tan por encima del techo del rango "normal" está `value`.

    Devuelve 0 si `value` es None o está dentro/por debajo del rango.
    El resultado está normalizado por el ancho del rango, así que 1.0
    significa "un ancho de rango por encima del techo".
    """
    if value is None:
        return 0.0
    lo, hi = normal_range
    width = max(hi - lo, 1e-9)
    if value <= hi:
        return 0.0
    return (value - hi) / width


def compute_stretch(
    ticker: str,
    close_prices: pd.Series,
    info: dict,
    pe_normal_range: tuple[float, float],
    pb_normal_range: tuple[float, float],
    sma_window_short: int = 50,
    sma_window_long: int = 200,
) -> StretchResult:
    if close_prices is None or len(close_prices) == 0:
        raise ValueError(f"No hay historial de precios para {ticker}")

    prices = close_prices.dropna()
    price = float(prices.iloc[-1])

    window_short = prices.tail(sma_window_short)
    window_long = prices.tail(sma_window_long)

    sma_short = float(window_short.mean()) if len(window_short) > 0 else None
    sma_long = float(window_long.mean()) if len(window_long) > 0 else None
    std_long = float(window_long.std()) if len(window_long) > 1 else 0.0

    if sma_long and std_long > 1e-9:
        price_z_score = (price - sma_long) / std_long
    else:
        price_z_score = 0.0

    price_vs_sma_long_pct = (
        (price - sma_long) / sma_long * 100 if sma_long and sma_long > 0 else None
    )

    trailing_pe = info.get("trailingPE")
    forward_pe = info.get("forwardPE")
    price_to_book = info.get("priceToBook")

    trailing_pe = float(trailing_pe) if trailing_pe else None
    forward_pe = float(forward_pe) if forward_pe else None
    price_to_book = float(price_to_book) if price_to_book else None

    pe_for_scoring = trailing_pe if trailing_pe is not None else forward_pe
    pe_overshoot = _overshoot(pe_for_scoring, pe_normal_range)
    pb_overshoot = _overshoot(price_to_book, pb_normal_range)
    price_component = max(price_z_score, 0.0)

    components = []
    weights = []
    breaches: list[str] = []

    components.append(price_component)
    weights.append(0.4)
    if price_component >= 0.75:
        breaches.append(
            f"precio {price_vs_sma_long_pct:+.1f}% vs SMA{sma_window_long} "
            f"({price_z_score:+.2f}σ)"
        )

    if pe_for_scoring is not None:
        components.append(pe_overshoot)
        weights.append(0.35)
        if pe_overshoot >= 0.3:
            label = "P/U" if trailing_pe is not None else "P/U (forward)"
            breaches.append(
                f"{label} en {pe_for_scoring:.1f}x (rango normal "
                f"{pe_normal_range[0]:.0f}x-{pe_normal_range[1]:.0f}x)"
            )

    if price_to_book is not None:
        components.append(pb_overshoot)
        weights.append(0.25)
        if pb_overshoot >= 0.3:
            breaches.append(
                f"P/VL en {price_to_book:.2f}x (rango normal "
                f"{pb_normal_range[0]:.1f}x-{pb_normal_range[1]:.1f}x)"
            )

    weights_arr = np.array(weights, dtype=float)
    weights_arr = weights_arr / weights_arr.sum()
    stretch_score = float(np.dot(np.array(components, dtype=float), weights_arr))

    return StretchResult(
        ticker=ticker,
        price=price,
        sma_short=sma_short,
        sma_long=sma_long,
        price_z_score=price_z_score,
        price_vs_sma_long_pct=price_vs_sma_long_pct,
        trailing_pe=trailing_pe,
        forward_pe=forward_pe,
        price_to_book=price_to_book,
        pe_overshoot=pe_overshoot,
        pb_overshoot=pb_overshoot,
        stretch_score=stretch_score,
        breaches=breaches,
    )
