/*
 * Motor actuarial de ActuaryOS en JavaScript (para la app móvil).
 *
 * Es un port fiel del paquete de Python `actuaryos`: mismas fórmulas, mismos
 * códigos de hallazgo y las mismas pruebas de referencia (tests/motor.test.js).
 * La interfaz sólo muestra lo que este motor calcula.
 */
(function (global) {
  "use strict";

  const VERSION = "0.1.0";
  const ERROR = "error", ADVERTENCIA = "advertencia", TRANSFORMACION = "transformación";
  const FALTANTES = new Set(["", "—", "–", "-", "na", "n/a", "nan", "null", "none"]);
  const ESCALAS = { unidades: 1, pesos: 1, miles: 1000, millones: 1000000 };
  const BORRADOR = "borrador — requiere revisión actuarial";

  const hallazgo = (severidad, codigo, mensaje, sugerencia = "", ubicacion = "") =>
    ({ severidad, codigo, mensaje, sugerencia, ubicacion });
  const hayErrores = (hs) => hs.some((h) => h.severidad === ERROR);
  const esNum = (x) => typeof x === "number" && !Number.isNaN(x);
  const fmt = (x, d = 4) => x.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
  const pct = (x, d = 1) => (x * 100).toFixed(d) + "%";

  // ---------------------------------------------------------------- CSV
  function parsearCSV(texto) {
    const filas = [];
    let fila = [], celda = "", comillas = false;
    texto = texto.replace(/^﻿/, "");
    const sep = (texto.split("\n")[0].match(/;/g) || []).length > (texto.split("\n")[0].match(/,/g) || []).length ? ";" : ",";
    for (let i = 0; i < texto.length; i++) {
      const c = texto[i];
      if (comillas) {
        if (c === '"' && texto[i + 1] === '"') { celda += '"'; i++; }
        else if (c === '"') comillas = false;
        else celda += c;
      } else if (c === '"') comillas = true;
      else if (c === sep) { fila.push(celda); celda = ""; }
      else if (c === "\n" || c === "\r") {
        if (c === "\r" && texto[i + 1] === "\n") i++;
        fila.push(celda); celda = "";
        if (fila.some((x) => x.trim() !== "")) filas.push(fila);
        fila = [];
      } else celda += c;
    }
    fila.push(celda);
    if (fila.some((x) => x.trim() !== "")) filas.push(fila);
    return filas;
  }

  function edadDe(encabezado) {
    const m = String(encabezado).match(/^\s*(\d+)\s*(m|meses|mes|months?)?\s*$/i);
    return m ? parseInt(m[1], 10) : null;
  }

  function celda(texto, ubicacion, limpiar, hs) {
    const t = String(texto ?? "").trim();
    if (FALTANTES.has(t.toLowerCase())) return null;
    if (/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(t)) return parseFloat(t);
    const limpio = t.replace(/[$\s,]|MXN|USD/gi, "");
    if (t.includes(",") && !/^[^,]*\d{1,3}(,\d{3})+(\.\d+)?[^,]*$/.test(t)) {
      hs.push(hallazgo(ERROR, "SEPARADOR_AMBIGUO",
        `«${t}» es ambiguo: la coma no separa grupos de tres dígitos, así que podría ser un decimal (${t.replace(/,/g, ".")}) o un error de captura (${limpio}).`,
        "Corrige la celda en el archivo original; este caso no se limpia automáticamente.", ubicacion));
      return null;
    }
    if (!/^[+-]?(\d+\.?\d*|\.\d+)$/.test(limpio)) {
      hs.push(hallazgo(ERROR, "VALOR_NO_NUMERICO", `El valor «${t}» no es un número.`,
        "Revisa la celda en el archivo original; no se puede interpretar automáticamente.", ubicacion));
      return null;
    }
    const valor = parseFloat(limpio);
    if (limpiar) {
      hs.push(hallazgo(TRANSFORMACION, "FORMATO_NUMERICO_LIMPIADO",
        `«${t}» se interpretó como ${valor} (se quitaron símbolos y separadores de miles).`, "", ubicacion));
      return valor;
    }
    hs.push(hallazgo(ERROR, "NUMERO_CON_FORMATO",
      `«${t}» parece un número con símbolos o separadores de miles; se interpretaría como ${valor}.`,
      "Confirma que la coma es separador de miles (no decimal) y activa «Limpiar formato», o corrige el archivo.",
      ubicacion));
    return null;
  }

  // ---------------------------------------------------------- Triángulo
  function crearTriangulo(origenes, edades, valores, unidad = "sin especificar", moneda = "sin especificar",
                          tipo = "pagos acumulados", fuente = "") {
    const v = valores.map((f) => f.map((x) => (esNum(x) ? x : null)));
    return Object.freeze({ origenes: [...origenes], edades: [...edades], valores: v, unidad, moneda, tipo, fuente });
  }
  const obs = (tri, i, j) => tri.valores[i][j] !== null;
  function indiceUltimo(tri) {
    return tri.valores.map((f) => { let k = -1; f.forEach((x, j) => { if (x !== null) k = j; }); return k; });
  }
  const diagonal = (tri) => indiceUltimo(tri).map((j, i) => (j >= 0 ? tri.valores[i][j] : null));

  function acumular(tri) {
    const v = tri.valores.map((f) => { let s = 0; return f.map((x) => (x === null ? null : (s += x))); });
    return crearTriangulo(tri.origenes, tri.edades, v, tri.unidad, tri.moneda, "pagos acumulados", tri.fuente);
  }

  function cargarTriangulo(texto, op = {}) {
    const { formato = "ancho", unidad = "sin especificar", limpiarFormato = false, incremental = false,
            columnas = {}, fuente = "" } = op;
    let moneda = op.moneda || "sin especificar";
    const filas = parsearCSV(texto);
    const hs = [];
    if (filas.length < 2) return { tri: null, hallazgos: [hallazgo(ERROR, "SIN_DATOS", "El archivo no tiene filas de datos.")] };
    const cab = filas[0].map((c) => c.trim());
    let origenes, edades = [], valores;

    if (formato === "ancho") {
      const iO = columnas.origen ? cab.indexOf(columnas.origen) : 0;
      if (iO < 0) return { tri: null, hallazgos: [hallazgo(ERROR, "COLUMNA_FALTANTE", `No existe la columna «${columnas.origen}».`, `Columnas disponibles: ${cab.join(", ")}`)] };
      const cols = [];
      cab.forEach((c, k) => {
        if (k === iO) return;
        const e = edadDe(c);
        if (e === null) {
          hs.push(hallazgo(ADVERTENCIA, "COLUMNA_IGNORADA", `La columna «${c}» no es una edad de desarrollo y se ignoró.`,
            "Si contiene datos necesarios, renómbrala (p. ej. «12» o «12 meses»).", c));
        } else { edades.push(e); cols.push(k); }
      });
      origenes = filas.slice(1).map((f) => String(f[iO] ?? "").trim());
      valores = filas.slice(1).map((f, r) => cols.map((k) => celda(f[k], `fila ${r + 2}, columna ${cab[k]}`, limpiarFormato, hs)));
      const vistos = {};
      origenes.forEach((o, r) => {
        if (o in vistos) hs.push(hallazgo(ERROR, "ORIGEN_DUPLICADO", `El origen ${o} aparece más de una vez (filas ${vistos[o] + 2} y ${r + 2}).`,
          "Consolida las filas o confirma cuál es la correcta.", `origen ${o}`));
        else vistos[o] = r;
      });
    } else if (formato === "largo") {
      const nom = { origen: "origen", desarrollo: "desarrollo", valor: "valor", moneda: "moneda", ...columnas };
      const idx = Object.fromEntries(Object.entries(nom).map(([k, v]) => [k, cab.indexOf(v)]));
      const faltan = ["origen", "desarrollo", "valor"].filter((k) => idx[k] < 0).map((k) => nom[k]);
      if (faltan.length) return { tri: null, hallazgos: [hallazgo(ERROR, "COLUMNA_FALTANTE", `Faltan columnas: ${faltan.join(", ")}.`,
        `Columnas disponibles: ${cab.join(", ")}. Usa el mapeo de columnas para indicar cuál es cuál.`)] };
      const datos = filas.slice(1).map((f, r) => ({ r, o: String(f[idx.origen] ?? "").trim(), e: edadDe(f[idx.desarrollo]),
        crudoE: f[idx.desarrollo], v: f[idx.valor], m: idx.moneda >= 0 ? String(f[idx.moneda] ?? "").trim().toUpperCase() : "" }));
      const monedas = [...new Set(datos.map((d) => d.m).filter(Boolean))].sort();
      if (monedas.length > 1) hs.push(hallazgo(ERROR, "MONEDAS_MEZCLADAS", `El archivo mezcla monedas: ${monedas.join(", ")}.`,
        "Convierte todo a una sola moneda con un tipo de cambio documentado o separa el análisis por moneda."));
      else if (monedas.length === 1 && moneda === "sin especificar") moneda = monedas[0];
      const validos = [];
      datos.forEach((d) => {
        if (d.e === null) hs.push(hallazgo(ERROR, "EDAD_INVALIDA", `«${d.crudoE}» no es una edad de desarrollo válida.`, "Usa meses enteros (12, 24, 36...).", `fila ${d.r + 2}`));
        else validos.push(d);
      });
      const grupos = {};
      validos.forEach((d) => { (grupos[d.o + "\u0000" + d.e] ||= []).push(d); });
      Object.values(grupos).filter((g) => g.length > 1).forEach((g) => {
        hs.push(hallazgo(ERROR, "CELDA_DUPLICADA", `Hay ${g.length} registros para origen ${g[0].o}, edad ${g[0].e} (filas ${g.map((d) => d.r + 2).join(", ")}).`,
          "Si son movimientos que deben sumarse, agrégalos antes; si es un duplicado, elimínalo.", `origen ${g[0].o}, ${g[0].e}m`));
      });
      origenes = [...new Set(validos.map((d) => d.o))].sort();
      edades = [...new Set(validos.map((d) => d.e))];
      valores = origenes.map(() => edades.map(() => null));
      Object.values(grupos).forEach((g) => {
        const d = g[0];
        valores[origenes.indexOf(d.o)][edades.indexOf(d.e)] = celda(d.v, `fila ${d.r + 2}`, limpiarFormato, hs);
      });
    } else throw new Error(`Formato desconocido: ${formato}`);

    if (!edades.length) hs.push(hallazgo(ERROR, "SIN_EDADES", "No se encontró ninguna columna de edad de desarrollo."));
    if (hayErrores(hs)) return { tri: null, hallazgos: hs };
    const orden = edades.map((e, k) => k).sort((a, b) => edades[a] - edades[b]);
    let tri = crearTriangulo(origenes, orden.map((k) => edades[k]), valores.map((f) => orden.map((k) => f[k])),
      unidad, moneda, "pagos acumulados", fuente);
    if (incremental) {
      tri = acumular(tri);
      hs.push(hallazgo(TRANSFORMACION, "ACUMULADO_DESDE_INCREMENTALES", "Los montos se cargaron como incrementales y se acumularon por origen."));
    }
    hs.push(...validarTriangulo(tri));
    return { tri: hayErrores(hs) ? null : tri, hallazgos: hs };
  }

  function mediana(xs) {
    const s = [...xs].sort((a, b) => a - b), n = s.length;
    return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
  }

  function validarTriangulo(tri) {
    const h = [], v = tri.valores, I = tri.origenes.length, K = tri.edades.length;
    if (tri.unidad === "sin especificar" || tri.moneda === "sin especificar")
      h.push(hallazgo(ADVERTENCIA, "UNIDAD_NO_DECLARADA", "No se declaró la unidad o la moneda de los montos.",
        "Indica, por ejemplo, unidad «miles» y moneda «MXN» para que los resultados se presenten correctamente."));
    const pasos = new Set(tri.edades.slice(1).map((e, k) => e - tri.edades[k]));
    if (pasos.size > 1) h.push(hallazgo(ADVERTENCIA, "EDADES_IRREGULARES", `Las edades no están igualmente espaciadas: [${tri.edades.join(", ")}].`,
      "Los factores se calculan entre columnas consecutivas; verifica que sea lo deseado."));
    const nObs = [];
    for (let i = 0; i < I; i++) {
      const idx = v[i].map((x, j) => (x !== null ? j : -1)).filter((j) => j >= 0);
      nObs.push(idx.length);
      if (!idx.length) { h.push(hallazgo(ADVERTENCIA, "ORIGEN_VACIO", `El origen ${tri.origenes[i]} no tiene datos.`, "Elimínalo o completa sus datos.", `origen ${tri.origenes[i]}`)); continue; }
      const huecos = [];
      for (let j = 0; j < idx[idx.length - 1]; j++) if (v[i][j] === null) huecos.push(tri.edades[j]);
      if (huecos.length) h.push(hallazgo(ERROR, "PERIODO_INCOMPLETO",
        `El origen ${tri.origenes[i]} tiene huecos antes de su último dato observado (edades [${huecos.join(", ")}]).`,
        "Un hueco intermedio no puede tratarse como cero ni como «aún no observado». Completa el dato o confirma de dónde viene.",
        `origen ${tri.origenes[i]}`));
    }
    for (let i = 1; i < I; i++) if (nObs[i] > nObs[i - 1])
      h.push(hallazgo(ADVERTENCIA, "FORMA_NO_TRIANGULAR", `El origen ${tri.origenes[i]} tiene más edades observadas que ${tri.origenes[i - 1]}.`,
        "Revisa el orden de los orígenes o si hay datos con fecha posterior al corte.", `origen ${tri.origenes[i]}`));
    for (let i = 0; i < I; i++) for (let j = 0; j < K; j++) if (v[i][j] !== null && v[i][j] < 0)
      h.push(hallazgo(ERROR, "VALOR_NEGATIVO", `Monto acumulado negativo (${v[i][j]}).`,
        "Un acumulado negativo suele indicar signo invertido o datos incrementales.", `origen ${tri.origenes[i]}, ${tri.edades[j]}m`));
    const razones = v.map((f) => f.slice(0, -1).map((x, j) => (x !== null && f[j + 1] !== null ? f[j + 1] / x : null)));
    let nPares = 0; const bajas = [];
    for (let i = 0; i < I; i++) for (let j = 0; j < K - 1; j++) {
      if (v[i][j] === null || v[i][j + 1] === null) continue;
      nPares++;
      if (v[i][j] === 0) h.push(hallazgo(ADVERTENCIA, "BASE_CERO",
        `El acumulado a ${tri.edades[j]}m es cero; no aporta información al factor ${tri.edades[j]}→${tri.edades[j + 1]}.`,
        "Confirma si realmente no hubo pagos o si falta el dato.", `origen ${tri.origenes[i]}, ${tri.edades[j]}m`));
      else if (razones[i][j] < 1) bajas.push([i, j]);
    }
    if (bajas.length && bajas.length >= 0.3 * nPares && nPares >= 3) {
      h.push(hallazgo(ERROR, "POSIBLES_DATOS_INCREMENTALES", `${bajas.length} de ${nPares} pasos disminuyen; los datos parecen incrementales, no acumulados.`,
        "Si los datos son pagos del periodo, activa «Datos incrementales» para acumularlos."));
      return h;
    }
    bajas.forEach(([i, j]) => h.push(hallazgo(ADVERTENCIA, "ACUMULADO_DECRECIENTE",
      `El acumulado baja de ${v[i][j]} a ${v[i][j + 1]} entre ${tri.edades[j]}m y ${tri.edades[j + 1]}m.`,
      "Puede ser un recobro o salvamento legítimo, o un error de captura. Confírmalo.", `origen ${tri.origenes[i]}`)));
    for (let j = 0; j < K - 1; j++) {
      const col = razones.map((f) => f[j]).filter((r) => r !== null && Number.isFinite(r));
      if (col.length < 3) continue;
      const med = mediana(col);
      for (let i = 0; i < I; i++) {
        const r = razones[i][j];
        if (r !== null && Number.isFinite(r) && Math.abs(r - med) > Math.max(0.5 * Math.abs(med - 1), 0.1))
          h.push(hallazgo(ADVERTENCIA, "FACTOR_ATIPICO",
            `El factor individual ${tri.edades[j]}→${tri.edades[j + 1]} de ${r.toFixed(4)} se aleja de la mediana de la columna (${med.toFixed(4)}).`,
            "Revisa si hubo un siniestro grande, un cambio de proceso o un error de captura; considera excluirlo con justificación documentada.",
            `origen ${tri.origenes[i]}`));
      }
    }
    return h;
  }

  // ------------------------------------------------------------ Métodos
  class MetodoNoAplicable extends Error {}

  function cifra(etiqueta, valor, explicacion) { return { etiqueta, valor, explicacion }; }
  function explicacion(formula, insumos, pasos, supuestos = [], limitaciones = [], sencilla = "") {
    return { formula, insumos, pasos, supuestos, limitaciones, sencilla };
  }

  function factoresDesarrollo(tri, excluir = []) {
    const ex = new Set(excluir.map(([o, e]) => o + "|" + e));
    const K = tri.edades.length - 1;
    const f = [], num = Array(K).fill(0), den = Array(K).fill(0), n = Array(K).fill(0), usados = [];
    for (let j = 0; j < K; j++) {
      usados.push([]);
      tri.origenes.forEach((o, i) => {
        if (obs(tri, i, j) && obs(tri, i, j + 1) && !ex.has(o + "|" + tri.edades[j])) {
          num[j] += tri.valores[i][j + 1]; den[j] += tri.valores[i][j]; n[j]++; usados[j].push(o);
        }
      });
      f.push(den[j] > 0 ? num[j] / den[j] : NaN);
    }
    return { f, num, den, n, usados };
  }

  function chainLadder(tri, { cola = 1.0, excluir = [] } = {}) {
    const I = tri.origenes.length, K = tri.edades.length;
    if (I < 2 || K < 2) throw new MetodoNoAplicable("Chain Ladder necesita al menos 2 orígenes y 2 edades de desarrollo.");
    if (cola < 1) throw new MetodoNoAplicable("El factor de cola debe ser ≥ 1 para pagos acumulados.");
    const { f, num, den, n, usados } = factoresDesarrollo(tri, excluir);
    const sinDatos = f.map((x, j) => (Number.isNaN(x) ? `${tri.edades[j]}→${tri.edades[j + 1]}` : null)).filter(Boolean);
    if (sinDatos.length) throw new MetodoNoAplicable(`No hay datos para estimar los factores ${sinDatos.join(", ")}.`);
    const advertencias = [];
    n.forEach((c, j) => { if (c === 1) advertencias.push(hallazgo(ADVERTENCIA, "FACTOR_CON_UNA_OBSERVACION",
      `El factor ${tri.edades[j]}→${tri.edades[j + 1]} se basa en un solo origen (${usados[j][0]}); es poco robusto.`,
      "Considera un factor de referencia de mercado o un ajuste de curva y documenta la decisión.")); });
    const fda = Array(K).fill(1);
    fda[K - 1] = cola;
    for (let j = K - 2; j >= 0; j--) fda[j] = f[j] * fda[j + 1];
    const u = tri.unidad, ult = indiceUltimo(tri), pagado = diagonal(tri);
    const supuestos = [
      "El patrón de desarrollo observado en el pasado se repetirá en los orígenes recientes.",
      "Los factores son promedios ponderados por volumen de todos los orígenes disponibles" +
        (excluir.length ? `, excepto ${excluir.length} factor(es) excluido(s) por el actuario.` : "."),
      cola === 1 ? `El origen más antiguo alcanzó su desarrollo final a ${tri.edades[K - 1]} meses (factor de cola = 1).`
        : `Después de ${tri.edades[K - 1]} meses aún falta desarrollo: factor de cola = ${cola} (supuesto del usuario).`,
    ];
    const limit = ["Es una estimación puntual: no mide la incertidumbre (ver método de Mack).",
      "Sensible a factores tempranos inestables, sobre todo en el origen más reciente."];
    const cifras = {}, tablaFactores = [], tablaOrigenes = [];
    for (let j = 0; j < K - 1; j++) {
      const a = tri.edades[j], b = tri.edades[j + 1];
      tablaFactores.push({ desde: a, hasta: b, factor: f[j], fda: fda[j], origenesUsados: usados[j] });
      cifras[`factor:${a}-${b}`] = cifra(`el factor ${a}→${b} meses`, f[j], explicacion(
        `f(${a}→${b}) = Σ C(${b}m) / Σ C(${a}m)`,
        [[`Σ C(${b}m) de ${usados[j].join(", ")}`, num[j]], [`Σ C(${a}m) de ${usados[j].join(", ")}`, den[j]]],
        [`Se suman los acumulados a ${b} meses de los orígenes que tienen ambas edades: ${fmt(num[j])}.`,
         `Se suman sus acumulados a ${a} meses: ${fmt(den[j])}.`,
         `Factor = ${fmt(num[j])} / ${fmt(den[j])} = ${f[j].toFixed(6)}.`],
        supuestos.slice(0, 2), n[j] < 3 ? [`Se basa en ${n[j]} observación(es).`] : [],
        `En los años con datos, lo pagado a ${b} meses fue ${f[j].toFixed(3)} veces lo pagado a ${a} meses. Usamos esa proporción para proyectar los años recientes.`));
    }
    let totU = 0, totR = 0;
    tri.origenes.forEach((o, i) => {
      const j = ult[i], factor = fda[j], ultimo = pagado[i] * factor, res = ultimo - pagado[i];
      totU += ultimo; totR += res;
      const futuros = tablaFactores.slice(j).map((t) => t.factor.toFixed(6));
      if (cola !== 1) futuros.push(`${cola} (cola)`);
      const producto = futuros.length ? futuros.join(" × ") : "1 (sin desarrollo pendiente)";
      tablaOrigenes.push({ origen: o, edadActual: tri.edades[j], pagado: pagado[i], fda: factor, ultimo, reserva: res });
      const insumos = [[`Pagado acumulado ${o} a ${tri.edades[j]}m`, pagado[i]], ["Factor de desarrollo acumulado", factor]];
      cifras[`ultimo:${o}`] = cifra(`el costo último de ${o}`, ultimo, explicacion("Último = Pagado actual × FDA", insumos,
        [`Último pagado observado de ${o}: ${fmt(pagado[i])} a ${tri.edades[j]} meses.`, `FDA = ${producto} = ${factor.toFixed(6)}.`,
         `Último = ${fmt(pagado[i])} × ${factor.toFixed(6)} = ${fmt(ultimo)}.`], supuestos, limit,
        `A ${tri.edades[j]} meses se han pagado ${fmt(pagado[i], 2)} ${u} por los siniestros de ${o}. Según el patrón histórico, el total final será unas ${factor.toFixed(3)} veces eso: ${fmt(ultimo, 2)} ${u}.`));
      cifras[`reserva:${o}`] = cifra(`la reserva de ${o}`, res, explicacion("Reserva = Último − Pagado actual", insumos,
        [`Último estimado de ${o}: ${fmt(ultimo)} (Pagado ${fmt(pagado[i])} × FDA ${factor.toFixed(6)}).`,
         `Reserva = ${fmt(ultimo)} − ${fmt(pagado[i])} = ${fmt(res)}.`], supuestos, limit,
        `Para ${o} se estima que todavía falta pagar ${fmt(res, 2)} ${u}: la diferencia entre el costo final estimado (${fmt(ultimo, 2)}) y lo ya pagado (${fmt(pagado[i], 2)}).`));
    });
    cifras["reserva:total"] = cifra("la reserva total", totR, explicacion("Reserva total = Σ_origen (Último − Pagado actual)",
      tablaOrigenes.map((r) => [`Reserva ${r.origen}`, r.reserva]),
      ["Se calculan factores ponderados por volumen para cada par de edades consecutivas.",
       "Se multiplica cada último pagado por el producto de los factores que le faltan.",
       "Se resta lo ya pagado para obtener la reserva por origen.",
       tablaOrigenes.map((r) => fmt(r.reserva)).join(" + ") + ` = ${fmt(totR)}.`], supuestos, limit,
      `Se estima que la aseguradora todavía debe pagar ${fmt(totR, 2)} ${u} de ${tri.moneda} por siniestros ya ocurridos. Es la suma de lo que falta por pagar en cada año.`));
    cifras["ultimo:total"] = cifra("el costo último total", totU, explicacion("Σ Último",
      tablaOrigenes.map((r) => [r.origen, r.ultimo]), ["Suma de los costos últimos por origen."], supuestos, limit));
    return resultado("Chain Ladder", "1.0.0", tri, { cola, excluir }, cifras, tablaFactores, tablaOrigenes, supuestos, advertencias);
  }

  function resultado(metodo, version, tri, parametros, cifras, tablaFactores, tablaOrigenes, supuestos, advertencias) {
    return { metodo, versionMetodo: version, huellaDatos: huella(tri), parametros, unidad: tri.unidad, moneda: tri.moneda,
      cifras, tablaFactores, tablaOrigenes, supuestos, advertencias, estado: BORRADOR, revisiones: [] };
  }

  function bornhuetterFerguson(tri, primas, elr, { cola = 1.0, fuente = "proporcionado por el usuario" } = {}) {
    const faltan = tri.origenes.filter((o) => !esNum(primas[o]));
    if (faltan.length) throw new MetodoNoAplicable(`Bornhuetter-Ferguson necesita la prima devengada de cada origen; faltan: ${faltan.join(", ")}.`);
    const elrs = {};
    tri.origenes.forEach((o) => { elrs[o] = typeof elr === "object" ? elr[o] : elr; });
    const sinElr = tri.origenes.filter((o) => !esNum(elrs[o]));
    if (sinElr.length) throw new MetodoNoAplicable(`Falta la siniestralidad esperada de: ${sinElr.join(", ")}.`);
    if (Object.values(elrs).some((x) => !(x > 0 && x < 5))) throw new MetodoNoAplicable("La siniestralidad esperada debe ser un cociente positivo (p. ej. 0.70 = 70%).");
    const cl = chainLadder(tri, { cola });
    const u = tri.unidad, valores = Object.values(elrs);
    const supuestos = [
      "El patrón de desarrollo histórico (Chain Ladder) indica qué porcentaje del costo falta por desarrollar.",
      cl.supuestos[2],
      "Siniestralidad esperada a priori: " + (new Set(valores).size === 1 ? `${pct(valores[0], 2)} para todos los orígenes`
        : tri.origenes.map((o) => `${o}: ${pct(elrs[o], 2)}`).join(", ")) + ` (${fuente}).`,
      "Las primas devengadas por origen son correctas y están en la misma unidad que los pagos.",
    ];
    const limit = ["El resultado depende directamente de la siniestralidad a priori: si está sesgada, la reserva también.",
      "No reacciona a la experiencia reciente del origen tanto como Chain Ladder (es su propósito)."];
    const cifras = {}, tablaOrigenes = [];
    let totR = 0, totU = 0;
    cl.tablaOrigenes.forEach((fila) => {
      const o = fila.origen, pend = 1 - 1 / fila.fda, esperado = primas[o] * elrs[o], res = esperado * pend, ultimo = fila.pagado + res;
      totR += res; totU += ultimo;
      tablaOrigenes.push({ ...fila, prima: primas[o], elr: elrs[o], pctPendiente: pend, ultimo, reserva: res });
      cifras[`reserva:${o}`] = cifra(`la reserva BF de ${o}`, res, explicacion("Reserva = Prima × ELR × (1 − 1/FDA)",
        [["Prima devengada", primas[o]], ["ELR", elrs[o]], ["FDA (Chain Ladder)", fila.fda]],
        [`Siniestros esperados a priori = ${fmt(primas[o])} × ${elrs[o].toFixed(4)} = ${fmt(esperado)}.`,
         `Porcentaje aún no desarrollado = 1 − 1/${fila.fda.toFixed(6)} = ${pend.toFixed(6)}.`,
         `Reserva = ${fmt(esperado)} × ${pend.toFixed(6)} = ${fmt(res)}.`], supuestos, limit,
        `Con la prima de ${o} esperábamos siniestros por ${fmt(esperado, 2)} ${u}. Según el patrón histórico, falta por desarrollar el ${pct(pend)}, así que reservamos ${fmt(res, 2)} ${u}.`));
      cifras[`ultimo:${o}`] = cifra(`el costo último BF de ${o}`, ultimo, explicacion("Último = Pagado + Reserva BF",
        [["Pagado", fila.pagado], ["Reserva BF", res]], [`Último = ${fmt(fila.pagado)} + ${fmt(res)} = ${fmt(ultimo)}.`], supuestos, limit));
    });
    cifras["reserva:total"] = cifra("la reserva BF total", totR, explicacion("Σ Prima × ELR × (1 − 1/FDA)",
      tablaOrigenes.map((r) => [`Reserva ${r.origen}`, r.reserva]), [tablaOrigenes.map((r) => fmt(r.reserva)).join(" + ") + ` = ${fmt(totR)}.`],
      supuestos, limit, `Por el método BF, falta por pagar ${fmt(totR, 2)} ${u} de ${tri.moneda}.`));
    cifras["ultimo:total"] = cifra("el costo último BF total", totU, explicacion("Σ Último",
      tablaOrigenes.map((r) => [r.origen, r.ultimo]), ["Suma de los costos últimos por origen."], supuestos, limit));
    return resultado("Bornhuetter-Ferguson", "1.0.0", tri, { cola, siniestralidadEsperada: elrs, fuenteSupuesto: fuente },
      cifras, cl.tablaFactores, tablaOrigenes, supuestos, [...cl.advertencias]);
  }

  // Inversa de la normal estándar (Acklam, error relativo < 1.2e-9).
  function invNormal(p) {
    const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.383577518672690e2, -3.066479806614716e1, 2.506628277459239];
    const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1];
    const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
    const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];
    const pl = 0.02425;
    if (p < pl) { const q = Math.sqrt(-2 * Math.log(p)); return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
    if (p > 1 - pl) return -invNormal(1 - p);
    const q = p - 0.5, r = q * q;
    return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  }

  function mack(tri, { nivel = 0.95 } = {}) {
    const I = tri.origenes.length, K = tri.edades.length;
    if (I < 3 || K < 3) throw new MetodoNoAplicable("Mack necesita al menos 3 orígenes y 3 edades de desarrollo.");
    const cl = chainLadder(tri);
    const { f, den, n } = factoresDesarrollo(tri);
    const s2 = Array(K - 1).fill(NaN), extrap = [];
    for (let j = 0; j < K - 1; j++) if (n[j] >= 2) {
      let s = 0;
      for (let i = 0; i < I; i++) if (obs(tri, i, j) && obs(tri, i, j + 1)) {
        const c = tri.valores[i][j]; s += c * (tri.valores[i][j + 1] / c - f[j]) ** 2;
      }
      s2[j] = s / (n[j] - 1);
    }
    for (let j = 0; j < K - 1; j++) if (Number.isNaN(s2[j])) {
      if (j < 2 || Number.isNaN(s2[j - 1]) || Number.isNaN(s2[j - 2]))
        throw new MetodoNoAplicable(`No hay suficientes datos para estimar la varianza del factor ${tri.edades[j]}→${tri.edades[j + 1]}.`);
      const a = s2[j - 2], b = s2[j - 1];
      s2[j] = Math.min(a > 0 ? b * b / a : 0, a, b);
      extrap.push(j);
    }
    const ult = indiceUltimo(tri);
    const C = tri.valores.map((fila, i) => { const r = [...fila]; for (let j = ult[i] + 1; j < K; j++) r[j] = r[j - 1] * f[j - 1]; return r; });
    const U = C.map((r) => r[K - 1]);
    const mse = Array(I).fill(0), param = Array(I).fill(0);
    for (let i = 0; i < I; i++) {
      for (let k = ult[i]; k < K - 1; k++) {
        mse[i] += s2[k] / f[k] ** 2 * (1 / C[i][k] + 1 / den[k]);
        param[i] += 2 * s2[k] / (f[k] ** 2 * den[k]);
      }
      mse[i] *= U[i] ** 2;
    }
    let mseTot = mse.reduce((a, b) => a + b, 0);
    for (let i = 0; i < I; i++) mseTot += U[i] * U.slice(i + 1).reduce((a, b) => a + b, 0) * param[i];
    const se = mse.map(Math.sqrt), seTot = Math.sqrt(mseTot);
    const advertencias = [...cl.advertencias];
    if (extrap.length) advertencias.push(hallazgo(ADVERTENCIA, "SIGMA_EXTRAPOLADA",
      "La varianza de " + extrap.map((j) => `${tri.edades[j]}→${tri.edades[j + 1]}`).join(", ") + " se extrapoló con la regla de Mack (sólo hay una observación).",
      "Valida la extrapolación; con pocas observaciones la incertidumbre está subestimada."));
    const z = invNormal(0.5 + nivel / 2), p = pct(nivel, 0);
    const supuestos = [...cl.supuestos, "Los orígenes son independientes entre sí.",
      "La varianza del siguiente pago es proporcional al acumulado actual (supuesto de Mack).",
      `El intervalo de ${p} usa una distribución lognormal con la misma media y error estándar.`];
    const limit = ["Mide el error de estimación y de proceso del modelo Chain Ladder, no el riesgo de que el modelo sea inadecuado (riesgo de modelo).",
      "Con triángulos pequeños el error estándar es muy incierto."];
    const intervalo = (m, de) => {
      if (m <= 0 || de <= 0) return [m, m];
      const s = Math.sqrt(Math.log(1 + (de / m) ** 2)), mu = Math.log(m) - s * s / 2;
      return [Math.exp(mu - z * s), Math.exp(mu + z * s)];
    };
    const cifras = { ...cl.cifras }, tablaOrigenes = [];
    cl.tablaOrigenes.forEach((fila, i) => {
      const [bajo, alto] = intervalo(fila.reserva, se[i]);
      tablaOrigenes.push({ ...fila, errorEstandar: se[i], cv: fila.reserva > 0 ? se[i] / fila.reserva : NaN, intervaloInferior: bajo, intervaloSuperior: alto });
      const fut = []; for (let k = ult[i]; k < K - 1; k++) fut.push(`${tri.edades[k]}→${tri.edades[k + 1]}`);
      const ins = [["Costo último Ĉ_i,U", U[i]]];
      for (let k = ult[i]; k < K - 1; k++) ins.push([`σ²(${tri.edades[k]}→${tri.edades[k + 1]})`, s2[k]]);
      cifras[`error_estandar:${fila.origen}`] = cifra(`el error estándar de la reserva de ${fila.origen}`, se[i], explicacion(
        "ee(R_i) = Ĉ_i,U · √( Σ_k σ²_k/f²_k · (1/Ĉ_i,k + 1/S_k) )", ins,
        fut.length ? [`Se suman las contribuciones de las edades pendientes: ${fut.join(", ")}.`, `mse = ${fmt(mse[i], 6)}; ee = √mse = ${fmt(se[i])}.`]
          : ["El origen ya está totalmente desarrollado: error estándar 0."], supuestos, limit,
        `La reserva de ${fila.origen} (${fmt(fila.reserva, 2)}) podría razonablemente variar en ± ${fmt(se[i], 2)} ${tri.unidad}. Entre más reciente el año, más incertidumbre.`));
    });
    const total = cl.cifras["reserva:total"].valor, [bajo, alto] = intervalo(total, seTot);
    cifras["error_estandar:total"] = cifra("el error estándar de la reserva total", seTot, explicacion(
      "mse(R) = Σ_i mse(R_i) + Σ_i Ĉ_i,U · Σ_{j>i} Ĉ_j,U · Σ_k 2σ²_k/(f²_k·S_k)",
      [["Σ mse(R_i)", mse.reduce((a, b) => a + b, 0)], ["mse(R) total", mseTot]],
      ["Se suman los errores cuadráticos de cada origen.", "Se añade la covarianza entre orígenes: todos usan los mismos factores estimados.",
       `ee total = √${fmt(mseTot)} = ${fmt(seTot)}.`], supuestos, limit,
      `La reserva total estimada es ${fmt(total, 2)} ${tri.unidad}, con un error estándar de ${fmt(seTot, 2)} (coeficiente de variación ${pct(seTot / total)}).`));
    const insI = [["Reserva", total], ["Error estándar", seTot], ["z", z]];
    cifras["intervalo:total:inferior"] = cifra(`el límite inferior del intervalo de ${p}`, bajo, explicacion("Lognormal(μ, s): exp(μ − z·s)", insI,
      [`s = √ln(1 + CV²); μ = ln(R) − s²/2; límite = ${fmt(bajo)}.`], supuestos, limit));
    cifras["intervalo:total:superior"] = cifra(`el límite superior del intervalo de ${p}`, alto, explicacion("Lognormal(μ, s): exp(μ + z·s)", insI,
      [`s = √ln(1 + CV²); μ = ln(R) − s²/2; límite = ${fmt(alto)}.`], supuestos, limit));
    const tablaFactores = cl.tablaFactores.map((t, j) => ({ ...t, sigma2: s2[j], sigma2Extrapolada: extrap.includes(j) }));
    return resultado("Mack", "1.0.0", tri, { nivelConfianza: nivel, cola: 1 }, cifras, tablaFactores, tablaOrigenes, supuestos, advertencias);
  }

  // ------------------------------------------------- Selector y revisión
  function evaluarMetodos(tri, tienePrimas = false, tieneElr = false) {
    const I = tri.origenes.length, K = tri.edades.length;
    const obsEdad = tri.edades.map((e, j) => tri.valores.filter((f) => f[j] !== null).length);
    const out = [];
    let razones = [], falta = [];
    const clOk = I >= 2 && K >= 2 && obsEdad.slice(1).every((c) => c >= 1);
    if (clOk) {
      razones.push(`Hay ${I} orígenes y ${K} edades: se pueden estimar todos los factores.`);
      if (I < 5) razones.push("Con menos de 5 orígenes los factores son frágiles; úsalo como referencia, no como única estimación.");
    } else falta.push("al menos 2 orígenes con observaciones en cada par de edades consecutivas");
    out.push({ metodo: "Chain Ladder", aplicable: clOk, razones, falta });
    razones = []; falta = [];
    if (!clOk) falta.push("un patrón de desarrollo estimable (requisito de Chain Ladder)");
    if (!tienePrimas) falta.push("primas devengadas por origen");
    if (!tieneElr) falta.push("una siniestralidad esperada a priori justificada (plan de negocio, tarificación, mercado)");
    if (!falta.length) razones.push("Útil cuando los orígenes recientes tienen poco desarrollo y sus pagos son poco representativos.");
    out.push({ metodo: "Bornhuetter-Ferguson", aplicable: !falta.length, razones, falta });
    razones = []; falta = [];
    const mackOk = clOk && I >= 3 && K >= 3;
    if (mackOk) {
      razones.push("Permite medir la incertidumbre de la reserva Chain Ladder (error estándar e intervalo).");
      if (obsEdad.slice(1).some((c) => c === 1)) razones.push("Alguna varianza se estimará con una sola observación o se extrapolará: interpreta el intervalo con cautela.");
    } else falta.push("al menos 3 orígenes y 3 edades de desarrollo");
    out.push({ metodo: "Mack", aplicable: mackOk, razones, falta });
    return out;
  }

  function revisar(res, estado, revisor, comentario = "") {
    if (!String(revisor || "").trim()) throw new Error("La revisión debe identificar a la persona que revisa.");
    res.estado = estado;
    res.revisiones.push({ estado, revisor: revisor.trim(), comentario, fecha: new Date().toISOString().slice(0, 19) + "Z" });
    return res;
  }

  // --------------------------------------------------------- Auditoría
  function sha256(texto) {
    const bytes = new TextEncoder().encode(texto);
    const K = new Uint32Array([0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2]);
    const H = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
    const l = bytes.length, total = Math.ceil((l + 9) / 64) * 64, m = new Uint8Array(total);
    m.set(bytes); m[l] = 0x80;
    const dv = new DataView(m.buffer);
    dv.setUint32(total - 8, Math.floor((l * 8) / 2 ** 32)); dv.setUint32(total - 4, (l * 8) >>> 0);
    const w = new Uint32Array(64), rot = (x, n) => (x >>> n) | (x << (32 - n));
    for (let o = 0; o < total; o += 64) {
      for (let t = 0; t < 16; t++) w[t] = dv.getUint32(o + t * 4);
      for (let t = 16; t < 64; t++) {
        const s0 = rot(w[t - 15], 7) ^ rot(w[t - 15], 18) ^ (w[t - 15] >>> 3), s1 = rot(w[t - 2], 17) ^ rot(w[t - 2], 19) ^ (w[t - 2] >>> 10);
        w[t] = (w[t - 16] + s0 + w[t - 7] + s1) >>> 0;
      }
      let [a, b, c, d, e, f, g, h] = H;
      for (let t = 0; t < 64; t++) {
        const t1 = (h + (rot(e, 6) ^ rot(e, 11) ^ rot(e, 25)) + ((e & f) ^ (~e & g)) + K[t] + w[t]) >>> 0;
        const t2 = ((rot(a, 2) ^ rot(a, 13) ^ rot(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
        h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
      }
      [a, b, c, d, e, f, g, h].forEach((x, k) => { H[k] = (H[k] + x) >>> 0; });
    }
    return [...H].map((x) => x.toString(16).padStart(8, "0")).join("");
  }

  function huella(tri) {
    return sha256(JSON.stringify({ origenes: tri.origenes, edades: tri.edades, valores: tri.valores,
      unidad: tri.unidad, moneda: tri.moneda, tipo: tri.tipo }));
  }

  // --------------------------------------------------------- Presentación
  function aMoneda(valor, unidad, moneda) {
    const esc = ESCALAS[String(unidad).toLowerCase()];
    if (esc === undefined) return `${fmt(valor, 2)} ${unidad}`;
    const x = Math.round(valor * esc * 100) / 100;
    return `${x < 0 ? "-" : ""}$${fmt(Math.abs(x), 2)} ${moneda}`;
  }

  function porQue(res, clave, modo = "experto") {
    const c = res.cifras[clave];
    if (!c) throw new Error(`No hay una cifra «${clave}».`);
    const unidad = clave.startsWith("factor:") ? "" : ` (${res.unidad} de ${res.moneda})`;
    return { titulo: `¿Por qué ${c.etiqueta} = ${fmt(c.valor)}${unidad}?`, modo, ...c.explicacion };
  }

  function tablaTexto(tri) {
    const w = Math.max(10, ...tri.origenes.map((o) => o.length));
    const lineas = ["Origen".padEnd(w) + tri.edades.map((e) => `${e}m`.padStart(12)).join("")];
    tri.origenes.forEach((o, i) => lineas.push(o.padEnd(w) + tri.valores[i].map((x) => (x === null ? "—" : fmt(x, 2)).padStart(12)).join("")));
    return lineas.join("\n");
  }

  function informe(tri, resultados, hallazgos, titulo = "Estimación de reservas de siniestros") {
    const m = (x) => aMoneda(x, tri.unidad, tri.moneda), r0 = resultados[0], total = r0.cifras["reserva:total"].valor;
    const L = [`# ${titulo}`, ""];
    if (resultados.some((r) => r.estado !== "aprobado"))
      L.push(`> **Estado: ${BORRADOR}.** Las cifras provienen del motor de cálculo, pero no han sido aprobadas por un actuario responsable.`, "");
    L.push("## Resumen", "", `- **Reserva estimada total (${r0.metodo}): ${m(total)}**`);
    resultados.slice(1).forEach((r) => {
      const t = r.cifras["reserva:total"].valor;
      if (r.cifras["error_estandar:total"] && Math.abs(t - total) < 1e-9) return;
      L.push(`- ${r.metodo}: ${m(t)} (${(t - total) / total >= 0 ? "+" : ""}${pct((t - total) / total)} vs. ${r0.metodo})`);
    });
    const rm = resultados.find((r) => r.cifras["error_estandar:total"]);
    if (rm) L.push(`- Error estándar (Mack): ${m(rm.cifras["error_estandar:total"].valor)}; intervalo de ${pct(rm.parametros.nivelConfianza, 0)}: ${m(rm.cifras["intervalo:total:inferior"].valor)} – ${m(rm.cifras["intervalo:total:superior"].valor)}`);
    const mayor = [...r0.tablaOrigenes].sort((a, b) => b.reserva - a.reserva)[0];
    if (total > 0 && mayor) L.push(`- El origen ${mayor.origen} concentra el ${pct(mayor.reserva / total, 0)} de la reserva; es el de menor desarrollo (${mayor.edadActual} meses) y el más sensible a los supuestos.`);
    L.push("", "## Datos utilizados", "", `- Fuente: ${tri.fuente || "captura en la app"}`, `- Tipo: ${tri.tipo}; unidad de cálculo: ${tri.unidad} de ${tri.moneda}`,
      `- Huella SHA-256: ${huella(tri)}`, "", "```", tablaTexto(tri), "```", "", "## Validación de datos", "");
    const rel = hallazgos.filter((h) => h.severidad !== "info");
    if (rel.length) rel.forEach((h) => L.push(`- **${h.severidad}** ${h.codigo} ${h.ubicacion}: ${h.mensaje} ${h.sugerencia}`.trim()));
    else L.push("- Sin hallazgos: estructura triangular completa, montos no negativos y acumulados crecientes.");
    L.push("", "## Factores de desarrollo", "", "| Periodo | Factor | Factor acumulado | Orígenes usados |", "|---|---:|---:|---|");
    r0.tablaFactores.forEach((f) => L.push(`| ${f.desde} → ${f.hasta} meses | ${f.factor.toFixed(5)} | ${f.fda.toFixed(5)} | ${f.origenesUsados.join(", ")} |`));
    resultados.forEach((r) => {
      const ee = r.tablaOrigenes[0] && "errorEstandar" in r.tablaOrigenes[0];
      L.push("", `## Resultados: ${r.metodo}`, "", "| Origen | Pagado | Costo último estimado | Reserva |" + (ee ? " Error estándar |" : ""),
        "|---|---:|---:|---:|" + (ee ? "---:|" : ""));
      r.tablaOrigenes.forEach((f) => L.push(`| ${f.origen} | ${m(f.pagado)} | ${m(f.ultimo)} | ${m(f.reserva)} |` + (ee ? ` ${m(f.errorEstandar)} |` : "")));
      L.push(`| **Total** | | ${m(r.cifras["ultimo:total"].valor)} | **${m(r.cifras["reserva:total"].valor)}** |` + (ee ? ` ${m(r.cifras["error_estandar:total"].valor)} |` : ""));
      L.push("", "Supuestos:", "", ...r.supuestos.map((s) => `- ${s}`));
      if (r.advertencias.length) L.push("", "Advertencias del método:", "", ...r.advertencias.map((h) => `- ${h.mensaje} ${h.sugerencia}`.trim()));
      if (r.revisiones.length) L.push("", "Revisión:", "", ...r.revisiones.map((v) => `- ${v.fecha} — ${v.estado} por ${v.revisor}: ${v.comentario}`));
    });
    L.push("", "## Trazabilidad", "", `Generado por ActuaryOS ${VERSION} (app móvil).`, "", "| Método | Versión | Parámetros |", "|---|---|---|");
    resultados.forEach((r) => L.push(`| ${r.metodo} | ${r.versionMetodo} | ${JSON.stringify(r.parametros)} |`));
    return L.join("\n") + "\n";
  }

  const API = {
    VERSION, BORRADOR, ERROR, ADVERTENCIA, TRANSFORMACION, MetodoNoAplicable,
    parsearCSV, cargarTriangulo, crearTriangulo, validarTriangulo, acumular, diagonal, hayErrores,
    factoresDesarrollo, chainLadder, bornhuetterFerguson, mack, evaluarMetodos,
    aprobar: (r, revisor, c) => revisar(r, "aprobado", revisor, c),
    rechazar: (r, revisor, c) => revisar(r, "rechazado", revisor, c),
    sha256, huella, aMoneda, porQue, informe, tablaTexto, invNormal,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  else global.ActuaryOS = API;
})(typeof window !== "undefined" ? window : globalThis);
