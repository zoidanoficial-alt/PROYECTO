"""Entrada universal de datos y detector de errores antes de calcular.

Principio: nunca corregir en silencio. Cada problema se reporta como un
``Hallazgo`` con su explicación y una propuesta de corrección. Las únicas
transformaciones permitidas son las que el usuario activa explícitamente, y
quedan registradas como hallazgos de tipo "transformación".
"""
from __future__ import annotations

import re
from dataclasses import asdict, dataclass
from pathlib import Path

import numpy as np
import pandas as pd

from .triangulo import Triangulo

ERROR = "error"
ADVERTENCIA = "advertencia"
INFO = "info"
TRANSFORMACION = "transformación"

_FALTANTES = {"", "—", "–", "-", "na", "n/a", "nan", "null", "none"}


@dataclass(frozen=True)
class Hallazgo:
    severidad: str
    codigo: str
    mensaje: str
    sugerencia: str = ""
    ubicacion: str = ""

    def como_dict(self) -> dict:
        return asdict(self)

    def __str__(self) -> str:
        loc = f" [{self.ubicacion}]" if self.ubicacion else ""
        sug = f"\n    → {self.sugerencia}" if self.sugerencia else ""
        return f"{self.severidad.upper()} {self.codigo}{loc}: {self.mensaje}{sug}"


def hay_errores(hallazgos: list[Hallazgo]) -> bool:
    return any(h.severidad == ERROR for h in hallazgos)


# --------------------------------------------------------------------------
# Lectura
# --------------------------------------------------------------------------

def _leer_tabla(ruta: Path, hoja: str | int | None) -> pd.DataFrame:
    if ruta.suffix.lower() in {".xlsx", ".xlsm", ".xls"}:
        return pd.read_excel(ruta, sheet_name=hoja or 0, dtype=str, keep_default_na=False)
    return pd.read_csv(ruta, dtype=str, keep_default_na=False)


def _edad(encabezado: str) -> int | None:
    m = re.fullmatch(r"\s*(\d+)\s*(m|meses|mes|months?)?\s*", str(encabezado), re.IGNORECASE)
    return int(m.group(1)) if m else None


def _celda(texto: str, ubicacion: str, limpiar: bool, hallazgos: list[Hallazgo]) -> float:
    t = str(texto).strip()
    if t.lower() in _FALTANTES:
        return np.nan
    try:
        return float(t)
    except ValueError:
        pass
    limpio = re.sub(r"[$\s,]|MXN|USD", "", t, flags=re.IGNORECASE)
    if "," in t and not re.fullmatch(r"[^,]*\d{1,3}(,\d{3})+(\.\d+)?[^,]*", t):
        hallazgos.append(Hallazgo(
            ERROR, "SEPARADOR_AMBIGUO",
            f"«{t}» es ambiguo: la coma no separa grupos de tres dígitos, así que podría ser "
            f"un decimal ({t.replace(',', '.')}) o un error de captura ({limpio}).",
            "Corrige la celda en el archivo original; este caso no se limpia automáticamente.",
            ubicacion,
        ))
        return np.nan
    try:
        valor = float(limpio)
    except ValueError:
        hallazgos.append(Hallazgo(
            ERROR, "VALOR_NO_NUMERICO",
            f"El valor «{t}» no es un número.",
            "Revisa la celda en el archivo original; no se puede interpretar automáticamente.",
            ubicacion,
        ))
        return np.nan
    if limpio != t and limpiar:
        hallazgos.append(Hallazgo(
            TRANSFORMACION, "FORMATO_NUMERICO_LIMPIADO",
            f"«{t}» se interpretó como {valor:g} (se quitaron símbolos y separadores de miles).",
            "", ubicacion,
        ))
        return valor
    hallazgos.append(Hallazgo(
        ERROR, "NUMERO_CON_FORMATO",
        f"«{t}» parece un número con símbolos o separadores de miles; se interpretaría como {valor:g}.",
        "Confirma que la coma es separador de miles (no decimal) y vuelve a cargar con "
        "--limpiar-formato, o corrige el archivo.",
        ubicacion,
    ))
    return np.nan


def cargar_triangulo(
    ruta: str | Path,
    formato: str = "ancho",
    columnas: dict[str, str] | None = None,
    unidad: str = "sin especificar",
    moneda: str = "sin especificar",
    tipo: str = "pagos acumulados",
    hoja: str | int | None = None,
    limpiar_formato: bool = False,
    incremental: bool = False,
) -> tuple[Triangulo | None, list[Hallazgo]]:
    """Carga un triángulo desde CSV o Excel y devuelve (triángulo, hallazgos).

    ``formato="ancho"``: una fila por origen y una columna por edad.
    ``formato="largo"``: una fila por celda, con columnas de origen, edad y
    valor (y opcionalmente moneda). ``columnas`` mapea los nombres lógicos
    ``origen``, ``desarrollo``, ``valor`` y ``moneda`` a los del archivo.
    Con ``incremental=True`` los montos se interpretan como pagos del periodo
    y se acumulan (queda registrado como transformación).

    Si hay errores, el triángulo devuelto es ``None``: no se calcula sobre
    datos que no se entienden.
    """
    ruta = Path(ruta)
    df = _leer_tabla(ruta, hoja)
    mapa = {"origen": None, "desarrollo": "desarrollo", "valor": "valor", "moneda": "moneda"}
    mapa.update(columnas or {})
    hallazgos: list[Hallazgo] = []

    if formato == "ancho":
        col_origen = mapa["origen"] or df.columns[0]
        if col_origen not in df.columns:
            return None, [Hallazgo(ERROR, "COLUMNA_FALTANTE", f"No existe la columna «{col_origen}».",
                                   f"Columnas disponibles: {', '.join(df.columns)}")]
        origenes = [str(o).strip() for o in df[col_origen]]
        edades, cols_edad = [], []
        for c in df.columns:
            if c == col_origen:
                continue
            e = _edad(c)
            if e is None:
                hallazgos.append(Hallazgo(
                    ADVERTENCIA, "COLUMNA_IGNORADA",
                    f"La columna «{c}» no es una edad de desarrollo y se ignoró.",
                    "Si contiene datos necesarios, renómbrala (p. ej. «12» o «12 meses»).", c))
                continue
            edades.append(e)
            cols_edad.append(c)
        valores = np.array([
            [_celda(df.at[r, c], f"fila {r + 2}, columna {c}", limpiar_formato, hallazgos)
             for c in cols_edad]
            for r in range(len(df))
        ]).reshape(len(df), len(cols_edad))
        vistos: dict[str, int] = {}
        for r, o in enumerate(origenes):
            if o in vistos:
                hallazgos.append(Hallazgo(
                    ERROR, "ORIGEN_DUPLICADO",
                    f"El origen {o} aparece más de una vez (filas {vistos[o] + 2} y {r + 2}).",
                    "Consolida las filas o confirma cuál es la correcta.", f"origen {o}"))
            vistos.setdefault(o, r)

    elif formato == "largo":
        mapa["origen"] = mapa["origen"] or "origen"
        faltan = [mapa[k] for k in ("origen", "desarrollo", "valor") if mapa[k] not in df.columns]
        if faltan:
            return None, [Hallazgo(ERROR, "COLUMNA_FALTANTE",
                                   f"Faltan columnas: {', '.join(faltan)}.",
                                   f"Columnas disponibles: {', '.join(df.columns)}. "
                                   "Usa el mapeo de columnas para indicar cuál es cuál.")]
        if mapa["moneda"] in df.columns:
            monedas = sorted({m.strip().upper() for m in df[mapa["moneda"]] if m.strip()})
            if len(monedas) > 1:
                hallazgos.append(Hallazgo(
                    ERROR, "MONEDAS_MEZCLADAS",
                    f"El archivo mezcla monedas: {', '.join(monedas)}.",
                    "Convierte todo a una sola moneda con un tipo de cambio documentado "
                    "o separa el análisis por moneda."))
            elif monedas and moneda == "sin especificar":
                moneda = monedas[0]
        df = df.assign(_o=df[mapa["origen"]].str.strip(), _e=df[mapa["desarrollo"]].map(_edad))
        malas = df[df["_e"].isna()]
        for r in malas.index:
            hallazgos.append(Hallazgo(
                ERROR, "EDAD_INVALIDA",
                f"«{df.at[r, mapa['desarrollo']]}» no es una edad de desarrollo válida.",
                "Usa meses enteros (12, 24, 36...).", f"fila {r + 2}"))
        df = df.drop(malas.index)
        dup = df[df.duplicated(["_o", "_e"], keep=False)]
        for (o, e), grupo in dup.groupby(["_o", "_e"]):
            filas = ", ".join(str(i + 2) for i in grupo.index)
            hallazgos.append(Hallazgo(
                ERROR, "CELDA_DUPLICADA",
                f"Hay {len(grupo)} registros para origen {o}, edad {int(e)} (filas {filas}).",
                "Si son movimientos que deben sumarse, agrégalos antes; si es un duplicado, elimínalo.",
                f"origen {o}, {int(e)}m"))
        origenes = sorted(df["_o"].unique())
        edades = sorted(int(e) for e in df["_e"].unique())
        valores = np.full((len(origenes), len(edades)), np.nan)
        pos_o = {o: i for i, o in enumerate(origenes)}
        pos_e = {e: j for j, e in enumerate(edades)}
        for r in df.drop_duplicates(["_o", "_e"]).index:
            valores[pos_o[df.at[r, "_o"]], pos_e[int(df.at[r, "_e"])]] = _celda(
                df.at[r, mapa["valor"]], f"fila {r + 2}", limpiar_formato, hallazgos)
    else:
        raise ValueError(f"Formato desconocido: {formato!r} (usa 'ancho' o 'largo').")

    if not edades:
        hallazgos.append(Hallazgo(ERROR, "SIN_EDADES", "No se encontró ninguna columna de edad de desarrollo."))
    if hay_errores(hallazgos):
        return None, hallazgos

    orden = np.argsort(edades)
    tri = Triangulo(
        origenes=tuple(origenes),
        edades=tuple(int(edades[k]) for k in orden),
        valores=valores[:, orden],
        unidad=unidad, moneda=moneda, tipo=tipo, fuente=str(ruta),
    )
    if incremental:
        tri = acumular(tri)
        hallazgos.append(Hallazgo(
            TRANSFORMACION, "ACUMULADO_DESDE_INCREMENTALES",
            "Los montos se cargaron como incrementales y se acumularon por origen."))
    hallazgos += validar_triangulo(tri)
    return (None if hay_errores(hallazgos) else tri), hallazgos


# --------------------------------------------------------------------------
# Validaciones de estructura y contenido
# --------------------------------------------------------------------------

def validar_triangulo(tri: Triangulo) -> list[Hallazgo]:
    h: list[Hallazgo] = []
    v, obs = tri.valores, tri.observado

    if tri.unidad == "sin especificar" or tri.moneda == "sin especificar":
        h.append(Hallazgo(
            ADVERTENCIA, "UNIDAD_NO_DECLARADA",
            "No se declaró la unidad o la moneda de los montos.",
            "Indica, por ejemplo, unidad «miles» y moneda «MXN» para que los resultados se "
            "presenten correctamente."))

    pasos = np.diff(tri.edades)
    if len(pasos) and len(set(pasos.tolist())) > 1:
        h.append(Hallazgo(
            ADVERTENCIA, "EDADES_IRREGULARES",
            f"Las edades no están igualmente espaciadas: {list(tri.edades)}.",
            "Los factores se calculan entre columnas consecutivas; verifica que sea lo deseado."))

    for i, o in enumerate(tri.origenes):
        idx = np.flatnonzero(obs[i])
        if idx.size == 0:
            h.append(Hallazgo(ADVERTENCIA, "ORIGEN_VACIO", f"El origen {o} no tiene datos.",
                              "Elimínalo o completa sus datos.", f"origen {o}"))
            continue
        huecos = [tri.edades[j] for j in range(idx[0], idx[-1]) if not obs[i, j]]
        if idx[0] != 0:
            huecos = [tri.edades[j] for j in range(0, idx[0])] + huecos
        if huecos:
            h.append(Hallazgo(
                ERROR, "PERIODO_INCOMPLETO",
                f"El origen {o} tiene huecos antes de su último dato observado (edades {huecos}).",
                "Un hueco intermedio no puede tratarse como cero ni como «aún no observado». "
                "Completa el dato o confirma de dónde viene.", f"origen {o}"))

    n_obs = obs.sum(axis=1)
    for i in range(1, tri.n_origenes):
        if n_obs[i] > n_obs[i - 1]:
            h.append(Hallazgo(
                ADVERTENCIA, "FORMA_NO_TRIANGULAR",
                f"El origen {tri.origenes[i]} tiene más edades observadas que {tri.origenes[i - 1]}.",
                "Revisa el orden de los orígenes o si hay datos con fecha posterior al corte.",
                f"origen {tri.origenes[i]}"))

    for i, j in zip(*np.nonzero(obs & (np.nan_to_num(v) < 0))):
        h.append(Hallazgo(
            ERROR, "VALOR_NEGATIVO",
            f"Monto acumulado negativo ({v[i, j]:g}).",
            "Un acumulado negativo suele indicar signo invertido o datos incrementales.",
            f"origen {tri.origenes[i]}, {tri.edades[j]}m"))

    pares = obs[:, :-1] & obs[:, 1:]
    with np.errstate(divide="ignore", invalid="ignore"):
        razones = np.where(pares, v[:, 1:] / v[:, :-1], np.nan)
    for i, j in zip(*np.nonzero(pares & (v[:, :-1] == 0))):
        h.append(Hallazgo(
            ADVERTENCIA, "BASE_CERO",
            f"El acumulado a {tri.edades[j]}m es cero; no aporta información al factor "
            f"{tri.edades[j]}→{tri.edades[j + 1]}.",
            "Confirma si realmente no hubo pagos o si falta el dato.",
            f"origen {tri.origenes[i]}, {tri.edades[j]}m"))

    bajas = np.argwhere(pares & (np.nan_to_num(razones, nan=1.0) < 1))
    if len(bajas) and len(bajas) >= 0.3 * pares.sum() and pares.sum() >= 3:
        h.append(Hallazgo(
            ERROR, "POSIBLES_DATOS_INCREMENTALES",
            f"{len(bajas)} de {int(pares.sum())} pasos disminuyen; los datos parecen incrementales, "
            "no acumulados.",
            "Si los datos son pagos del periodo, cárgalos como incrementales (--incremental) "
            "para acumularlos."))
        return h
    else:
        for i, j in bajas:
            h.append(Hallazgo(
                ADVERTENCIA, "ACUMULADO_DECRECIENTE",
                f"El acumulado baja de {v[i, j]:g} a {v[i, j + 1]:g} entre {tri.edades[j]}m y "
                f"{tri.edades[j + 1]}m.",
                "Puede ser un recobro o salvamento legítimo, o un error de captura. Confírmalo.",
                f"origen {tri.origenes[i]}"))

    for j in range(razones.shape[1]):
        col = razones[:, j]
        col_ok = col[~np.isnan(col)]
        if col_ok.size < 3:
            continue
        med = np.median(col_ok)
        for i in np.flatnonzero(~np.isnan(col)):
            r = col[i]
            if abs(r - med) > max(0.5 * abs(med - 1), 0.1):
                h.append(Hallazgo(
                    ADVERTENCIA, "FACTOR_ATIPICO",
                    f"El factor individual {tri.edades[j]}→{tri.edades[j + 1]} de {r:.4f} se aleja "
                    f"de la mediana de la columna ({med:.4f}).",
                    "Revisa si hubo un siniestro grande, un cambio de proceso o un error de captura; "
                    "considera excluirlo con justificación documentada.",
                    f"origen {tri.origenes[i]}"))
    return h


def acumular(tri: Triangulo) -> Triangulo:
    """Convierte un triángulo de montos incrementales en acumulados."""
    acum = np.where(tri.observado, np.nancumsum(tri.valores, axis=1), np.nan)
    return Triangulo(tri.origenes, tri.edades, acum, tri.unidad, tri.moneda,
                     tri.tipo.replace("incrementales", "acumulados"), tri.fuente)
