import random

from cassandra_bmv.multiples import StretchResult
from cassandra_bmv.state import StreakInfo
from cassandra_bmv.verdict import ValueVerdict
from cassandra_bmv.voice import (
    _tier_for_streak,
    build_alert_message,
    build_verdict_summary_message,
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


def _verdict(ticker, label, score):
    return ValueVerdict(
        ticker=ticker,
        label=label,
        overall_score=score,
        valuation_score=score,
        quality_score=score,
        fcf_yield_score=score,
        stretch_penalty=0.0,
        notes=[],
        insufficient_data=score is None,
    )


def test_verdict_summary_groups_by_label_and_sorts_by_score():
    verdicts = [
        (_verdict("AAA.MX", "MANTENER / vigilar", 55), "Empresa A"),
        (_verdict("BBB.MX", "COMPRA (valor atractivo)", 80), "Empresa B"),
        (_verdict("CCC.MX", "COMPRA (valor atractivo)", 90), "Empresa C"),
        (_verdict("DDD.MX", "EVITAR por ahora", 20), "Empresa D"),
        (_verdict("EEE.MX", "SIN DATOS SUFICIENTES", None), "Empresa E"),
    ]
    msg = build_verdict_summary_message(verdicts)

    assert "5 emisoras analizadas" in msg
    assert "COMPRA (valor atractivo):" in msg
    assert "EVITAR por ahora:" in msg
    assert "SIN DATOS SUFICIENTES:" in msg
    # dentro de COMPRA, la de mayor puntaje (Empresa C, 90) debe salir primero
    idx_c = msg.index("Empresa C")
    idx_b = msg.index("Empresa B")
    assert idx_c < idx_b
