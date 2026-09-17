"""Carga y normaliza la configuración desde un archivo YAML."""

from __future__ import annotations

from dataclasses import dataclass, field

import yaml


@dataclass
class TickerConfig:
    symbol: str
    name: str = ""
    pe_normal_range: tuple[float, float] | None = None
    pb_normal_range: tuple[float, float] | None = None


@dataclass
class Thresholds:
    stretch_score: float = 1.5
    sma_window_short: int = 50
    sma_window_long: int = 200
    lookback_days: int = 400
    default_pe_normal_range: tuple[float, float] = (8.0, 20.0)
    default_pb_normal_range: tuple[float, float] = (1.0, 3.5)


@dataclass
class NotifyConfig:
    console: bool = True
    file_log: str | None = "alerts.log"
    discord_webhook_env: str | None = "DISCORD_WEBHOOK_URL"
    telegram_bot_token_env: str | None = "TELEGRAM_BOT_TOKEN"
    telegram_chat_id_env: str | None = "TELEGRAM_CHAT_ID"


@dataclass
class AppConfig:
    tickers: list[TickerConfig] = field(default_factory=list)
    thresholds: Thresholds = field(default_factory=Thresholds)
    notify: NotifyConfig = field(default_factory=NotifyConfig)
    state_file: str = "state.json"


def _as_range(value) -> tuple[float, float] | None:
    if value is None:
        return None
    lo, hi = value
    return (float(lo), float(hi))


def load_config(path: str) -> AppConfig:
    with open(path, encoding="utf-8") as fh:
        raw = yaml.safe_load(fh) or {}

    thresholds_raw = raw.get("thresholds", {}) or {}
    thresholds = Thresholds(
        stretch_score=float(thresholds_raw.get("stretch_score", 1.5)),
        sma_window_short=int(thresholds_raw.get("sma_window_short", 50)),
        sma_window_long=int(thresholds_raw.get("sma_window_long", 200)),
        lookback_days=int(thresholds_raw.get("lookback_days", 400)),
        default_pe_normal_range=_as_range(thresholds_raw.get("default_pe_normal_range"))
        or (8.0, 20.0),
        default_pb_normal_range=_as_range(thresholds_raw.get("default_pb_normal_range"))
        or (1.0, 3.5),
    )

    notify_raw = raw.get("notify", {}) or {}
    notify = NotifyConfig(
        console=bool(notify_raw.get("console", True)),
        file_log=notify_raw.get("file_log", "alerts.log"),
        discord_webhook_env=notify_raw.get("discord_webhook_env", "DISCORD_WEBHOOK_URL"),
        telegram_bot_token_env=notify_raw.get("telegram_bot_token_env", "TELEGRAM_BOT_TOKEN"),
        telegram_chat_id_env=notify_raw.get("telegram_chat_id_env", "TELEGRAM_CHAT_ID"),
    )

    tickers = []
    for entry in raw.get("tickers", []):
        if isinstance(entry, str):
            tickers.append(TickerConfig(symbol=entry))
            continue
        tickers.append(
            TickerConfig(
                symbol=entry["symbol"],
                name=entry.get("name", ""),
                pe_normal_range=_as_range(entry.get("pe_normal_range")),
                pb_normal_range=_as_range(entry.get("pb_normal_range")),
            )
        )

    return AppConfig(
        tickers=tickers,
        thresholds=thresholds,
        notify=notify,
        state_file=raw.get("state_file", "state.json"),
    )
