"""Orquestador de la investigación guiada.

Una `Sesion` recorre las etapas del producto y en todo momento sabe cuál es
el siguiente paso recomendado, qué información falta y por qué:

  1. Cargar datos          → leer Excel/CSV o captura manual
  2. Identificar columnas  → proponer mapeo y preguntar lo dudoso
  3. Validar               → errores, duplicados, monedas, totales
  4. Analizar              → indicadores deterministas y trazables
  5. Explicar              → lenguaje sencillo, hechos vs hipótesis
  6. Investigar            → puente de utilidad e hipótesis
  7. Decidir               → acciones simuladas y escenarios
  8. Informe               → documento para presentar a un director
"""

from __future__ import annotations

import json
from datetime import date
from pathlib import Path

import pandas as pd

from . import ingesta
from .calculos import Resultados, calcular
from .diagnostico import Investigacion, investigar
from .escenarios import BaseMensual, Escenario, Palancas, base_desde_resultados, comparar, simular
from .modelos import Paso, Pregunta
from .recomendaciones import Accion, recomendar
from .validacion import OpcionesValidacion, ResultadoValidacion, validar

BIENVENIDA = (
    "Vamos a averiguar cuánto dinero estás ganando realmente. Primero necesito entender cuánto vendes, "
    "cuánto te cuesta vender y qué gastos tiene tu empresa. Puedes subir un Excel o CSV, o introducir "
    "las cifras manualmente. Yo te guío en cada paso."
)


class Sesion:
    def __init__(self, moneda_base: str = "MXN", hoy: date | None = None) -> None:
        self.moneda_base = moneda_base
        self.hoy = hoy
        self.tablas: list[ingesta.TablaCruda] = []
        self.mapeos: dict[str, ingesta.PropuestaMapeo] = {}
        self.preguntas: list[Pregunta] = []
        self.tipos_cambio: dict[str, float] = {}
        self.excluir_duplicados = True
        self.mapeo_confirmado = False
        self.problemas_confirmados = False
        self.movimientos: pd.DataFrame | None = None
        self.validacion: ResultadoValidacion | None = None
        self.resultados: Resultados | None = None
        self.investigacion: Investigacion | None = None
        self.base: BaseMensual | None = None
        self.acciones: list[Accion] = []
        self.escenarios: list[Escenario] = []
        self.bitacora: list[str] = []  # decisiones del usuario, para auditoría

    # ------------------------------------------------------------------ carga
    def cargar_archivo(self, ruta: str | Path) -> list[Pregunta]:
        nuevas = ingesta.leer_archivo(ruta)
        self.bitacora.append(f"Archivo cargado: {Path(ruta).name} ({len(nuevas)} tabla(s))")
        return self._agregar_tablas(nuevas)

    def cargar_dataframe(self, df: pd.DataFrame, nombre: str = "datos") -> list[Pregunta]:
        return self._agregar_tablas([ingesta.tabla_desde_dataframe(df, nombre)])

    def cargar_manual(self, meses: list[dict]) -> list[Pregunta]:
        self.bitacora.append(f"Captura manual de {len(meses)} mes(es)")
        return self._agregar_tablas([ingesta.tabla_desde_captura_manual(meses)])

    def _agregar_tablas(self, tablas: list[ingesta.TablaCruda]) -> list[Pregunta]:
        for t in tablas:
            prop = ingesta.proponer_mapeo(t)
            # Hojas sin fecha ni importe (instrucciones, portadas, notas) no son datos.
            if len(tablas) > 1 and {"fecha", "importe"} <= set(prop.faltantes):
                self.bitacora.append(f"Hoja ignorada por no tener fechas ni importes: {t.nombre}")
                continue
            self.tablas.append(t)
            self.mapeos[t.nombre] = prop
            self.preguntas += ingesta.preguntas_de_mapeo(prop, t)
        self._invalidar()
        self.mapeo_confirmado = not self.preguntas_pendientes()
        return self.preguntas_pendientes()

    def _invalidar(self) -> None:
        self.movimientos = self.validacion = self.resultados = self.investigacion = self.base = None
        self.acciones, self.escenarios = [], []

    # -------------------------------------------------------------- preguntas
    def preguntas_pendientes(self) -> list[Pregunta]:
        return [p for p in self.preguntas if p.respuesta is None]

    def responder(self, pregunta_id: str, respuesta: str) -> None:
        p = next(p for p in self.preguntas if p.id == pregunta_id)
        p.respuesta = respuesta
        tabla = p.contexto.get("tabla")
        if p.tipo == "mapeo_columna":
            self.mapeos[tabla].mapeo[p.contexto["columna"]] = respuesta
            self.mapeos[tabla].confianza[p.contexto["columna"]] = 1.0
        elif p.tipo == "campo_faltante":
            self.mapeos[tabla].mapeo[respuesta] = p.contexto["campo"]
            self.mapeos[tabla].faltantes = [f for f in self.mapeos[tabla].faltantes if f != p.contexto["campo"]]
        elif p.tipo == "tipo_hoja":
            self.mapeos[tabla].tipo_hoja = respuesta
        elif p.tipo == "tipo_cambio":
            self.tipos_cambio[p.contexto["moneda"]] = float(respuesta)
        elif p.tipo == "duplicados":
            self.excluir_duplicados = respuesta == "excluir"
        self.bitacora.append(f"Usuario respondió «{p.texto}» → {respuesta}")
        self._invalidar()

    def aceptar_sugerencias(self) -> None:
        """Acepta todas las interpretaciones propuestas (útil en modo automático/demo)."""
        for p in self.preguntas_pendientes():
            if p.sugerida is not None:
                self.responder(p.id, p.sugerida)
        self.mapeo_confirmado = not self.preguntas_pendientes()

    def confirmar_mapeo(self) -> None:
        self.mapeo_confirmado = True
        self.bitacora.append("Usuario confirmó la interpretación de columnas")

    def fijar_tipo_cambio(self, moneda: str, valor: float) -> None:
        self.tipos_cambio[moneda.upper()] = float(valor)
        self.bitacora.append(f"Tipo de cambio {moneda.upper()} = {valor}")
        self._invalidar()

    def confirmar_problemas(self) -> None:
        """El usuario revisó las advertencias y acepta cómo se trataron."""
        self.problemas_confirmados = True
        self.bitacora.append("Usuario revisó y aceptó el tratamiento de los problemas de datos")
        self.resultados = self.investigacion = self.base = None
        self.acciones, self.escenarios = [], []

    # ----------------------------------------------------------------- etapas
    def validar(self) -> ResultadoValidacion:
        if self.validacion is None:
            self.movimientos = ingesta.construir_movimientos(self.tablas, self.mapeos, self.moneda_base)
            op = OpcionesValidacion(self.moneda_base, dict(self.tipos_cambio), self.excluir_duplicados, self.hoy)
            self.validacion = validar(self.movimientos, op)
            for prob in self.validacion.problemas:
                if prob.codigo == "monedas_mezcladas":
                    moneda = prob.titulo.split(" en ")[-1]
                    pid = f"tc::{moneda}"
                    if not any(q.id == pid for q in self.preguntas):
                        self.preguntas.append(Pregunta(
                            pid, "tipo_cambio", f"¿Qué tipo de cambio uso para {moneda} → {self.moneda_base}?",
                            "Sin tipo de cambio no puedo sumar esas operaciones con las demás.",
                            contexto={"moneda": moneda}))
        return self.validacion

    def _confianza(self) -> str:
        cal = self.validar().calidad
        if cal == "provisional" and self.problemas_confirmados:
            return "confiable"
        return cal

    # Cada resultado derivado recuerda de qué resultado salió: si la interfaz (que puede
    # correr dos veces en paralelo) dejó guardado algo de un estado anterior, se recalcula.
    def analizar(self) -> Resultados:
        val = self.validar()
        confianza = self._confianza()
        if self.resultados is None or self.resultados.confianza != confianza:
            if val.calidad == "insuficiente":
                raise ValueError("Los datos no alcanzan para analizar: " +
                                 "; ".join(p.titulo for p in val.bloqueantes))
            self.resultados = calcular(val.limpio, confianza, val.supuestos, self.moneda_base)
        return self.resultados

    def investigar(self) -> Investigacion:
        res = self.analizar()
        if self.investigacion is None or getattr(self, "_inv_origen", None) is not res:
            self.investigacion = investigar(res, self.validar())
            self._inv_origen = res
        return self.investigacion

    def base_mensual(self) -> BaseMensual:
        res = self.analizar()
        if self.base is None or getattr(self, "_base_origen", None) is not res:
            self.base = base_desde_resultados(res)
            self._base_origen = res
        return self.base

    def recomendar(self) -> list[Accion]:
        inv = self.investigar()
        if not self.acciones or getattr(self, "_acc_origen", None) is not inv:
            self.acciones = recomendar(inv, self.base_mensual(), self.analizar().flujo is not None)
            self._acc_origen = inv
        return self.acciones

    def simular(self, palancas: Palancas, nombre: str = "Escenario") -> Escenario:
        esc = simular(self.base_mensual(), palancas, nombre)
        self.escenarios.append(esc)
        self.bitacora.append(f"Escenario simulado: {nombre} — {'; '.join(palancas.describir())}")
        return esc

    def comparar(self, escenarios: list[tuple[str, Palancas]]) -> pd.DataFrame:
        return comparar(self.base_mensual(), escenarios)

    def informe(self, ruta: str | Path, empresa: str = "Tu empresa", contacto: dict | None = None) -> Path:
        from .informe import generar_informe
        return generar_informe(self, ruta, empresa, contacto)

    def exportar_json(self, ruta: str | Path) -> Path:
        """Todas las cifras con su trazabilidad completa, para auditoría."""
        res = self.analizar()
        datos = {
            "cifras": [c.a_dict() for c in res.libro.todas()],
            "problemas": [vars(p) for p in self.validar().problemas],
            "supuestos": res.supuestos,
            "bitacora": self.bitacora,
        }
        ruta = Path(ruta)
        ruta.write_text(json.dumps(datos, ensure_ascii=False, indent=2, default=str), encoding="utf-8")
        return ruta

    # ------------------------------------------------------- siguiente paso
    def siguiente_paso(self) -> Paso:
        if not self.tablas:
            return Paso(1, "Carga tus datos", BIENVENIDA,
                        "Sin ventas, costos y gastos no hay nada que analizar.",
                        falta=["Ventas (fecha e importe; idealmente producto y cantidad)",
                               "Costos de lo vendido", "Gastos de operación"],
                        opciones=["Subir Excel o CSV", "Introducir cifras manualmente", "Probar con datos de ejemplo"])
        pend = self.preguntas_pendientes()
        if pend:
            return Paso(2, "Confirma cómo leí tus datos", pend[0].texto, pend[0].por_que,
                        falta=[p.texto for p in pend], opciones=pend[0].opciones)
        val = self.validar()
        pend = self.preguntas_pendientes()
        if pend:
            return Paso(3, "Resuelve un dato faltante", pend[0].texto, pend[0].por_que,
                        falta=[p.texto for p in pend])
        if val.calidad == "insuficiente":
            return Paso(3, "Los datos no alcanzan todavía", "; ".join(p.titulo for p in val.bloqueantes),
                        "Nunca presento resultados con datos incompletos como si fueran definitivos.",
                        falta=[p.sugerencia for p in val.bloqueantes])
        if val.advertencias and not self.problemas_confirmados:
            return Paso(3, f"Revisa {len(val.advertencias)} posible(s) problema(s) en tus datos",
                        "Revisa cómo traté cada problema. Puedes continuar, pero los resultados serán provisionales.",
                        "Si hay duplicados o totales que no cuadran, las conclusiones podrían cambiar.",
                        falta=[p.titulo for p in val.advertencias],
                        opciones=["Acepto el tratamiento propuesto", "Corregiré el archivo"])
        res = self.analizar()
        if self.investigacion is None:
            return Paso(4, "Mira el diagnóstico", "Ya calculé ventas, márgenes, utilidad y efectivo. "
                        "Revisa la respuesta a «¿cuánto gano realmente?» y lo que encontré.",
                        "Antes de decidir conviene entender qué pasó.", falta=res.faltantes)
        if not self.acciones:
            return Paso(6, "Investiga las causas", "Revisa el puente de utilidad y qué hipótesis respaldan los datos.",
                        "Separar hechos de hipótesis evita decidir con base en suposiciones.")
        if not self.escenarios:
            return Paso(7, "Compara alternativas", "Simula las acciones propuestas o tus propias ideas "
                        "(precio, volumen, costos, plazos).", "Decidir es comparar alternativas con sus riesgos.")
        return Paso(8, "Genera tu informe", "Exporta el informe ejecutivo para presentarlo.",
                    "Un informe con evidencia y supuestos facilita que otros revisen y aprueben la decisión.")
