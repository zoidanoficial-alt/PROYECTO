"""Veredicto cuantitativo al estilo "value investing": ¿está barata, es un
buen negocio, y no la estás comprando ya inflada?

Esto NO es Warren Buffett, ni asesoría financiera. Es una heurística que
traduce a números los principios que suele usar el value investing (margen
de seguridad, calidad del negocio, no perseguir precios ya estirados) para
dar una recomendación de referencia: COMPRA, MANTENER o EVITAR.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from .analysis import QuantReport
from .multiples import StretchResult

_STRETCH_PENALTY_PER_POINT = 15.0
_STRETCH_PENALTY_CAP = 30.0


@dataclass
class ValueVerdict:
    ticker: str
    label: str
    overall_score: float | None
    valuation_score: float | None
    quality_score: float | None
    fcf_yield_score: float | None
    stretch_penalty: float
    notes: list[str] = field(default_factory=list)
    insufficient_data: bool = False


def _range_score(value: float | None, lo: float, hi: float) -> float | None:
    """100 si `value` está en o por debajo de `lo` (barata), 0 si está en o
    por encima de `hi` (cara), lineal en medio."""
    if value is None:
        return None
    if value <= lo:
        return 100.0
    if value >= hi:
        return 0.0
    return (hi - value) / (hi - lo) * 100


def _linear_score(value: float | None, lo: float, hi: float) -> float | None:
    """0 si `value` <= lo, 100 si `value` >= hi, lineal en medio."""
    if value is None:
        return None
    if value <= lo:
        return 0.0
    if value >= hi:
        return 100.0
    return (value - lo) / (hi - lo) * 100


def _weighted_average(components: list[tuple[float | None, float]]) -> float | None:
    available = [(score, weight) for score, weight in components if score is not None]
    if not available:
        return None
    total_weight = sum(weight for _, weight in available)
    return sum(score * weight for score, weight in available) / total_weight


def compute_value_verdict(
    ticker: str,
    report: QuantReport,
    stretch: StretchResult,
    info: dict,
    pe_normal_range: tuple[float, float],
    pb_normal_range: tuple[float, float],
) -> ValueVerdict:
    notes: list[str] = []

    # --- Valuación: ¿está barata dentro de su propio rango normal? ---
    pe_score = _range_score(report.trailing_pe, *pe_normal_range)
    pb_score = _range_score(report.price_to_book, *pb_normal_range)
    valuation_score = _weighted_average([(pe_score, 0.6), (pb_score, 0.4)])

    if report.trailing_pe is not None:
        notes.append(
            f"P/U {report.trailing_pe:.1f}x vs. rango normal "
            f"{pe_normal_range[0]:.0f}x-{pe_normal_range[1]:.0f}x"
        )
    if report.price_to_book is not None:
        notes.append(
            f"P/VL {report.price_to_book:.2f}x vs. rango normal "
            f"{pb_normal_range[0]:.1f}x-{pb_normal_range[1]:.1f}x"
        )

    # --- Calidad del negocio: rentabilidad y nivel de deuda ---
    roe = info.get("returnOnEquity")
    roe_pct = roe * 100 if roe is not None else None
    roe_score = _linear_score(roe_pct, 0, 25)
    if roe_pct is not None:
        notes.append(f"ROE {roe_pct:.1f}% (rentabilidad sobre capital)")

    margin = info.get("profitMargins")
    margin_pct = margin * 100 if margin is not None else None
    margin_score = _linear_score(margin_pct, 0, 20)
    if margin_pct is not None:
        notes.append(f"Margen neto {margin_pct:.1f}%")

    debt_to_equity = info.get("debtToEquity")
    debt_score = None
    if debt_to_equity is not None:
        debt_score = 100 - (_linear_score(debt_to_equity, 0, 150) or 0)
        notes.append(f"Deuda/Capital {debt_to_equity:.0f}%")

    quality_score = _weighted_average(
        [(roe_score, 0.4), (margin_score, 0.3), (debt_score, 0.3)]
    )

    # --- Generación real de efectivo (FCF yield) ---
    free_cashflow = info.get("freeCashflow")
    market_cap = info.get("marketCap") or report.market_cap
    fcf_yield_score = None
    if free_cashflow is not None and market_cap:
        fcf_yield_pct = free_cashflow / market_cap * 100
        fcf_yield_score = _linear_score(fcf_yield_pct, 0, 8)
        notes.append(f"Rendimiento de flujo de efectivo libre {fcf_yield_pct:.1f}%")

    # --- Penalización por estar comprando algo ya estirado ---
    stretch_penalty = min(
        max(stretch.stretch_score, 0.0) * _STRETCH_PENALTY_PER_POINT, _STRETCH_PENALTY_CAP
    )
    if stretch_penalty > 1:
        notes.append(
            f"Penalización de {stretch_penalty:.0f} pts por estiramiento de precio "
            f"(puntaje {stretch.stretch_score:.2f}): comprar algo ya muy corrido "
            f"reduce el margen de seguridad"
        )

    base_score = _weighted_average(
        [(valuation_score, 0.45), (quality_score, 0.40), (fcf_yield_score, 0.15)]
    )

    insufficient_data = base_score is None
    overall_score = None
    if not insufficient_data:
        overall_score = max(0.0, min(100.0, base_score - stretch_penalty))

    if insufficient_data:
        label = "SIN DATOS SUFICIENTES"
    elif overall_score >= 70:
        label = "COMPRA (valor atractivo)"
    elif overall_score >= 50:
        label = "MANTENER / vigilar"
    else:
        label = "EVITAR por ahora"

    return ValueVerdict(
        ticker=ticker,
        label=label,
        overall_score=overall_score,
        valuation_score=valuation_score,
        quality_score=quality_score,
        fcf_yield_score=fcf_yield_score,
        stretch_penalty=stretch_penalty,
        notes=notes,
        insufficient_data=insufficient_data,
    )
