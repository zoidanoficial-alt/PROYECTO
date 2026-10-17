"""Etapa 1: cargar datos (Excel, CSV o captura manual) e identificar columnas.

El formato canónico es un "libro de movimientos": una fila por venta, costo
o gasto. Cada fila conserva su `origen` (archivo › hoja › fila) para que
cualquier cifra posterior pueda rastrearse hasta el dato original.

Los datos crudos nunca se modifican: la limpieza produce una tabla derivada
(ver `validacion`). Si una regla cambia, el análisis se puede recalcular
desde los mismos datos de entrada.
"""

from __future__ import annotations

import difflib
import re
from dataclasses import dataclass, field
from pathlib import Path

import numpy as np
import pandas as pd

from .modelos import Pregunta, normalizar_texto

# Campos canónicos que entiende el analista, con sus nombres habituales.
CAMPOS: dict[str, dict] = {
    "fecha": {
        "descripcion": "Fecha de la operación (venta, compra o gasto)",
        "obligatorio": True,
        "sinonimos": ["fecha", "date", "dia", "fecha operacion", "fecha factura",
                      "fecha venta", "fecha emision", "fecha movimiento", "periodo"],
    },
    "tipo": {
        "descripcion": "Si la fila es una venta, un costo de venta o un gasto",
        "obligatorio": False,
        "sinonimos": ["tipo", "tipo movimiento", "movimiento", "naturaleza", "clase", "type"],
    },
    "concepto": {
        "descripcion": "Descripción de la operación",
        "obligatorio": False,
        "sinonimos": ["concepto", "descripcion", "detalle", "description", "glosa",
                      "partida", "nota"],
    },
    "categoria": {
        "descripcion": "Rubro o cuenta (renta, nómina, materia prima...)",
        "obligatorio": False,
        "sinonimos": ["categoria", "rubro", "cuenta", "category", "clasificacion",
                      "cuenta contable", "centro de costo"],
    },
    "producto": {
        "descripcion": "Producto o servicio vendido",
        "obligatorio": False,
        "sinonimos": ["producto", "articulo", "sku", "item", "product", "servicio",
                      "linea de producto", "modelo"],
    },
    "cantidad": {
        "descripcion": "Unidades vendidas o compradas",
        "obligatorio": False,
        "sinonimos": ["cantidad", "unidades", "qty", "quantity", "piezas", "volumen", "cant"],
    },
    "importe": {
        "descripcion": "Monto de la operación",
        "obligatorio": True,
        "sinonimos": ["importe", "monto", "total", "valor", "amount", "importe total",
                      "monto total", "subtotal", "cargo", "abono", "precio total"],
    },
    "moneda": {
        "descripcion": "Moneda del importe (MXN, USD...)",
        "obligatorio": False,
        "sinonimos": ["moneda", "currency", "divisa", "tipo moneda"],
    },
    "fecha_liquidacion": {
        "descripcion": "Cuándo se cobró o pagó realmente (para el flujo de efectivo)",
        "obligatorio": False,
        "sinonimos": ["fecha cobro", "fecha de cobro", "fecha pago", "fecha de pago",
                      "cobrado el", "pagado el", "fecha liquidacion", "fecha deposito",
                      "fecha cobro pago"],
    },
    "folio": {
        "descripcion": "Número de factura o identificador único",
        "obligatorio": False,
        "sinonimos": ["folio", "id", "factura", "no factura", "numero factura",
                      "referencia", "invoice", "uuid", "num"],
    },
    "contraparte": {
        "descripcion": "Cliente o proveedor",
        "obligatorio": False,
        "sinonimos": ["cliente", "proveedor", "customer", "vendor", "razon social"],
    },
}

IGNORAR = "(ignorar)"
UMBRAL_SEGURO = 0.85

# Valores de la columna "tipo" (o nombres de hoja) y su significado.
TIPOS = {
    "venta": ["venta", "ventas", "ingreso", "ingresos", "income", "sales", "sale", "factura emitida"],
    "costo": ["costo", "costos", "costo de venta", "costo de ventas", "costo ventas", "cogs",
              "compra", "compras", "materia prima", "mercancia", "inventario vendido"],
    "gasto": ["gasto", "gastos", "gasto operativo", "gastos operativos", "gastos de operacion",
              "opex", "expense", "expenses", "egreso", "egresos"],
}


@dataclass
class TablaCruda:
    archivo: str
    hoja: str
    datos: pd.DataFrame  # todo como texto, tal cual venía
    filas: list[int] | None = None  # número de fila real (1-based) de cada registro

    @property
    def nombre(self) -> str:
        return f"{self.archivo} › {self.hoja}" if self.hoja else self.archivo

    def origen(self, i: int) -> str:
        fila = self.filas[i] if self.filas is not None else i + 2  # +1 encabezado, +1 base 1
        return f"{self.nombre} › fila {fila}"


@dataclass
class PropuestaMapeo:
    tabla: str
    mapeo: dict[str, str]  # encabezado original -> campo canónico (o IGNORAR)
    confianza: dict[str, float]
    desconocidas: list[str] = field(default_factory=list)
    faltantes: list[str] = field(default_factory=list)  # campos obligatorios sin columna
    tipo_hoja: str | None = None  # si toda la tabla es de un mismo tipo


# ---------------------------------------------------------------------------
# Lectura
# ---------------------------------------------------------------------------

def _puntaje(encabezado: str, campo: str) -> float:
    enc = normalizar_texto(encabezado)
    if not enc:
        return 0.0
    mejor = 0.0
    for sin in CAMPOS[campo]["sinonimos"]:
        if enc == sin:
            return 1.0
        tokens_enc, tokens_sin = enc.split(), sin.split()
        if all(t in tokens_enc for t in tokens_sin):
            # contiene el sinónimo completo: entre más del encabezado explique, mejor
            mejor = max(mejor, 0.6 + 0.3 * len(sin) / len(enc))
        else:
            mejor = max(mejor, difflib.SequenceMatcher(None, enc, sin).ratio() * 0.9)
    return mejor


def _fila_encabezado(crudo: pd.DataFrame) -> int:
    """Muchos Excel traen un título arriba; busca la fila que parece encabezado."""
    mejor_i, mejor_n = 0, -1
    for i in range(min(10, len(crudo))):
        celdas = [c for c in crudo.iloc[i].tolist() if isinstance(c, str) and c.strip()]
        n = sum(1 for c in celdas if max(_puntaje(c, f) for f in CAMPOS) >= 0.75)
        if n > mejor_n:
            mejor_i, mejor_n = i, n
    return mejor_i


def _desde_crudo(crudo: pd.DataFrame, archivo: str, hoja: str) -> TablaCruda | None:
    # El índice original (0-based) se conserva para reportar la fila real del archivo.
    crudo = crudo.dropna(how="all").dropna(axis=1, how="all")
    if crudo.empty:
        return None
    i = _fila_encabezado(crudo)
    encabezados = []
    for j, c in enumerate(crudo.iloc[i].tolist()):
        nombre = str(c).strip() if isinstance(c, str) and c.strip() else f"columna_{j + 1}"
        while nombre in encabezados:
            nombre += "_"
        encabezados.append(nombre)
    datos = crudo.iloc[i + 1:].copy()
    datos = datos.astype(object).where(datos.notna(), None)  # celdas vacías: None, nunca "nan"
    datos.columns = encabezados
    filas = [int(idx) + 1 for idx in datos.index]
    return TablaCruda(archivo, hoja, datos.reset_index(drop=True), filas)


def leer_archivo(ruta: str | Path) -> list[TablaCruda]:
    ruta = Path(ruta)
    ext = ruta.suffix.lower()
    if ext in (".xlsx", ".xlsm", ".xls"):
        hojas = pd.read_excel(ruta, sheet_name=None, header=None, dtype=str)
        tablas = [_desde_crudo(df, ruta.name, hoja) for hoja, df in hojas.items()]
    elif ext in (".csv", ".txt", ".tsv"):
        crudo = None
        for codificacion in ("utf-8-sig", "latin-1"):
            try:
                crudo = pd.read_csv(ruta, header=None, dtype=str, sep=None,
                                    engine="python", encoding=codificacion)
                break
            except UnicodeDecodeError:
                continue
        if crudo is None:
            raise ValueError(f"No pude leer {ruta.name}: codificación desconocida")
        tablas = [_desde_crudo(crudo, ruta.name, "")]
    else:
        raise ValueError(f"Formato no soportado: {ext}. Usa .xlsx, .xls o .csv")
    return [t for t in tablas if t is not None]


def tabla_desde_dataframe(df: pd.DataFrame, nombre: str = "datos") -> TablaCruda:
    datos = df.astype(object).where(df.notna(), None)
    datos = datos.map(lambda v: None if v is None else str(v))
    datos.columns = [str(c) for c in datos.columns]
    return TablaCruda(nombre, "", datos.reset_index(drop=True))


def tabla_desde_captura_manual(meses: list[dict]) -> TablaCruda:
    """Captura mínima: totales por mes ({"mes": "2026-04", "ventas": .., "costo_ventas": .., "gastos": ..})."""
    filas = []
    for m in meses:
        for campo, tipo, concepto in (("ventas", "venta", "Ventas del mes"),
                                      ("costo_ventas", "costo", "Costo de ventas del mes"),
                                      ("gastos", "gasto", "Gastos del mes")):
            if m.get(campo) is not None:
                filas.append({"fecha": f"{m['mes']}-01", "tipo": tipo, "concepto": concepto,
                              "categoria": m.get(f"categoria_{campo}", concepto),
                              "importe": str(m[campo])})
    return TablaCruda("captura manual", "", pd.DataFrame(filas, dtype=object))


# ---------------------------------------------------------------------------
# Identificación de columnas
# ---------------------------------------------------------------------------

def tipo_desde_texto(valor) -> str | None:
    t = normalizar_texto(valor)
    if not t:
        return None
    for tipo, sinonimos in TIPOS.items():
        if t in sinonimos:
            return tipo
    for tipo, sinonimos in TIPOS.items():
        if any(s in t for s in sinonimos):
            return tipo
    return None


def proponer_mapeo(tabla: TablaCruda) -> PropuestaMapeo:
    candidatos = []
    for enc in tabla.datos.columns:
        for campo in CAMPOS:
            p = _puntaje(enc, campo)
            if p >= 0.6:
                candidatos.append((p, enc, campo))
    candidatos.sort(key=lambda x: -x[0])

    mapeo: dict[str, str] = {}
    confianza: dict[str, float] = {}
    usados: set[str] = set()
    for p, enc, campo in candidatos:
        if enc in mapeo or campo in usados:
            continue
        mapeo[enc] = campo
        confianza[enc] = round(p, 2)
        usados.add(campo)

    desconocidas = [c for c in tabla.datos.columns if c not in mapeo]
    for c in desconocidas:
        mapeo[c] = IGNORAR
        confianza[c] = 0.0
    tipo_hoja = tipo_desde_texto(tabla.hoja) if tabla.hoja else None
    if tipo_hoja is None and "tipo" not in usados:
        tipo_hoja = tipo_desde_texto(Path(tabla.archivo).stem)
    faltantes = [f for f, d in CAMPOS.items() if d["obligatorio"] and f not in usados]
    return PropuestaMapeo(tabla.nombre, mapeo, confianza, desconocidas, faltantes, tipo_hoja)


def preguntas_de_mapeo(prop: PropuestaMapeo, tabla: TablaCruda) -> list[Pregunta]:
    """Pide confirmación solo de lo dudoso (Principio 1: nunca adivinar en silencio)."""
    preguntas = []
    opciones = list(CAMPOS) + [IGNORAR]
    for enc, campo in prop.mapeo.items():
        conf = prop.confianza.get(enc, 0)
        if campo != IGNORAR and conf >= UMBRAL_SEGURO:
            continue
        muestra = [v for v in tabla.datos[enc].dropna().astype(str).head(3).tolist()]
        if campo == IGNORAR:
            texto = f"No reconozco la columna «{enc}» (ej.: {', '.join(muestra) or 'vacía'}). ¿Qué contiene?"
        else:
            texto = (f"Creo que la columna «{enc}» (ej.: {', '.join(muestra)}) es "
                     f"«{campo}»: {CAMPOS[campo]['descripcion'].lower()}. ¿Es correcto?")
        preguntas.append(Pregunta(
            id=f"mapeo::{prop.tabla}::{enc}", tipo="mapeo_columna", texto=texto,
            por_que="Si interpreto mal una columna, todos los cálculos que dependen de ella estarían mal.",
            opciones=opciones, sugerida=campo, contexto={"tabla": prop.tabla, "columna": enc},
        ))
    for campo in prop.faltantes:
        preguntas.append(Pregunta(
            id=f"faltante::{prop.tabla}::{campo}", tipo="campo_faltante",
            texto=f"En «{prop.tabla}» no encuentro una columna de {campo} "
                  f"({CAMPOS[campo]['descripcion'].lower()}). ¿Cuál columna es?",
            por_que=f"Sin {campo} no puedo ubicar ni sumar las operaciones.",
            opciones=list(tabla.datos.columns), contexto={"tabla": prop.tabla, "campo": campo},
        ))
    if "tipo" not in prop.mapeo.values() and prop.tipo_hoja is None:
        preguntas.append(Pregunta(
            id=f"tipo_hoja::{prop.tabla}", tipo="tipo_hoja",
            texto=f"¿Qué contiene «{prop.tabla}»: ventas, costos de venta o gastos?",
            por_que="Necesito separar lo que entra (ventas) de lo que cuesta vender y de los gastos para calcular márgenes.",
            opciones=["venta", "costo", "gasto"], contexto={"tabla": prop.tabla},
        ))
    return preguntas


# ---------------------------------------------------------------------------
# Conversión de valores
# ---------------------------------------------------------------------------

_MONEDAS = {"USD": ["usd", "us$", "dlls", "dls", "dolares", "dollar"], "EUR": ["eur", "€", "euros"],
            "MXN": ["mxn", "mn", "pesos", "m.n."]}


def moneda_en_texto(valor) -> str | None:
    if valor is None:
        return None
    t = str(valor).lower()
    for codigo, marcas in _MONEDAS.items():
        if any(re.search(rf"(?<![a-z]){re.escape(m)}(?![a-z])", t) for m in marcas):
            return codigo
    return None


def convertir_importe(valor) -> float:
    """"$1,234.50", "1.234,50", "(1,200)", "USD 300", "-45" -> float; NaN si no se puede."""
    if valor is None:
        return np.nan
    if isinstance(valor, (int, float, np.number)):
        return float(valor)
    t = str(valor).strip()
    if not t or t.lower() in ("nan", "none", "-", "n/a", "na"):
        return np.nan
    negativo = (t.startswith("(") and t.endswith(")")) or t.startswith("-") or t.startswith("−")
    t = re.sub(r"[^\d,.]", "", t)
    if not t or not re.search(r"\d", t):
        return np.nan
    if "," in t and "." in t:
        if t.rfind(",") > t.rfind("."):  # 1.234,50
            t = t.replace(".", "").replace(",", ".")
        else:  # 1,234.50
            t = t.replace(",", "")
    elif "," in t:
        partes = t.split(",")
        if len(partes) == 2 and len(partes[1]) in (1, 2):
            t = t.replace(",", ".")
        else:
            t = t.replace(",", "")
    elif t.count(".") > 1:
        t = t.replace(".", "")
    try:
        n = float(t)
    except ValueError:
        return np.nan
    return -n if negativo else n


_FORMATOS_FECHA = ("%Y-%m-%d", "%Y-%m-%d %H:%M:%S", "%d/%m/%Y", "%d-%m-%Y", "%d/%m/%y",
                   "%d.%m.%Y", "%Y/%m/%d", "%Y-%m", "%m/%Y")


def convertir_fecha(valor) -> pd.Timestamp:
    """Interpreta fechas con día primero (formato México). NaT si es inválida."""
    if valor is None:
        return pd.NaT
    t = str(valor).strip()
    if not t or t.lower() in ("nan", "none", "nat"):
        return pd.NaT
    if re.fullmatch(r"\d{5}(\.0+)?", t):  # número de serie de Excel
        n = int(float(t))
        if 20000 < n < 80000:
            return pd.Timestamp("1899-12-30") + pd.Timedelta(days=n)
    for f in _FORMATOS_FECHA:
        try:
            return pd.Timestamp(pd.to_datetime(t, format=f))
        except (ValueError, TypeError):
            continue
    return pd.NaT


# ---------------------------------------------------------------------------
# Construcción del libro de movimientos
# ---------------------------------------------------------------------------

COLUMNAS = ["origen", "fecha", "tipo", "concepto", "categoria", "producto", "cantidad", "importe",
            "moneda", "fecha_liquidacion", "folio", "contraparte",
            "fecha_texto", "importe_texto", "tipo_texto"]


def construir_movimientos(tablas: list[TablaCruda], mapeos: dict[str, PropuestaMapeo],
                          moneda_base: str = "MXN") -> pd.DataFrame:
    partes = []
    for tabla in tablas:
        prop = mapeos[tabla.nombre]
        inverso = {campo: enc for enc, campo in prop.mapeo.items() if campo != IGNORAR}
        d = tabla.datos
        col = lambda campo: d[inverso[campo]] if campo in inverso else pd.Series([None] * len(d), dtype=object)  # noqa: E731
        df = pd.DataFrame({
            "origen": [tabla.origen(i) for i in range(len(d))],
            "fecha_texto": col("fecha").tolist(),
            "importe_texto": col("importe").tolist(),
            "tipo_texto": col("tipo").tolist(),
            "concepto": col("concepto").tolist(),
            "categoria": col("categoria").tolist(),
            "producto": col("producto").tolist(),
            "cantidad": [convertir_importe(v) for v in col("cantidad")],
            "moneda": col("moneda").tolist(),
            "folio": col("folio").tolist(),
            "contraparte": col("contraparte").tolist(),
            "fecha_liquidacion": [convertir_fecha(v) for v in col("fecha_liquidacion")],
        })
        df["fecha"] = [convertir_fecha(v) for v in df["fecha_texto"]]
        df["importe"] = [convertir_importe(v) for v in df["importe_texto"]]
        if "tipo" in inverso:
            df["tipo"] = [tipo_desde_texto(v) for v in df["tipo_texto"]]
        else:
            df["tipo"] = prop.tipo_hoja
            df["tipo_texto"] = tabla.hoja or tabla.archivo
        # Moneda: columna explícita, o marcada dentro del importe ("USD 300"), o la base.
        monedas = []
        for m, imp in zip(df["moneda"], df["importe_texto"]):
            codigo = str(m).strip().upper() if pd.notna(m) and str(m).strip() else None
            codigo = _normalizar_moneda(codigo) or moneda_en_texto(imp) or moneda_base
            monedas.append(codigo)
        df["moneda"] = monedas
        # Filas totalmente vacías no son datos
        vacias = df[["fecha_texto", "importe_texto", "concepto", "producto"]].isna().all(axis=1)
        partes.append(df[~vacias])
    if not partes:
        return pd.DataFrame(columns=COLUMNAS)
    mov = pd.concat(partes, ignore_index=True)
    for c in ("concepto", "categoria", "producto", "folio", "contraparte"):
        mov[c] = mov[c].map(lambda v: str(v).strip() if pd.notna(v) and str(v).strip() else None)
    return mov[COLUMNAS]


def _normalizar_moneda(codigo: str | None) -> str | None:
    if not codigo:
        return None
    detectada = moneda_en_texto(codigo)
    return detectada or codigo
