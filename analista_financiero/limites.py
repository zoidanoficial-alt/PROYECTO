"""Límites del análisis automático y cuándo pedir revisión profesional.

Hacer accesible el análisis no significa sustituir el juicio profesional:
en crédito, inversiones importantes, impuestos o información regulada, el
sistema lo dice explícitamente y prepara la información para un experto.
"""

from __future__ import annotations

import re

from .modelos import normalizar_texto

TEMAS_SENSIBLES = {
    "impuestos": {
        "patron": r"\b(impuesto|impuestos|sat|iva|isr|ieps|declaracion|deducible|deducir|fiscal|cfdi|retencion)\b",
        "aviso": "Los temas fiscales dependen de tu régimen y de reglas que cambian. Este análisis no calcula "
                 "impuestos: valida cualquier decisión con tu contador.",
    },
    "credito": {
        "patron": r"\b(credito|prestamo|financiamiento|deuda|banco|tasa de interes|refinanciar|endeudar)\b",
        "aviso": "Puedo estimar cuánto efectivo te faltaría y cuándo, pero el costo real de un crédito, sus "
                 "garantías y condiciones deben revisarse con un asesor financiero o tu banco.",
    },
    "inversion": {
        "patron": r"\b(invertir|inversion|comprar maquinaria|abrir sucursal|nueva sucursal|expandir|adquirir|comprar (un|una) (local|empresa|negocio))\b",
        "aviso": "Para inversiones importantes conviene un análisis de retorno con flujos proyectados, riesgos y "
                 "alternativas, revisado por un profesional. Puedo preparar los datos base.",
    },
    "regulado": {
        "patron": r"\b(auditoria|dictamen|estados financieros oficiales|inversionistas|socios|reporte regulatorio|cnbv|bolsa)\b",
        "aviso": "La información para terceros (auditores, inversionistas, reguladores) requiere estados "
                 "financieros elaborados y firmados por un contador público.",
    },
    "laboral_legal": {
        "patron": r"\b(despedir|despido|liquidacion laboral|demanda|contrato legal|imss|infonavit)\b",
        "aviso": "Las decisiones laborales y legales tienen implicaciones que este análisis no cubre. Consulta a un abogado o contador.",
    },
}

LIMITES_GENERALES = [
    "El análisis usa solo los datos cargados; no reemplaza la contabilidad formal ni estados financieros auditados.",
    "No calcula impuestos, depreciación ni intereses salvo que vengan como gastos en los datos.",
    "Los escenarios dependen de supuestos (elasticidad, plazos, crecimiento) que deben validarse en la práctica.",
    "Las causas detrás de cada efecto (p. ej. «el proveedor subió precios») son hipótesis hasta confirmarlas.",
]


def detectar_temas(texto: str) -> list[tuple[str, str]]:
    t = normalizar_texto(texto)
    return [(tema, d["aviso"]) for tema, d in TEMAS_SENSIBLES.items() if re.search(d["patron"], t)]


def revisiones_requeridas(investigacion=None, escenario=None, calidad: str = "confiable") -> list[str]:
    avisos = []
    if calidad != "confiable":
        avisos.append("Los datos tienen problemas sin confirmar: las conclusiones son provisionales.")
    if escenario is not None and escenario.necesidad_financiamiento > 0:
        avisos.append(TEMAS_SENSIBLES["credito"]["aviso"])
    if investigacion is not None:
        for h in investigacion.hallazgos:
            if h.clave == "perdida":
                avisos.append("La operación pierde dinero: conviene revisar el plan con un asesor antes de "
                              "comprometer más recursos.")
    return avisos
