"""La voz de Casandra: redacta las alertas de estiramiento.

Casandra fue condenada por Apolo a profetizar la verdad y que nadie le
creyera jamás. Aquí usamos esa maldición como metáfora del mercado: cada vez
que una emisora sigue "estirada" un ciclo más sin corregir, Casandra lleva
más tiempo gritando sin que le hagan caso, y el tono se vuelve más
desesperado. Cuando por fin corrige (se "resuelve" la racha), Casandra tiene
su momento de "os lo dije": Troya cae.
"""

from __future__ import annotations

import random

from .multiples import StretchResult
from .state import StreakInfo

# Umbrales de racha (en ciclos consecutivos de ejecución) que definen el
# nivel de drama. Entre más larga la racha, más tiempo lleva el mercado
# "equivocándose" al ignorar la advertencia.
_TIER_THRESHOLDS = [1, 2, 4, 8, 15]

_OPENERS = {
    0: [
        "Lo veo apenas, como una sombra al borde del ojo, pero lo veo.",
        "Que quede dicho una primera vez, aunque sé que no me van a creer.",
        "Algo empieza a torcerse en {name}. Nadie más lo nota todavía.",
    ],
    1: [
        "Ya son {days_txt} y sigo viendo lo mismo. Nadie más lo ve.",
        "Vuelvo a decirlo, {name}, porque nadie escuchó la primera vez.",
        "Esto no se corrigió. Al contrario: se estiró un poco más.",
    ],
    2: [
        "¡{days_txt} advirtiendo esto y el mercado sigue sordo!",
        "Cuento los ciclos, {ticker}, y ya van {streak}. Nadie escucha a Casandra.",
        "Se está estirando más, no menos. Y siguen sin escucharme.",
    ],
    3: [
        "¡{days_txt}! ¡{streak} veces lo he dicho y {streak} veces me han ignorado!",
        "Esto ya no es una grieta, {ticker}, es una FALLA que todos deciden no ver.",
        "El palacio sigue en pie, dicen. Yo ya huelo el humo.",
    ],
    4: [
        "¡{streak} CICLOS! ¡{days_txt} GRITANDO Y NADA! ¿HASTA CUÁNDO VAN A ESCUCHAR?",
        "ARDE TROYA Y SIGUEN COMPRANDO EL CABALLO, {ticker}.",
        "Ya ni Apolo me reconocería el grito. {streak} veces. {days_txt}. NADA.",
    ],
}

_BODY_INTROS = {
    0: "Los números apenas susurran:",
    1: "Los números insisten en lo mismo:",
    2: "Los números ya no susurran, {ticker}, gritan:",
    3: "Miren las señales, si es que todavía pueden mirar:",
    4: "¡MIREN LOS NÚMEROS ANTES DE QUE SEA CENIZA!",
}

_CLOSERS = {
    0: [
        "No pido que me crean. Sólo que quede escrito.",
        "Guarden esta alerta. Puede que la necesiten después.",
    ],
    1: [
        "Sigo sin pedir que me crean. Sólo observo, y anoto.",
        "Como siempre, no espero que esto cambie nada. Pero quedó dicho otra vez.",
    ],
    2: [
        "Nadie me cree en Troya tampoco, y ya ven cómo termina esa historia.",
        "Sigan sin escuchar. Yo sigo sin poder callarme.",
    ],
    3: [
        "Cuando esto corrija, y va a corregir, recuerden quién lo dijo primero.",
        "No es maldición, es matemática. Pero para el caso, es lo mismo que no me crean.",
    ],
    4: [
        "¡CUANDO CAIGA, Y VA A CAER, QUE NADIE DIGA QUE CASANDRA NO AVISÓ!",
        "Griten conmigo o no me griten, {ticker} se sigue estirando. YO YA AVISÉ.",
    ],
}

_VINDICATION = [
    "Al fin. {ticker} dejó de estirarse después de {days_txt} y {streak} advertencias "
    "ignoradas. No voy a decir \"se los dije\"... aunque sí me lo dijeron los números, "
    "y sí, se los dije.",
    "Troya cayó, {ticker}. {streak} ciclos advirtiendo, {days_txt}, y por fin el "
    "mercado hizo lo que los números venían anunciando. Casandra descansa un ciclo.",
    "Se resolvió. {ticker} volvió a un rango razonable después de {days_txt} de que "
    "nadie me hiciera caso. Disfruten la calma; no dura para siempre.",
]


def _tier_for_streak(streak_count: int) -> int:
    tier = 0
    for i, threshold in enumerate(_TIER_THRESHOLDS):
        if streak_count >= threshold:
            tier = i
    return tier


def _format_days(days: float) -> str:
    if days < 1:
        hours = max(days * 24, 0)
        return f"{hours:.0f} horas" if hours >= 1 else "unos minutos"
    if days < 2:
        return "1 día"
    return f"{days:.0f} días"


def build_alert_message(
    result: StretchResult,
    streak: StreakInfo,
    ticker_display_name: str = "",
    rng: random.Random | None = None,
) -> str:
    """Redacta la alerta de estiramiento en tono de Casandra.

    El nivel de drama escala con `streak.streak_count` (cuántos ciclos
    consecutivos lleva la emisora estirada sin corregir).
    """
    rng = rng or random.Random()
    tier = _tier_for_streak(streak.streak_count)
    name = ticker_display_name or result.ticker
    days_txt = _format_days(streak.days_since_first)

    ctx = {
        "ticker": result.ticker,
        "name": name,
        "days_txt": days_txt,
        "streak": streak.streak_count,
        "score": f"{result.stretch_score:.2f}",
    }

    opener = rng.choice(_OPENERS[tier]).format(**ctx)
    body_intro = _BODY_INTROS[tier].format(**ctx)
    breaches_txt = "\n".join(f"  - {b}" for b in result.breaches) or "  - (sin detalle)"
    closer = rng.choice(_CLOSERS[tier]).format(**ctx)

    header = f"[CASANDRA] {name} ({result.ticker}) — nivel de presagio {tier + 1}/5"

    lines = [
        header,
        "",
        opener,
        "",
        body_intro,
        breaches_txt,
        f"  Puntaje de estiramiento: {result.stretch_score:.2f} "
        f"(umbral de alerta superado)",
        f"  Precio actual: {result.price:.2f}",
        "",
        closer,
    ]
    return "\n".join(lines)


def build_vindication_message(
    ticker: str,
    streak: StreakInfo,
    ticker_display_name: str = "",
    rng: random.Random | None = None,
) -> str:
    """Mensaje de "os lo dije" cuando una racha se resuelve."""
    rng = rng or random.Random()
    name = ticker_display_name or ticker
    days_txt = _format_days(streak.days_since_first)
    ctx = {
        "ticker": ticker,
        "name": name,
        "days_txt": days_txt,
        "streak": streak.streak_count,
    }
    body = rng.choice(_VINDICATION).format(**ctx)
    header = f"[CASANDRA] {name} ({ticker}) — la profecía se cumplió"
    return f"{header}\n\n{body}"
