"""Interfaz de línea de comandos: modo guiado (conversacional) y modo automático.

    python -m analista_financiero                      # modo guiado
    python -m analista_financiero guiar ventas.xlsx    # modo guiado con un archivo
    python -m analista_financiero analizar ventas.xlsx --tc USD=18.5 --informe informe.html
    python -m analista_financiero demo --salida demo/  # genera datos de ejemplo y su informe
    python -m analista_financiero preguntar ventas.xlsx "¿por qué bajó mi utilidad?"
"""

from __future__ import annotations

import argparse
import sys
import textwrap
from datetime import date
from pathlib import Path

from .diagnostico import ESTADOS_TEXTO
from .escenarios import Palancas
from .explicar import explicar_cifra, explicar_variacion, leccion
from .modelos import fmt_dinero, fmt_pct
from .sesion import BIENVENIDA, Sesion

ANCHO = 88


def decir(texto: str = "", sangria: str = "") -> None:
    for parrafo in str(texto).split("\n"):
        print(textwrap.fill(parrafo, ANCHO, initial_indent=sangria, subsequent_indent=sangria) if parrafo else "")


def titulo(texto: str) -> None:
    print("\n" + texto.upper())
    print("─" * min(ANCHO, len(texto) + 4))


def preguntar(texto: str, opciones: list[str] | None = None, defecto: str | None = None) -> str:
    if opciones:
        for i, o in enumerate(opciones, 1):
            print(f"  {i}. {o}")
    sufijo = f" [{defecto}]" if defecto else ""
    try:
        r = input(f"{texto}{sufijo}: ").strip()
    except EOFError:
        r = ""
    if not r and defecto is not None:
        return defecto
    if opciones and r.isdigit() and 1 <= int(r) <= len(opciones):
        return opciones[int(r) - 1]
    return r


def mostrar_paso(s: Sesion) -> None:
    p = s.siguiente_paso()
    print()
    decir(f"➜ Siguiente paso ({p.etapa}/8): {p.titulo}")
    decir(p.que_hacer, "   ")
    decir(f"Por qué: {p.por_que}", "   ")


# ---------------------------------------------------------------------------
# Presentación de resultados
# ---------------------------------------------------------------------------

def mostrar_validacion(s: Sesion) -> None:
    v = s.validar()
    titulo("Revisión de tus datos")
    r = v.resumen
    decir(f"Leí {r['filas_leidas']} filas de {' a '.join(r['meses'][:1] + r['meses'][-1:])}. "
          f"Analizaré {r['filas_analizadas']} y dejé fuera {r['filas_excluidas']}.")
    for p in v.problemas:
        marca = {"bloqueante": "✖", "advertencia": "!", "info": "·"}[p.severidad]
        decir(f"{marca} {p.titulo}. {p.explicacion}", "  ")
        if p.accion_tomada:
            decir(f"→ {p.accion_tomada}", "      ")
        if p.filas:
            decir(f"Filas: {', '.join(p.filas[:3])}{' …' if len(p.filas) > 3 else ''}", "      ")


def mostrar_diagnostico(s: Sesion) -> None:
    inv = s.investigar()
    res = s.analizar()
    titulo("¿Cuánto estoy ganando realmente?")
    decir(inv.respuesta_principal)
    if res.confianza != "confiable":
        decir("(Resultado PROVISIONAL: hay problemas de datos sin confirmar.)")
    if inv.hallazgo_inicial:
        titulo(f"Hallazgo inicial: {inv.hallazgo_inicial.titulo}")
        decir(inv.hallazgo_inicial.explicacion)
    for h in inv.hallazgos:
        decir(f"• {h.titulo}. {h.explicacion}", "  ")


def mostrar_investigacion(s: Sesion) -> None:
    inv = s.investigar()
    if not inv.puente:
        decir(inv.conclusion)
        return
    titulo("Puente de utilidad: qué sumó y qué restó")
    for p in inv.puente:
        signo = "" if p["tipo"] == "total" else ("+" if p["valor"] > 0 else "")
        decir(f"{p['etiqueta']:<48}{signo + fmt_dinero(p['valor']):>16}", "  ")
    titulo("Paso 1. ¿Qué cambió?")
    for h in inv.hipotesis:
        decir(f"■ {h.titulo} — {h.pregunta}")
        decir(f"{ESTADOS_TEXTO[h.estado]}. {h.resumen}", "   ")
        for x in h.hechos[:4]:
            decir(f"✓ Hecho: {x}", "     ")
        if h.estado in ("respaldada", "parcial"):
            for x in h.posibles_causas[:2]:
                decir(f"? Hipótesis por confirmar: {x}", "     ")
            for x in h.que_comprobar[:2]:
                decir(f"→ Comprueba: {x}", "     ")
        for x in h.datos_faltantes:
            decir(f"… Falta: {x}", "     ")
    titulo("Paso 2. Conclusión con los datos confirmados")
    decir(inv.conclusion)


def mostrar_acciones(s: Sesion) -> None:
    titulo("Paso 3. Acciones recomendadas (simuladas)")
    for i, a in enumerate(s.recomendar(), 1):
        imp = ("+" if a.impacto_utilidad_mes > 0 else "") + fmt_dinero(a.impacto_utilidad_mes)
        decir(f"{i}. {a.titulo}: {imp} de utilidad al mes"
              + (f"; libera {fmt_dinero(a.impacto_caja_unico)} de efectivo" if a.impacto_caja_unico else ""))
        decir(a.descripcion, "   ")
        for x in a.supuestos:
            decir(f"Supuesto: {x}", "   ")
        for k, v in a.sensibilidad.items():
            decir(f"Si {k}: {fmt_dinero(v)} al mes", "   ")
        for x in a.riesgos[:1]:
            decir(f"Riesgo: {x}", "   ")
        if a.requiere_experto:
            decir("Conviene revisarlo con un profesional.", "   ")
        decir(f"Primer paso: {a.primer_paso}", "   ")


def menu_explicar(s: Sesion) -> None:
    lib = s.analizar().libro
    opciones = ["margen_bruto", "margen_operativo", "utilidad_operativa", "gastos_operativos", "flujo_efectivo",
                "punto_equilibrio", "efecto_mezcla", "efecto_costo", "dias_cobro"]
    eleccion = preguntar("¿Qué quieres entender?", opciones, "margen_bruto")
    claves = {"flujo_efectivo": "flujo_operativo.total", "punto_equilibrio": "punto_equilibrio.mensual",
              "efecto_mezcla": "efecto.mezcla", "efecto_costo": "efecto.costo", "dias_cobro": "dias_cobro.total"}
    if f"var.{eleccion}" in lib:
        decir(explicar_variacion(lib, eleccion))
    clave = claves.get(eleccion, f"{eleccion}.actual" if f"{eleccion}.actual" in lib else f"{eleccion}.total")
    c = lib.get(clave)
    if c is not None:
        decir(explicar_cifra(c, lib))
    print()
    decir(leccion(eleccion))


def menu_simular(s: Sesion) -> None:
    titulo("Simulador: ¿qué pasa si...?")
    decir("Escribe porcentajes como 5 (=5%) o -10. Deja vacío para no cambiar.")

    def num(texto: str) -> float:
        r = preguntar(texto, defecto="0")
        try:
            return float(r.replace("%", "")) / 100
        except ValueError:
            return 0.0

    pal = Palancas(
        cambio_precio_pct=num("Cambio de precio %"),
        cambio_volumen_pct=num("Cambio de unidades vendidas %"),
        cambio_costo_unitario_pct=num("Cambio del costo por unidad %"),
        cambio_gastos_pct=num("Cambio de gastos de operación %"),
    )
    if pal.cambio_precio_pct:
        pal.elasticidad = -num("¿Cuántas unidades pierdes (%) por cada 1% que sube el precio? (ej. 80 = 0.8)")
    dc = preguntar("Días de cobro (vacío = como hoy)", defecto="")
    if dc:
        pal.dias_cobro = float(dc)
    saldo = preguntar("Saldo actual en el banco (vacío si no lo sabes)", defecto="")
    if saldo:
        pal.saldo_inicial = float(saldo.replace(",", "").replace("$", ""))
    esc = s.simular(pal, "Mi escenario")
    tabla = s.comparar([("Mi escenario", pal)])
    for nombre, f in tabla.iterrows():
        decir(f"{nombre:<16} utilidad/mes {fmt_dinero(f['utilidad_mes']):>12}  margen {fmt_pct(f['margen_operativo']):>7}  "
              f"caja 6m {fmt_dinero(f['caja_final']):>12}  faltante {fmt_dinero(f['necesidad_financiamiento']):>10}", "  ")
    for x in esc.supuestos:
        decir(f"· {x}", "  ")
    if esc.necesidad_financiamiento > 0:
        decir(f"En este escenario te faltarían hasta {fmt_dinero(esc.necesidad_financiamiento)}. Antes de pedir "
              "un crédito, revisa su costo y condiciones con un profesional.")


def menu_preguntar(s: Sesion, pregunta: str | None = None) -> None:
    from .asistente import Asistente
    asistente = Asistente(s)
    decir(f"(Asistente: {asistente.modo})")
    while True:
        q = pregunta or preguntar("Tu pregunta (vacío para volver)", defecto="")
        if not q:
            return
        decir(asistente.responder(q))
        if pregunta:
            return


# ---------------------------------------------------------------------------
# Flujos
# ---------------------------------------------------------------------------

def resolver_preguntas(s: Sesion, auto: bool = False) -> None:
    while s.preguntas_pendientes():
        p = s.preguntas_pendientes()[0]
        if auto:
            if p.sugerida is None:
                raise SystemExit(f"Necesito una respuesta: {p.texto} (usa el modo guiado o --tc)")
            s.responder(p.id, p.sugerida)
            continue
        decir(p.texto)
        decir(f"({p.por_que})", "  ")
        r = preguntar("Respuesta", p.opciones or None, p.sugerida)
        s.responder(p.id, r)
        if p.tipo != "mapeo_columna":
            s.validar()


def guiado(ruta: str | None = None) -> None:
    s = Sesion()
    titulo("Analista financiero")
    decir(BIENVENIDA)
    if ruta is None:
        op = preguntar("¿Cómo quieres empezar?", ["Subir un Excel o CSV", "Introducir cifras manualmente",
                                                  "Probar con datos de ejemplo"], "Probar con datos de ejemplo")
        if op.startswith("Subir"):
            ruta = preguntar("Ruta del archivo")
        elif op.startswith("Introducir"):
            meses = []
            decir("Por cada mes escribe ventas, costo de lo vendido y gastos. Mes vacío para terminar.")
            while True:
                mes = preguntar("Mes (AAAA-MM)", defecto="")
                if not mes:
                    break
                meses.append({"mes": mes, "ventas": float(preguntar("  Ventas")),
                              "costo_ventas": float(preguntar("  Costo de lo vendido")),
                              "gastos": float(preguntar("  Gastos de operación"))})
            s.cargar_manual(meses)
        else:
            from .demo import generar_excel
            ruta = str(generar_excel(Path("demo_analista/cafe_la_montana.xlsx")))
            decir(f"Generé datos de ejemplo en {ruta}.")
    if ruta:
        s.cargar_archivo(ruta)
        titulo("Cómo leí tu archivo")
        for t in s.tablas:
            m = s.mapeos[t.nombre]
            usadas = ", ".join(f"«{c}»→{f}" for c, f in m.mapeo.items() if f != "(ignorar)")
            decir(f"{t.nombre}: {usadas}" + (f" (todo es {m.tipo_hoja})" if m.tipo_hoja else ""))
    resolver_preguntas(s)
    s.validar()
    resolver_preguntas(s)
    mostrar_validacion(s)
    if s.validar().calidad == "insuficiente":
        mostrar_paso(s)
        return
    if s.validar().advertencias:
        r = preguntar("¿Aceptas cómo traté estos problemas?", ["Sí, continuar", "Continuar como provisional"], "Sí, continuar")
        if r.startswith("Sí"):
            s.confirmar_problemas()
    mostrar_diagnostico(s)
    mostrar_investigacion(s)
    mostrar_acciones(s)
    while True:
        mostrar_paso(s)
        op = preguntar("\n¿Qué hacemos?", ["Entender una cifra", "Simular un escenario", "Preguntar libremente",
                                           "Generar informe", "Salir"], "Generar informe")
        if op.startswith("Entender"):
            menu_explicar(s)
        elif op.startswith("Simular"):
            menu_simular(s)
        elif op.startswith("Preguntar"):
            menu_preguntar(s)
        elif op.startswith("Generar"):
            destino = preguntar("Nombre del informe", defecto="informe_financiero.html")
            ruta_inf = s.informe(destino)
            s.exportar_json(Path(destino).with_suffix(".json"))
            decir(f"Listo: {ruta_inf} (ábrelo en el navegador; se puede imprimir a PDF). "
                  f"La trazabilidad completa está en {Path(destino).with_suffix('.json')}.")
        else:
            return


def automatico(args: argparse.Namespace) -> int:
    s = Sesion(hoy=date.today())
    s.cargar_archivo(args.archivo)
    for tc in args.tc or []:
        moneda, valor = tc.split("=")
        s.fijar_tipo_cambio(moneda, float(valor))
    s.aceptar_sugerencias()
    s.validar()
    for p in s.preguntas_pendientes():
        if p.tipo == "tipo_cambio":
            decir(f"Aviso: {p.texto} Usa --tc {p.contexto['moneda']}=VALOR; por ahora esas filas quedan fuera.")
            p.respuesta = "(sin respuesta)"
    resolver_preguntas(s, auto=True)
    mostrar_validacion(s)
    if s.validar().calidad == "insuficiente":
        mostrar_paso(s)
        return 1
    if args.confirmar:
        s.confirmar_problemas()
    mostrar_diagnostico(s)
    mostrar_investigacion(s)
    mostrar_acciones(s)
    if args.informe:
        ruta = s.informe(args.informe, args.empresa)
        decir(f"\nInforme: {ruta}")
    if args.json:
        decir(f"Trazabilidad: {s.exportar_json(args.json)}")
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="analista_financiero", description="Analista financiero guiado")
    sub = parser.add_subparsers(dest="comando")
    g = sub.add_parser("guiar", help="modo conversacional paso a paso")
    g.add_argument("archivo", nargs="?")
    a = sub.add_parser("analizar", help="análisis completo sin preguntas")
    a.add_argument("archivo")
    a.add_argument("--tc", action="append", help="tipo de cambio, ej. USD=18.5")
    a.add_argument("--informe", help="ruta del informe HTML")
    a.add_argument("--json", help="ruta de la trazabilidad en JSON")
    a.add_argument("--empresa", default="Tu empresa")
    a.add_argument("--confirmar", action="store_true", help="aceptar el tratamiento de problemas de datos")
    d = sub.add_parser("demo", help="genera datos de ejemplo y su informe")
    d.add_argument("--salida", default="demo_analista")
    q = sub.add_parser("preguntar", help="pregunta en lenguaje natural sobre un archivo")
    q.add_argument("archivo")
    q.add_argument("pregunta")
    args = parser.parse_args(argv)

    if args.comando in (None, "guiar"):
        guiado(getattr(args, "archivo", None))
        return 0
    if args.comando == "analizar":
        return automatico(args)
    if args.comando == "demo":
        from .demo import generar_csv, generar_excel
        salida = Path(args.salida)
        x = generar_excel(salida / "cafe_la_montana.xlsx")
        generar_csv(salida / "cafe_la_montana.csv")
        ns = argparse.Namespace(archivo=str(x), tc=["USD=18.5"], informe=str(salida / "informe.html"),
                                json=str(salida / "trazabilidad.json"), empresa="Café La Montaña", confirmar=True)
        return automatico(ns)
    if args.comando == "preguntar":
        s = Sesion()
        s.cargar_archivo(args.archivo)
        s.aceptar_sugerencias()
        s.validar()
        for p in s.preguntas_pendientes():
            p.respuesta = "(sin respuesta)"
        menu_preguntar(s, args.pregunta)
        return 0
    parser.print_help()
    return 1


if __name__ == "__main__":
    sys.exit(main())
