"""Etapa 8: informe ejecutivo exportable (HTML autocontenido, imprimible a PDF).

Estructura inspirada en "Storytelling with Data":
  - la idea principal va en el título (no "Análisis financiero Q3");
  - cada gráfica tiene un título que dice qué concluir;
  - gris para el contexto, un solo color de acento para lo que importa;
  - primero la respuesta, después la evidencia; los anexos permiten rastrear
    cada cifra hasta los datos originales (Principio 3).
"""

from __future__ import annotations

import html
from dataclasses import replace
from datetime import date
from pathlib import Path

import pandas as pd

from .diagnostico import ESTADOS_TEXTO
from .escenarios import Palancas
from . import marca
from .explicar import GLOSARIO
from .limites import LIMITES_GENERALES, revisiones_requeridas
from .modelos import fmt_dinero, fmt_pct, fmt_pts

e = html.escape


# ---------------------------------------------------------------------------
# Gráficas SVG mínimas
# ---------------------------------------------------------------------------

def _svg_linea(serie: pd.Series, titulo: str, acento: bool, ancho: int = 340, alto: int = 150) -> str:
    vals = [float(v) for v in serie.values]
    meses_es = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]
    etiquetas = [f"{meses_es[int(str(i)[5:7]) - 1]} {str(i)[2:4]}" if len(str(i)) == 7 else str(i) for i in serie.index]
    if not vals:
        return ""
    lo, hi = min(min(vals), 0), max(max(vals), 0)
    rango = (hi - lo) or 1
    m_izq, m_der, m_sup, m_inf = 22, 22, 22, 22
    w, h = ancho - m_izq - m_der, alto - m_sup - m_inf
    x = lambda i: m_izq + (w * i / max(1, len(vals) - 1))  # noqa: E731
    y = lambda v: m_sup + h - (v - lo) / rango * h  # noqa: E731
    puntos = " ".join(f"{x(i):.1f},{y(v):.1f}" for i, v in enumerate(vals))
    color = "var(--acento)" if acento else "var(--contexto)"
    partes = [f'<svg viewBox="0 0 {ancho} {alto}" role="img" aria-label="{e(titulo)}">']
    if lo < 0:
        partes.append(f'<line x1="{m_izq}" x2="{ancho - m_der}" y1="{y(0):.1f}" y2="{y(0):.1f}" class="cero"/>')
    partes.append(f'<polyline points="{puntos}" fill="none" stroke="{color}" stroke-width="2.5"/>')
    for i, v in enumerate(vals):
        partes.append(f'<circle cx="{x(i):.1f}" cy="{y(v):.1f}" r="3" fill="{color}"/>')
    for i in (0, len(vals) - 1):
        partes.append(f'<text x="{x(i):.1f}" y="{y(vals[i]) - 8:.1f}" text-anchor="{"start" if i == 0 else "end"}" '
                      f'class="etq {"fuerte" if acento else ""}">{e(fmt_dinero(vals[i]))}</text>')
    for i, et in enumerate(etiquetas):
        ancla = "start" if i == 0 else "end" if i == len(etiquetas) - 1 else "middle"
        partes.append(f'<text x="{x(i) + (-6 if ancla == "start" else 6 if ancla == "end" else 0):.1f}" y="{alto - 4}" '
                      f'text-anchor="{ancla}" class="eje">{e(et)}</text>')
    partes.append("</svg>")
    return "".join(partes)


def _svg_puente(puente: list[dict], ancho: int = 720) -> str:
    n = len(puente)
    fila, m_izq, m_der = 30, 250, 90
    alto = n * fila + 10
    acumulado, barras = 0.0, []
    for p in puente:
        if p["tipo"] == "total":
            ini, fin = 0.0, p["valor"]
            acumulado = p["valor"]
        else:
            ini, fin = acumulado, acumulado + p["valor"]
            acumulado = fin
        barras.append((p, ini, fin))
    lo = min(min(b[1], b[2]) for b in barras + [(None, 0, 0)])
    hi = max(max(b[1], b[2]) for b in barras + [(None, 0, 0)])
    rango = (hi - lo) or 1
    w = ancho - m_izq - m_der
    x = lambda v: m_izq + (v - lo) / rango * w  # noqa: E731
    partes = [f'<svg viewBox="0 0 {ancho} {alto}" role="img" aria-label="Puente de utilidad">',
              f'<line x1="{x(0):.1f}" x2="{x(0):.1f}" y1="0" y2="{alto}" class="cero"/>']
    for i, (p, ini, fin) in enumerate(barras):
        y0 = 5 + i * fila
        izq, der = sorted((x(ini), x(fin)))
        if p["tipo"] == "total":
            clase = "b-total"
        else:
            clase = "b-neg" if p["valor"] < 0 else "b-pos"
        partes.append(f'<rect x="{izq:.1f}" y="{y0 + 4}" width="{max(1.5, der - izq):.1f}" height="{fila - 10}" class="{clase}"/>')
        partes.append(f'<text x="{m_izq - 10}" y="{y0 + fila / 2 + 4}" text-anchor="end" class="etq {"fuerte" if p["tipo"] == "total" else ""}">{e(p["etiqueta"])}</text>')
        valor = fmt_dinero(p["valor"]) if p["tipo"] == "total" else (("+" if p["valor"] > 0 else "") + fmt_dinero(p["valor"]))
        partes.append(f'<text x="{der + 6:.1f}" y="{y0 + fila / 2 + 4}" class="etq {"neg" if p["tipo"] != "total" and p["valor"] < 0 else ""}">{e(valor)}</text>')
    partes.append("</svg>")
    return "".join(partes)


# ---------------------------------------------------------------------------
# Secciones
# ---------------------------------------------------------------------------

def _kpi(nombre: str, valor: str, detalle: str, malo: bool = False) -> str:
    return (f'<div class="kpi"><div class="kpi-n">{e(nombre)}</div><div class="kpi-v">{e(valor)}</div>'
            f'<div class="kpi-d {"neg" if malo else ""}">{e(detalle)}</div></div>')


def _lista(items: list[str], clase: str = "") -> str:
    if not items:
        return ""
    return f'<ul class="{clase}">' + "".join(f"<li>{e(i)}</li>" for i in items) + "</ul>"


def _combinar(palancas: list[Palancas]) -> Palancas:
    total = Palancas()
    for p in palancas:
        total = replace(
            total,
            precio_por_producto={**total.precio_por_producto, **p.precio_por_producto},
            costo_por_producto={**total.costo_por_producto, **p.costo_por_producto},
            gastos_monto={**total.gastos_monto, **p.gastos_monto},
            desplazar_mezcla=p.desplazar_mezcla or total.desplazar_mezcla,
            dias_cobro=p.dias_cobro if p.dias_cobro is not None else total.dias_cobro,
            elasticidad=p.elasticidad or total.elasticidad,
        )
    return total


CSS = """
:root{--fondo:#ffffff;--texto:#1f2937;--suave:#6b7280;--linea:#e5e7eb;--panel:#f9fafb;
--acento:#B4532A;--contexto:#9ca3af;--pos:#64748b;--total:#0E1A2B;--ok:#15803d;--aviso:#b45309}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--fondo:#111318;--texto:#e5e7eb;--suave:#9ca3af;
--linea:#2a2f3a;--panel:#181b22;--acento:#E0874F;--contexto:#6b7280;--pos:#94a3b8;--total:#cbd5e1;--ok:#4ade80;--aviso:#fbbf24}}
*{box-sizing:border-box}body{margin:0;background:var(--fondo);color:var(--texto);
font:15px/1.55 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
main{max-width:920px;margin:0 auto;padding:32px 16px 64px}
h1{font-size:28px;line-height:1.2;margin:4px 0 8px}h2{font-size:20px;margin:40px 0 6px}
h3{font-size:16px;margin:0 0 6px}.sub{color:var(--suave);margin:0 0 16px}
.meta{color:var(--suave);font-size:13px}.badge{display:inline-block;padding:2px 8px;border-radius:999px;
font-size:12px;border:1px solid var(--linea)}.prov{color:var(--aviso);border-color:var(--aviso)}.conf{color:var(--ok);border-color:var(--ok)}
.respuesta{background:var(--panel);border-left:4px solid var(--acento);padding:14px 16px;border-radius:6px;margin:16px 0}
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:12px;margin:16px 0}
.kpi{border:1px solid var(--linea);border-radius:8px;padding:12px}.kpi-n{color:var(--suave);font-size:13px}
.kpi-v{font-size:22px;font-weight:650}.kpi-d{font-size:13px;color:var(--suave)}.neg{color:var(--acento)!important;fill:var(--acento)}
.graficas{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px}
svg{width:100%;height:auto;display:block}svg .etq{font-size:12px;fill:var(--texto)}svg .fuerte{font-weight:650}
svg .eje{font-size:11px;fill:var(--suave)}svg .cero{stroke:var(--linea);stroke-width:1}
.b-neg{fill:var(--acento)}.b-pos{fill:var(--pos)}.b-total{fill:var(--total)}
.hips{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:12px}
.hip{border:1px solid var(--linea);border-radius:8px;padding:14px}.hip .estado{font-size:12px;font-weight:600}
.e-respaldada{color:var(--acento)}.e-parcial{color:var(--aviso)}.e-descartada{color:var(--suave)}.e-sin_datos{color:var(--suave)}
.hip ul{padding-left:18px;margin:6px 0}.etiqueta{font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:var(--suave);margin-top:8px}
table{width:100%;border-collapse:collapse;font-size:14px;margin:8px 0}th,td{text-align:left;padding:7px 8px;border-bottom:1px solid var(--linea);vertical-align:top}
th{color:var(--suave);font-weight:600;font-size:13px}td.n{text-align:right;white-space:nowrap}
.tabla{overflow-x:auto}details{margin:6px 0}summary{cursor:pointer;color:var(--suave)}
.aviso{border:1px solid var(--aviso);border-radius:8px;padding:12px 14px;margin:12px 0}
code{font-size:12px;color:var(--suave)}
.marca{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;flex-wrap:wrap;
padding-bottom:14px;margin-bottom:22px;border-bottom:2px solid var(--total)}
.marca img{height:46px;width:auto;display:block}.marca .para{text-align:right;font-size:13px;color:var(--suave)}
.marca .para strong{display:block;font-size:15px;color:var(--texto)}
.logo-oscuro{display:none!important}
@media (prefers-color-scheme:dark){.logo-claro{display:none!important}.logo-oscuro{display:block!important}}
.pie{margin-top:48px;padding-top:14px;border-top:1px solid var(--linea);font-size:12px;color:var(--suave)}
@media print{.logo-oscuro{display:none!important}.logo-claro{display:block!important}}
@media print{main{max-width:none;padding:0}h2{break-after:avoid}.hip,.kpi,tr{break-inside:avoid}}
"""


def _pie(contacto: dict | None) -> str:
    datos = marca.linea_contacto(contacto or {})
    return (f'<footer class="pie"><strong>{e(marca.NOMBRE)}</strong> · {e(marca.LEMA)}'
            + (f"<br>{e(datos)}" if datos else "")
            + "<br>Documento confidencial, preparado exclusivamente para el cliente indicado. "
              "No sustituye la opinión de un contador público en materia fiscal o de estados financieros.</footer>")


def generar_informe(sesion, ruta: str | Path, empresa: str = "Tu empresa", contacto: dict | None = None) -> Path:
    """`contacto`: datos del consultor (ver marca.CAMPOS_CONTACTO) para el pie del informe."""
    val = sesion.validar()
    res = sesion.analizar()
    inv = sesion.investigar()
    acciones = sesion.recomendar()
    base = sesion.base_mensual()
    lib = res.libro
    provisional = res.confianza != "confiable"

    titulo = inv.hallazgo_inicial.titulo if inv.hallazgo_inicial else "Diagnóstico de rentabilidad"
    if inv.causas:
        top = inv.causas[0]
        titulo += f". El mayor golpe: {top['etiqueta'].lower()}"

    s: list[str] = []
    s.append(f'<header class="marca"><div><img class="logo-claro" alt="{e(marca.NOMBRE)}" src="{marca.svg_data_uri("logo-claro")}">'
             f'<img class="logo-oscuro" alt="{e(marca.NOMBRE)}" src="{marca.svg_data_uri("logo-oscuro")}"></div>'
             f'<div class="para"><strong>Diagnóstico financiero</strong>Preparado para {e(empresa)}</div></header>')
    s.append(f'<p class="meta">{e(empresa)} · Periodo {e(res.periodos.etiqueta("total"))} · '
             f'Generado {date.today().isoformat()} · '
             + ('<span class="badge prov">Resultado provisional</span>' if provisional
                else '<span class="badge conf">Datos validados</span>') + "</p>")
    s.append(f"<h1>{e(titulo)}</h1>")
    s.append(f'<p class="sub">{e(inv.conclusion)}</p>')
    s.append(f'<div class="respuesta"><strong>¿Cuánto estoy ganando realmente?</strong><br>{e(inv.respuesta_principal)}</div>')

    # KPIs
    k = []
    if "var.ventas" in lib:
        k.append(_kpi("Ventas (periodo reciente)", fmt_dinero(lib.valor("ventas.actual")),
                      f"{fmt_pct(lib.valor('var.ventas'), signo=True)} vs {res.periodos.etiqueta('base')}"))
        k.append(_kpi("Margen bruto", fmt_pct(lib.valor("margen_bruto.actual")),
                      f"{fmt_pts(lib.valor('var.margen_bruto'))} vs periodo base", (lib.valor("var.margen_bruto") or 0) < 0))
        k.append(_kpi("Utilidad de operación", fmt_dinero(lib.valor("utilidad_operativa.actual")),
                      f"{fmt_dinero(lib.valor('dif.utilidad_operativa'))} vs periodo base", (lib.valor("dif.utilidad_operativa") or 0) < 0))
    if lib.valor("flujo_operativo.actual") is not None:
        k.append(_kpi("Efectivo generado (reciente)", fmt_dinero(lib.valor("flujo_operativo.actual")),
                      f"Por cobrar: {fmt_dinero(lib.valor('cxc.final'))}", lib.valor("flujo_operativo.actual") < 0))
    s.append('<div class="kpis">' + "".join(k) + "</div>")

    if not res.mensual.empty:
        s.append("<h2>Se vende más, pero se gana menos</h2>" if inv.hallazgo_inicial and inv.hallazgo_inicial.clave == "ventas_suben_utilidad_cae"
                 else "<h2>Cómo evolucionaron ventas y utilidad</h2>")
        s.append('<div class="graficas"><div><h3>Ventas por mes</h3>' + _svg_linea(res.mensual["ventas"], "Ventas", False) +
                 '</div><div><h3>Utilidad de operación por mes</h3>' + _svg_linea(res.mensual["utilidad_operativa"], "Utilidad", True) + "</div></div>")

    if inv.puente:
        s.append("<h2>Qué se comió la utilidad, peso por peso</h2>")
        s.append(f'<p class="sub">Cómo se pasa de la utilidad de {e(res.periodos.etiqueta("base"))} a la de '
                 f'{e(res.periodos.etiqueta("actual"))}. Las barras en color restaron; las grises sumaron. El puente cuadra exactamente con tus datos.</p>')
        s.append(_svg_puente(inv.puente))

        s.append("<h2>Investigación guiada: ¿qué cambió?</h2>")
        s.append('<p class="sub">Cada hipótesis se contrasta con los datos. Los <strong>hechos</strong> son cálculos; '
                 'las <strong>posibles causas</strong> son hipótesis que debes confirmar.</p><div class="hips">')
        for h in inv.hipotesis:
            s.append(f'<div class="hip"><h3>{e(h.titulo)}</h3><div class="sub" style="margin:0">{e(h.pregunta)}</div>'
                     f'<div class="estado e-{h.estado}">{e(ESTADOS_TEXTO[h.estado])}'
                     + (f" · efecto {e(fmt_dinero(h.impacto))}" if h.impacto else "") + "</div>"
                     f"<p>{e(h.resumen)}</p>")
            if h.hechos:
                s.append('<div class="etiqueta">Hechos</div>' + _lista(h.hechos[:5]))
            if h.posibles_causas and h.estado in ("respaldada", "parcial"):
                s.append('<div class="etiqueta">Posibles causas (por confirmar)</div>' + _lista(h.posibles_causas))
            if h.que_comprobar and h.estado in ("respaldada", "parcial"):
                s.append('<div class="etiqueta">Qué comprobar</div>' + _lista(h.que_comprobar[:3]))
            if h.datos_faltantes:
                s.append('<div class="etiqueta">Datos que faltan</div>' + _lista(h.datos_faltantes))
            s.append("</div>")
        s.append("</div>")

    otros = [h for h in inv.hallazgos]
    if otros:
        s.append("<h2>Otras señales que conviene atender</h2>")
        s.append(_lista([f"{h.titulo}. {h.explicacion}" for h in otros]))

    # Alternativas
    if acciones:
        s.append("<h2>Alternativas y su impacto</h2>")
        s.append('<p class="sub">Cada impacto lo calcula el simulador sobre tu mes típico reciente '
                 f'({e(base.meses_referencia)}). Cambia según los supuestos indicados.</p><div class="tabla"><table>'
                 "<tr><th>Acción</th><th>Utilidad / mes</th><th>Efectivo (una vez)</th><th>Esfuerzo</th><th>Supuestos y riesgos</th></tr>")
        for a in acciones:
            sens = "; ".join(f"{k}: {fmt_dinero(v)}" for k, v in a.sensibilidad.items())
            detalle = _lista(a.supuestos + a.riesgos + ([f"Sensibilidad — {sens}"] if sens else []))
            s.append(f"<tr><td><strong>{e(a.titulo)}</strong><br>{e(a.descripcion)}"
                     + (" <span class='badge prov'>requiere revisión profesional</span>" if a.requiere_experto else "")
                     + f"</td><td class='n'>{e(('+' if a.impacto_utilidad_mes > 0 else '') + fmt_dinero(a.impacto_utilidad_mes))}</td>"
                     f"<td class='n'>{e(fmt_dinero(a.impacto_caja_unico) if a.impacto_caja_unico else '—')}</td>"
                     f"<td>{e(a.esfuerzo)}<br><span class='meta'>{e(a.plazo)}</span></td><td>{detalle}</td></tr>")
        s.append("</table></div>")

        # Escenarios
        con_palanca = [a for a in acciones if a.palancas.describir() != Palancas().describir()]
        escenarios = [(a.titulo, replace(a.palancas, meses=6)) for a in con_palanca[:3]]
        if len(con_palanca) > 1:
            escenarios.append(("Plan combinado", replace(_combinar([a.palancas for a in con_palanca]), meses=6)))
        escenarios += [(x.nombre, x.palancas) for x in sesion.escenarios]
        tabla = sesion.comparar(escenarios)
        s.append("<h2>Escenarios a 6 meses</h2><div class='tabla'><table><tr><th>Escenario</th><th>Utilidad / mes</th>"
                 "<th>Margen</th><th>Utilidad 6 meses</th><th>Caja generada</th><th>Faltante de caja</th></tr>")
        for nombre, f in tabla.iterrows():
            s.append(f"<tr><td>{e(nombre)}</td><td class='n'>{e(fmt_dinero(f['utilidad_mes']))}</td>"
                     f"<td class='n'>{e(fmt_pct(f['margen_operativo']))}</td><td class='n'>{e(fmt_dinero(f['utilidad_periodo']))}</td>"
                     f"<td class='n'>{e(fmt_dinero(f['caja_final']))}</td><td class='n'>{e(fmt_dinero(f['necesidad_financiamiento']))}</td></tr>")
        s.append("</table></div>")
        s.append("<details><summary>Supuestos de la proyección</summary>" + _lista(base.supuestos) + "</details>")

        s.append("<h2>Plan de acción</h2><table><tr><th>Cuándo</th><th>Qué hacer</th><th>Primer paso</th></tr>")
        for a in acciones:
            s.append(f"<tr><td>{e(a.plazo)}</td><td>{e(a.titulo)}</td><td>{e(a.primer_paso)}</td></tr>")
        s.append("</table>")

    # Riesgos y límites
    s.append("<h2>Riesgos y límites de este análisis</h2>")
    revisiones = revisiones_requeridas(inv, None, res.confianza)
    if revisiones:
        s.append('<div class="aviso">' + _lista(revisiones) + "</div>")
    s.append(_lista(LIMITES_GENERALES + res.supuestos))
    if res.faltantes:
        s.append("<h3>Información que mejoraría el análisis</h3>" + _lista(res.faltantes))

    # Anexos
    s.append("<h2>Anexo A. Calidad de los datos</h2>")
    r = val.resumen
    s.append(f"<p>Se leyeron {r['filas_leidas']} filas; se analizaron {r['filas_analizadas']} y se excluyeron "
             f"{r['filas_excluidas']} ({fmt_pct(r['pct_importe_excluido'])} del importe).</p>")
    s.append("<div class='tabla'><table><tr><th>Severidad</th><th>Problema</th><th>Qué se hizo</th><th>Filas</th></tr>")
    for p in val.problemas:
        filas = ", ".join(p.filas[:3]) + (f" y {len(p.filas) - 3} más" if len(p.filas) > 3 else "")
        s.append(f"<tr><td>{e(p.severidad)}</td><td><strong>{e(p.titulo)}</strong><br>{e(p.explicacion)}</td>"
                 f"<td>{e(p.accion_tomada or p.sugerencia)}</td><td><code>{e(filas)}</code></td></tr>")
    s.append("</table></div>")

    s.append("<h2>Anexo B. Trazabilidad de las cifras</h2>")
    s.append('<p class="sub">Cada cifra del informe con su fórmula, periodo y origen. El detalle completo se exporta en JSON.</p>')
    s.append("<div class='tabla'><table><tr><th>Cifra</th><th>Valor</th><th>Fórmula</th><th>Periodo</th><th>Origen</th></tr>")
    claves = [c for c in lib.todas() if not any(c.clave.endswith(f".{m}") for m in res.periodos.meses)]
    for c in claves:
        origen = (f"{len(c.origen)} filas (p. ej. {c.origen[0]})" if c.origen
                  else ("de: " + ", ".join(c.depende_de)) if c.depende_de else "—")
        s.append(f"<tr><td>{e(c.nombre)}<br><code>{e(c.clave)}</code></td><td class='n'>{e(c.texto())}</td>"
                 f"<td>{e(c.formula)}{'<br><span class=meta>' + e(' '.join(c.supuestos)) + '</span>' if c.supuestos else ''}</td>"
                 f"<td>{e(c.periodo)}</td><td><code>{e(origen)}</code></td></tr>")
    s.append("</table></div>")

    usados = {c.concepto for c in lib.todas() if c.concepto} & set(GLOSARIO)
    s.append("<h2>Anexo C. Glosario</h2>")
    for clave in GLOSARIO:
        if clave in usados:
            g = GLOSARIO[clave]
            s.append(f"<details><summary><strong>{e(g['nombre'])}</strong>: {e(g['que_es'])}</summary>"
                     f"<p>Cómo se calcula: {e(g['calculo'])}<br>Por qué importa: {e(g['importa'])}<br>"
                     f"Qué revisar: {e(g['revisar'])}</p></details>")

    doc = (f'<!doctype html><html lang="es"><head><meta charset="utf-8">'
           f'<meta name="viewport" content="width=device-width,initial-scale=1">'
           f"<title>Diagnóstico financiero — {e(empresa)} · {e(marca.NOMBRE)}</title><style>{CSS}</style></head>"
           f"<body><main>{''.join(s)}</main></body></html>")
    doc = doc.replace("</main>", _pie(contacto) + "</main>")
    ruta = Path(ruta)
    ruta.parent.mkdir(parents=True, exist_ok=True)
    ruta.write_text(doc, encoding="utf-8")
    return ruta
