"""Descarga de precios y fundamentales para emisoras de la BMV vía Yahoo Finance.

Los tickers de la Bolsa Mexicana de Valores se consultan en Yahoo Finance con
el sufijo ".MX" (p. ej. "AMXL.MX", "WALMEX.MX"). Este módulo normaliza el
símbolo y trae tanto el historial de precios como los múltiplos de valuación
expuestos por yfinance.
"""

from __future__ import annotations

import pandas as pd


def normalize_bmv_ticker(symbol: str) -> str:
    symbol = symbol.strip().upper()
    if not symbol.endswith(".MX"):
        symbol = f"{symbol}.MX"
    return symbol


def fetch_ticker_data(symbol: str, lookback_days: int = 400) -> tuple[pd.Series, dict]:
    """Trae el historial de cierre y la info fundamental de un ticker.

    Se importa yfinance dentro de la función para que el resto del paquete
    (cálculo de múltiplos, voz de Casandra, manejo de estado) se pueda probar
    y usar sin necesidad de tener yfinance instalado.
    """
    try:
        import yfinance as yf
    except ImportError as exc:
        raise RuntimeError(
            "yfinance no está instalado. Corre `pip install -r requirements.txt`."
        ) from exc

    ticker_symbol = normalize_bmv_ticker(symbol)
    ticker = yf.Ticker(ticker_symbol)

    history = ticker.history(period=f"{lookback_days}d", interval="1d")
    if history.empty:
        raise RuntimeError(f"Yahoo Finance no devolvió historial para {ticker_symbol}")

    close_prices = history["Close"]

    try:
        info = ticker.get_info()
    except Exception:
        info = {}

    return close_prices, info
