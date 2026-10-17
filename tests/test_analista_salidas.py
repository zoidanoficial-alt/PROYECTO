"""Etapa 8 y capa de lenguaje: informe, explicaciones, límites y asistente."""

import json
import re
from datetime import date
from types import SimpleNamespace

import pytest

from analista_financiero import Sesion
from analista_financiero.asistente import Asistente, Herramientas
from analista_financiero.demo import generar_excel
from analista_financiero.explicar import explicar_cifra, explicar_variacion
from analista_financiero.limites import detectar_temas


@pytest.fixture(scope="module")
def demo(tmp_path_factory):
    s = Sesion(hoy=date(2026, 10, 17))
    s.cargar_archivo(generar_excel(tmp_path_factory.mktemp("d") / "demo.xlsx"))
    s.aceptar_sugerencias()
    s.fijar_tipo_cambio("USD", 18.5)
    return s


def test_informe_html(demo, tmp_path):
    ruta = demo.informe(tmp_path / "informe.html", "Café La Montaña")
    html = ruta.read_text(encoding="utf-8")
    assert "Las ventas crecen, pero la utilidad cae" in html
    assert "¿Cuánto estoy ganando realmente?" in html
    assert "Resultado provisional" in html  # hay advertencias sin confirmar
    assert "Anexo B. Trazabilidad" in html and "Plan de acción" in html
    assert not re.search(r"\bnan\b", html, re.IGNORECASE)
    assert "<svg" in html


def test_exportar_json(demo, tmp_path):
    datos = json.loads(demo.exportar_json(tmp_path / "t.json").read_text(encoding="utf-8"))
    ventas = next(c for c in datos["cifras"] if c["clave"] == "ventas.total")
    assert ventas["origen"] and ventas["formula"]
    assert datos["bitacora"]


def test_explicaciones_en_lenguaje_sencillo(demo):
    lib = demo.analizar().libro
    texto = explicar_cifra(lib["margen_bruto.actual"], lib)
    assert "De cada $100" in texto and "PROVISIONAL" in texto
    var = explicar_variacion(lib, "margen_bruto")
    assert "bajó" in var and "equivale a" in var


def test_detecta_temas_que_requieren_profesional():
    temas = {t for t, _ in detectar_temas("¿Puedo deducir el IVA si pido un préstamo al banco?")}
    assert temas == {"impuestos", "credito"}
    assert detectar_temas("¿por qué bajó mi margen?") == []


def test_herramientas_no_inventan_cifras(demo):
    h = Herramientas(demo)
    assert "error" in h.ver_cifra("no.existe")
    r = h.ver_cifra("utilidad_operativa.actual")
    assert r["rastreo"]["formula"] and r["explicacion"]
    sim = h.simular_escenario(cambio_precio_pct=0.05, elasticidad=-0.8)
    assert set(sim["comparacion"]) == {"Seguir igual", "Escenario"}
    assert "error" in h.simular_escenario(inventado=1)


def test_asistente_local(demo):
    a = Asistente(demo, usar_claude=False)
    assert a.modo.startswith("local")
    r = a.responder("¿Por qué bajó mi utilidad si vendo más?")
    assert "Respaldada" in r
    r = a.responder("¿Me conviene pedir un préstamo?")
    assert r.startswith("Nota (credito)")
    assert "faltante" in a.responder("¿Me alcanza el efectivo?")


class _ClienteFalso:
    """Simula la API: primero pide una herramienta, luego responde con texto."""

    def __init__(self, respuestas):
        self.respuestas = list(respuestas)
        self.llamadas = []
        self.beta = SimpleNamespace(messages=SimpleNamespace(create=self._create))

    def _create(self, **kw):
        self.llamadas.append(kw)
        return self.respuestas.pop(0)


def _bloque(**kw):
    return SimpleNamespace(**kw)


def test_asistente_claude_usa_herramientas(demo):
    a = Asistente(demo, usar_claude=False)
    a.cliente = _ClienteFalso([
        SimpleNamespace(stop_reason="tool_use", content=[
            _bloque(type="tool_use", id="t1", name="ver_cifra", input={"clave": "margen_bruto.actual"})]),
        SimpleNamespace(stop_reason="end_turn", content=[_bloque(type="text", text="Tu margen es 30.3% [margen_bruto.actual].")]),
    ])
    r = a.responder("¿cuál es mi margen?")
    assert r == "Tu margen es 30.3% [margen_bruto.actual]."
    segunda = a.cliente.llamadas[1]
    # la lista de mensajes es la misma que sigue creciendo: [usuario, tool_use, tool_result, texto]
    resultado = segunda["messages"][2]["content"][0]
    assert resultado["type"] == "tool_result" and resultado["tool_use_id"] == "t1"
    assert "30.3%" in resultado["content"] and resultado["is_error"] is False
    assert segunda["model"] == "claude-opus-5-5" and segunda["fallbacks"] == "default"


def test_asistente_claude_rechazo_cae_a_local(demo):
    a = Asistente(demo, usar_claude=False)
    a.cliente = _ClienteFalso([SimpleNamespace(stop_reason="refusal", content=[])])
    r = a.responder("¿qué hago?")
    assert "Respuesta local" in r and a.mensajes == []
