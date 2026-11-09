// Conexión con el panel de administración (Google Sheets + Apps Script).
// La dirección se configura en config.json; si está vacía, el sitio funciona sin panel.
(function () {
  var cfg = null;
  function config() {
    if (!cfg) {
      cfg = fetch("config.json", { cache: "no-cache" })
        .then(function (r) { return r.ok ? r.json() : {}; })
        .catch(function () { return {}; });
    }
    return cfg;
  }
  function api() { return config().then(function (c) { return (c && c.api) || ""; }); }

  // Lee una hoja pública: eventos, capsulas o ministerios
  function get(tipo) {
    return api().then(function (url) {
      if (!url) throw new Error("sin panel");
      return fetch(url + "?tipo=" + encodeURIComponent(tipo)).then(function (r) { return r.json(); });
    }).then(function (d) {
      if (!d || !d.ok) throw new Error("respuesta no válida");
      return d;
    });
  }

  function formData(form) {
    var d = {};
    Array.prototype.forEach.call(form.elements, function (el) {
      if (!el.name || el.type === "submit" || el.type === "button") return;
      if (el.type === "checkbox") {
        if (el.name === "consent") return;
        if (el.checked) d[el.name] = d[el.name] ? d[el.name] + ", " + el.value : el.value;
        return;
      }
      d[el.name] = (el.value || "").trim();
    });
    return d;
  }

  // Manda un formulario al Sheet. Si no hay panel o falla, usa el mensaje para Instagram/WhatsApp.
  function submit(form, nombre, fallback, gracias) {
    api().then(function (url) {
      if (!url) return fallback();
      var btn = form.querySelector('button[type="submit"]'), label = btn.textContent;
      btn.disabled = true; btn.textContent = "Enviando…";
      var datos = formData(form); datos._form = nombre;
      fetch(url, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(datos) })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          if (!d || !d.ok) throw new Error("no guardado");
          resultado(gracias.titulo, gracias.texto, false);
          form.reset();
        })
        .catch(function () {
          fallback();
          resultado(null, "No pudimos enviarlo en este momento. Puedes mandarnos este mensaje por Instagram.", true);
        })
        .then(function () { btn.disabled = false; btn.textContent = label; });
    });
  }

  // Ajusta el recuadro de resultado: "enviado" (sin mensaje para copiar) o el mensaje para copiar
  function resultado(titulo, texto, conMensaje) {
    var box = document.getElementById("result"), t = document.getElementById("res-title"), p = document.getElementById("res-text");
    if (!t.dataset.orig) { t.dataset.orig = t.textContent; p.dataset.orig = p.textContent; }
    t.textContent = titulo || t.dataset.orig;
    p.textContent = texto || p.dataset.orig;
    document.getElementById("msg").hidden = !conMensaje;
    box.querySelector(".row").hidden = !conMensaje;
    if (!conMensaje) document.getElementById("ig-hint").hidden = true;
    box.hidden = false;
    box.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  // Con panel activo, el aviso de privacidad se vuelve obligatorio en los formularios
  document.addEventListener("DOMContentLoaded", function () {
    var row = document.getElementById("consent-row");
    if (!row) return;
    api().then(function (url) {
      if (!url) return;
      row.hidden = false;
      document.getElementById("consent").required = true;
    });
  });

  // ---- Utilidades compartidas por las páginas de detalle ----
  var DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
  var MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

  // Primero el panel (Google Sheets); si no está o falla, el archivo .json del sitio
  function data(tipo, archivo) {
    return get(tipo).catch(function () {
      return fetch(archivo, { cache: "no-cache" }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); });
    });
  }
  function slug(s) {
    return String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  }
  function hashId() { try { return decodeURIComponent(location.hash.slice(1)); } catch (e) { return location.hash.slice(1); } }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function fecha(f) {
    var p = String(f).split("-").map(Number), d = new Date(Date.UTC(p[0], p[1] - 1, p[2]));
    return { dia: DIAS[d.getUTCDay()], num: p[2], mes: MESES[p[1] - 1], anio: p[0] };
  }
  function hoyMX() {
    var p = {};
    new Intl.DateTimeFormat("en-US", { timeZone: "America/Mexico_City", year: "numeric", month: "2-digit", day: "2-digit" })
      .formatToParts(new Date()).forEach(function (x) { p[x.type] = x.value; });
    return p.year + "-" + p.month + "-" + p.day;
  }
  // La vista previa de claude.ai no permite videos incrustados; el sitio publicado sí
  var embeddable = /^https?:$/.test(location.protocol) && !/claude/.test(location.hostname);

  window.TDG = { api: api, get: get, submit: submit, resultado: resultado, config: config,
    data: data, slug: slug, hashId: hashId, el: el, fecha: fecha, hoyMX: hoyMX, embeddable: embeddable };
})();
