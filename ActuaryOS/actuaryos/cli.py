"""Línea de comandos de ActuaryOS.

    python -m actuaryos validar   DATOS
    python -m actuaryos recomendar DATOS [--primas P.csv --elr 0.70]
    python -m actuaryos reservas  DATOS --metodo {chain-ladder,bf,mack,todos} [...]
    python -m actuaryos reproducir REGISTRO.json
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import pandas as pd

from .auditoria import crear_registro, ejecutar, guardar_registro, reproducir
from .comparar import comparar_metodos
from .datos import cargar_triangulo
from .informe import a_moneda, informe_markdown
from .reservas import MetodoNoAplicable
from .selector import recomendar


def _args_carga(p: argparse.ArgumentParser) -> None:
    p.add_argument("datos", help="Archivo CSV o Excel con el triángulo")
    p.add_argument("--formato", choices=["ancho", "largo"], default="ancho",
                   help="ancho: una fila por origen; largo: una fila por celda (default: ancho)")
    p.add_argument("--unidad", default="sin especificar", help="unidades, pesos, miles o millones")
    p.add_argument("--moneda", default="sin especificar", help="p. ej. MXN")
    p.add_argument("--hoja", default=None, help="Hoja de Excel a leer")
    p.add_argument("--incremental", action="store_true", help="Los montos son pagos del periodo; acumularlos")
    p.add_argument("--limpiar-formato", action="store_true",
                   help="Aceptar números con $ o separadores de miles (queda registrado)")
    p.add_argument("--col-origen", help="Nombre de la columna de origen")
    p.add_argument("--col-desarrollo", help="(formato largo) columna de edad de desarrollo")
    p.add_argument("--col-valor", help="(formato largo) columna de montos")
    p.add_argument("--col-moneda", help="(formato largo) columna de moneda")


def _carga(a: argparse.Namespace) -> dict:
    columnas = {k: v for k, v in {"origen": a.col_origen, "desarrollo": a.col_desarrollo,
                                  "valor": a.col_valor, "moneda": a.col_moneda}.items() if v}
    return {"ruta": str(a.datos), "formato": a.formato, "columnas": columnas or None,
            "unidad": a.unidad, "moneda": a.moneda, "hoja": a.hoja,
            "limpiar_formato": a.limpiar_formato, "incremental": a.incremental}


def _cargar(a: argparse.Namespace):
    carga = _carga(a)
    ruta = carga.pop("ruta")
    tri, hallazgos = cargar_triangulo(ruta, **carga)
    return tri, hallazgos


def _imprimir_hallazgos(hallazgos) -> None:
    if not hallazgos:
        print("✔ Sin hallazgos en los datos.")
        return
    for h in hallazgos:
        print(str(h))


def _leer_primas(ruta: str) -> dict[str, float]:
    df = pd.read_csv(ruta, dtype=str)
    col_o, col_p = df.columns[0], df.columns[1]
    return {str(o).strip(): float(p) for o, p in zip(df[col_o], df[col_p])}


def cmd_validar(a) -> int:
    tri, hallazgos = _cargar(a)
    _imprimir_hallazgos(hallazgos)
    if tri is not None:
        print("\n" + tri.como_tabla())
        print("\n✔ Los datos se pueden usar para calcular." if not hallazgos else
              "\n✔ Se puede calcular, pero revisa las advertencias.")
        return 0
    print("\n✘ Corrige los errores antes de calcular. Los datos originales no se modificaron.")
    return 1


def cmd_recomendar(a) -> int:
    tri, hallazgos = _cargar(a)
    if tri is None:
        _imprimir_hallazgos(hallazgos)
        return 1
    print(recomendar(tri, tiene_primas=bool(a.primas), tiene_elr=a.elr is not None))
    return 0


def cmd_reservas(a) -> int:
    tri, hallazgos = _cargar(a)
    if hallazgos:
        print("Validación de datos:")
        _imprimir_hallazgos(hallazgos)
        print()
    if tri is None:
        print("✘ No se calculó nada: corrige los errores anteriores.")
        return 1

    metodos = ["chain-ladder", "bf", "mack"] if a.metodo == "todos" else [a.metodo]
    resultados, registros = [], []
    for metodo in metodos:
        params: dict = {"cola": a.cola}
        if metodo == "bf":
            if not a.primas or a.elr is None:
                msg = "Bornhuetter-Ferguson requiere --primas y --elr (la app no inventa supuestos)."
                if a.metodo == "todos":
                    print(f"• Se omite BF: {msg}")
                    continue
                print(f"✘ {msg}")
                return 1
            params.update(primas=_leer_primas(a.primas), siniestralidad_esperada=a.elr,
                          fuente_supuesto=a.fuente_elr)
        if metodo == "mack":
            params = {"nivel_confianza": a.confianza}
            if a.cola != 1.0:
                print("• Se omite Mack: con factor de cola ≠ 1 la incertidumbre de la cola no está modelada.")
                continue
        try:
            r = ejecutar(metodo, tri, params)
        except MetodoNoAplicable as e:
            print(f"✘ {metodo}: {e}")
            if a.metodo != "todos":
                return 1
            continue
        resultados.append(r)
        registros.append(crear_registro(r, {**_carga(a), "metodo": metodo}, hallazgos))

    if not resultados:
        return 1
    for r in resultados:
        print(f"== {r.metodo} ==")
        for f in r.tabla_origenes:
            extra = f"   ee {a_moneda(f['error_estandar'], tri.unidad, tri.moneda)}" if "error_estandar" in f else ""
            print(f"  {f['origen']:<8} último {a_moneda(f['ultimo'], tri.unidad, tri.moneda):>22}"
                  f"   reserva {a_moneda(f['reserva'], tri.unidad, tri.moneda):>20}{extra}")
        print(f"  RESERVA TOTAL: {a_moneda(r['reserva:total'], tri.unidad, tri.moneda)}")
        if "error_estandar:total" in r.cifras:
            print(f"  Error estándar: {a_moneda(r['error_estandar:total'], tri.unidad, tri.moneda)}  "
                  f"Intervalo {a.confianza:.0%}: {a_moneda(r['intervalo:total:inferior'], tri.unidad, tri.moneda)}"
                  f" – {a_moneda(r['intervalo:total:superior'], tri.unidad, tri.moneda)}")
        for h in r.advertencias:
            print(f"  ⚠ {h.mensaje}")
        print(f"  Estado: {r.estado}\n")
    if len(resultados) > 1:
        print(comparar_metodos(resultados) + "\n")

    if a.por_que:
        for clave in a.por_que:
            try:
                print(resultados[0].por_que(clave, a.modo) + "\n")
            except KeyError as e:
                print(f"✘ {e.args[0]}")
                return 1
    if a.informe:
        Path(a.informe).write_text(informe_markdown(tri, resultados, hallazgos), encoding="utf-8")
        print(f"Informe: {a.informe}")
    if a.registro:
        guardar_registro(registros[0] if len(registros) == 1 else {"corridas": registros}, a.registro)
        print(f"Registro de auditoría: {a.registro}")
    return 0


def cmd_reproducir(a) -> int:
    registro = json.loads(Path(a.registro).read_text(encoding="utf-8"))
    corridas = registro.get("corridas", [registro])
    todo_ok = True
    for c in corridas:
        print(f"== {c['resultado']['metodo']} ==")
        ok, detalle = reproducir(c, a.datos)
        todo_ok &= ok
        print("\n".join(detalle) + "\n")
    return 0 if todo_ok else 1


def construir_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="actuaryos", description="ActuaryOS: reservas explicables y auditables")
    sub = p.add_subparsers(dest="comando", required=True)

    v = sub.add_parser("validar", help="Detectar errores en los datos antes de calcular")
    _args_carga(v)
    v.set_defaults(func=cmd_validar)

    r = sub.add_parser("recomendar", help="Evaluar qué métodos permiten los datos")
    _args_carga(r)
    r.add_argument("--primas", help="CSV con origen,prima devengada")
    r.add_argument("--elr", type=float, help="Siniestralidad esperada a priori (p. ej. 0.70)")
    r.set_defaults(func=cmd_recomendar)

    c = sub.add_parser("reservas", help="Calcular reservas")
    _args_carga(c)
    c.add_argument("--metodo", choices=["chain-ladder", "bf", "mack", "todos"], default="chain-ladder")
    c.add_argument("--cola", type=float, default=1.0, help="Factor de cola (default 1: sin desarrollo posterior)")
    c.add_argument("--primas", help="CSV con origen,prima devengada (para BF)")
    c.add_argument("--elr", type=float, help="Siniestralidad esperada a priori para BF (p. ej. 0.70)")
    c.add_argument("--fuente-elr", default="proporcionado por el usuario",
                   help="De dónde sale la siniestralidad a priori (queda en el informe)")
    c.add_argument("--confianza", type=float, default=0.95, help="Nivel del intervalo de Mack")
    c.add_argument("--por-que", action="append", metavar="CLAVE",
                   help="Explicar una cifra, p. ej. reserva:2024, factor:12-24, reserva:total")
    c.add_argument("--modo", choices=["principiante", "experto"], default="experto")
    c.add_argument("--informe", help="Escribir informe Markdown en esta ruta")
    c.add_argument("--registro", help="Escribir registro de auditoría JSON en esta ruta")
    c.set_defaults(func=cmd_reservas)

    x = sub.add_parser("reproducir", help="Recalcular desde un registro de auditoría y conciliar")
    x.add_argument("registro")
    x.add_argument("--datos", help="Ruta alternativa al archivo de datos")
    x.set_defaults(func=cmd_reproducir)
    return p


def main(argv: list[str] | None = None) -> int:
    a = construir_parser().parse_args(argv)
    return a.func(a)


if __name__ == "__main__":
    sys.exit(main())

