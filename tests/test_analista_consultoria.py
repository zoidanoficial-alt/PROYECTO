"""Herramientas de trabajo de CIFRAS Consultores: marca, expedientes y plantilla."""

from datetime import date

import openpyxl
import pytest

from analista_financiero import Sesion, expedientes, marca
from analista_financiero.demo import generar_excel
from analista_financiero.plantilla import HOJAS, generar_plantilla


def test_config_de_contacto_ida_y_vuelta(tmp_path):
    assert marca.cargar_config(tmp_path)["correo"] == ""  # sin archivo: campos vacíos
    marca.guardar_config({"consultor": " Ana López ", "correo": "ana@cifras.mx", "otro": "x"}, tmp_path)
    cfg = marca.cargar_config(tmp_path)
    assert cfg["consultor"] == "Ana López" and "otro" not in cfg
    assert marca.linea_contacto(cfg) == "Ana López · ana@cifras.mx"


def test_recursos_de_marca():
    assert "<svg" in marca.svg("logo-claro") and "<svg" in marca.svg("icono")
    assert marca.svg_data_uri("logo-oscuro").startswith("data:image/svg+xml;base64,")


def test_expediente_completo(tmp_path):
    c = expedientes.crear("Café La Montaña, S.A.", "Juan · 555 123", "Cafetería", base=tmp_path)
    assert [x.nombre for x in expedientes.listar(tmp_path)] == ["Café La Montaña, S.A."]
    assert expedientes.abrir(c.carpeta).giro == "Cafetería"
    with pytest.raises(ValueError):
        expedientes.crear("   ", base=tmp_path)

    demo = generar_excel(tmp_path / "demo.xlsx").read_bytes()
    ruta = expedientes.guardar_archivo(c, "ventas.xlsx", demo)
    assert expedientes.guardar_archivo(c, "ventas.xlsx", demo) == ruta  # mismo contenido: no duplica
    otra = expedientes.guardar_archivo(c, "ventas.xlsx", demo + b"x")  # contenido distinto: no sobrescribe
    assert otra != ruta and ruta.read_bytes() == demo
    assert len(expedientes.archivos(c)) == 2

    s = Sesion(hoy=date(2026, 10, 17))
    s.cargar_archivo(ruta)
    s.aceptar_sugerencias()
    s.fijar_tipo_cambio("USD", 18.5)
    s.confirmar_problemas()
    carpeta = expedientes.registrar_entrega(c, s, contacto={"consultor": "Ana López", "correo": "ana@cifras.mx"})
    html = (carpeta / "informe.html").read_text(encoding="utf-8")
    assert "Preparado para Café La Montaña, S.A." in html
    assert "CIFRAS Consultores" in html and "ana@cifras.mx" in html and "confidencial" in html
    assert (carpeta / "trazabilidad.json").exists() and (carpeta / "bitacora.txt").read_text(encoding="utf-8")
    assert expedientes.entregas(c) == [carpeta]


def test_nombre_de_carpeta_seguro(tmp_path):
    c = expedientes.crear('Taller "El Rayo" / Sucursal: Norte?', base=tmp_path)
    assert c.carpeta.parent == tmp_path / "Clientes"
    assert not any(ch in c.carpeta.name for ch in '<>:"/\\|?*')


def test_plantilla_se_lee_sin_preguntas(tmp_path):
    ruta = generar_plantilla(tmp_path / "plantilla.xlsx")
    wb = openpyxl.load_workbook(ruta)
    assert wb.sheetnames == ["Instrucciones", *HOJAS]
    s = Sesion(hoy=date(2026, 10, 17))
    preguntas = s.cargar_archivo(ruta)
    assert preguntas == []  # columnas reconocidas, tipo deducido por hoja, instrucciones ignoradas
    assert {t.hoja for t in s.tablas} == set(HOJAS)
    assert any("Instrucciones" in b for b in s.bitacora)
    v = s.validar()
    assert set(v.limpio["tipo"]) == {"venta", "costo", "gasto"}
