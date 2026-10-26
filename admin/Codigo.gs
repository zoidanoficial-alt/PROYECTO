/**
 * TIEMPO DE GRACIA — Panel de administración en Google Sheets
 *
 * Este código conecta el Google Sheet con el sitio y la app:
 *  - Las pestañas Eventos, Cápsulas y Ministerios se publican en el sitio y la app.
 *  - Los formularios del sitio (oración, primer paso, Transforma, servir) llegan como filas nuevas.
 *
 * Instalación: ver admin/INSTRUCCIONES.md
 * IMPORTANTE: no cambies el orden de las columnas; el sitio las lee por posición.
 */

var ZONA = "America/Mexico_City";

// Cada hoja: [clave que usa el sitio, encabezado que ve el administrador]
var HOJAS = {
  eventos: { nombre: "Eventos", publica: true, columnas: [
    ["id", "ID (se llena solo)"], ["fecha", "Fecha"], ["hora", "Hora (opcional)"], ["etiqueta", "Etiqueta"],
    ["titulo", "Título"], ["descripcion", "Descripción"], ["lugar", "Lugar"],
    ["video", "Video de YouTube (enlace, opcional)"], ["video_titulo", "Título del video"],
    ["video_subtitulo", "Subtítulo del video"], ["publicado", "¿Publicado?"]] },
  capsulas: { nombre: "Cápsulas", publica: true, columnas: [
    ["seccion", "Sección (TG o Transforma)"], ["url", "Enlace del Short o Reel"], ["titulo", "Título"], ["publicado", "¿Publicado?"]] },
  ministerios: { nombre: "Ministerios", publica: true, columnas: [
    ["nombre", "Ministerio"], ["subtitulo", "Subtítulo"], ["descripcion", "Descripción"],
    ["enlace", "Página (opcional)"], ["publicado", "¿Publicado?"]] },
  oracion: { nombre: "Oración", columnas: [
    ["recibido", "Recibido"], ["tipo", "Tipo"], ["nombre", "Nombre"], ["apellidos", "Apellidos"],
    ["celular", "Celular"], ["mensaje", "Mensaje"], ["estado", "Estado"], ["notas", "Notas del equipo"]] },
  primer_paso: { nombre: "Primer paso", columnas: [
    ["recibido", "Recibido"], ["ayuda", "¿Cómo podemos ayudar?"], ["nombre", "Nombre"], ["apellidos", "Apellidos"],
    ["celular", "Celular"], ["asiste", "¿Asiste?"], ["conocio", "Cómo nos conoció"], ["oracion", "Petición de oración"],
    ["estado", "Estado"], ["notas", "Notas del equipo"]] },
  transforma: { nombre: "Transforma", columnas: [
    ["recibido", "Recibido"], ["nombre", "Nombre"], ["apellidos", "Apellidos"], ["edad", "Edad"], ["celular", "Celular"],
    ["insta", "Instagram"], ["conocio", "Cómo se enteró"], ["busca", "Le gustaría"], ["mensaje", "Mensaje"],
    ["estado", "Estado"], ["notas", "Notas del equipo"]] },
  servir: { nombre: "Servir", columnas: [
    ["recibido", "Recibido"], ["ministerio", "Ministerio"], ["nombre", "Nombre"], ["apellidos", "Apellidos"],
    ["celular", "Celular"], ["mensaje", "Mensaje"], ["estado", "Estado"], ["notas", "Notas del equipo"]] },
  config: { nombre: "Configuración", columnas: [["clave", "Clave"], ["valor", "Valor"], ["descripcion", "Para qué sirve"]] }
};
var FORMULARIOS = { oracion: "petición de oración", primer_paso: "persona de primera vez", transforma: "joven en Transforma", servir: "persona que quiere servir" };
var ESTADOS = ["Nuevo", "En proceso", "Atendido"];

/* ---------------- Menú y preparación ---------------- */

function onOpen() {
  SpreadsheetApp.getUi().createMenu("Tiempo de Gracia")
    .addItem("Preparar hojas (solo la primera vez)", "preparar")
    .addToUi();
}

function preparar() {
  var ss = SpreadsheetApp.getActive();
  Object.keys(HOJAS).forEach(function (k) {
    var h = HOJAS[k], sh = ss.getSheetByName(h.nombre) || ss.insertSheet(h.nombre);
    var enc = h.columnas.map(function (c) { return c[1]; });
    sh.getRange(1, 1, 1, enc.length).setValues([enc]).setFontWeight("bold").setBackground("#1f2030").setFontColor("#ffffff");
    sh.setFrozenRows(1);
    var col = function (clave) { return h.columnas.map(function (c) { return c[0]; }).indexOf(clave) + 1; };
    if (col("publicado")) {
      sh.getRange(2, col("publicado"), 500).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(["Sí", "No"]).build());
    }
    if (col("estado")) {
      sh.getRange(2, col("estado"), 2000).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(ESTADOS).build());
    }
    if (col("fecha")) sh.getRange(2, col("fecha"), 500).setNumberFormat("yyyy-mm-dd");
    if (col("recibido")) sh.getRange(2, col("recibido"), 2000).setNumberFormat("yyyy-mm-dd hh:mm");
  });
  sembrar(ss);
  var hoja1 = ss.getSheetByName("Hoja 1") || ss.getSheetByName("Sheet1");
  if (hoja1 && hoja1.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(hoja1);
  SpreadsheetApp.getUi().alert("Listo. Ahora publica el programa: Implementar > Nueva implementación > Aplicación web (ver instrucciones).");
}

function sembrar(ss) {
  var ev = ss.getSheetByName(HOJAS.eventos.nombre);
  if (ev.getLastRow() < 2) {
    ev.appendRow(["the-chosen-t6", "2026-10-11", "", "Noche de película · The Chosen",
      "Comparte con nosotros el primer capítulo de la sexta temporada de The Chosen",
      "Ven a ver con nosotros el estreno de The Chosen, la serie sobre la vida de Jesús y sus discípulos. Una tarde para disfrutar en comunidad. ¡Invita a quien quieras!",
      "Priv. de los Cipreses 2, 1.º piso, Jardines de San Mateo", "https://www.youtube.com/watch?v=u433XFiq3mE",
      "The Chosen", "Temporada 6 · Capítulo 1", "Sí"]);
  }
  var mi = ss.getSheetByName(HOJAS.ministerios.nombre);
  if (mi.getLastRow() < 2) {
    [["Transforma", "Jóvenes", "El grupo de jóvenes: amistad, Palabra y alabanza para vivir la fe en esta etapa.", "transforma.html"],
     ["Alabanza", "Música y adoración", "Músicos y voces que guían a la iglesia en la adoración cada domingo.", ""],
     ["Niños", "Escuela dominical", "Enseñanza bíblica para los más pequeños mientras sus papás están en el culto.", ""],
     ["Intercesión", "Oración", "Un equipo que ora por las peticiones de la iglesia y de quienes nos escriben.", "oracion.html"],
     ["Bienvenida", "Recibir a los que llegan", "Saludar, orientar y acompañar a quienes nos visitan por primera vez.", "primer-paso.html"],
     ["Medios", "Redes y transmisión", "Fotos, video, redes sociales y transmisiones para llevar el mensaje más lejos.", "capsulas.html"]
    ].forEach(function (r) { mi.appendRow(r.concat(["Sí"])); });
  }
  var cf = ss.getSheetByName(HOJAS.config.nombre);
  if (cf.getLastRow() < 2) {
    cf.appendRow(["correo_avisos", "", "Correos (separados por coma) que reciben un aviso cuando llega una petición o una persona nueva. Déjalo vacío para no recibir correos."]);
  }
}

/** Al escribir un evento nuevo, le pone un ID automático (sirve para las notificaciones de la app). */
function onEdit(e) {
  var sh = e.range.getSheet();
  if (sh.getName() !== HOJAS.eventos.nombre || e.range.getRow() < 2) return;
  var fila = e.range.getRow(), datos = sh.getRange(fila, 1, 1, 5).getValues()[0];
  if (!datos[0] && datos[4]) {
    var base = String(datos[4]).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
    sh.getRange(fila, 1).setValue(base + "-" + Utilities.getUuid().slice(0, 4));
  }
}

/* ---------------- Lo que lee el sitio (público) ---------------- */

function doGet(e) {
  var tipo = (e && e.parameter && e.parameter.tipo) || "";
  if (!HOJAS[tipo] || !HOJAS[tipo].publica) return json({ ok: false, error: "tipo no válido" });
  var cache = CacheService.getScriptCache(), guardado = cache.get(tipo);
  if (guardado) return ContentService.createTextOutput(guardado).setMimeType(ContentService.MimeType.JSON);
  var filas = leer(tipo).filter(function (r) { return String(r.publicado || "Sí").toLowerCase() !== "no"; });
  filas.forEach(function (r) { delete r.publicado; });
  if (tipo === "eventos") filas = filas.filter(function (r) { return r.id && r.fecha && r.titulo; }).map(limpiarEvento);
  if (tipo === "capsulas") filas = filas.filter(function (r) { return r.url; });
  if (tipo === "ministerios") filas = filas.filter(function (r) { return r.nombre; });
  var salida = {}; salida.ok = true; salida[tipo] = filas;
  var texto = JSON.stringify(salida);
  cache.put(tipo, texto, 60); // un minuto, para no gastar la cuota de Google
  return ContentService.createTextOutput(texto).setMimeType(ContentService.MimeType.JSON);
}

function leer(tipo) {
  var h = HOJAS[tipo], sh = SpreadsheetApp.getActive().getSheetByName(h.nombre);
  if (!sh || sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, h.columnas.length).getValues()
    .filter(function (fila) { return fila.some(function (v) { return v !== ""; }); })
    .map(function (fila) {
      var o = {};
      h.columnas.forEach(function (c, i) { o[c[0]] = fila[i]; });
      return o;
    });
}

function esFecha(v) { return Object.prototype.toString.call(v) === "[object Date]"; }

function limpiarEvento(r) {
  var fecha = esFecha(r.fecha) ? Utilities.formatDate(r.fecha, ZONA, "yyyy-MM-dd") : String(r.fecha).trim();
  var hora = esFecha(r.hora) ? Utilities.formatDate(r.hora, ZONA, "HH:mm") : String(r.hora || "").trim();
  var v = String(r.video || "").trim(), m = v.match(/(?:v=|youtu\.be\/|shorts\/)([\w-]{6,})/);
  return {
    id: String(r.id).trim(), fecha: fecha, hora: hora,
    etiqueta: String(r.etiqueta || ""), titulo: String(r.titulo), descripcion: String(r.descripcion || ""),
    lugar: String(r.lugar || ""), video: m ? m[1] : v,
    video_titulo: String(r.video_titulo || ""), video_subtitulo: String(r.video_subtitulo || "")
  };
}

/* ---------------- Lo que mandan los formularios ---------------- */

function doPost(e) {
  try {
    var d = JSON.parse(e.postData.contents || "{}");
    if (d.website) return json({ ok: true }); // trampa para robots: un campo oculto que las personas no llenan
    var tipo = d._form, h = HOJAS[tipo];
    if (!FORMULARIOS[tipo]) return json({ ok: false, error: "formulario no válido" });
    var fila = h.columnas.map(function (c) {
      if (c[0] === "recibido") return new Date();
      if (c[0] === "estado") return "Nuevo";
      if (c[0] === "notas") return "";
      var v = String(d[c[0]] == null ? "" : d[c[0]]).slice(0, 3000);
      if (c[0] === "celular") v = v.replace(/\D/g, "");
      return /^[=+\-@]/.test(v) ? "'" + v : v; // evita que un texto se interprete como fórmula
    });
    var lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try { SpreadsheetApp.getActive().getSheetByName(h.nombre).appendRow(fila); } finally { lock.releaseLock(); }
    avisar(tipo, d);
    return json({ ok: true });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  }
}

function avisar(tipo, d) {
  var destino = leer("config").filter(function (r) { return r.clave === "correo_avisos"; })[0];
  destino = destino && String(destino.valor).trim();
  if (!destino) return;
  var quien = ((d.nombre || "") + " " + (d.apellidos || "")).trim() || "Alguien (sin nombre)";
  MailApp.sendEmail(destino, "Tiempo de Gracia: nueva " + FORMULARIOS[tipo],
    quien + " envió un formulario de " + FORMULARIOS[tipo] + ".\n\nRevísalo en la hoja «" + HOJAS[tipo].nombre + "»:\n" + SpreadsheetApp.getActive().getUrl());
}

function json(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
