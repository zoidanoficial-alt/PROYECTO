from cassandra_bmv.config import AppConfig, NotifyConfig
from cassandra_bmv.run import send_test_notification


def test_send_test_notification_reports_no_channels_when_nothing_configured(capsys):
    config = AppConfig(
        tickers=[],
        notify=NotifyConfig(
            console=False,
            file_log=None,
            discord_webhook_env=None,
            telegram_bot_token_env=None,
            telegram_chat_id_env=None,
        ),
    )
    exit_code = send_test_notification(config)
    assert exit_code == 1
    assert "No hay notificadores configurados" in capsys.readouterr().out


def test_send_test_notification_sends_through_console(capsys):
    config = AppConfig(tickers=[], notify=NotifyConfig(console=True, file_log=None))
    exit_code = send_test_notification(config)
    out = capsys.readouterr().out
    assert exit_code == 0
    assert "Prueba de conexión" in out
    assert "1 canal(es)" in out
