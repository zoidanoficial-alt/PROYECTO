from datetime import datetime, timedelta, timezone

import pytest

from cassandra_bmv.state import update_state


def test_first_trigger_starts_streak_at_one():
    state = {}
    now = datetime(2026, 1, 1, tzinfo=timezone.utc)
    streak = update_state(state, "AAA.MX", triggered=True, score=1.8, now=now)
    assert streak.streak_count == 1
    assert streak.triggered_now is True
    assert streak.just_resolved is False
    assert state["AAA.MX"]["streak_count"] == 1


def test_consecutive_triggers_increment_streak_and_keep_first_date():
    state = {}
    day0 = datetime(2026, 1, 1, tzinfo=timezone.utc)
    update_state(state, "AAA.MX", triggered=True, score=1.6, now=day0)

    day3 = day0 + timedelta(days=3)
    streak = update_state(state, "AAA.MX", triggered=True, score=2.1, now=day3)

    assert streak.streak_count == 2
    assert streak.days_since_first == pytest.approx(3.0)
    assert streak.max_score == 2.1


def test_streak_resets_and_resolution_is_flagged():
    state = {}
    day0 = datetime(2026, 1, 1, tzinfo=timezone.utc)
    update_state(state, "AAA.MX", triggered=True, score=1.6, now=day0)
    update_state(state, "AAA.MX", triggered=True, score=1.7, now=day0 + timedelta(days=1))

    resolved_day = day0 + timedelta(days=5)
    streak = update_state(state, "AAA.MX", triggered=False, score=0.4, now=resolved_day)

    assert streak.just_resolved is True
    assert streak.streak_count == 2  # racha que se resolvió
    assert state["AAA.MX"]["streak_count"] == 0

    # el siguiente ciclo sin trigger ya no debe marcar resolución de nuevo
    streak2 = update_state(
        state, "AAA.MX", triggered=False, score=0.3, now=resolved_day + timedelta(days=1)
    )
    assert streak2.just_resolved is False
    assert streak2.streak_count == 0


def test_new_streak_after_resolution_starts_over():
    state = {}
    day0 = datetime(2026, 1, 1, tzinfo=timezone.utc)
    update_state(state, "AAA.MX", triggered=True, score=1.6, now=day0)
    update_state(state, "AAA.MX", triggered=False, score=0.2, now=day0 + timedelta(days=1))

    new_start = day0 + timedelta(days=10)
    streak = update_state(state, "AAA.MX", triggered=True, score=1.9, now=new_start)
    assert streak.streak_count == 1
    assert streak.days_since_first == pytest.approx(0.0)

