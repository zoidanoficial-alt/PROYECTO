"""Etapa 2: validar la información antes de analizarla.

Detecta fechas inválidas, importes ilegibles, duplicados, monedas mezcladas,
filas de "total" que harían contar doble (y si esos totales cuadran),
meses sin datos y partidas inusuales.

Regla: nunca presentar datos dudosos como resultados definitivos. Cada
problema queda registrado con las filas afectadas y lo que se hizo con
ellas; el análisis se marca como "provisional" mientras haya advertencias
sin confirmar.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import date

import numpy as np
import pandas as pd

from .modelos import Problema, fmt_dinero, primer_texto

PATRON_TOTAL = re.compile(r"\b(?:sub\s*)?total(?:es)?\b", re.IGNORECASE)
CLAVE_DUPLICADO = ["fecha", "tipo", "concepto", "categoria", "producto", "cantidad",
                   "importe", "moneda", "folio", "contraparte"]


@dataclass
class OpcionesValidacion:
    moneda_base: str = "MXN"
    tipos_cambio: dict[str, float] = field(default_factory=dict)  # {"USD": 18.5}
    excluir_duplicados: bool = True
    hoy: date | None = None
    tolerancia_totales: float = 0.005  # 0.5%


@dataclass
class ResultadoValidacion:
    limpio: pd.DataFrame
    excluido: pd.DataFrame  # filas fuera del análisis, con columna "motivo"
    problemas: list[Problema]
    calidad: str  # "confiable" | "provisional" | "insuficiente"
    supuestos: list[str]
    resumen: dict

    @property
    def bloqueantes(self) -> list[Problema]:
        return [p for p in self.problemas if p.severidad == "bloqueante"]

    @property
    def advertencias(self) -> list[Problema]:
        return [p for p in self.problemas if p.severidad == "advertencia"]


def _muestra(df: pd.DataFrame, n: int = 50) -> list[str]:
    return df["origen"].astype(str).tolist()[:n]


def validar(mov: pd.DataFrame, opciones: OpcionesValidacion | None = None) -> ResultadoValidacion:
    op = opciones or OpcionesValidacion()
    hoy = pd.Timestamp(op.hoy or date.today())
    df = mov.copy()
    df["motivo"] = None
    df["inusual"] = False
    problemas: list[Problema] = []
    supuestos: list[str] = [
        "Las fechas escritas como 03/04/2026 se leen como día/mes/año (formato México).",
    ]

    def excluir(mask: pd.Series, motivo: str) -> None:
        df.loc[mask & df["motivo"].isna(), "motivo"] = motivo

    # 1. Filas de total o subtotal: se excluyen para no contar doble, y se verifica que cuadren.
    texto = (df["concepto"].fillna("") + " " + df["categoria"].fillna("") + " " +
             df["producto"].fillna(""))
    es_total = texto.str.contains(PATRON_TOTAL)
    if es_total.any():
        excluir(es_total, "fila de total/subtotal")
        detalle = df[~es_total]
        for _, fila in df[es_total].iterrows():
            if pd.isna(fila["fecha"]) or pd.isna(fila["importe"]) or fila["tipo"] is None:
                continue
            mes = fila["fecha"].to_period("M")
            mismos = detalle[(detalle["tipo"] == fila["tipo"]) &
                             (detalle["fecha"].dt.to_period("M") == mes) &
                             (detalle["moneda"] == fila["moneda"])]
            suma = float(mismos["importe"].abs().sum())
            declarado = abs(float(fila["importe"]))
            if declarado and abs(suma - declarado) / declarado > op.tolerancia_totales:
                problemas.append(Problema(
                    "total_no_cuadra", "advertencia",
                    f"El total de {fila['tipo']}s de {mes} no cuadra",
                    f"La fila «{primer_texto(fila['concepto'], fila['producto'], fila['categoria'])}» dice {fmt_dinero(declarado)}, pero la suma del "
                    f"detalle de ese mes da {fmt_dinero(suma)} (diferencia "
                    f"{fmt_dinero(suma - declarado)}). Puede faltar o sobrar alguna operación.",
                    filas=[fila["origen"]] + _muestra(mismos, 20),
                    sugerencia="Compara el detalle contra tu reporte original; usé la suma del detalle.",
                    accion_tomada="Se usa la suma del detalle; la fila de total no se cuenta.",
                    importe_afectado=abs(suma - declarado),
                ))
        problemas.append(Problema(
            "fila_total", "info", f"{int(es_total.sum())} fila(s) de total excluidas",
            "Las filas que ya son una suma se excluyen para no contar dos veces el mismo dinero.",
            filas=_muestra(df[es_total]), accion_tomada="Excluidas del análisis.",
        ))

    # 2. Fechas inválidas
    mal_fecha = df["fecha"].isna() & df["motivo"].isna()
    if mal_fecha.any():
        ejemplos = ", ".join(f"«{v}»" for v in df.loc[mal_fecha, "fecha_texto"].head(3).tolist())
        problemas.append(Problema(
            "fecha_invalida", "advertencia", f"{int(mal_fecha.sum())} fila(s) con fecha inválida o vacía",
            f"No puedo ubicar estas operaciones en el tiempo (ej.: {ejemplos}).",
            filas=_muestra(df[mal_fecha]),
            sugerencia="Corrige la fecha en tu archivo y vuelve a cargarlo.",
            accion_tomada="Excluidas del análisis.",
            importe_afectado=float(df.loc[mal_fecha, "importe"].abs().sum(skipna=True)),
        ))
        excluir(mal_fecha, "fecha inválida")

    # 3. Importes ilegibles o vacíos
    mal_importe = df["importe"].isna() & df["motivo"].isna()
    if mal_importe.any():
        ejemplos = ", ".join(f"«{v}»" for v in df.loc[mal_importe, "importe_texto"].head(3).tolist())
        problemas.append(Problema(
            "importe_invalido", "advertencia", f"{int(mal_importe.sum())} fila(s) sin importe válido",
            f"Estas filas no tienen un monto que pueda leer (ej.: {ejemplos}).",
            filas=_muestra(df[mal_importe]), accion_tomada="Excluidas del análisis.",
        ))
        excluir(mal_importe, "importe inválido")

    # 4. Tipo desconocido (no sé si es venta, costo o gasto)
    sin_tipo = df["tipo"].isna() & df["motivo"].isna()
    if sin_tipo.any():
        valores = sorted({str(v) for v in df.loc[sin_tipo, "tipo_texto"].dropna()})[:5]
        problemas.append(Problema(
            "tipo_desconocido", "advertencia", f"{int(sin_tipo.sum())} fila(s) sin clasificar",
            "No sé si estas filas son ventas, costos o gastos"
            + (f" (valores: {', '.join(valores)})." if valores else "."),
            filas=_muestra(df[sin_tipo]),
            sugerencia="Indica qué significa cada valor de la columna de tipo.",
            accion_tomada="Excluidas del análisis.",
            importe_afectado=float(df.loc[sin_tipo, "importe"].abs().sum(skipna=True)),
        ))
        excluir(sin_tipo, "tipo desconocido")

    # 5. Monedas mezcladas
    otras = df["motivo"].isna() & (df["moneda"] != op.moneda_base)
    if otras.any():
        for moneda, grupo in df[otras].groupby("moneda"):
            tc = op.tipos_cambio.get(moneda)
            if tc:
                df.loc[grupo.index, "importe"] = grupo["importe"] * tc
                df.loc[grupo.index, "moneda"] = op.moneda_base
                supuestos.append(f"Importes en {moneda} convertidos a {op.moneda_base} con tipo de cambio {tc}.")
                problemas.append(Problema(
                    "moneda_convertida", "info", f"{len(grupo)} fila(s) en {moneda} convertidas",
                    f"Usé un tipo de cambio de {tc} {op.moneda_base} por {moneda} para todas.",
                    filas=_muestra(grupo), accion_tomada="Convertidas.",
                ))
            else:
                problemas.append(Problema(
                    "monedas_mezcladas", "advertencia", f"{len(grupo)} fila(s) en {moneda}",
                    f"Tu archivo mezcla {op.moneda_base} con {moneda}. Sumarlas tal cual sería como "
                    f"sumar peras con manzanas.",
                    filas=_muestra(grupo),
                    sugerencia=f"Dime el tipo de cambio de {moneda} a {op.moneda_base} para incluirlas.",
                    accion_tomada="Excluidas hasta tener tipo de cambio.",
                    importe_afectado=float(grupo["importe"].abs().sum()),
                ))
                excluir(df.index.isin(grupo.index), f"moneda {moneda} sin tipo de cambio")

    vivos = df["motivo"].isna()

    # 6. Signos: los sistemas contables suelen exportar costos y gastos en negativo.
    neg_egreso = vivos & df["tipo"].isin(["costo", "gasto"]) & (df["importe"] < 0)
    if neg_egreso.any():
        df.loc[neg_egreso, "importe"] = df.loc[neg_egreso, "importe"].abs()
        supuestos.append("Costos y gastos registrados en negativo se tomaron como montos positivos (es una convención contable).")
        problemas.append(Problema(
            "signo_egreso", "info", f"{int(neg_egreso.sum())} costo(s)/gasto(s) en negativo",
            "Los tomé como egresos normales: el signo menos suele ser una convención de exportación.",
            filas=_muestra(df[neg_egreso]), accion_tomada="Convertidos a positivo.",
        ))
    neg_venta = vivos & (df["tipo"] == "venta") & (df["importe"] < 0)
    if neg_venta.any():
        problemas.append(Problema(
            "venta_negativa", "advertencia", f"{int(neg_venta.sum())} venta(s) en negativo",
            "Las interpreté como devoluciones o notas de crédito, que restan a las ventas.",
            filas=_muestra(df[neg_venta]),
            sugerencia="Confirma que son devoluciones y no errores de captura.",
            accion_tomada="Restan a las ventas del mes.",
            importe_afectado=float(df.loc[neg_venta, "importe"].abs().sum()),
        ))

    # 7. Duplicados exactos
    claves = [c for c in CLAVE_DUPLICADO if c in df.columns]
    dup = vivos & df.duplicated(subset=claves, keep="first") & df["fecha"].notna()
    if dup.any():
        problemas.append(Problema(
            "duplicado", "advertencia", f"{int(dup.sum())} registro(s) duplicado(s)",
            "Hay filas idénticas en fecha, concepto, producto e importe. Lo más común es que se "
            "hayan capturado o exportado dos veces.",
            filas=_muestra(df[dup]),
            sugerencia="Si de verdad son operaciones distintas, indícalo y las incluyo.",
            accion_tomada="Excluidas (se conserva la primera)." if op.excluir_duplicados else "Conservadas a petición del usuario.",
            importe_afectado=float(df.loc[dup, "importe"].abs().sum()),
        ))
        if op.excluir_duplicados:
            excluir(dup, "duplicado")

    vivos = df["motivo"].isna()

    # 8. Folio repetido con montos distintos (posible error de captura)
    if df["folio"].notna().any():
        con_folio = df[vivos & df["folio"].notna()]
        conflictos = con_folio.groupby(["tipo", "folio"])["importe"].nunique()
        conflictos = conflictos[conflictos > 1]
        if len(conflictos):
            filas = con_folio.set_index(["tipo", "folio"]).loc[conflictos.index, "origen"].tolist()
            problemas.append(Problema(
                "folio_conflicto", "advertencia", f"{len(conflictos)} folio(s) repetidos con montos distintos",
                "El mismo número de factura aparece con importes diferentes.",
                filas=filas[:50], sugerencia="Revisa si es una corrección o una captura doble.",
                accion_tomada="Se incluyeron; revísalos.",
            ))

    # 9. Fechas en el futuro
    futuro = vivos & (df["fecha"] > hoy)
    if futuro.any():
        problemas.append(Problema(
            "fecha_futura", "advertencia", f"{int(futuro.sum())} operación(es) con fecha futura",
            "Pueden ser errores de captura (año equivocado) o ventas programadas.",
            filas=_muestra(df[futuro]), accion_tomada="Se incluyeron; revísalas.",
        ))

    limpio = df[vivos].copy()

    # 10. Ventas/costos ausentes y meses sin datos
    if not (limpio["tipo"] == "venta").any():
        problemas.append(Problema(
            "sin_ventas", "bloqueante", "No encontré ventas",
            "Sin ventas no puedo calcular márgenes ni utilidades.",
            sugerencia="Carga un archivo con tus ventas o indica qué columna/hoja las contiene.",
        ))
    if not (limpio["tipo"] == "costo").any():
        problemas.append(Problema(
            "sin_costos", "advertencia", "No encontré costos de venta",
            "Sin el costo de lo que vendes no puedo saber cuánto te deja cada venta (margen bruto). "
            "Todo lo que no sea venta lo estoy tratando como gasto.",
            sugerencia="Si tienes compras de mercancía o materia prima, márcalas como «costo».",
        ))
    if len(limpio) and (limpio["tipo"] == "venta").any():
        meses_venta = set(limpio.loc[limpio["tipo"] == "venta", "fecha"].dt.to_period("M"))
        rango = pd.period_range(min(meses_venta), max(meses_venta), freq="M")
        huecos = [str(m) for m in rango if m not in meses_venta]
        if huecos:
            problemas.append(Problema(
                "mes_sin_ventas", "advertencia", f"Meses sin ventas registradas: {', '.join(huecos)}",
                "Puede ser real (cierre temporal) o que falten datos. Si faltan, las comparaciones saldrán sesgadas.",
                sugerencia="Confirma si ese mes no hubo ventas o carga los datos faltantes.",
            ))

    # 11. Partidas inusuales (posibles extraordinarios): se marcan, no se excluyen.
    for (tipo, cat), grupo in limpio.groupby(["tipo", limpio["categoria"].fillna("(sin categoría)")]):
        if tipo == "venta" or len(grupo) < 4:
            continue
        imp = grupo["importe"]
        q1, q3 = np.percentile(imp, [25, 75])
        umbral = max(q3 + 3 * (q3 - q1), imp.median() * 3)
        raros = grupo[imp > umbral]
        if len(raros):
            limpio.loc[raros.index, "inusual"] = True
            problemas.append(Problema(
                "partida_inusual", "info", f"Partida(s) inusual(es) en {cat}",
                f"{len(raros)} {tipo}(s) de {cat} son mucho mayores de lo normal en ese rubro "
                f"(lo típico es {fmt_dinero(imp.median())}). Podrían ser extraordinarias.",
                filas=_muestra(raros), sugerencia="Confirma si se repetirán o fueron únicas.",
                accion_tomada="Incluidas, pero marcadas para la investigación.",
                importe_afectado=float(raros["importe"].sum()),
            ))

    excluido = df[~vivos].copy()
    total_bruto = float(df["importe"].abs().sum(skipna=True)) or 1.0
    pct_excluido = float(excluido["importe"].abs().sum(skipna=True)) / total_bruto
    if any(p.severidad == "bloqueante" for p in problemas) or limpio.empty:
        calidad = "insuficiente"
    elif any(p.severidad == "advertencia" for p in problemas):
        calidad = "provisional"
    else:
        calidad = "confiable"

    resumen = {
        "filas_leidas": int(len(df)),
        "filas_analizadas": int(len(limpio)),
        "filas_excluidas": int(len(excluido)),
        "pct_importe_excluido": pct_excluido,
        "meses": sorted(str(m) for m in limpio["fecha"].dt.to_period("M").unique()) if len(limpio) else [],
        "tiene_cantidades": bool(limpio["cantidad"].notna().any()) if len(limpio) else False,
        "tiene_productos": bool(limpio["producto"].notna().any()) if len(limpio) else False,
        "tiene_liquidacion": bool(limpio["fecha_liquidacion"].notna().any()) if len(limpio) else False,
    }
    return ResultadoValidacion(limpio.drop(columns=["motivo"]), excluido, problemas, calidad, supuestos, resumen)
