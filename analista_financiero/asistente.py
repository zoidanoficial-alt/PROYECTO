"""Asistente conversacional: entiende preguntas, explica resultados y propone investigaciones.

Reparto de responsabilidades:
  - El modelo de lenguaje (Claude) interpreta la pregunta, elige qué consultar
    y redacta la respuesta en lenguaje sencillo.
  - Toda cifra sale de herramientas que llaman al motor determinista
    (`calculos`, `diagnostico`, `escenarios`). El modelo no calcula ni estima
    cifras: el prompt se lo prohíbe y cada número se cita con su clave para
    poder rastrearlo.

Si no hay credenciales de la API de Anthropic, funciona en modo local con un
enrutador de intenciones por palabras clave sobre las mismas herramientas.
"""

from __future__ import annotations

import json
import os
from dataclasses import fields

from .diagnostico import ESTADOS_TEXTO
from .escenarios import Palancas
from .explicar import GLOSARIO, explicar_cifra, explicar_variacion, leccion
from .limites import detectar_temas
from .modelos import fmt_dinero, fmt_pct, normalizar_texto

MODELO = "claude-opus-5-5"

SISTEMA = """Eres un analista financiero que acompaña a dueños de pequeñas y medianas empresas sin formación financiera. Respondes en español claro, como un buen asesor que explica sin tecnicismos y enseña de paso.

Reglas que no se rompen:
1. Nunca calcules, estimes ni inventes cifras. Toda cifra que menciones debe venir de un resultado de herramienta. Si necesitas un número que no tienes, llama a la herramienta adecuada (para escenarios, `simular_escenario`). Si ninguna herramienta lo da, di qué dato falta.
2. Cita entre corchetes la clave de cada cifra que uses, por ejemplo: «el margen bruto bajó a 34.3% [margen_bruto.actual]». Así el usuario puede rastrearla.
3. Separa hechos (cálculos sobre sus datos) de hipótesis (posibles motivos que hay que confirmar). Nunca presentes una hipótesis como hecho.
4. Traduce: no digas solo «el margen bajó 4 puntos»; explica qué significa en pesos, qué lo puede causar y qué comprobar.
5. Si los datos son provisionales (problemas sin confirmar), dilo.
6. En impuestos, créditos, inversiones importantes, temas laborales o información para terceros (auditores, inversionistas), explica lo que muestran los datos pero recomienda revisión profesional.
7. Termina con el siguiente paso recomendado: qué revisar, qué dato aportar o qué alternativa simular.

Sé breve: 3 a 8 frases salvo que pidan detalle."""


class Herramientas:
    """Funciones deterministas expuestas al asistente. Devuelven dicts serializables."""

    def __init__(self, sesion) -> None:
        self.s = sesion

    def resumen_general(self) -> dict:
        inv, res = self.s.investigar(), self.s.analizar()
        return {
            "respuesta_cuanto_gano": inv.respuesta_principal,
            "hallazgo_inicial": None if inv.hallazgo_inicial is None else
            {"titulo": inv.hallazgo_inicial.titulo, "explicacion": inv.hallazgo_inicial.explicacion},
            "otros_hallazgos": [{"titulo": h.titulo, "explicacion": h.explicacion, "evidencia": h.evidencia} for h in inv.hallazgos],
            "conclusion": inv.conclusion,
            "confianza_datos": res.confianza,
            "periodos": {"base": res.periodos.etiqueta("base"), "actual": res.periodos.etiqueta("actual")},
            "datos_faltantes": res.faltantes,
        }

    def listar_cifras(self, filtro: str = "") -> dict:
        lib = self.s.analizar().libro
        f = normalizar_texto(filtro)
        meses = set(self.s.analizar().periodos.meses)
        cifras = [{"clave": c.clave, "nombre": c.nombre, "valor": c.texto(), "periodo": c.periodo}
                  for c in lib.todas()
                  if (not f or f in normalizar_texto(c.clave + " " + c.nombre)) and c.clave.split(".")[-1] not in meses]
        return {"cifras": cifras[:60]}

    def ver_cifra(self, clave: str) -> dict:
        lib = self.s.analizar().libro
        c = lib.get(clave)
        if c is None:
            return {"error": f"No existe la cifra «{clave}». Usa listar_cifras para ver las disponibles."}
        metrica = clave.split(".", 1)[-1] if clave.startswith("var.") else clave.split(".")[0]
        return {"rastreo": lib.rastrear(clave), "explicacion": explicar_cifra(c, lib),
                "variacion": explicar_variacion(lib, metrica) if f"var.{metrica}" in lib else None}

    def investigacion(self) -> dict:
        inv = self.s.investigar()
        return {
            "puente_utilidad": [{"etiqueta": p["etiqueta"], "valor": fmt_dinero(p["valor"]), "clave": p["clave"]} for p in inv.puente],
            "hipotesis": [{"clave": h.clave, "pregunta": h.pregunta, "estado": ESTADOS_TEXTO[h.estado],
                           "efecto_en_utilidad": None if h.impacto is None else fmt_dinero(h.impacto),
                           "resumen": h.resumen, "hechos": h.hechos[:6],
                           "posibles_causas_por_confirmar": h.posibles_causas,
                           "que_comprobar": h.que_comprobar, "datos_faltantes": h.datos_faltantes,
                           "evidencia": h.evidencia} for h in inv.hipotesis],
            "conclusion": inv.conclusion,
        }

    def productos(self) -> dict:
        p = self.s.analizar().productos
        if p is None or p.empty:
            return {"error": "No hay detalle por producto en los datos."}
        filas = []
        for (periodo, prod), f in p.iterrows():
            filas.append({"periodo": periodo, "producto": prod, "ventas": fmt_dinero(f["ventas"]),
                          "costo": fmt_dinero(f["costo"]), "margen_pct": fmt_pct(f["margen_pct"]),
                          "unidades": None if f["unidades"] != f["unidades"] else round(float(f["unidades"])),
                          "precio_unitario": fmt_dinero(f["precio_unitario"], decimales=2),
                          "costo_unitario": fmt_dinero(f["costo_unitario"], decimales=2)})
        return {"productos": filas}

    def problemas_datos(self) -> dict:
        v = self.s.validar()
        return {"calidad": v.calidad, "resumen": v.resumen,
                "problemas": [{"severidad": p.severidad, "titulo": p.titulo, "explicacion": p.explicacion,
                               "accion_tomada": p.accion_tomada, "filas": p.filas[:5]} for p in v.problemas]}

    def acciones_recomendadas(self) -> dict:
        return {"acciones": [{"titulo": a.titulo, "descripcion": a.descripcion,
                              "impacto_utilidad_mensual": fmt_dinero(a.impacto_utilidad_mes),
                              "efectivo_liberado_una_vez": fmt_dinero(a.impacto_caja_unico) if a.impacto_caja_unico else None,
                              "supuestos": a.supuestos, "riesgos": a.riesgos,
                              "sensibilidad": {k: fmt_dinero(v) for k, v in a.sensibilidad.items()},
                              "esfuerzo": a.esfuerzo, "plazo": a.plazo, "primer_paso": a.primer_paso,
                              "requiere_revision_profesional": a.requiere_experto} for a in self.s.recomendar()]}

    def simular_escenario(self, **palancas) -> dict:
        validos = {f.name for f in fields(Palancas)}
        desconocidos = set(palancas) - validos
        if desconocidos:
            return {"error": f"Parámetros desconocidos: {sorted(desconocidos)}"}
        if isinstance(palancas.get("desplazar_mezcla"), list):
            palancas["desplazar_mezcla"] = tuple(palancas["desplazar_mezcla"])
        pal = Palancas(**palancas)
        tabla = self.s.comparar([("Escenario", pal)])
        esc = self.s.simular(pal, "Escenario del asistente")
        return {"comparacion": {n: {"utilidad_mes": fmt_dinero(f["utilidad_mes"]), "ventas_mes": fmt_dinero(f["ventas_mes"]),
                                    "margen_operativo": fmt_pct(f["margen_operativo"]),
                                    "cambio_utilidad_mes": fmt_dinero(f["cambio_utilidad_mes"]),
                                    "caja_generada": fmt_dinero(f["caja_final"]),
                                    "faltante_de_caja": fmt_dinero(f["necesidad_financiamiento"])}
                                for n, f in tabla.iterrows()},
                "supuestos": esc.supuestos}

    def explicar_concepto(self, concepto: str) -> dict:
        clave = normalizar_texto(concepto).replace(" ", "_")
        if clave not in GLOSARIO:
            parecidos = [k for k in GLOSARIO if clave in k or k in clave]
            if not parecidos:
                return {"error": "Concepto no encontrado", "disponibles": list(GLOSARIO)}
            clave = parecidos[0]
        return {"concepto": clave, **GLOSARIO[clave]}

    def siguiente_paso(self) -> dict:
        p = self.s.siguiente_paso()
        return {"etapa": p.etapa, "titulo": p.titulo, "que_hacer": p.que_hacer, "por_que": p.por_que, "falta": p.falta}


_PROP_PCT = {"type": "number", "description": "fracción: 0.05 = +5%, -0.1 = −10%"}
_DICT_PCT = {"type": "object", "additionalProperties": {"type": "number"},
             "description": "por nombre exacto de producto o categoría → fracción"}

DEFINICIONES = [
    {"name": "resumen_general", "description": "Respuesta a «¿cuánto gano?», hallazgos principales, conclusión, confianza de los datos y datos faltantes. Úsala primero si no tienes contexto.",
     "input_schema": {"type": "object", "properties": {}}},
    {"name": "listar_cifras", "description": "Lista cifras calculadas (clave, nombre, valor, periodo). Filtra por texto, p. ej. 'margen' o 'gastos'. Sufijos de clave: .base, .actual, .total; prefijos var. (cambio %), dif. (cambio en pesos), efecto. (puente).",
     "input_schema": {"type": "object", "properties": {"filtro": {"type": "string"}}}},
    {"name": "ver_cifra", "description": "Detalle de una cifra: valor, fórmula, periodo, supuestos, filas de origen, de qué cifras depende y explicación en lenguaje sencillo.",
     "input_schema": {"type": "object", "properties": {"clave": {"type": "string"}}, "required": ["clave"]}},
    {"name": "investigacion", "description": "Puente de utilidad (qué sumó y qué restó entre periodos) y evaluación de hipótesis: costos, gastos, precios y mezcla, calidad de datos.",
     "input_schema": {"type": "object", "properties": {}}},
    {"name": "productos", "description": "Ventas, costo, margen, unidades, precio y costo unitario por producto, en periodo base y actual.",
     "input_schema": {"type": "object", "properties": {}}},
    {"name": "problemas_datos", "description": "Problemas encontrados al validar los datos (duplicados, fechas, monedas, totales) y qué se hizo con ellos.",
     "input_schema": {"type": "object", "properties": {}}},
    {"name": "acciones_recomendadas", "description": "Acciones propuestas con su impacto simulado, supuestos, riesgos, sensibilidad y primer paso.",
     "input_schema": {"type": "object", "properties": {}}},
    {"name": "simular_escenario", "description": "Simula un escenario sobre el mes típico reciente y lo compara con «seguir igual». Todas las palancas son opcionales.",
     "input_schema": {"type": "object", "properties": {
         "cambio_precio_pct": _PROP_PCT, "precio_por_producto": _DICT_PCT,
         "elasticidad": {"type": "number", "description": "cambio % de unidades por 1% de precio; típicamente entre -0.5 y -2"},
         "cambio_volumen_pct": _PROP_PCT, "volumen_por_producto": _DICT_PCT,
         "cambio_costo_unitario_pct": _PROP_PCT, "costo_por_producto": _DICT_PCT,
         "cambio_gastos_pct": _PROP_PCT, "gastos_por_categoria": _DICT_PCT,
         "gastos_monto": {"type": "object", "additionalProperties": {"type": "number"}, "description": "categoría → cambio mensual en pesos (negativo = ahorro)"},
         "desplazar_mezcla": {"type": "array", "items": {"type": ["string", "number"]}, "description": "[producto_origen, producto_destino, fracción]"},
         "dias_cobro": {"type": "number"}, "dias_pago": {"type": "number"},
         "crecimiento_mensual": _PROP_PCT, "meses": {"type": "integer"}, "saldo_inicial": {"type": "number"}}}},
    {"name": "explicar_concepto", "description": "Definición sencilla de un concepto financiero (qué es, cómo se calcula, por qué importa, qué revisar).",
     "input_schema": {"type": "object", "properties": {"concepto": {"type": "string"}}, "required": ["concepto"]}},
    {"name": "siguiente_paso", "description": "Siguiente paso recomendado en la investigación y qué información falta.",
     "input_schema": {"type": "object", "properties": {}}},
]


class Asistente:
    def __init__(self, sesion, usar_claude: bool | None = None) -> None:
        self.s = sesion
        self.h = Herramientas(sesion)
        self.mensajes: list = []
        self.cliente = None
        if usar_claude is not False and (os.environ.get("ANTHROPIC_API_KEY") or os.environ.get("ANTHROPIC_AUTH_TOKEN")):
            try:
                import anthropic
                self.cliente = anthropic.Anthropic()
            except ImportError:
                self.cliente = None

    @property
    def modo(self) -> str:
        return f"Claude ({MODELO})" if self.cliente else "local (sin IA generativa)"

    def responder(self, pregunta: str) -> str:
        avisos = [f"Nota ({t}): {a}" for t, a in detectar_temas(pregunta)]
        texto = self._responder_claude(pregunta) if self.cliente else self._responder_local(pregunta)
        return "\n".join(avisos + [texto])

    # ---------------------------------------------------------------- Claude
    def _ejecutar(self, nombre: str, entrada: dict) -> tuple[str, bool]:
        try:
            resultado = getattr(self.h, nombre)(**(entrada or {}))
            return json.dumps(resultado, ensure_ascii=False, default=str), "error" in resultado
        except Exception as exc:  # el error vuelve al modelo como resultado, no rompe la conversación
            return json.dumps({"error": f"{type(exc).__name__}: {exc}"}, ensure_ascii=False), True

    def _responder_claude(self, pregunta: str) -> str:
        import anthropic

        self.mensajes.append({"role": "user", "content": pregunta})
        for _ in range(12):
            try:
                r = self.cliente.beta.messages.create(
                    model=MODELO, max_tokens=16000, system=SISTEMA, tools=DEFINICIONES,
                    messages=self.mensajes, output_config={"effort": "medium"},
                    betas=["server-side-fallback-2026-07-01"], fallbacks="default",
                )
            except anthropic.APIConnectionError:
                self.mensajes.pop()
                return "No pude conectarme al servicio de IA. Respuesta local:\n" + self._responder_local(pregunta)
            except anthropic.APIStatusError as exc:
                self.mensajes.pop()
                return f"El servicio de IA respondió con error ({exc.status_code}). Respuesta local:\n" + self._responder_local(pregunta)
            if r.stop_reason == "refusal":
                self.mensajes.pop()
                return "El asistente no pudo responder esa pregunta. Respuesta local:\n" + self._responder_local(pregunta)
            # Se guarda el contenido completo (incluye bloques de razonamiento) para la siguiente vuelta.
            self.mensajes.append({"role": "assistant", "content": r.content})
            usos = [b for b in r.content if b.type == "tool_use"]
            if r.stop_reason != "tool_use" or not usos:
                return "".join(b.text for b in r.content if b.type == "text").strip()
            resultados = []
            for b in usos:
                contenido, es_error = self._ejecutar(b.name, b.input)
                resultados.append({"type": "tool_result", "tool_use_id": b.id, "content": contenido, "is_error": es_error})
            self.mensajes.append({"role": "user", "content": resultados})
        return "La consulta requirió demasiados pasos; intenta una pregunta más concreta."

    # ----------------------------------------------------------------- local
    def _responder_local(self, pregunta: str) -> str:
        q = normalizar_texto(pregunta)
        tiene = lambda *pal: any(p in q for p in pal)  # noqa: E731
        if tiene("que pasa si", "simula", "si subo", "si bajo", "si aumento", "si reduzco", "escenario"):
            return self._local_simular(q, pregunta.lower())
        if tiene("por que", "causa", "baj", "cay", "investig", "explica la caida", "que cambio"):
            inv = self.h.investigacion()
            lineas = [inv["conclusion"], ""]
            for h in inv["hipotesis"]:
                lineas.append(f"• {h['pregunta']} → {h['estado']}. {h['resumen']}")
            return "\n".join(lineas)
        if tiene("prestamo", "credito", "financiamiento", "me alcanza", "caja", "efectivo", "liquidez"):
            r = self.h.simular_escenario()
            igual = r["comparacion"]["Seguir igual"]
            return (f"Si sigues como en los últimos meses, la operación dejaría {igual['utilidad_mes']} al mes y en 6 meses "
                    f"habría generado {igual['caja_generada']} de efectivo; el faltante máximo de caja sería "
                    f"{igual['faltante_de_caja']}. Antes de pedir un crédito, conviene atacar las causas (pregunta "
                    "«¿qué hago?») y simular cuánto reducen ese faltante.\nSupuestos: " + " ".join(r["supuestos"][:4]))
        if tiene("que hago", "recomienda", "accion", "mejorar", "debo", "conviene"):
            acc = self.h.acciones_recomendadas()["acciones"]
            if not acc:
                return "No encontré acciones claras: los datos no muestran causas negativas importantes."
            return "\n".join(f"{i}. {a['titulo']}: {a['impacto_utilidad_mensual']} al mes. Primer paso: {a['primer_paso']}"
                             for i, a in enumerate(acc, 1))
        if tiene("error", "duplicad", "problema", "datos", "calidad", "confiable"):
            p = self.h.problemas_datos()
            return f"Calidad de los datos: {p['calidad']}.\n" + "\n".join(
                f"• {x['titulo']}: {x['accion_tomada']}" for x in p["problemas"])
        if tiene("producto", "cual deja", "cual vende", "margen por"):
            filas = self.h.productos().get("productos", [])
            return "\n".join(f"{f['periodo']:<7} {f['producto']:<28} ventas {f['ventas']:>12}  margen {f['margen_pct']:>6}"
                             for f in filas) or "No hay detalle por producto."
        for clave in GLOSARIO:
            nombre = normalizar_texto(GLOSARIO[clave]["nombre"])
            if clave.replace("_", " ") in q or nombre.split(" (")[0] in q:
                lib = self.s.analizar().libro
                texto = leccion(clave)
                for k in (f"{clave}.actual", f"{clave}.total"):
                    if k in lib:
                        texto = explicar_cifra(lib[k], lib) + "\n\n" + texto
                        break
                return texto
        if tiene("siguiente", "ahora que", "que sigue"):
            p = self.h.siguiente_paso()
            return f"{p['titulo']}: {p['que_hacer']} ({p['por_que']})"
        r = self.h.resumen_general()
        return r["respuesta_cuanto_gano"] + ("\n" + r["conclusion"] if r["conclusion"] else "")

    def _local_simular(self, q: str, original: str) -> str:
        import re
        m = re.search(r"(-?\d+(?:[.,]\d+)?)\s*(?:%|por ?ciento)", original)
        pct = float(m.group(1).replace(",", ".")) / 100 if m else 0.05
        if "baj" in q or "reduzc" in q or "menos" in q:
            pct = -abs(pct)
        pal = {}
        if "precio" in q:
            pal = {"cambio_precio_pct": pct, "elasticidad": -0.8}
        elif "gasto" in q:
            pal = {"cambio_gastos_pct": pct}
        elif "costo" in q:
            pal = {"cambio_costo_unitario_pct": pct}
        elif "vend" in q or "volumen" in q or "unidades" in q:
            pal = {"cambio_volumen_pct": pct}
        elif "cobr" in q:
            d = re.search(r"(\d+)\s*dias", q)
            pal = {"dias_cobro": float(d.group(1)) if d else 15.0}
        r = self.h.simular_escenario(**pal)
        lineas = [f"{n}: utilidad/mes {v['utilidad_mes']}, margen {v['margen_operativo']}, caja 6 meses {v['caja_generada']}"
                  for n, v in r["comparacion"].items()]
        return "\n".join(lineas + ["Supuestos:"] + [f"· {s}" for s in r["supuestos"]])
