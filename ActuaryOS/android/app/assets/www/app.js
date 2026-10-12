/* Interfaz de ActuaryOS: sólo presenta lo que calcula motor.js. */
(function () {
  "use strict";
  const A = window.ActuaryOS;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  const EJEMPLO = "anio_siniestro,12,24,36,48\n2021,100,150,180,200\n2022,120,168,201,\n2023,140,196,,\n2024,160,,,\n";
  const PRIMAS_EJEMPLO = { 2021: 270, 2022: 300, 2023: 340, 2024: 390 };

  const estado = { tri: null, hallazgos: [], resultados: [], fuente: "" };
  const modo = () => ($("modoExperto").checked ? "experto" : "principiante");
  const dinero = (x) => A.aMoneda(x, estado.tri.unidad, estado.tri.moneda);
  // En tablas se omite la moneda (va en el encabezado) para que quepan en pantallas angostas.
  const corto = (x) => dinero(x).replace(" " + estado.tri.moneda, "");

  // ------------------------------------------------------------ Navegación
  function irA(paso) {
    document.querySelectorAll(".paso").forEach((s) => s.classList.toggle("activo", s.id === "paso-" + paso));
    document.querySelectorAll("#pasos button").forEach((b) => b.classList.toggle("activo", b.dataset.paso === paso));
    window.scrollTo(0, 0);
  }
  function habilitar(...pasos) {
    document.querySelectorAll("#pasos button").forEach((b) => { if (pasos.includes(b.dataset.paso)) b.disabled = false; });
  }
  function bloquearDesde(paso) {
    const orden = ["datos", "metodos", "resultados", "informe"];
    document.querySelectorAll("#pasos button").forEach((b) => {
      if (orden.indexOf(b.dataset.paso) >= orden.indexOf(paso)) b.disabled = true;
    });
  }
  $("pasos").addEventListener("click", (e) => { const b = e.target.closest("button"); if (b && !b.disabled) irA(b.dataset.paso); });

  function toast(msg) {
    const t = $("toast"); t.textContent = msg; t.classList.remove("oculto");
    clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.add("oculto"), 2600);
  }

  // ----------------------------------------------------------------- Datos
  $("btnEjemplo").onclick = () => {
    $("texto").value = EJEMPLO; $("formato").value = "ancho"; $("unidad").value = "miles"; $("moneda").value = "MXN";
    $("incremental").checked = false; $("limpiar").checked = false;
    estado.fuente = "Ejemplo sintético: Seguros Horizonte (Caso 1)";
    validar();
  };
  $("archivo").onchange = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => { $("texto").value = r.result; estado.fuente = f.name; validar(); };
    r.onerror = () => toast("No se pudo leer el archivo.");
    r.readAsText(f);
    e.target.value = "";
  };
  $("texto").addEventListener("input", () => { estado.fuente = "captura en la app"; });
  $("btnValidar").onclick = validar;

  function validar() {
    const texto = $("texto").value;
    bloquearDesde("metodos");
    if (!texto.trim()) { toast("Primero carga o pega los datos."); return; }
    const { tri, hallazgos } = A.cargarTriangulo(texto, {
      formato: $("formato").value, unidad: $("unidad").value, moneda: $("moneda").value.trim().toUpperCase() || "sin especificar",
      limpiarFormato: $("limpiar").checked, incremental: $("incremental").checked, fuente: estado.fuente || "captura en la app",
    });
    estado.tri = tri; estado.hallazgos = hallazgos;
    $("validacion").classList.remove("oculto");
    $("hallazgos").innerHTML = hallazgos.length ? hallazgos.map(htmlHallazgo).join("")
      : '<div class="aviso ok">Sin hallazgos: estructura triangular completa, montos no negativos y acumulados crecientes.</div>';
    if (tri) {
      $("tablaTriangulo").innerHTML = htmlTriangulo(tri);
      $("btnAMetodos").classList.remove("oculto");
      prepararMetodos();
      habilitar("metodos");
    } else {
      $("tablaTriangulo").innerHTML = "";
      $("btnAMetodos").classList.add("oculto");
      $("hallazgos").insertAdjacentHTML("beforeend",
        '<p class="nota">No se calculó nada. Corrige los errores en el archivo o activa una opción explícita; los datos originales no se modificaron.</p>');
    }
    $("validacion").scrollIntoView({ behavior: "smooth" });
  }

  function htmlHallazgo(h) {
    return `<div class="aviso ${esc(h.severidad)}"><span class="cod">${esc(h.severidad.toUpperCase())} · ${esc(h.codigo)}${h.ubicacion ? " · " + esc(h.ubicacion) : ""}</span>${esc(h.mensaje)}${h.sugerencia ? `<span class="sug">→ ${esc(h.sugerencia)}</span>` : ""}</div>`;
  }
  function htmlTriangulo(tri) {
    const cab = "<tr><th>Origen</th>" + tri.edades.map((e) => `<th>${e} m</th>`).join("") + "</tr>";
    const filas = tri.origenes.map((o, i) => `<tr><td>${esc(o)}</td>` + tri.valores[i].map((x) =>
      x === null ? '<td class="vacio">—</td>' : `<td>${x.toLocaleString("en-US", { maximumFractionDigits: 2 })}</td>`).join("") + "</tr>").join("");
    return `<caption class="nota" style="caption-side:top;text-align:left">${esc(tri.tipo)} · ${esc(tri.unidad)} de ${esc(tri.moneda)} · «—» = aún no observado</caption>${cab}${filas}`;
  }
  $("btnAMetodos").onclick = () => irA("metodos");

  // --------------------------------------------------------------- Métodos
  function prepararMetodos() {
    const tri = estado.tri;
    const esEjemplo = $("texto").value.trim() === EJEMPLO.trim();
    $("primas").innerHTML = tri.origenes.map((o) =>
      `<label class="campo">Prima devengada ${esc(o)} <input type="number" step="any" min="0" data-prima="${esc(o)}" value="${esEjemplo && PRIMAS_EJEMPLO[o] ? PRIMAS_EJEMPLO[o] : ""}"></label>`).join("");
    if (esEjemplo) { $("elr").value = 75; $("fuenteElr").value = "supuesto sintético del ejemplo"; }
    else { $("elr").value = ""; $("fuenteElr").value = ""; }
    actualizarEvaluacion();
  }
  function leerPrimas() {
    const p = {};
    document.querySelectorAll("[data-prima]").forEach((i) => { if (i.value !== "") p[i.dataset.prima] = parseFloat(i.value); });
    return p;
  }
  function actualizarEvaluacion() {
    const primas = leerPrimas();
    const tienePrimas = estado.tri.origenes.every((o) => Number.isFinite(primas[o]));
    const ev = A.evaluarMetodos(estado.tri, tienePrimas, $("elr").value !== "");
    $("evaluacion").innerHTML = ev.map((e) => `<div class="metodo"><span class="${e.aplicable ? "ok" : "no"}">${e.aplicable ? "✔" : "✘"}</span> <b>${esc(e.metodo)}</b>
      <ul>${e.razones.map((r) => `<li>${esc(r)}</li>`).join("")}${e.falta.map((f) => `<li>Falta: ${esc(f)}</li>`).join("")}</ul></div>`).join("") +
      '<p class="nota">Diferencias grandes entre métodos son una señal para revisar supuestos, no para elegir la cifra más conveniente.</p>';
    const mack = ev.find((e) => e.metodo === "Mack");
    $("mMack").disabled = !mack.aplicable;
    if (!mack.aplicable) $("mMack").checked = false;
  }
  $("mBF").onchange = () => $("bfOpciones").classList.toggle("oculto", !$("mBF").checked);
  $("paso-metodos").addEventListener("input", (e) => { if (e.target.dataset.prima !== undefined || e.target.id === "elr") actualizarEvaluacion(); });

  $("btnCalcular").onclick = () => {
    const err = $("errorMetodos"); err.classList.add("oculto");
    const tri = estado.tri, cola = parseFloat($("cola").value || "1");
    const res = [];
    try {
      if (!$("mCL").checked && !$("mMack").checked && !$("mBF").checked) throw new Error("Elige al menos un método.");
      if ($("mCL").checked || ($("mMack").checked && cola !== 1)) res.push(A.chainLadder(tri, { cola }));
      if ($("mBF").checked) {
        const elr = parseFloat($("elr").value) / 100;
        res.push(A.bornhuetterFerguson(tri, leerPrimas(), Number.isFinite(elr) ? elr : undefined,
          { cola, fuente: $("fuenteElr").value.trim() || "proporcionado por el usuario, sin fuente documentada" }));
      }
      if ($("mMack").checked) {
        if (cola !== 1) toast("Mack se omite: con cola ≠ 1 la incertidumbre de la cola no está modelada.");
        else res.push(A.mack(tri, { nivel: parseFloat($("nivel").value) }));
      }
    } catch (e) {
      err.textContent = e.message; err.classList.remove("oculto"); return;
    }
    // Chain Ladder primero como referencia; Mack ya lo contiene si no se pidió aparte.
    res.sort((a, b) => ["Chain Ladder", "Mack", "Bornhuetter-Ferguson"].indexOf(a.metodo) - ["Chain Ladder", "Mack", "Bornhuetter-Ferguson"].indexOf(b.metodo));
    estado.resultados = res;
    pintarResultados();
    habilitar("resultados", "informe");
    irA("resultados");
  };

  // ------------------------------------------------------------ Resultados
  function pintarResultados() {
    const r0 = estado.resultados[0], total = r0.cifras["reserva:total"].valor;
    $("totalPrincipal").textContent = dinero(total);
    $("totalPrincipal").dataset.ref = "0|reserva:total";
    const mack = estado.resultados.find((r) => r.cifras["error_estandar:total"]);
    $("totalSub").innerHTML = esc(r0.metodo) + (mack ? ` · intervalo ${Math.round(mack.parametros.nivelConfianza * 100)}%: ${esc(dinero(mack.cifras["intervalo:total:inferior"].valor))} – ${esc(dinero(mack.cifras["intervalo:total:superior"].valor))}` : "") +
      '<br><span class="nota">Toca cualquier cifra subrayada para ver «¿Por qué?»</span>';
    pintarEstado();
    $("resultados").innerHTML = estado.resultados.map(htmlMetodo).join("") + htmlComparacion();
    $("escCola").value = r0.parametros.cola || 1; $("escAjuste").value = 0;
    escenario();
  }
  function pintarEstado() {
    const r0 = estado.resultados[0], e = $("estado");
    e.textContent = r0.estado === A.BORRADOR ? "Borrador · requiere revisión actuarial" :
      `${r0.estado === "aprobado" ? "Aprobado" : "Rechazado"} por ${r0.revisiones.at(-1).revisor}`;
    e.className = "estado " + (r0.estado === "aprobado" ? "aprobado" : r0.estado === "rechazado" ? "rechazado" : "");
  }
  function htmlMetodo(r, k) {
    const ee = "errorEstandar" in r.tablaOrigenes[0];
    const c = (clave, txt) => `<td class="porque" data-ref="${k}|${esc(clave)}">${esc(txt)}</td>`;
    const filas = r.tablaOrigenes.map((f) => `<tr><td>${esc(f.origen)}</td>${c("reserva:" + f.origen, corto(f.reserva))}${ee ? c("error_estandar:" + f.origen, corto(f.errorEstandar)) : ""}${c("ultimo:" + f.origen, corto(f.ultimo))}<td>${esc(corto(f.pagado))}</td></tr>`).join("");
    const tot = `<tr class="total"><td>Total</td>${c("reserva:total", corto(r.cifras["reserva:total"].valor))}${ee ? c("error_estandar:total", corto(r.cifras["error_estandar:total"].valor)) : ""}${c("ultimo:total", corto(r.cifras["ultimo:total"].valor))}<td></td></tr>`;
    const factores = k === 0 ? `<h3>Factores de desarrollo</h3><div class="tabla-scroll"><table class="tabla"><tr><th>Periodo</th><th>Factor</th><th>Acumulado</th></tr>${
      r.tablaFactores.map((f) => `<tr><td>${f.desde} → ${f.hasta} m</td>${c(`factor:${f.desde}-${f.hasta}`, f.factor.toFixed(5))}<td>${f.fda.toFixed(5)}</td></tr>`).join("")}</table></div>` : "";
    return `<div class="tarjeta"><h2>${esc(r.metodo)}</h2><p class="nota">Cifras en ${esc(estado.tri.moneda)}</p>
      <div class="tabla-scroll"><table class="tabla"><tr><th>Año</th><th>Reserva</th>${ee ? "<th>Error est.</th>" : ""}<th>Último</th><th>Pagado</th></tr>${filas}${tot}</table></div>
      ${factores}
      ${r.advertencias.map(htmlHallazgo).join("")}
      <details><summary class="nota">Supuestos (${r.supuestos.length})</summary><ul class="nota">${r.supuestos.map((s) => `<li>${esc(s)}</li>`).join("")}</ul></details></div>`;
  }
  function htmlComparacion() {
    const rs = estado.resultados;
    if (rs.length < 2) return "";
    const base = rs[0].cifras["reserva:total"].valor;
    const lineas = rs.slice(1).map((r) => {
      const t = r.cifras["reserva:total"].valor;
      if (r.metodo === "Mack" && Math.abs(t - base) < 1e-9) return `<li><b>Mack</b>: misma estimación puntual que Chain Ladder; aporta la incertidumbre.</li>`;
      const d = (t - base) / base;
      return `<li><b>${esc(r.metodo)}</b>: ${esc(dinero(t))} (${d >= 0 ? "+" : ""}${(d * 100).toFixed(1)}% vs. ${esc(rs[0].metodo)})${Math.abs(d) > 0.1 ? " ⚠ diferencia material: revisar supuestos" : ""}</li>`;
    });
    return `<div class="tarjeta"><h2>Comparación</h2><ul>${lineas.join("")}</ul></div>`;
  }

  // «¿Por qué?»
  document.body.addEventListener("click", (e) => {
    const el = e.target.closest(".porque");
    if (!el || !el.dataset.ref) return;
    const [k, clave] = el.dataset.ref.split("|");
    abrirPorQue(estado.resultados[+k], clave);
  });
  function abrirPorQue(r, clave) {
    const x = A.porQue(r, clave);
    const lista = (t, xs, ord) => xs.length ? `<h3>${t}</h3><${ord ? "ol" : "ul"}>${xs.map((s) => `<li>${esc(s)}</li>`).join("")}</${ord ? "ol" : "ul"}>` : "";
    let html = `<div class="titulo">${esc(x.titulo)}</div><p class="nota">${esc(r.metodo)} v${esc(r.versionMetodo)}</p>`;
    if (modo() === "principiante") {
      html += `<p>${esc(x.sencilla || x.pasos.at(-1))}</p>` + lista("Lo que estamos suponiendo", x.supuestos) + lista("Ten en cuenta", x.limitaciones) +
        '<p class="nota">Activa «Modo experto» para ver la fórmula, los datos y cada paso.</p>';
    } else {
      html += `<h3>Fórmula</h3><div class="formula">${esc(x.formula)}</div>` +
        `<h3>Datos utilizados</h3><div class="tabla-scroll"><table class="tabla">${x.insumos.map(([k2, v]) =>
          `<tr><td>${esc(k2)}</td><td>${typeof v === "number" ? v.toLocaleString("en-US", { maximumFractionDigits: 6 }) : esc(v)}</td></tr>`).join("")}</table></div>` +
        lista("Pasos", x.pasos, true) + lista("Supuestos", x.supuestos) + lista("Limitaciones", x.limitaciones);
    }
    $("hojaContenido").innerHTML = html;
    $("hoja").classList.remove("oculto");
  }
  $("hoja").addEventListener("click", (e) => { if (e.target.hasAttribute("data-cerrar")) $("hoja").classList.add("oculto"); });

  // Escenarios «¿Qué pasa si…?»
  function escenario() {
    const r0 = estado.resultados[0], cola = parseFloat($("escCola").value), aj = parseInt($("escAjuste").value, 10) / 100;
    $("colaValor").textContent = cola.toFixed(3);
    $("ajusteValor").textContent = (aj > 0 ? "+" : "") + Math.round(aj * 100) + "%";
    const base = A.chainLadder(estado.tri, { cola: r0.parametros.cola || 1 });
    const f = base.tablaFactores.map((t) => 1 + (t.factor - 1) * (1 + aj));
    const K = estado.tri.edades.length;
    const fda = Array(K).fill(1); fda[K - 1] = cola;
    for (let j = K - 2; j >= 0; j--) fda[j] = f[j] * fda[j + 1];
    let nuevo = 0;
    const filas = base.tablaOrigenes.map((o) => {
      const j = estado.tri.edades.indexOf(o.edadActual), res = o.pagado * fda[j] - o.pagado;
      nuevo += res;
      return `<tr><td>${esc(o.origen)}</td><td>${esc(corto(o.reserva))}</td><td>${esc(corto(res))}</td></tr>`;
    }).join("");
    const orig = base.cifras["reserva:total"].valor, d = nuevo - orig;
    $("escenario").innerHTML = `<p>Reserva Chain Ladder en el escenario: <b>${esc(dinero(nuevo))}</b></p>
      <p class="delta ${d > 1e-9 ? "sube" : d < -1e-9 ? "baja" : ""}">${d >= 0 ? "+" : ""}${esc(dinero(d))} (${orig ? ((d / orig) * 100).toFixed(1) : "0.0"}%)</p>
      <div class="tabla-scroll"><table class="tabla"><tr><th>Año</th><th>Original</th><th>Escenario</th></tr>${filas}</table></div>
      <p class="nota">El ajuste multiplica el desarrollo pendiente de cada factor (f − 1). El año más reciente es el más sensible.</p>`;
  }
  $("escCola").oninput = escenario;
  $("escAjuste").oninput = escenario;

  // Revisión
  function revisar(accion) {
    const err = $("errorRevision"); err.classList.add("oculto");
    try {
      estado.resultados.forEach((r) => A[accion](r, $("revisor").value, $("comentario").value.trim()));
      pintarEstado();
      toast(accion === "aprobar" ? "Resultados aprobados y registrados." : "Resultados rechazados y registrados.");
    } catch (e) { err.textContent = e.message; err.classList.remove("oculto"); }
  }
  $("btnAprobar").onclick = () => revisar("aprobar");
  $("btnRechazar").onclick = () => {
    if (!$("comentario").value.trim()) { const err = $("errorRevision"); err.textContent = "Explica el motivo del rechazo en el comentario."; err.classList.remove("oculto"); return; }
    revisar("rechazar");
  };

  // ---------------------------------------------------------------- Informe
  $("btnAInforme").onclick = () => { $("informe").textContent = A.informe(estado.tri, estado.resultados, estado.hallazgos); irA("informe"); };
  document.querySelector('[data-paso="informe"]').addEventListener("click", () => {
    if (estado.resultados.length) $("informe").textContent = A.informe(estado.tri, estado.resultados, estado.hallazgos);
  });
  $("btnCompartir").onclick = () => {
    const texto = $("informe").textContent;
    if (window.PuenteAndroid) window.PuenteAndroid.compartir("Informe de reservas — ActuaryOS", texto);
    else if (navigator.share) navigator.share({ title: "Informe de reservas", text: texto }).catch(() => {});
    else copiar(texto);
  };
  $("btnCopiar").onclick = () => copiar($("informe").textContent);
  function copiar(texto) {
    if (window.PuenteAndroid) { window.PuenteAndroid.copiar(texto); toast("Informe copiado."); return; }
    (navigator.clipboard ? navigator.clipboard.writeText(texto) : Promise.reject()).then(() => toast("Informe copiado."), () => toast("No se pudo copiar."));
  }

  $("modoExperto").onchange = () => toast($("modoExperto").checked ? "Modo experto: fórmulas, datos y pasos." : "Modo principiante: explicaciones sencillas.");
})();
