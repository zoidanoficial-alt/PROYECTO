"""Persistencia del "historial de profecías" por emisora.

Guarda, por ticker, cuántos ciclos consecutivos lleva disparada la alerta de
estiramiento. Esa racha es lo que usa `voice.py` para volverse cada vez más
dramática: entre más tiempo pase sin que el mercado le dé la razón a Casandra,
más se desespera.
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass
from datetime import datetime, timezone


@dataclass
class StreakInfo:
    ticker: str
    triggered_now: bool
    streak_count: int
    days_since_first: float
    max_score: float
    just_resolved: bool
    """True cuando esta emisora estaba en racha y en este ciclo dejó de estar
    estirada: es el momento en que, narrativamente, "Troya cae"."""


def load_state(path: str) -> dict:
    if not os.path.exists(path):
        return {}
    with open(path, encoding="utf-8") as fh:
        try:
            return json.load(fh)
        except json.JSONDecodeError:
            return {}


def save_state(path: str, state: dict) -> None:
    tmp_path = f"{path}.tmp"
    with open(tmp_path, "w", encoding="utf-8") as fh:
        json.dump(state, fh, indent=2, sort_keys=True, ensure_ascii=False)
    os.replace(tmp_path, path)


def update_state(
    state: dict,
    ticker: str,
    triggered: bool,
    score: float,
    now: datetime | None = None,
) -> StreakInfo:
    now = now or datetime.now(timezone.utc)
    entry = state.get(ticker)

    if triggered:
        if entry and entry.get("streak_count", 0) > 0:
            streak_count = entry["streak_count"] + 1
            first_triggered_at = entry["first_triggered_at"]
            max_score = max(entry.get("max_score", 0.0), score)
        else:
            streak_count = 1
            first_triggered_at = now.isoformat()
            max_score = score

        state[ticker] = {
            "streak_count": streak_count,
            "first_triggered_at": first_triggered_at,
            "last_triggered_at": now.isoformat(),
            "last_checked_at": now.isoformat(),
            "max_score": max_score,
        }
        first_dt = datetime.fromisoformat(first_triggered_at)
        days_since_first = (now - first_dt).total_seconds() / 86400
        return StreakInfo(
            ticker=ticker,
            triggered_now=True,
            streak_count=streak_count,
            days_since_first=days_since_first,
            max_score=max_score,
            just_resolved=False,
        )

    # No está estirada en este ciclo.
    was_streaking = bool(entry and entry.get("streak_count", 0) > 0)
    just_resolved = was_streaking

    prior_streak = entry.get("streak_count", 0) if entry else 0
    prior_first = entry.get("first_triggered_at") if entry else None
    prior_max_score = entry.get("max_score", 0.0) if entry else 0.0

    state[ticker] = {
        "streak_count": 0,
        "first_triggered_at": None,
        "last_triggered_at": entry.get("last_triggered_at") if entry else None,
        "last_checked_at": now.isoformat(),
        "max_score": 0.0,
    }

    days_since_first = 0.0
    if just_resolved and prior_first:
        first_dt = datetime.fromisoformat(prior_first)
        days_since_first = (now - first_dt).total_seconds() / 86400

    return StreakInfo(
        ticker=ticker,
        triggered_now=False,
        streak_count=prior_streak if just_resolved else 0,
        days_since_first=days_since_first,
        max_score=prior_max_score,
        just_resolved=just_resolved,
    )
