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

  window.TDG = { api: api, get: get, submit: submit, resultado: resultado };
})();
