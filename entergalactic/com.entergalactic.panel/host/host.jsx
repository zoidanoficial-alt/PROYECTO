/*
 * ENTERGALACTIC - lado Photoshop (ExtendScript, ES3).
 * Compatible con Photoshop CC 2018 (v19) y posteriores.
 * Las funciones devuelven texto: "OK|..." o "ERR|mensaje".
 */

function eg_err(e) {
    return "ERR|" + (e && e.message ? e.message : String(e));
}

function eg_hasSelection(doc) {
    try { var b = doc.selection.bounds; return b && b.length === 4; } catch (e) { return false; }
}

/* OK|nombre|ancho|alto|bits|seleccion(0/1) */
function eg_docInfo() {
    try {
        if (app.documents.length === 0) return "ERR|No hay ningún documento abierto.";
        var d = app.activeDocument;
        var bits = d.bitsPerChannel == BitsPerChannelType.SIXTEEN ? 16 :
                   (d.bitsPerChannel == BitsPerChannelType.THIRTYTWO ? 32 : 8);
        return "OK|" + d.name + "|" + Math.round(d.width.as("px")) + "|" +
               Math.round(d.height.as("px")) + "|" + bits + "|" + (eg_hasSelection(d) ? 1 : 0);
    } catch (e) { return eg_err(e); }
}

/* Exporta a PNG la imagen visible combinada (mode="visible") o sólo la capa activa (mode="layer"). */
function eg_export(path, mode) {
    var prevUnits = app.preferences.rulerUnits;
    var prevDialogs = app.displayDialogs;
    try {
        if (app.documents.length === 0) return "ERR|No hay ningún documento abierto.";
        app.preferences.rulerUnits = Units.PIXELS;
        app.displayDialogs = DialogModes.NO;
        var src = app.activeDocument;
        var dup;
        if (mode === "layer") {
            var layer = src.activeLayer;
            if (layer.typename !== "ArtLayer") return "ERR|Selecciona una capa de píxeles (no un grupo).";
            dup = app.documents.add(src.width, src.height, src.resolution, "eg_tmp",
                                    NewDocumentMode.RGB, DocumentFill.TRANSPARENT, 1, src.bitsPerChannel);
            app.activeDocument = src;
            var copy = layer.duplicate(dup, ElementPlacement.PLACEATBEGINNING);
            app.activeDocument = dup;
            copy.opacity = 100;
            copy.blendMode = BlendMode.NORMAL;
            copy.visible = true;
        } else {
            dup = src.duplicate("eg_tmp", true);
        }
        if (dup.mode !== DocumentMode.RGB) dup.changeMode(ChangeMode.RGB);
        if (dup.bitsPerChannel == BitsPerChannelType.THIRTYTWO) dup.bitsPerChannel = BitsPerChannelType.SIXTEEN;
        var opts = new PNGSaveOptions();
        opts.interlaced = false;
        try { opts.compression = 1; } catch (e3) {}
        dup.saveAs(new File(path), opts, true, Extension.LOWERCASE);
        dup.close(SaveOptions.DONOTSAVECHANGES);
        app.activeDocument = src;
        return "OK|" + path;
    } catch (e) {
        return eg_err(e);
    } finally {
        app.preferences.rulerUnits = prevUnits;
        app.displayDialogs = prevDialogs;
    }
}

/* Crea una máscara de capa a partir de la selección activa (Mostrar selección). */
function eg_maskFromSelection() {
    var d = new ActionDescriptor();
    d.putClass(charIDToTypeID("Nw  "), charIDToTypeID("Chnl"));
    var r = new ActionReference();
    r.putEnumerated(charIDToTypeID("Chnl"), charIDToTypeID("Chnl"), charIDToTypeID("Msk "));
    d.putReference(charIDToTypeID("At  "), r);
    d.putEnumerated(charIDToTypeID("Usng"), charIDToTypeID("UsrM"), charIDToTypeID("RvlS"));
    executeAction(charIDToTypeID("Mk  "), d, DialogModes.NO);
}

/*
 * Importa el resultado.
 *   asNewDoc  "1" = documento nuevo (obligatorio si cambió el tamaño), "0" = capa nueva.
 *   useMask   "1" = si hay selección en el documento, se usa como máscara de la capa.
 * Devuelve OK|doc  o  OK|layer|masked(0/1)
 */
function eg_import(path, asNewDoc, newName, layerName, useMask) {
    var prevDialogs = app.displayDialogs;
    var prevUnits = app.preferences.rulerUnits;
    try {
        app.displayDialogs = DialogModes.NO;
        app.preferences.rulerUnits = Units.PIXELS;
        var f = new File(path);
        if (!f.exists) return "ERR|No se encontró el resultado: " + path;

        if (asNewDoc === "1" || app.documents.length === 0) {
            var opened = app.open(f);
            var named = opened.duplicate(newName, false);
            opened.close(SaveOptions.DONOTSAVECHANGES);
            app.activeDocument = named;
            try { named.activeLayer.name = layerName; } catch (e0) {}
            return "OK|doc";
        }

        var target = app.activeDocument;
        var hadSel = eg_hasSelection(target);
        var res = app.open(f);
        var resLayer = res.activeLayer;
        if (resLayer.isBackgroundLayer) resLayer.isBackgroundLayer = false;
        var rb = resLayer.bounds;
        var newLayer;
        var pasted = false;
        try {
            newLayer = resLayer.duplicate(target, ElementPlacement.PLACEATBEGINNING);
        } catch (eDup) {
            res.selection.selectAll();
            res.selection.copy();
            app.activeDocument = target;
            newLayer = target.paste();
            pasted = true;
            app.activeDocument = res;
        }
        res.close(SaveOptions.DONOTSAVECHANGES);
        app.activeDocument = target;
        newLayer.name = layerName;
        target.activeLayer = newLayer;
        if (pasted) {
            var nb = newLayer.bounds;
            var dx = rb[0].as("px") - nb[0].as("px"), dy = rb[1].as("px") - nb[1].as("px");
            if (dx !== 0 || dy !== 0) newLayer.translate(dx, dy);
        }
        var masked = 0;
        if (useMask === "1" && hadSel && eg_hasSelection(target)) {
            try { eg_maskFromSelection(); masked = 1; } catch (eM) {}
        }
        return "OK|layer|" + masked;
    } catch (e) {
        return eg_err(e);
    } finally {
        app.displayDialogs = prevDialogs;
        app.preferences.rulerUnits = prevUnits;
    }
}
