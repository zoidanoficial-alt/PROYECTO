"""Orquesta un ciclo completo: jala precios, calcula múltiplos, decide si algo
se estiró, actualiza la racha por emisora y despacha la alerta con la voz de
Casandra.

Uso:
    python -m cassandra_bmv.run --config tickers.yaml
    python -m cassandra_bmv.run --config tickers.yaml --loop-interval 3600
"""

from __future__ import annotations

import argparse
import sys
import time
from datetime import datetime, timezone

from .config import AppConfig, load_config
from .fetch import fetch_ticker_data
from .multiples import compute_stretch
from .notify import build_notifiers, dispatch
from .state import load_state, save_state, update_state
from .voice import build_alert_message, build_vindication_message


def run_once(config: AppConfig, state_path: str, dry_run: bool = False) -> int:
    state = load_state(state_path)
    notifiers = [] if dry_run else build_notifiers(config.notify)
    now = datetime.now(timezone.utc)
    alerts_sent = 0

    for ticker_cfg in config.tickers:
        try:
            close_prices, info = fetch_ticker_data(
                ticker_cfg.symbol, config.thresholds.lookback_days
            )
        except Exception as exc:
            print(f"[ERROR] {ticker_cfg.symbol}: no se pudo obtener datos ({exc})")
            continue

        pe_range = ticker_cfg.pe_normal_range or config.thresholds.default_pe_normal_range
        pb_range = ticker_cfg.pb_normal_range or config.thresholds.default_pb_normal_range

        try:
            result = compute_stretch(
                ticker=ticker_cfg.symbol,
                close_prices=close_prices,
                info=info,
                pe_normal_range=pe_range,
                pb_normal_range=pb_range,
                sma_window_short=config.thresholds.sma_window_short,
                sma_window_long=config.thresholds.sma_window_long,
            )
        except Exception as exc:
            print(f"[ERROR] {ticker_cfg.symbol}: no se pudo calcular el estiramiento ({exc})")
            continue

        triggered = result.stretch_score >= config.thresholds.stretch_score
        streak = update_state(state, ticker_cfg.symbol, triggered, result.stretch_score, now)

        if triggered:
            message = build_alert_message(result, streak, ticker_cfg.name)
            print(
                f"[INFO] {ticker_cfg.symbol}: estirado (score={result.stretch_score:.2f}, "
                f"racha={streak.streak_count})"
            )
            dispatch(notifiers, message)
            alerts_sent += 1
        elif streak.just_resolved:
            message = build_vindication_message(ticker_cfg.symbol, streak, ticker_cfg.name)
            print(f"[INFO] {ticker_cfg.symbol}: racha resuelta")
            dispatch(notifiers, message)
            alerts_sent += 1
        else:
            print(f"[INFO] {ticker_cfg.symbol}: sin novedad (score={result.stretch_score:.2f})")

    save_state(state_path, state)
    return alerts_sent


def send_test_notification(config: AppConfig) -> int:
    """Manda un mensaje de prueba por todos los canales configurados.

    Sirve para confirmar que Telegram/Discord/archivo están bien conectados
    sin tener que esperar a que una emisora realmente se estire.
    """
    notifiers = build_notifiers(config.notify)
    if not notifiers:
        print(
            "[WARN] No hay notificadores configurados (revisa 'notify' en tu YAML "
            "y las variables de entorno correspondientes)."
        )
        return 1

    message = (
        "[CASANDRA] Prueba de conexión\n\n"
        "Todavía no veo nada estirado. Sólo confirmo que, cuando lo vea, "
        "vas a poder escucharme por este canal."
    )
    dispatch(notifiers, message)
    print(f"[INFO] Mensaje de prueba enviado a {len(notifiers)} canal(es).")
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Alertas de valuación estirada en la BMV, en tono de Casandra."
    )
    parser.add_argument("--config", default="tickers.yaml", help="Ruta al YAML de configuración")
    parser.add_argument("--state", default=None, help="Ruta al archivo de estado (override)")
    parser.add_argument(
        "--dry-run", action="store_true", help="No envía notificaciones, sólo imprime"
    )
    parser.add_argument(
        "--loop-interval",
        type=int,
        default=None,
        help="Si se da, corre en bucle cada N segundos en vez de una sola vez",
    )
    parser.add_argument(
        "--test-notify",
        action="store_true",
        help="Manda un mensaje de prueba por los canales configurados y termina",
    )
    args = parser.parse_args(argv)

    config = load_config(args.config)
    state_path = args.state or config.state_file

    if args.test_notify:
        return send_test_notification(config)

    if args.loop_interval:
        while True:
            run_once(config, state_path, dry_run=args.dry_run)
            time.sleep(args.loop_interval)
    else:
        run_once(config, state_path, dry_run=args.dry_run)

    return 0


if __name__ == "__main__":
    sys.exit(main())
