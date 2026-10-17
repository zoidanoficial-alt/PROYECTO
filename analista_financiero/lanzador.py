"""Punto de entrada del ejecutable (AnalistaFinanciero.exe).

Doble clic: arranca la aplicación web en esta computadora y abre el
navegador. Nada sale de la máquina (salvo el asistente con IA, si el usuario
pone su clave de Anthropic).

    AnalistaFinanciero.exe            # abre la aplicación
    AnalistaFinanciero.exe --prueba   # verificación rápida sin interfaz (la usa la compilación)
    AnalistaFinanciero.exe --version
"""

from __future__ import annotations

import os
import socket
import sys
import tempfile
import threading
import time
import urllib.request
import webbrowser
from pathlib import Path


def _ruta_app() -> Path:
    # En el ejecutable de PyInstaller los archivos viven en sys._MEIPASS.
    base = Path(getattr(sys, "_MEIPASS", Path(__file__).resolve().parent.parent))
    return base / "analista_financiero" / "app.py"


def _puerto_libre(preferido: int = 8501) -> int:
    for puerto in [preferido] + list(range(8502, 8600)):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            try:
                s.bind(("127.0.0.1", puerto))
                return puerto
            except OSError:
                continue
    return preferido


def _abrir_navegador(puerto: int) -> None:
    for _ in range(120):
        try:
            urllib.request.urlopen(f"http://127.0.0.1:{puerto}/_stcore/health", timeout=1)
            break
        except OSError:
            time.sleep(0.5)
    webbrowser.open(f"http://localhost:{puerto}")


def prueba() -> int:
    """Corre el análisis completo con los datos de ejemplo, sin interfaz."""
    from analista_financiero import Sesion, __version__
    from analista_financiero.demo import generar_excel

    destino = Path(tempfile.mkdtemp())
    s = Sesion()
    s.cargar_archivo(generar_excel(destino / "demo.xlsx"))
    s.aceptar_sugerencias()
    s.fijar_tipo_cambio("USD", 18.5)
    s.confirmar_problemas()
    inv = s.investigar()
    informe = s.informe(destino / "informe.html", "Prueba")
    assert inv.puente and informe.stat().st_size > 10_000
    assert _ruta_app().exists(), f"No encuentro {_ruta_app()}"
    import streamlit  # noqa: F401  (confirma que la interfaz quedó empaquetada)
    print(f"OK analista_financiero {__version__}: {inv.hallazgo_inicial.titulo}; informe {informe}")
    return 0


def main() -> int:
    args = sys.argv[1:]
    if "--version" in args:
        from analista_financiero import __version__
        print(__version__)
        return 0
    if "--prueba" in args:
        return prueba()

    from streamlit.web import cli as stcli

    puerto = _puerto_libre()
    print("=" * 64)
    print(" Analista financiero")
    print(f" Abriendo http://localhost:{puerto} en tu navegador...")
    print(" Deja esta ventana abierta mientras uses la aplicación.")
    print(" Para salir, cierra esta ventana.")
    print("=" * 64)
    os.environ.setdefault("STREAMLIT_BROWSER_GATHER_USAGE_STATS", "false")
    # Modo headless evita la pregunta de bienvenida de Streamlit (pide un correo en la consola);
    # el navegador lo abrimos nosotros en cuanto el servidor responde.
    threading.Thread(target=_abrir_navegador, args=(puerto,), daemon=True).start()
    sys.argv = [
        "streamlit", "run", str(_ruta_app()),
        "--global.developmentMode=false",
        "--server.headless=true",
        f"--server.port={puerto}",
        "--server.address=127.0.0.1",
        "--server.fileWatcherType=none",
        "--browser.gatherUsageStats=false",
        "--theme.primaryColor=#c2410c",
        "--client.toolbarMode=minimal",
    ]
    return stcli.main()


if __name__ == "__main__":
    sys.exit(main())
