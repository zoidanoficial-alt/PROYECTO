// FOTONEANDO · Pinceles cinematográficos para Photoshop CC 2018 o posterior.
// Uso: en Photoshop, Archivo > Secuencias de comandos > Explorar... y elige este archivo.
// Convierte cada PNG de la carpeta «puntas» (junto a este script) en un pincel.
#target photoshop

(function () {
    var PACKS = {
        "Piel": "Piel",
        "Luz": "Luz",
        "Atmosfera": "Atmósfera",
        "Particulas": "Partículas",
        "Texturas": "Texturas",
        "Medios": "Medios"
    };
    var folder = new Folder(File($.fileName).parent + "/puntas");
    if (!folder.exists) {
        alert("No encuentro la carpeta «puntas» junto a este script.\nDescomprime todo el zip y vuelve a intentarlo.");
        return;
    }
    var files = folder.getFiles("*.png");
    files.sort(function (a, b) { return decodeURI(a.name) < decodeURI(b.name) ? -1 : 1; });
    if (!files.length) {
        alert("La carpeta «puntas» está vacía.");
        return;
    }
    if (!confirm("Se van a crear " + files.length + " pinceles FOTONEANDO.\nTarda uno o dos minutos. ¿Continuar?")) {
        return;
    }

    var oldDialogs = app.displayDialogs;
    app.displayDialogs = DialogModes.NO;
    var ok = 0, errors = [];

    function cTID(s) { return charIDToTypeID(s); }

    function defineBrush(name) {
        var desc = new ActionDescriptor();
        var ref = new ActionReference();
        ref.putClass(cTID("Brsh"));
        desc.putReference(cTID("null"), ref);
        desc.putString(cTID("Nm  "), name);
        var ref2 = new ActionReference();
        ref2.putProperty(cTID("Prpr"), cTID("fsel"));
        ref2.putEnumerated(cTID("Dcmn"), cTID("Ordn"), cTID("Trgt"));
        desc.putReference(cTID("Usng"), ref2);
        executeAction(cTID("Mk  "), desc, DialogModes.NO);
    }

    for (var i = 0; i < files.length; i++) {
        var f = files[i];
        // «07 Piel - Micro Wrinkle.png» -> «FT Piel · Micro Wrinkle»
        var base = decodeURI(f.name).replace(/\.png$/i, "");
        var m = base.match(/^\d+\s+(\S+)\s+-\s+(.+)$/);
        var name = m ? ("FT " + (PACKS[m[1]] || m[1]) + " · " + m[2]) : base;
        var doc = null;
        try {
            doc = app.open(f);
            if (doc.mode !== DocumentMode.GRAYSCALE) {
                doc.changeMode(ChangeMode.GRAYSCALE);
            }
            doc.selection.selectAll();
            defineBrush(name);
            ok++;
        } catch (e) {
            errors.push(name + ": " + e.message);
        }
        if (doc) {
            doc.close(SaveOptions.DONOTSAVECHANGES);
        }
    }
    app.displayDialogs = oldDialogs;

    var msg = "Listo: " + ok + " de " + files.length + " pinceles creados.\n\n" +
        "Están al final de la lista de pinceles (Ventana > Pinceles), con el prefijo «FT».\n" +
        "Para guardarlos como archivo .abr: Edición > Ajustes preestablecidos > Gestor de ajustes preestablecidos, " +
        "selecciona los pinceles FT y pulsa «Guardar conjunto».";
    if (errors.length) {
        msg += "\n\nNo se pudieron crear:\n" + errors.join("\n");
    }
    alert(msg);
})();
