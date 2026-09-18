"""Análisis cuantitativo extendido: tendencia, momentum, valuación y riesgo.

A diferencia de `multiples.py` (que solo decide si algo está "estirado"),
este módulo arma un reporte completo por emisora, pensado para mandarse
periódicamente (no sólo cuando hay alerta).
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd

from .multiples import StretchResult

_TRADING_DAYS = {
    "1d": 1,
    "1w": 5,
    "1m": 21,
    "6m": 126,
    "1y": 252,
}


@dataclass
class QuantReport:
    ticker: str
    price: float
    sma20: float | None
    sma50: float | None
    sma200: float | None
    trend_label: str
    cross_signal: str | None
    rsi14: float | None
    returns_pct: dict[str, float | None]
    volatility_annualized_pct: float | None
    drawdown_52w_pct: float | None
    trailing_pe: float | None
    forward_pe: float | None
    price_to_book: float | None
    dividend_yield_pct: float | None
    market_cap: float | None
    stretch_score: float


def _sma(prices: pd.Series, window: int) -> float | None:
    tail = prices.tail(window)
    if len(tail) < window:
        return None
    return float(tail.mean())


def _rsi(prices: pd.Series, period: int = 14) -> float | None:
    if len(prices) < period + 1:
        return None
    delta = prices.diff().dropna()
    gain = delta.clip(lower=0)
    loss = -delta.clip(upper=0)
    avg_gain = gain.rolling(period).mean().iloc[-1]
    avg_loss = loss.rolling(period).mean().iloc[-1]
    if avg_loss == 0:
        return 100.0
    rs = avg_gain / avg_loss
    return float(100 - (100 / (1 + rs)))


def _return_over(prices: pd.Series, trading_days: int) -> float | None:
    if len(prices) <= trading_days:
        return None
    past = prices.iloc[-1 - trading_days]
    if past == 0:
        return None
    return float((prices.iloc[-1] / past - 1) * 100)


def _volatility_annualized(prices: pd.Series, window: int = 21) -> float | None:
    returns = prices.pct_change().dropna().tail(window)
    if len(returns) < 2:
        return None
    return float(returns.std() * np.sqrt(252) * 100)


def _drawdown_52w(prices: pd.Series) -> float | None:
    window = prices.tail(252)
    if window.empty:
        return None
    high = float(window.max())
    if high == 0:
        return None
    return float((prices.iloc[-1] - high) / high * 100)


def _trend_label(price: float, sma50: float | None, sma200: float | None) -> tuple[str, str | None]:
    if sma50 is None or sma200 is None:
        return "sin suficiente historial", None

    cross_signal = "cruce dorado (SMA50 > SMA200)" if sma50 > sma200 else "cruce de la muerte (SMA50 < SMA200)"

    if price > sma50 > sma200:
        return "alcista: precio por encima de SMA50 y SMA200", cross_signal
    if price < sma50 < sma200:
        return "bajista: precio por debajo de SMA50 y SMA200", cross_signal
    return "mixta/lateral: sin alineación clara entre precio, SMA50 y SMA200", cross_signal


def _dividend_yield_pct(info: dict) -> float | None:
    value = info.get("dividendYield")
    if value is None:
        return None
    value = float(value)
    # yfinance a veces regresa fracción (0.03) y a veces porcentaje (3.0);
    # normalizamos asumiendo que un dividendo > 1 ya viene en por ciento.
    return value if value > 1 else value * 100


def compute_quant_report(
    ticker: str,
    close_prices: pd.Series,
    info: dict,
    stretch: StretchResult,
) -> QuantReport:
    prices = close_prices.dropna()
    price = float(prices.iloc[-1])

    sma20 = _sma(prices, 20)
    sma50 = stretch.sma_short
    sma200 = stretch.sma_long
    trend_label, cross_signal = _trend_label(price, sma50, sma200)

    returns_pct = {label: _return_over(prices, days) for label, days in _TRADING_DAYS.items()}

    return QuantReport(
        ticker=ticker,
        price=price,
        sma20=sma20,
        sma50=sma50,
        sma200=sma200,
        trend_label=trend_label,
        cross_signal=cross_signal,
        rsi14=_rsi(prices),
        returns_pct=returns_pct,
        volatility_annualized_pct=_volatility_annualized(prices),
        drawdown_52w_pct=_drawdown_52w(prices),
        trailing_pe=stretch.trailing_pe,
        forward_pe=stretch.forward_pe,
        price_to_book=stretch.price_to_book,
        dividend_yield_pct=_dividend_yield_pct(info),
        market_cap=info.get("marketCap"),
        stretch_score=stretch.stretch_score,
    )
