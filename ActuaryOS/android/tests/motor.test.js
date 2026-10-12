// Pruebas del motor JavaScript de la app: mismas referencias que el paquete de Python.
// Ejecutar: node --test ActuaryOS/android/tests/
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const A = require("../app/assets/www/motor.js");

const RAIZ = path.resolve(__dirname, "..", "..");
const CASO = path.join(RAIZ, "casos", "caso1_seguros_horizonte");
const leer = (...p) => fs.readFileSync(path.join(...p), "utf8");
const ESPERADO = JSON.parse(leer(CASO, "esperado.json"));
const TOL = ESPERADO.tolerancia;
const cerca = (a, b, tol = TOL) => assert.ok(Math.abs(a - b) <= tol, `${a} ≠ ${b}`);
const codigos = (hs) => new Set(hs.map((h) => h.codigo));
const caso1 = () => A.cargarTriangulo(leer(CASO, "pagos_acumulados.csv"), { unidad: "miles", moneda: "MXN" });
const PRIMAS = { 2021: 270, 2022: 300, 2023: 340, 2024: 390 };

test("Caso 1: carga sin hallazgos y «—» no es cero", () => {
  const { tri, hallazgos } = caso1();
  assert.deepEqual(hallazgos, []);
  assert.deepEqual(tri.edades, [12, 24, 36, 48]);
  assert.equal(tri.valores[3][1], null);
  assert.deepEqual(A.diagonal(tri), [200, 201, 196, 160]);
});

test("Caso 1: factores, últimos y reservas esperados", () => {
  const r = A.chainLadder(caso1().tri);
  for (const [k, v] of Object.entries(ESPERADO.chain_ladder.factores)) cerca(r.cifras[`factor:${k}`].valor, v);
  for (const [o, v] of Object.entries(ESPERADO.chain_ladder.ultimo)) cerca(r.cifras[`ultimo:${o}`].valor, v);
  for (const [o, v] of Object.entries(ESPERADO.chain_ladder.reserva)) cerca(r.cifras[`reserva:${o}`].valor, v);
  cerca(r.cifras["reserva:total"].valor, ESPERADO.chain_ladder.reserva_total);
  assert.equal(A.aMoneda(r.cifras["reserva:total"].valor, "miles", "MXN"), ESPERADO.chain_ladder.presentacion_total);
  assert.equal(r.estado, A.BORRADOR);
  assert.deepEqual(r.advertencias.map((h) => h.codigo), ["FACTOR_CON_UNA_OBSERVACION"]);
});

test("Caso 1: cola y exclusión son supuestos explícitos", () => {
  const { tri } = caso1();
  const c = A.chainLadder(tri, { cola: 1.05 });
  cerca(c.cifras["reserva:2021"].valor, 10, 1e-9);
  assert.ok(c.supuestos.some((s) => s.includes("1.05")));
  const e = A.chainLadder(tri, { excluir: [["2021", 12]] });
  cerca(e.cifras["factor:12-24"].valor, (168 + 196) / (120 + 140), 1e-12);
  assert.throws(() => A.chainLadder(tri, { cola: 0.9 }), A.MetodoNoAplicable);
});

test("Caso 1: Bornhuetter-Ferguson y supuestos obligatorios", () => {
  const { tri } = caso1();
  const r = A.bornhuetterFerguson(tri, PRIMAS, 0.75, { fuente: "plan sintético" });
  cerca(r.cifras["reserva:total"].valor, ESPERADO.bornhuetter_ferguson.reserva_total);
  assert.throws(() => A.bornhuetterFerguson(tri, { 2021: 270 }, 0.75), /prima/);
  assert.throws(() => A.bornhuetterFerguson(tri, PRIMAS, undefined), /siniestralidad/);
});

test("«¿Por qué?» trae fórmula, insumos, pasos y versión sencilla", () => {
  const r = A.chainLadder(caso1().tri);
  const x = A.porQue(r, "reserva:2024");
  assert.equal(x.formula, "Reserva = Último − Pagado actual");
  assert.ok(x.pasos.join(" ").includes("304.1137"));
  assert.ok(x.sencilla.includes("falta pagar 144.11 miles"));
  assert.ok(A.porQue(r, "factor:12-24").pasos[2].includes("514.0000 / 360.0000"));
});

test("Revisión exige nombre de quien aprueba", () => {
  const r = A.chainLadder(caso1().tri);
  assert.throws(() => A.aprobar(r, " "));
  A.aprobar(r, "Actuaria responsable", "ok");
  assert.equal(r.estado, "aprobado");
});

test("Mack reproduce Mack (1993) sobre Taylor & Ashe", () => {
  const { tri } = A.cargarTriangulo(leer(RAIZ, "tests", "referencias", "genins_taylor_ashe.csv"), { unidad: "unidades", moneda: "-" });
  const r = A.mack(tri);
  cerca(r.cifras["reserva:total"].valor, 18680856, 1);
  assert.deepEqual(r.tablaOrigenes.map((f) => Math.round(f.errorEstandar)),
    [0, 75535, 121699, 133549, 261406, 411010, 558317, 875328, 971258, 1363155]);
  assert.equal(Math.round(r.cifras["error_estandar:total"].valor), 2447095);
});

test("Mack en Caso 1 coincide con la versión de Python", () => {
  const r = A.mack(caso1().tri);
  cerca(r.cifras["error_estandar:total"].valor, 12.212614446458785, 1e-9);
  assert.ok(r.advertencias.some((h) => h.codigo === "SIGMA_EXTRAPOLADA"));
});

test("Detector de errores con los archivos del Caso 1", () => {
  const E = path.join(CASO, "con_errores");
  const cargar = (n, op = {}) => A.cargarTriangulo(leer(E, n), { unidad: "miles", moneda: "MXN", ...op });
  let r = cargar("hueco_intermedio.csv");
  assert.equal(r.tri, null); assert.ok(codigos(r.hallazgos).has("PERIODO_INCOMPLETO"));
  r = cargar("numeros_con_formato.csv");
  assert.equal(r.tri, null);
  assert.ok(codigos(r.hallazgos).has("NUMERO_CON_FORMATO") && codigos(r.hallazgos).has("SEPARADOR_AMBIGUO"));
  r = cargar("numeros_con_formato.csv", { limpiarFormato: true });
  assert.ok(codigos(r.hallazgos).has("FORMATO_NUMERICO_LIMPIADO") && r.tri === null);
  r = cargar("datos_incrementales.csv");
  assert.ok(codigos(r.hallazgos).has("POSIBLES_DATOS_INCREMENTALES"));
  r = cargar("datos_incrementales.csv", { incremental: true });
  assert.deepEqual(A.diagonal(r.tri), [200, 201, 196, 160]);
  r = cargar("formato_largo_duplicados_monedas.csv", { formato: "largo", moneda: undefined });
  assert.ok(codigos(r.hallazgos).has("CELDA_DUPLICADA") && codigos(r.hallazgos).has("MONEDAS_MEZCLADAS"));
  r = cargar("factor_atipico.csv");
  assert.ok(r.tri);
  assert.deepEqual(r.hallazgos.filter((h) => h.codigo === "FACTOR_ATIPICO").map((h) => h.ubicacion), ["origen 2023"]);
});

test("Selector explica qué falta", () => {
  const ev = A.evaluarMetodos(caso1().tri);
  assert.deepEqual(ev.map((e) => e.aplicable), [true, false, true]);
  assert.ok(ev[1].falta.some((f) => f.includes("primas")));
});

test("SHA-256 propio coincide con node:crypto", () => {
  for (const s of ["", "abc", "ActuaryOS ñ — 231,369.44", "x".repeat(1000)])
    assert.equal(A.sha256(s), crypto.createHash("sha256").update(s, "utf8").digest("hex"));
});

test("Normal inversa", () => {
  cerca(A.invNormal(0.975), 1.959963984540054, 1e-8);
  cerca(A.invNormal(0.005), -2.5758293035489, 1e-8);
});

test("Informe usa las cifras del motor", () => {
  const { tri, hallazgos } = caso1();
  const md = A.informe(tri, [A.chainLadder(tri), A.mack(tri)], hallazgos);
  assert.ok(md.includes("$231,369.44 MXN") && md.includes("borrador") && md.includes("concentra el 62%"));
});
