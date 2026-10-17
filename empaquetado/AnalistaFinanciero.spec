# Especificación de PyInstaller para AnalistaFinanciero.exe
#   pyinstaller --noconfirm empaquetado/AnalistaFinanciero.spec
# Genera un solo archivo en dist/ (en Windows: dist/AnalistaFinanciero.exe).

from pathlib import Path

from PyInstaller.utils.hooks import collect_all, copy_metadata

raiz = Path(SPECPATH).parent  # noqa: F821  (SPECPATH lo define PyInstaller)

datas, binaries, ocultos = [], [], []
for paquete in ("streamlit", "altair", "pyarrow", "pydeck"):
    d, b, h = collect_all(paquete)
    datas += d
    binaries += b
    ocultos += h
datas += copy_metadata("streamlit")
# app.py se ejecuta como script con `streamlit run`: debe viajar como archivo.
datas += [(str(raiz / "analista_financiero"), "analista_financiero")]
ocultos += ["analista_financiero." + m for m in (
    "asistente", "calculos", "demo", "diagnostico", "escenarios", "explicar", "informe",
    "ingesta", "limites", "modelos", "recomendaciones", "sesion", "validacion", "cli")]
ocultos += ["openpyxl", "anthropic"]

a = Analysis(  # noqa: F821
    [str(raiz / "analista_financiero" / "lanzador.py")],
    pathex=[str(raiz)],
    binaries=binaries,
    datas=datas,
    hiddenimports=ocultos,
    excludes=["tkinter", "matplotlib", "IPython", "pytest", "yfinance"],
)
pyz = PYZ(a.pure)  # noqa: F821
exe = EXE(  # noqa: F821
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name="AnalistaFinanciero",
    console=True,  # la ventana negra indica que la app sigue abierta; cerrarla la apaga
    upx=False,
)
