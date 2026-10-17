"""Punto de entrada del ejecutable (CIFRAS.exe, CIFRAS Consultores).

Doble clic: abre CIFRAS Consultores en su propia ventana de escritorio, sin
navegador ni ventana negra. Por dentro, la interfaz (Streamlit) corre en un
hilo de este mismo proceso, solo en esta computadora (127.0.0.1), y la
ventana la muestra con WebView2, el componente web de Windows. Si WebView2
no está disponible, se abre Edge en "modo aplicación" y, como último
recurso, el navegador predeterminado.

    CIFRAS.exe                    # abre la aplicación
    CIFRAS.exe --navegador        # la abre en el navegador (respaldo manual)
    CIFRAS.exe --prueba           # verificación del motor sin interfaz (la usa la compilación)
    CIFRAS.exe --prueba-ventana   # abre la ventana, espera a que cargue y la cierra (compilación)
    CIFRAS.exe --version

Nada sale de la máquina, salvo el asistente con IA si el usuario pone su
clave de Anthropic. Lo que pasa en segundo plano se anota en
Documentos/CIFRAS Consultores/registro.log.
"""

from __future__ import annotations

import os
import socket
import subprocess
import sys
import tempfile
import threading
import time
import traceback
import urllib.request
import webbrowser
from pathlib import Path

# Ejecutado como script (desarrollo), el paquete no está en la ruta de importación.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

TITULO = "CIFRAS Consultores"

# Opciones de la interfaz (equivalen a las banderas de `streamlit run`).
OPCIONES_INTERFAZ = {
    "global_developmentMode": False,
    "server_headless": True,  # sin pregunta de bienvenida ni apertura de navegador
    "server_address": "127.0.0.1",  # solo accesible desde esta computadora
    "server_fileWatcherType": "none",
    "runner_fastReruns": False,  # evita dos ejecuciones simultáneas sobre la misma sesión
    "browser_gatherUsageStats": False,
    "theme_base": "light",
    "theme_primaryColor": "#B4532A",
    "theme_textColor": "#0E1A2B",
    "client_toolbarMode": "minimal",
}

PANTALLA_CARGA = """<!doctype html><html><head><meta charset="utf-8"><style>
body{margin:0;height:100vh;display:flex;align-items:center;justify-content:center;
background:#0E1A2B;color:#fff;font-family:'Segoe UI',system-ui,sans-serif}
.c{text-align:center}.l{font-size:56px;font-weight:600;letter-spacing:6px}.l span{color:#E0874F}
.s{letter-spacing:8px;font-size:13px;opacity:.85;margin-top:4px}.m{margin-top:36px;font-size:14px;opacity:.7}
</style></head><body><div class="c"><div class="l">CIFRAS<span>.</span></div>
<div class="s">CONSULTORES</div><div class="m">Iniciando…</div></div></body></html>"""

PANTALLA_ERROR = """<!doctype html><html><head><meta charset="utf-8"></head>
<body style="font-family:'Segoe UI',sans-serif;padding:40px;color:#0E1A2B">
<h2>No se pudo iniciar CIFRAS Consultores</h2>
<p>Cierra esta ventana y vuelve a abrir el programa. Si el problema continúa, envía a soporte el archivo
<code>registro.log</code> de la carpeta Documentos\\CIFRAS Consultores.</p></body></html>"""


# ---------------------------------------------------------------------------
# Utilidades
# ---------------------------------------------------------------------------

def _ruta_app() -> Path:
    # En el ejecutable de PyInstaller los archivos viven en sys._MEIPASS.
    base = Path(getattr(sys, "_MEIPASS", Path(__file__).resolve().parent.parent))
    return base / "analista_financiero" / "app.py"


def _carpeta_trabajo() -> Path:
    try:
        from analista_financiero.marca import carpeta_trabajo
        return carpeta_trabajo()
    except Exception:  # sin carpeta de trabajo no hay registro, pero el programa debe abrir
        return Path(tempfile.gettempdir())


def _preparar_registro() -> Path:
    """Sin consola, stdout/stderr no existen: todo va a registro.log."""
    ruta = _carpeta_trabajo() / "registro.log"
    try:
        if ruta.exists() and ruta.stat().st_size > 2_000_000:
            ruta.unlink()
        archivo = open(ruta, "a", encoding="utf-8", buffering=1)  # noqa: SIM115 (vive todo el proceso)
        archivo.write(f"\n===== {time.strftime('%Y-%m-%d %H:%M:%S')} · inicio =====\n")
        if sys.stdout is None:  # ejecutable de ventana: no hay consola
            sys.stdout = archivo
            sys.stderr = archivo
    except OSError:
        pass
    return ruta


def _puerto_libre(preferido: int = 8501) -> int:
    for puerto in [preferido] + list(range(8502, 8600)):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            try:
                s.bind(("127.0.0.1", puerto))
                return puerto
            except OSError:
                continue
    return preferido


def _servidor_listo(puerto: int, segundos: float = 120) -> bool:
    limite = time.time() + segundos
    while time.time() < limite:
        try:
            with urllib.request.urlopen(f"http://127.0.0.1:{puerto}/_stcore/health", timeout=1) as r:
                if r.status == 200:
                    return True
        except OSError:
            time.sleep(0.4)
    return False


# ---------------------------------------------------------------------------
# Servidor de la interfaz (en un hilo de este proceso)
# ---------------------------------------------------------------------------

def _iniciar_servidor(puerto: int) -> threading.Thread:
    from streamlit import config as st_config
    from streamlit.web import bootstrap

    # Las señales solo se pueden instalar en el hilo principal, que ocupa la ventana.
    bootstrap._set_up_signal_handler = lambda server: None
    app = str(_ruta_app())
    opciones = {**OPCIONES_INTERFAZ, "server_port": puerto}
    # Lo mismo que hace `streamlit run`, sin depender de su línea de comandos.
    st_config._main_script_path = app
    bootstrap.load_config_options(flag_options=opciones)

    def correr() -> None:
        try:
            bootstrap.run(app, False, [], opciones)
        except Exception:
            traceback.print_exc()

    hilo = threading.Thread(target=correr, name="interfaz", daemon=True)
    hilo.start()
    return hilo


# ---------------------------------------------------------------------------
# Formas de mostrar la interfaz
# ---------------------------------------------------------------------------

def _ventana_nativa(url: str, puerto: int, prueba: bool = False) -> int:
    """Ventana de escritorio con WebView2. Lanza excepción si no se puede crear."""
    import webview

    webview.settings["ALLOW_DOWNLOADS"] = True  # informes y plantilla se guardan con el diálogo de Windows
    ventana = webview.create_window(
        TITULO, html=PANTALLA_CARGA, width=1440, height=920, min_size=(1100, 700),
        text_select=True, zoomable=True, background_color="#0E1A2B",
    )
    resultado = {"codigo": 0}

    def al_abrir(v) -> None:
        if not _servidor_listo(puerto):
            print("La interfaz no respondió a tiempo")
            resultado["codigo"] = 1
            v.load_html(PANTALLA_ERROR)
            if prueba:
                v.destroy()
            return
        v.load_url(url)
        if prueba:
            # Comprobación de la compilación: la app debe dibujarse dentro de la ventana.
            limite = time.time() + 120
            texto = ""
            while time.time() < limite:
                try:
                    texto = v.evaluate_js("document.body ? document.body.innerText : ''") or ""
                except Exception:
                    texto = ""
                if "Tus clientes" in texto:
                    break
                time.sleep(1)
            ok = "Tus clientes" in texto
            print(f"PRUEBA-VENTANA {'OK' if ok else 'FALLO'}: {len(texto)} caracteres visibles")
            resultado["codigo"] = 0 if ok else 1
            v.destroy()

    almacen = _carpeta_trabajo() / ".ventana"
    webview.start(al_abrir, ventana, private_mode=False, storage_path=str(almacen))
    return resultado["codigo"]


def _ruta_edge() -> str | None:
    candidatos = [
        Path(os.environ.get("PROGRAMFILES(X86)", r"C:\Program Files (x86)")) / "Microsoft/Edge/Application/msedge.exe",
        Path(os.environ.get("PROGRAMFILES", r"C:\Program Files")) / "Microsoft/Edge/Application/msedge.exe",
        Path(os.environ.get("LOCALAPPDATA", "")) / "Microsoft/Edge/Application/msedge.exe",
    ]
    return next((str(p) for p in candidatos if p.is_file()), None)


def _edge_modo_app(url: str) -> subprocess.Popen | None:
    """Edge sin barra de direcciones ni pestañas; con perfil propio para poder esperar a que se cierre."""
    edge = _ruta_edge()
    if not edge:
        return None
    perfil = _carpeta_trabajo() / ".navegador"
    return subprocess.Popen([edge, f"--app={url}", "--window-size=1440,920", f"--user-data-dir={perfil}",
                             "--no-first-run", "--no-default-browser-check"])


def escritorio(prueba: bool = False, forzar_navegador: bool = False) -> int:
    registro = _preparar_registro()
    puerto = _puerto_libre()
    url = f"http://127.0.0.1:{puerto}"
    print(f"{TITULO}: interfaz en {url}")
    hilo = _iniciar_servidor(puerto)

    if not forzar_navegador:
        try:
            return _ventana_nativa(url, puerto, prueba)
        except Exception:
            print("No se pudo abrir la ventana nativa; se usa el respaldo:")
            traceback.print_exc()
            if prueba:
                return 1

    if not _servidor_listo(puerto):
        print("La interfaz no respondió a tiempo")
        return 1
    proceso = None if forzar_navegador else _edge_modo_app(url)
    if proceso is not None:
        proceso.wait()  # al cerrar la ventana de Edge se cierra el programa
        return 0
    webbrowser.open(url)
    print(f"Abierto en el navegador. Registro: {registro}")
    hilo.join()  # el programa sigue vivo mientras corre la interfaz
    return 0


# ---------------------------------------------------------------------------
# Verificación sin interfaz
# ---------------------------------------------------------------------------

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
    from analista_financiero import marca
    from analista_financiero.plantilla import generar_plantilla
    assert "<svg" in marca.svg("logo-claro") and "CIFRAS" in informe.read_text(encoding="utf-8")
    generar_plantilla(destino / "plantilla.xlsx")
    import altair  # noqa: F401  (las gráficas de la interfaz)
    import jinja2  # noqa: F401
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
        _preparar_registro()
        return prueba()
    return escritorio(prueba="--prueba-ventana" in args, forzar_navegador="--navegador" in args)


if __name__ == "__main__":
    codigo = main()
    sys.stdout and sys.stdout.flush()
    # os._exit: al cerrar la ventana termina también el hilo de la interfaz sin esperas.
    os._exit(codigo)
