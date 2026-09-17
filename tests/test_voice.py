import random

from cassandra_bmv.multiples import StretchResult
from cassandra_bmv.state import StreakInfo
from cassandra_bmv.voice import (
    _tier_for_streak,
    build_alert_message,
    build_vindication_message,
)


def _result(score=2.0, breaches=None):
    return StretchResult(
        ticker="AAA.MX",
        price=123.45,
        sma_short=110.0,
        sma_long=100.0,
        price_z_score=2.5,
        price_vs_sma_long_pct=23.0,
        trailing_pe=35.0,
        forward_pe=None,
        price_to_book=None,
        pe_overshoot=1.2,
        pb_overshoot=0.0,
        stretch_score=score,
        breaches=breaches if breaches is not None else ["P/U en 35.0x"],
    )


def test_tier_increases_with_streak_length():
    assert _tier_for_streak(1) == 0
    assert _tier_for_streak(2) == 1
    assert _tier_for_streak(4) == 2
    assert _tier_for_streak(8) == 3
    assert _tier_for_streak(20) == 4
    assert _tier_for_streak(100) == 4  # se topa en el nivel máximo


def test_alert_message_contains_ticker_and_breaches():
    streak = StreakInfo(
        ticker="AAA.MX",
        triggered_now=True,
        streak_count=1,
        days_since_first=0.1,
        max_score=2.0,
        just_resolved=False,
    )
    msg = build_alert_message(_result(), streak, "Empresa Ejemplo", rng=random.Random(1))
    assert "AAA.MX" in msg
    assert "P/U en 35.0x" in msg
    assert "nivel de presagio 1/5" in msg


def test_alert_escalates_with_longer_streak():
    short_streak = StreakInfo("AAA.MX", True, 1, 0.5, 1.8, False)
    long_streak = StreakInfo("AAA.MX", True, 20, 25.0, 2.5, False)

    short_msg = build_alert_message(_result(), short_streak, rng=random.Random(1))
    long_msg = build_alert_message(_result(), long_streak, rng=random.Random(1))

    assert "nivel de presagio 1/5" in short_msg
    assert "nivel de presagio 5/5" in long_msg
    # el mensaje de racha larga debe ser mas "gritado" (mas mayusculas)
    def caps_ratio(text):
        letters = [c for c in text if c.isalpha()]
        return sum(1 for c in letters if c.isupper()) / max(len(letters), 1)

    assert caps_ratio(long_msg) > caps_ratio(short_msg)


def test_vindication_message_mentions_streak_and_ticker():
    streak = StreakInfo(
        ticker="AAA.MX",
        triggered_now=False,
        streak_count=6,
        days_since_first=14.0,
        max_score=2.2,
        just_resolved=True,
    )
    msg = build_vindication_message("AAA.MX", streak, "Empresa Ejemplo", rng=random.Random(2))
    assert "AAA.MX" in msg
    assert "la profecía se cumplió" in msg
