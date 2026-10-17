"""Aplicación de trabajo de CIFRAS Consultores (Streamlit).

    streamlit run analista_financiero/app.py

Misma lógica que la CLI: toda la información viene de `Sesion`; la interfaz
solo muestra, pregunta y deja profundizar ("¿cómo se calculó?").
"""

from __future__ import annotations

import os
import subprocess
import sys
import tempfile
from pathlib import Path

import pandas as pd
import streamlit as st
from streamlit.delta_generator import DeltaGenerator

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from analista_financiero import expedientes, marca  # noqa: E402
from analista_financiero.asistente import Asistente  # noqa: E402
from analista_financiero.diagnostico import ESTADOS_TEXTO  # noqa: E402
from analista_financiero.escenarios import Palancas  # noqa: E402
from analista_financiero.explicar import GLOSARIO, explicar_cifra, explicar_variacion  # noqa: E402
from analista_financiero.informe import CSS, _svg_puente  # noqa: E402
from analista_financiero.ingesta import CAMPOS, IGNORAR  # noqa: E402
from analista_financiero.limites import LIMITES_GENERALES  # noqa: E402
from analista_financiero.modelos import fmt_dinero, fmt_pct, fmt_pts  # noqa: E402
from analista_financiero.plantilla import generar_plantilla  # noqa: E402
from analista_financiero.sesion import BIENVENIDA, Sesion  # noqa: E402

def _sin_formulas(metodo):
    """Streamlit interpreta "$...$" como fórmula matemática; aquí $ siempre es dinero."""
    def envoltura(self, body, *args, **kwargs):
        if isinstance(body, str) and not kwargs.get("unsafe_allow_html"):
            body = body.replace("\\$", "$").replace("$", "\\$")
        return metodo(self, body, *args, **kwargs)
    return envoltura


for _nombre in ("markdown", "caption", "info", "warning", "success", "error"):
    _original = getattr(DeltaGenerator, _nombre)
    if not getattr(_original, "_sin_formulas", False):
        _nuevo = _sin_formulas(_original)
        _nuevo._sin_formulas = True
        setattr(DeltaGenerator, _nombre, _nuevo)
        # st.info, st.markdown... son métodos ya ligados al contenedor principal: se vuelven a ligar.
        setattr(st, _nombre, getattr(st._main, _nombre))

_ICONO = Path(__file__).resolve().parent / "recursos" / "icono.png"
st.set_page_config(page_title=marca.NOMBRE, page_icon=str(_ICONO) if _ICONO.exists() else "📊", layout="wide")

ETAPAS = ["Cargar datos", "Confirmar columnas", "Validar", "Analizar", "Explicar", "Investigar", "Decidir", "Informe"]
ICONO_ESTADO = {"respaldada": "🔴", "parcial": "🟠", "descartada": "⚪", "sin_datos": "❔"}


def sesion() -> Sesion:
    if "sesion" not in st.session_state:
        st.session_state.sesion = Sesion()
    return st.session_state.sesion


def reiniciar() -> None:
    for k in ("sesion", "asistente", "chat", "archivo_cargado", "ultima_entrega"):
        st.session_state.pop(k, None)


def cliente_actual() -> expedientes.Cliente | None:
    ruta = st.session_state.get("cliente")
    return expedientes.abrir(Path(ruta)) if ruta else None


def abrir_en_sistema(ruta: Path) -> None:
    """Abre un archivo o carpeta con el programa de Windows correspondiente (la app corre en esta PC)."""
    try:
        if sys.platform.startswith("win"):
            os.startfile(str(ruta))  # noqa: S606
        elif sys.platform == "darwin":
            subprocess.Popen(["open", str(ruta)])
        else:
            subprocess.Popen(["xdg-open", str(ruta)])
    except OSError as exc:
        st.error(f"No pude abrirlo automáticamente ({exc}). Está en: {ruta}")


def logo(variante: str = "logo-claro", alto: int = 40, destino=st) -> None:
    destino.markdown(f'<img src="{marca.svg_data_uri(variante)}" style="height:{alto}px;width:auto">', unsafe_allow_html=True)


def como_se_calculo(clave: str) -> None:
    s = sesion()
    lib = s.analizar().libro
    c = lib.get(clave)
    if c is None:
        return
    with st.expander(f"¿Cómo se calculó «{c.nombre}»?"):
        st.write(explicar_cifra(c, lib))
        metrica = clave.split(".")[0]
        if f"var.{metrica}" in lib:
            st.info(explicar_variacion(lib, metrica))
        if c.origen:
            st.caption(f"Filas de origen ({len(c.origen)}): " + "; ".join(c.origen[:8]) + (" …" if len(c.origen) > 8 else ""))
        if c.depende_de:
            st.caption("Depende de: " + ", ".join(f"`{d}`" for d in c.depende_de))


# ---------------------------------------------------------------------------
# Barra lateral: dónde estoy y qué sigue (Principio 1)
# ---------------------------------------------------------------------------

def barra_lateral() -> None:
    s = sesion()
    p = s.siguiente_paso()
    logo("logo-claro", 44, st.sidebar)
    c = cliente_actual()
    st.sidebar.caption(f"Cliente: **{c.nombre}**" if c else "Sin cliente seleccionado (pestaña Clientes)")
    for i, nombre in enumerate(ETAPAS, 1):
        estado = "✅" if i < p.etapa else ("➡️" if i == p.etapa else "◻️")
        st.sidebar.write(f"{estado} {i}. {nombre}")
    st.sidebar.divider()
    st.sidebar.subheader("Siguiente paso")
    st.sidebar.write(f"**{p.titulo}**")
    st.sidebar.write(p.que_hacer)
    st.sidebar.caption(f"Por qué: {p.por_que}")
    for f in p.falta[:5]:
        st.sidebar.caption(f"• {f}")
    st.sidebar.divider()
    with st.sidebar.expander("📚 Aprende un concepto"):
        clave = st.selectbox("Concepto", list(GLOSARIO), format_func=lambda k: GLOSARIO[k]["nombre"])
        g = GLOSARIO[clave]
        st.write(f"**Qué es:** {g['que_es']}\n\n**Cómo se calcula:** {g['calculo']}\n\n"
                 f"**Por qué importa:** {g['importa']}\n\n**Qué revisar:** {g['revisar']}")
    if st.sidebar.button("Nuevo análisis (mismo cliente)"):
        reiniciar()
        st.rerun()


# ---------------------------------------------------------------------------
# Pestañas
# ---------------------------------------------------------------------------

def tab_datos() -> None:
    s = sesion()
    st.write(BIENVENIDA)
    c1, c2, c3 = st.columns(3)
    with c1:
        archivo = st.file_uploader("Sube un Excel o CSV", type=["xlsx", "xls", "csv"])
        if archivo is not None and st.session_state.get("archivo_cargado") != archivo.name:
            c = cliente_actual()
            if c:  # copia en el expediente del cliente
                ruta = expedientes.guardar_archivo(c, archivo.name, archivo.getvalue())
            else:
                ruta = Path(tempfile.mkdtemp()) / archivo.name
                ruta.write_bytes(archivo.getvalue())
            s.cargar_archivo(ruta)
            st.session_state.archivo_cargado = archivo.name
            st.rerun()
    with c2:
        st.write("**O captura tus cifras por mes**")
        base = pd.DataFrame({"mes": ["2026-01", "2026-02"], "ventas": [0.0, 0.0],
                             "costo_ventas": [0.0, 0.0], "gastos": [0.0, 0.0]})
        tabla = st.data_editor(base, num_rows="dynamic", key="captura")
        if st.button("Usar estas cifras"):
            s.cargar_manual(tabla.to_dict("records"))
            st.rerun()
    with c3:
        st.write("**O prueba con un ejemplo**")
        st.caption("Café La Montaña: 6 meses donde las ventas suben y la utilidad cae, con errores típicos en los datos.")
        if st.button("Cargar datos de ejemplo"):
            from analista_financiero.demo import generar_excel
            ruta = generar_excel(Path(tempfile.mkdtemp()) / "cafe_la_montana.xlsx")
            s.cargar_archivo(ruta)
            st.rerun()

    if not s.tablas:
        st.divider()
        st.write("**¿Tu cliente todavía no te manda sus datos?** Envíale esta plantilla de Excel: "
                 "si la llena, el archivo se lee sin preguntas.")
        boton_plantilla("datos")
        return
    st.subheader("Así leí tus datos")
    st.caption("Revisa que cada columna signifique lo que creo. Las dudosas están marcadas.")
    opciones = list(CAMPOS) + [IGNORAR]
    for t in s.tablas:
        m = s.mapeos[t.nombre]
        with st.expander(f"{t.nombre} — {len(t.datos)} filas" + (f" · todo es «{m.tipo_hoja}»" if m.tipo_hoja else ""), expanded=True):
            st.dataframe(t.datos.head(5), width="stretch")
            cols = st.columns(min(4, len(m.mapeo)) or 1)
            for i, (enc, campo) in enumerate(m.mapeo.items()):
                conf = m.confianza.get(enc, 0)
                etiqueta = f"«{enc}»" + (" ⚠️" if conf < 0.85 else "")
                nuevo = cols[i % len(cols)].selectbox(etiqueta, opciones, index=opciones.index(campo), key=f"map::{t.nombre}::{enc}")
                if nuevo != campo:
                    m.mapeo[enc] = nuevo
                    m.confianza[enc] = 1.0
                    s._invalidar()
    for p in s.preguntas_pendientes():
        st.warning(f"{p.texto}  \n_{p.por_que}_")
        if p.tipo == "tipo_cambio":
            valor = st.number_input(p.texto, min_value=0.0, value=18.0, key=p.id)
            if st.button("Usar este tipo de cambio", key=p.id + "b"):
                s.responder(p.id, str(valor))
                st.rerun()
        elif p.tipo in ("tipo_hoja", "campo_faltante"):
            r = st.selectbox("Respuesta", p.opciones, key=p.id)
            if st.button("Confirmar", key=p.id + "b"):
                s.responder(p.id, r)
                st.rerun()
    if any(p.tipo == "mapeo_columna" for p in s.preguntas_pendientes()):
        if st.button("✅ Confirmo cómo se leyeron las columnas", type="primary"):
            for p in s.preguntas_pendientes():
                if p.tipo == "mapeo_columna":
                    p.respuesta = s.mapeos[p.contexto["tabla"]].mapeo[p.contexto["columna"]]
            s.confirmar_mapeo()
            s.validar()
            st.rerun()


def tab_validacion() -> None:
    s = sesion()
    v = s.validar()
    r = v.resumen
    c = st.columns(4)
    c[0].metric("Filas leídas", r["filas_leidas"])
    c[1].metric("Filas analizadas", r["filas_analizadas"])
    c[2].metric("Filas excluidas", r["filas_excluidas"])
    c[3].metric("Importe excluido", fmt_pct(r["pct_importe_excluido"]))
    if not v.problemas:
        st.success("No encontré problemas en los datos: fechas, importes, monedas y totales están en orden.")
    for p in v.problemas:
        caja = {"bloqueante": st.error, "advertencia": st.warning, "info": st.info}[p.severidad]
        caja(f"**{p.titulo}.** {p.explicacion}  \n→ {p.accion_tomada or p.sugerencia}")
        if p.filas:
            with st.expander("Ver filas afectadas"):
                st.write("\n".join(f"- {f}" for f in p.filas[:20]))
    if v.advertencias and not s.problemas_confirmados:
        st.write("Mientras no confirmes, los resultados se marcan como **provisionales**.")
        if st.button("Acepto cómo se trataron estos problemas", type="primary"):
            s.confirmar_problemas()
            st.rerun()
    if not v.excluido.empty:
        with st.expander("Filas excluidas del análisis"):
            st.dataframe(v.excluido[["origen", "fecha_texto", "tipo", "concepto", "producto", "importe_texto", "moneda", "motivo"]],
                         width="stretch")


def tab_diagnostico() -> None:
    s = sesion()
    res, inv = s.analizar(), s.investigar()
    lib = res.libro
    if res.confianza != "confiable":
        st.warning("Resultados PROVISIONALES: hay problemas de datos sin confirmar (pestaña Validación).")
    st.subheader("¿Cuánto estoy ganando realmente?")
    st.info(inv.respuesta_principal)
    if "var.ventas" in lib:
        c = st.columns(4)
        c[0].metric("Ventas (reciente)", fmt_dinero(lib.valor("ventas.actual")), fmt_pct(lib.valor("var.ventas"), signo=True))
        c[1].metric("Margen bruto", fmt_pct(lib.valor("margen_bruto.actual")), fmt_pts(lib.valor("var.margen_bruto")))
        c[2].metric("Utilidad de operación", fmt_dinero(lib.valor("utilidad_operativa.actual")),
                    fmt_dinero(lib.valor("dif.utilidad_operativa")))
        if lib.valor("flujo_operativo.actual") is not None:
            c[3].metric("Efectivo generado", fmt_dinero(lib.valor("flujo_operativo.actual")),
                        f"por cobrar {fmt_dinero(lib.valor('cxc.final'))}", delta_color="off")
        for clave in ("margen_bruto.actual", "utilidad_operativa.actual", "flujo_operativo.total"):
            como_se_calculo(clave)
    if not res.mensual.empty:
        st.subheader("Ventas y utilidad por mes")
        c1, c2 = st.columns(2)
        c1.line_chart(res.mensual[["ventas"]], color="#9ca3af")
        c2.line_chart(res.mensual[["utilidad_operativa"]], color="#c2410c")
    if inv.hallazgos:
        st.subheader("Señales")
        for h in inv.hallazgos:
            st.write(f"{'🔴' if h.severidad == 'alta' else '🟠' if h.severidad == 'media' else '🟢'} **{h.titulo}.** {h.explicacion}")
    if res.faltantes:
        with st.expander("Datos que mejorarían el análisis"):
            for f in res.faltantes:
                st.write(f"- {f}")


def tab_investigacion() -> None:
    s = sesion()
    inv = s.investigar()
    st.markdown("### 🔍 Investigación financiera guiada")
    if inv.hallazgo_inicial:
        st.caption("HALLAZGO INICIAL")
        st.markdown(f"#### {inv.hallazgo_inicial.titulo}")
        st.write(inv.hallazgo_inicial.explicacion)
    if not inv.puente:
        st.info(inv.conclusion)
        return
    st.markdown("#### Paso 1. ¿Qué cambió?")
    cols = st.columns(2)
    for i, h in enumerate(inv.hipotesis):
        with cols[i % 2].container(border=True):
            st.markdown(f"**{h.titulo}**  \n{h.pregunta}")
            st.write(f"{ICONO_ESTADO[h.estado]} **{ESTADOS_TEXTO[h.estado]}**"
                     + (f" · efecto {fmt_dinero(h.impacto)}" if h.impacto else ""))
            st.write(h.resumen)
            with st.expander("Evidencia y qué comprobar"):
                for x in h.hechos:
                    st.write(f"✓ **Hecho:** {x}")
                if h.estado in ("respaldada", "parcial"):
                    for x in h.posibles_causas:
                        st.write(f"? **Hipótesis por confirmar:** {x}")
                    for x in h.que_comprobar:
                        st.write(f"→ **Comprueba:** {x}")
                for x in h.datos_faltantes:
                    st.write(f"… **Falta:** {x}")
    st.markdown("#### Paso 2. Comprobar antes de concluir")
    st.write("El puente compara periodos equivalentes y muestra, peso por peso, qué sumó y qué restó. Cuadra exactamente con tus datos.")
    # El HTML lo genera el propio motor (todo texto del usuario va escapado).
    st.iframe(f"<style>{CSS}</style><main style='padding:8px'>{_svg_puente(inv.puente)}</main>",
              height=len(inv.puente) * 30 + 40)
    tabla = pd.DataFrame([{"Concepto": p["etiqueta"], "Monto": fmt_dinero(p["valor"]), "Cifra": p["clave"]} for p in inv.puente])
    with st.expander("Ver el puente como tabla y rastrear cada cifra"):
        st.dataframe(tabla, width="stretch", hide_index=True)
        clave = st.selectbox("Rastrear una cifra", [p["clave"] for p in inv.puente])
        st.json(s.analizar().libro.rastrear(clave), expanded=False)
    st.markdown("#### Paso 3. Recomendar una acción")
    st.write(inv.conclusion)
    st.caption("Las acciones concretas y su impacto simulado están en la pestaña «Decisiones».")


def tab_decisiones() -> None:
    s = sesion()
    acciones = s.recomendar()
    st.subheader("Acciones recomendadas")
    st.caption(f"Impacto calculado por el simulador sobre tu mes típico reciente ({s.base_mensual().meses_referencia}).")
    for a in acciones:
        imp = ("+" if a.impacto_utilidad_mes > 0 else "") + fmt_dinero(a.impacto_utilidad_mes)
        with st.container(border=True):
            st.markdown(f"**{a.titulo}** — {imp} de utilidad al mes"
                        + (f"; libera {fmt_dinero(a.impacto_caja_unico)} de efectivo" if a.impacto_caja_unico else "")
                        + ("  ⚖️ _revisión profesional recomendada_" if a.requiere_experto else ""))
            st.write(a.descripcion)
            c1, c2 = st.columns(2)
            c1.caption("Supuestos: " + " ".join(a.supuestos) if a.supuestos else "")
            c2.caption("Riesgos: " + " ".join(a.riesgos) if a.riesgos else "")
            if a.sensibilidad:
                st.caption("Sensibilidad: " + "; ".join(f"{k}: {fmt_dinero(v)}" for k, v in a.sensibilidad.items()))
            st.write(f"**Primer paso:** {a.primer_paso} · _{a.plazo}, esfuerzo {a.esfuerzo}_")

    st.subheader("Simulador: ¿qué pasa si...?")
    base = s.base_mensual()
    c = st.columns(3)
    precio = c[0].slider("Cambio de precio %", -30, 30, 0)
    elasticidad = c[0].slider("Unidades que pierdes por cada 1% de aumento de precio", 0.0, 3.0, 0.8, 0.1,
                              help=GLOSARIO["elasticidad"]["que_es"])
    volumen = c[1].slider("Cambio de unidades vendidas %", -50, 50, 0)
    costo = c[1].slider("Cambio del costo por unidad %", -30, 30, 0)
    gastos = c[2].slider("Cambio de gastos de operación %", -30, 30, 0)
    dias = c[2].slider("Días de cobro", 0, 120, int(round(base.dias_cobro)))
    crecimiento = c[0].slider("Crecimiento mensual de ventas %", -10, 10, 0)
    saldo = c[1].number_input("Saldo actual en el banco (opcional)", value=0.0, step=1000.0)
    meses = c[2].slider("Meses a proyectar", 3, 18, 6)
    pal = Palancas(cambio_precio_pct=precio / 100, elasticidad=-elasticidad, cambio_volumen_pct=volumen / 100,
                   cambio_costo_unitario_pct=costo / 100, cambio_gastos_pct=gastos / 100, dias_cobro=float(dias),
                   crecimiento_mensual=crecimiento / 100, meses=meses, saldo_inicial=saldo or None)
    tabla = s.comparar([("Mi escenario", pal)])
    vista = tabla.copy()
    for col in vista.columns:
        vista[col] = [fmt_pct(v) if col == "margen_operativo" else fmt_dinero(v) for v in vista[col]]
    st.dataframe(vista.rename(columns={"ventas_mes": "Ventas/mes", "utilidad_mes": "Utilidad/mes",
                                       "margen_operativo": "Margen", "cambio_utilidad_mes": "Cambio utilidad/mes",
                                       "utilidad_periodo": "Utilidad del periodo", "caja_final": "Caja al final",
                                       "necesidad_financiamiento": "Faltante de caja"}), width="stretch")
    from analista_financiero.escenarios import simular
    esc, igual = simular(base, pal, "Mi escenario"), simular(base, Palancas(meses=meses, saldo_inicial=saldo or None), "Seguir igual")
    st.line_chart(pd.DataFrame({"Seguir igual": igual.proyeccion["saldo"], "Mi escenario": esc.proyeccion["saldo"]}))
    if esc.necesidad_financiamiento > 0:
        st.warning(f"En este escenario te faltarían hasta {fmt_dinero(esc.necesidad_financiamiento)} de efectivo. "
                   "Antes de pedir un crédito, revisa costo y condiciones con un profesional.")
    with st.expander("Supuestos del escenario"):
        for x in esc.supuestos:
            st.write(f"- {x}")
    if st.button("Guardar este escenario para el informe"):
        s.simular(pal, f"Escenario {len(s.escenarios) + 1}")
        st.success("Guardado.")


def tab_informe() -> None:
    s = sesion()
    c = cliente_actual()
    empresa = st.text_input("Nombre del cliente en el informe", c.nombre if c else "Mi cliente")
    config = marca.cargar_config()
    if not marca.linea_contacto(config):
        st.info("Tip: captura tus datos de contacto en la pestaña «Configuración» para que aparezcan en el informe.")
    if st.button("Generar informe", type="primary"):
        if c:
            destino = expedientes.registrar_entrega(c, s, empresa, config)
        else:
            destino = Path(tempfile.mkdtemp())
            s.informe(destino / "informe.html", empresa, config)
            s.exportar_json(destino / "trazabilidad.json")
        st.session_state.ultima_entrega = {"carpeta": str(destino), "empresa": empresa, "expediente": bool(c)}
        st.rerun()  # vuelve a dibujar todo, incluida la lista de entregas del expediente
    ultima = st.session_state.get("ultima_entrega")
    if ultima and (Path(ultima["carpeta"]) / "informe.html").exists():
        destino = Path(ultima["carpeta"])
        if ultima["expediente"]:
            st.success(f"Informe guardado en el expediente: {destino}")
        else:
            st.warning("No hay cliente seleccionado: el informe no se guardó en ningún expediente. Descárgalo.")
        html_ruta, json_ruta = destino / "informe.html", destino / "trazabilidad.json"
        st.download_button("Descargar informe (HTML, imprimible a PDF)", html_ruta.read_bytes(),
                           f"Diagnostico - {ultima['empresa']}.html", "text/html")
        st.download_button("Descargar trazabilidad (JSON)", json_ruta.read_bytes(), "trazabilidad.json", "application/json")
        a, b = st.columns(2)
        if a.button("🖨️ Abrir informe para imprimir o guardar en PDF", type="primary"):
            abrir_en_sistema(html_ruta)
        if b.button("📂 Abrir carpeta del informe"):
            abrir_en_sistema(destino)
        st.caption("El informe se abre en tu navegador: usa Imprimir (Ctrl+P) → Guardar como PDF.")
        st.iframe(html_ruta, height=900)
    st.subheader("Límites de este análisis")
    for x in LIMITES_GENERALES:
        st.caption(f"• {x}")


def tab_asistente() -> None:
    s = sesion()
    with st.expander("Activar el asistente con IA (opcional)"):
        st.caption("Sin clave, el asistente responde en modo local. La clave solo se usa en esta computadora "
                   "mientras la aplicación esté abierta.")
        clave = st.text_input("Clave de API de Anthropic", type="password")
        if st.button("Usar esta clave") and clave:
            import os
            os.environ["ANTHROPIC_API_KEY"] = clave.strip()
            st.session_state.pop("asistente", None)
    if "asistente" not in st.session_state:
        st.session_state.asistente = Asistente(s)
        st.session_state.chat = []
    a = st.session_state.asistente
    st.caption(f"Modo: {a.modo}. Las cifras siempre vienen del motor de cálculo, nunca de una estimación del modelo.")
    for rol, texto in st.session_state.chat:
        st.chat_message(rol).write(texto)
    pregunta = st.chat_input("Pregunta lo que quieras: ¿por qué bajó mi utilidad?, ¿qué pasa si subo 5% el precio?")
    if pregunta:
        st.session_state.chat.append(("user", pregunta))
        with st.spinner("Analizando..."):
            respuesta = a.responder(pregunta)
        st.session_state.chat.append(("assistant", respuesta))
        st.rerun()


def boton_plantilla(clave: str) -> None:
    ruta = generar_plantilla(Path(tempfile.mkdtemp()) / "Plantilla CIFRAS Consultores.xlsx")
    st.download_button("⬇️ Descargar plantilla de Excel para clientes", ruta.read_bytes(),
                       "Plantilla CIFRAS Consultores.xlsx",
                       "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", key=f"plantilla-{clave}")


def tab_clientes() -> None:
    clientes = expedientes.listar()
    actual = cliente_actual()
    c1, c2 = st.columns([2, 1])
    with c1:
        st.subheader("Tus clientes")
        if clientes:
            nombres = [c.nombre for c in clientes]
            indice = nombres.index(actual.nombre) if actual and actual.nombre in nombres else 0
            elegido = st.selectbox("Cliente", nombres, index=indice)
            cliente = clientes[nombres.index(elegido)]
            if not actual or actual.carpeta != cliente.carpeta:
                if st.button(f"Trabajar con {cliente.nombre}", type="primary"):
                    st.session_state.cliente = str(cliente.carpeta)
                    reiniciar()
                    st.rerun()
        else:
            st.info("Aún no tienes clientes. Crea el primero →")
    with c2:
        with st.form("nuevo_cliente", clear_on_submit=True):
            st.subheader("Nuevo cliente")
            nombre = st.text_input("Empresa")
            contacto = st.text_input("Contacto (nombre, correo o teléfono)")
            giro = st.text_input("Giro del negocio")
            if st.form_submit_button("Crear expediente") and nombre.strip():
                nuevo = expedientes.crear(nombre, contacto, giro)
                st.session_state.cliente = str(nuevo.carpeta)
                reiniciar()
                st.rerun()

    if not actual:
        return
    st.divider()
    st.subheader(f"Expediente: {actual.nombre}")
    st.caption(" · ".join(x for x in (actual.giro, actual.contacto) if x))
    if st.button("📂 Abrir carpeta del expediente"):
        abrir_en_sistema(actual.carpeta)
    a, b = st.columns(2)
    with a:
        st.write("**Archivos recibidos**")
        archivos = expedientes.archivos(actual)
        if not archivos:
            st.caption("Ninguno todavía. Súbelos en la pestaña «Datos».")
        for i, ruta in enumerate(archivos[:10]):
            col1, col2 = st.columns([3, 1])
            col1.write(f"📄 {ruta.name}")
            if col2.button("Analizar", key=f"analizar-{i}"):
                reiniciar()
                sesion().cargar_archivo(ruta)
                st.session_state.archivo_cargado = ruta.name
                st.success(f"Cargado {ruta.name}. Continúa en la pestaña «Datos».")
    with b:
        st.write("**Informes entregados**")
        entregas = expedientes.entregas(actual)
        if not entregas:
            st.caption("Ninguno todavía.")
        for i, carpeta in enumerate(entregas[:10]):
            fecha = carpeta.name.replace("_", " ")
            st.download_button(f"⬇️ Informe {fecha}", (carpeta / "informe.html").read_bytes(),
                               f"Diagnostico - {actual.nombre} - {carpeta.name}.html", "text/html", key=f"entrega-{i}")


def tab_configuracion() -> None:
    st.subheader("Tus datos (aparecen en el pie de cada informe)")
    config = marca.cargar_config()
    with st.form("config"):
        nuevos = {k: st.text_input(etiqueta, config.get(k, "")) for k, etiqueta in marca.CAMPOS_CONTACTO.items()}
        if st.form_submit_button("Guardar", type="primary"):
            marca.guardar_config(nuevos)
            st.success("Guardado.")
    st.subheader("Plantilla para clientes")
    st.write("Envía esta plantilla a tus clientes para que te entreguen ventas, costos y gastos en el formato correcto.")
    boton_plantilla("config")
    st.subheader("Dónde se guarda tu trabajo")
    st.code(str(marca.carpeta_trabajo()))
    if st.button("📂 Abrir carpeta de trabajo"):
        abrir_en_sistema(marca.carpeta_trabajo())
    st.caption("Cada cliente tiene su carpeta con los archivos que te entregó y los informes generados. "
               "Respalda esta carpeta periódicamente (por ejemplo, en OneDrive o Google Drive).")


def main() -> None:
    s = sesion()
    logo("logo-claro", 56)
    c = cliente_actual()
    st.caption(f"Expediente activo: **{c.nombre}**" if c else "Elige o crea un cliente en la pestaña «Clientes» para guardar su expediente.")
    nombres = ["🗂 Clientes", "1 · Datos", "2 · Validación", "3 · Diagnóstico", "4 · Investigación", "5 · Decisiones",
               "6 · Informe", "💬 Asistente", "⚙️ Configuración"]
    todas = st.tabs(nombres)
    with todas[0]:
        tab_clientes()
    with todas[-1]:
        tab_configuracion()
    tabs = todas[1:-1]
    with tabs[0]:
        tab_datos()
    listo = bool(s.tablas) and not s.preguntas_pendientes()
    if listo:
        listo = s.validar().calidad != "insuficiente" and not s.preguntas_pendientes()
    with tabs[1]:
        if s.tablas and not [p for p in s.preguntas_pendientes() if p.tipo != "tipo_cambio"]:
            tab_validacion()
        else:
            st.info("Primero carga y confirma tus datos.")
    for tab, fn in zip(tabs[2:], (tab_diagnostico, tab_investigacion, tab_decisiones, tab_informe, tab_asistente)):
        with tab:
            if listo:
                fn()
            else:
                st.info(s.siguiente_paso().que_hacer)
    # La barra lateral se dibuja al final para reflejar lo que ya se calculó en esta vuelta.
    barra_lateral()


main()
