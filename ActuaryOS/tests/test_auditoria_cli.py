"""Reproducibilidad, comparación y línea de comandos."""
import json
import shutil
from pathlib import Path

from actuaryos.auditoria import reproducir
from actuaryos.cli import main
from actuaryos.comparar import explicar_cambio
from actuaryos.datos import cargar_triangulo
from actuaryos.reservas import chain_ladder

CASO = Path(__file__).resolve().parents[1] / "casos" / "caso1_seguros_horizonte"
OPC = ["--unidad", "miles", "--moneda", "MXN"]


def test_flujo_completo_y_reproduccion(tmp_path, capsys):
    datos = tmp_path / "pagos.csv"
    shutil.copy(CASO / "pagos_acumulados.csv", datos)
    registro, informe = tmp_path / "registro.json", tmp_path / "informe.md"
    codigo = main(["reservas", str(datos), *OPC, "--metodo", "todos",
                   "--primas", str(CASO / "primas_devengadas.csv"), "--elr", "0.75",
                   "--por-que", "reserva:total", "--registro", str(registro), "--informe", str(informe)])
    salida = capsys.readouterr().out
    assert codigo == 0
    assert "RESERVA TOTAL: $231,369.44 MXN" in salida
    assert "Bornhuetter-Ferguson vs Chain Ladder" in salida
    assert "$231,369.44 MXN" in informe.read_text(encoding="utf-8")

    reg = json.loads(registro.read_text(encoding="utf-8"))
    for corrida in reg["corridas"]:
        ok, detalle = reproducir(corrida)
        assert ok, detalle

    # Si alguien modifica los datos, la reproducción lo detecta.
    datos.write_text(datos.read_text().replace("2024,160", "2024,161"))
    ok, detalle = reproducir(reg["corridas"][0])
    assert not ok and "cambiaron" in detalle[0]
    assert main(["reproducir", str(registro)]) == 1


def test_validar_devuelve_error_con_datos_malos(capsys):
    assert main(["validar", str(CASO / "con_errores" / "hueco_intermedio.csv"), *OPC]) == 1
    assert "PERIODO_INCOMPLETO" in capsys.readouterr().out


def test_bf_sin_supuestos_no_corre(capsys):
    assert main(["reservas", str(CASO / "pagos_acumulados.csv"), *OPC, "--metodo", "bf"]) == 1
    assert "no inventa supuestos" in capsys.readouterr().out


def test_recomendar(capsys):
    assert main(["recomendar", str(CASO / "pagos_acumulados.csv"), *OPC]) == 0
    salida = capsys.readouterr().out
    assert "✔ Chain Ladder" in salida and "✘ Bornhuetter-Ferguson" in salida


def test_explicar_cambio_de_supuesto():
    tri, _ = cargar_triangulo(CASO / "pagos_acumulados.csv", unidad="miles", moneda="MXN")
    texto = explicar_cambio(chain_ladder(tri), chain_ladder(tri, cola=1.02))
    assert "Parámetro «cola»: 1.0 → 1.02" in texto
    assert "reserva:2021: 0.0000 → 4.0000" in texto
