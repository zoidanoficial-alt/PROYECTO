/*
 * Realce IA - lado Photoshop (ExtendScript, ES3).
 * Compatible con Photoshop CC 2018 (v19) y posteriores.
 * Las funciones devuelven texto: "OK|..." o "ERR|mensaje".
 */

function realce_err(e) {
    return "ERR|" + (e && e.message ? e.message : String(e));
}

/* Información del documento activo: OK|nombre|ancho|alto|bits */
function realce_docInfo() {
    try {
        if (app.documents.length === 0) return "ERR|No hay ningún documento abierto.";
        var d = app.activeDocument;
        var bits = d.bitsPerChannel == BitsPerChannelType.SIXTEEN ? 16 :
                   (d.bitsPerChannel == BitsPerChannelType.THIRTYTWO ? 32 : 8);
        return "OK|" + d.name + "|" + Math.round(d.width.as("px")) + "|" +
               Math.round(d.height.as("px")) + "|" + bits;
    } catch (e) { return realce_err(e); }
}

/*
 * Exporta la imagen visible del documento activo (todas las capas combinadas)
 * a un PNG temporal. mode = "visible" | "layer" (sólo la capa activa).
 */
function realce_export(path, mode) {
    var prevUnits = app.preferences.rulerUnits;
    var prevDialogs = app.displayDialogs;
    try {
        if (app.documents.length === 0) return "ERR|No hay ningún documento abierto.";
        app.preferences.rulerUnits = Units.PIXELS;
        app.displayDialogs = DialogModes.NO;
        var src = app.activeDocument;
        var layerName = "";
        var dup;
        if (mode === "layer") {
            var layer = src.activeLayer;
            if (layer.typename !== "ArtLayer") return "ERR|Selecciona una capa de píxeles (no un grupo).";
            layerName = layer.name;
            // Documento transparente del mismo tamaño con sólo esa capa (funciona aunque esté en un grupo).
            dup = app.documents.add(src.width, src.height, src.resolution, "realce_tmp",
                                    NewDocumentMode.RGB, DocumentFill.TRANSPARENT, 1,
                                    src.bitsPerChannel);
            app.activeDocument = src;
            var copy = layer.duplicate(dup, ElementPlacement.PLACEATBEGINNING);
            app.activeDocument = dup;
            copy.opacity = 100;
            copy.blendMode = BlendMode.NORMAL;
            copy.visible = true;
        } else {
            dup = src.duplicate("realce_tmp", true); // true = combinar capas
        }
        if (dup.mode !== DocumentMode.RGB) dup.changeMode(ChangeMode.RGB);
        if (dup.bitsPerChannel == BitsPerChannelType.THIRTYTWO) dup.bitsPerChannel = BitsPerChannelType.SIXTEEN;

        var opts = new PNGSaveOptions();
        opts.interlaced = false;
        try { opts.compression = 1; } catch (e3) {}
        dup.saveAs(new File(path), opts, true, Extension.LOWERCASE);
        dup.close(SaveOptions.DONOTSAVECHANGES);
        app.activeDocument = src;
        return "OK|" + path + "|" + layerName;
    } catch (e) {
        return realce_err(e);
    } finally {
        app.preferences.rulerUnits = prevUnits;
        app.displayDialogs = prevDialogs;
    }
}

/*
 * Importa el resultado.
 *   asNewDoc = "1": abre el resultado como documento nuevo (siempre al ampliar).
 *   asNewDoc = "0": lo añade como capa nueva sobre el documento activo.
 */
function realce_import(path, asNewDoc, newName) {
    var prevDialogs = app.displayDialogs;
    try {
        app.displayDialogs = DialogModes.NO;
        var f = new File(path);
        if (!f.exists) return "ERR|No se encontró el resultado: " + path;

        if (asNewDoc === "1" || app.documents.length === 0) {
            var opened = app.open(f);
            var named = opened.duplicate(newName, false);
            opened.close(SaveOptions.DONOTSAVECHANGES);
            app.activeDocument = named;
            named.activeLayer.name = "Realce IA";
            return "OK|doc";
        }

        var target = app.activeDocument;
        var res = app.open(f);
        var resLayer = res.activeLayer;
        if (resLayer.isBackgroundLayer) resLayer.isBackgroundLayer = false;
        var rb = resLayer.bounds;
        var newLayer;
        var pasted = false;
        try {
            // Duplicar entre documentos conserva la posición exacta de los píxeles.
            newLayer = resLayer.duplicate(target, ElementPlacement.PLACEATBEGINNING);
        } catch (eDup) {
            // Alternativa: copiar y pegar (Photoshop centra lo pegado; luego se recoloca).
            res.selection.selectAll();
            res.selection.copy();
            app.activeDocument = target;
            newLayer = target.paste();
            pasted = true;
            app.activeDocument = res;
        }
        res.close(SaveOptions.DONOTSAVECHANGES);
        app.activeDocument = target;
        newLayer.name = "Realce IA";
        target.activeLayer = newLayer;
        if (pasted) {
            var nb = newLayer.bounds;
            var dx = rb[0].as("px") - nb[0].as("px"), dy = rb[1].as("px") - nb[1].as("px");
            if (dx !== 0 || dy !== 0) newLayer.translate(dx, dy);
        }
        return "OK|layer";
    } catch (e) {
        return realce_err(e);
    } finally {
        app.displayDialogs = prevDialogs;
    }
}
