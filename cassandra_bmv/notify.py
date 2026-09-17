"""Canales de salida para las profecías de Casandra."""

from __future__ import annotations

import os
from abc import ABC, abstractmethod
from datetime import datetime, timezone

import requests

from .config import NotifyConfig


class Notifier(ABC):
    @abstractmethod
    def send(self, message: str) -> None: ...


class ConsoleNotifier(Notifier):
    def send(self, message: str) -> None:
        print(message)
        print("-" * 60)


class FileNotifier(Notifier):
    def __init__(self, path: str):
        self.path = path

    def send(self, message: str) -> None:
        timestamp = datetime.now(timezone.utc).isoformat()
        with open(self.path, "a", encoding="utf-8") as fh:
            fh.write(f"=== {timestamp} ===\n{message}\n\n")


class DiscordWebhookNotifier(Notifier):
    def __init__(self, webhook_url: str):
        self.webhook_url = webhook_url

    def send(self, message: str) -> None:
        # Discord limita cada mensaje a 2000 caracteres.
        payload = {"content": message[:1990]}
        response = requests.post(self.webhook_url, json=payload, timeout=10)
        response.raise_for_status()


class TelegramNotifier(Notifier):
    def __init__(self, bot_token: str, chat_id: str):
        self.bot_token = bot_token
        self.chat_id = chat_id

    def send(self, message: str) -> None:
        url = f"https://api.telegram.org/bot{self.bot_token}/sendMessage"
        response = requests.post(
            url, json={"chat_id": self.chat_id, "text": message[:4000]}, timeout=10
        )
        response.raise_for_status()


def build_notifiers(config: NotifyConfig) -> list[Notifier]:
    notifiers: list[Notifier] = []

    if config.console:
        notifiers.append(ConsoleNotifier())

    if config.file_log:
        notifiers.append(FileNotifier(config.file_log))

    if config.discord_webhook_env:
        webhook_url = os.environ.get(config.discord_webhook_env)
        if webhook_url:
            notifiers.append(DiscordWebhookNotifier(webhook_url))

    if config.telegram_bot_token_env and config.telegram_chat_id_env:
        bot_token = os.environ.get(config.telegram_bot_token_env)
        chat_id = os.environ.get(config.telegram_chat_id_env)
        if bot_token and chat_id:
            notifiers.append(TelegramNotifier(bot_token, chat_id))

    return notifiers


def dispatch(notifiers: list[Notifier], message: str) -> None:
    for notifier in notifiers:
        try:
            notifier.send(message)
        except Exception as exc:  # pragma: no cover - red externa
            print(f"[WARN] No se pudo enviar por {type(notifier).__name__}: {exc}")
