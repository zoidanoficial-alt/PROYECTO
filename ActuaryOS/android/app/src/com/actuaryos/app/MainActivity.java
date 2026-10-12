package com.actuaryos.app;

import android.app.Activity;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

/**
 * Contenedor de la app: muestra la interfaz web empaquetada en assets/www.
 * Todo el cálculo ocurre localmente en motor.js; la app no usa internet.
 */
public class MainActivity extends Activity {

    private static final int PEDIR_ARCHIVO = 1;
    private static final String INICIO = "file:///android_asset/www/index.html";

    private WebView web;
    private ValueCallback<Uri[]> archivoPendiente;

    @Override
    protected void onCreate(Bundle estado) {
        super.onCreate(estado);
        web = new WebView(this);
        setContentView(web);

        WebSettings ajustes = web.getSettings();
        ajustes.setJavaScriptEnabled(true);
        ajustes.setDomStorageEnabled(true);
        ajustes.setAllowFileAccess(true);
        ajustes.setAllowContentAccess(true);
        ajustes.setAllowFileAccessFromFileURLs(false);
        ajustes.setAllowUniversalAccessFromFileURLs(false);
        ajustes.setBuiltInZoomControls(false);

        web.addJavascriptInterface(new Puente(), "PuenteAndroid");
        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView vista, WebResourceRequest solicitud) {
                // Sólo se navega dentro de la app; los enlaces externos se abren en el navegador.
                Uri uri = solicitud.getUrl();
                if ("file".equals(uri.getScheme())) {
                    return false;
                }
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, uri));
                } catch (Exception e) {
                    avisar("No hay una app para abrir el enlace.");
                }
                return true;
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView vista, ValueCallback<Uri[]> callback,
                                             FileChooserParams parametros) {
                if (archivoPendiente != null) {
                    archivoPendiente.onReceiveValue(null);
                }
                archivoPendiente = callback;
                Intent intento = new Intent(Intent.ACTION_GET_CONTENT);
                intento.addCategory(Intent.CATEGORY_OPENABLE);
                intento.setType("*/*");
                intento.putExtra(Intent.EXTRA_MIME_TYPES, new String[]{
                        "text/csv", "text/comma-separated-values", "text/plain", "application/csv",
                        "application/vnd.ms-excel", "application/octet-stream"});
                try {
                    startActivityForResult(Intent.createChooser(intento, getString(R.string.elegir_archivo)), PEDIR_ARCHIVO);
                } catch (Exception e) {
                    archivoPendiente = null;
                    avisar("No hay un administrador de archivos disponible.");
                    return false;
                }
                return true;
            }
        });

        if (estado != null) {
            web.restoreState(estado);
        } else {
            web.loadUrl(INICIO);
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle salida) {
        super.onSaveInstanceState(salida);
        web.saveState(salida);
    }

    @Override
    protected void onActivityResult(int codigo, int resultado, Intent datos) {
        if (codigo == PEDIR_ARCHIVO && archivoPendiente != null) {
            Uri[] uris = null;
            if (resultado == RESULT_OK && datos != null && datos.getData() != null) {
                uris = new Uri[]{datos.getData()};
            }
            archivoPendiente.onReceiveValue(uris);
            archivoPendiente = null;
            return;
        }
        super.onActivityResult(codigo, resultado, datos);
    }

    @Override
    public void onBackPressed() {
        if (web.canGoBack()) {
            web.goBack();
        } else {
            super.onBackPressed();
        }
    }

    private void avisar(String mensaje) {
        Toast.makeText(this, mensaje, Toast.LENGTH_SHORT).show();
    }

    /** Funciones nativas expuestas a la interfaz como window.PuenteAndroid. */
    private class Puente {
        @JavascriptInterface
        public void compartir(final String titulo, final String texto) {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    Intent envio = new Intent(Intent.ACTION_SEND);
                    envio.setType("text/plain");
                    envio.putExtra(Intent.EXTRA_SUBJECT, titulo);
                    envio.putExtra(Intent.EXTRA_TEXT, texto);
                    startActivity(Intent.createChooser(envio, getString(R.string.compartir)));
                }
            });
        }

        @JavascriptInterface
        public void copiar(final String texto) {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    ClipboardManager portapapeles = (ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE);
                    portapapeles.setPrimaryClip(ClipData.newPlainText("Informe ActuaryOS", texto));
                }
            });
        }
    }
}
