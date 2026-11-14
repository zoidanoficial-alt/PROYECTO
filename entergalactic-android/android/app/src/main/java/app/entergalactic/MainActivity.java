package app.entergalactic;

import android.Manifest;
import android.app.Activity;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.media.MediaScannerConnection;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.webkit.WebViewAssetLoader;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;

/**
 * ENTERGALACTIC para Android.
 *
 * La interfaz y el motor de efectos son HTML/JavaScript (carpeta web/ del proyecto) y se sirven
 * sin conexión desde los assets mediante WebViewAssetLoader, en un origen https propio, para que
 * funcionen los Web Workers. La actividad sólo añade lo que el navegador no puede hacer solo:
 * elegir fotos de la galería y guardar el resultado en Imágenes/ENTERGALACTIC.
 */
public class MainActivity extends Activity {
    private static final int PICK_IMAGE = 1;
    private static final int REQ_STORAGE = 2;
    private static final String START_URL = "https://appassets.androidplatform.net/assets/www/index.html";

    private WebView web;
    private ValueCallback<Uri[]> pendingChooser;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        web = new WebView(this);
        web.setBackgroundColor(0xFF13121A);
        setContentView(web);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(true);
        s.setMediaPlaybackRequiresUserGesture(true);

        final WebViewAssetLoader loader = new WebViewAssetLoader.Builder()
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();
        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return loader.shouldInterceptRequest(request.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                // La app no navega fuera de sus propios archivos.
                return !"appassets.androidplatform.net".equals(request.getUrl().getHost());
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (pendingChooser != null) pendingChooser.onReceiveValue(null);
                pendingChooser = callback;
                Intent i = new Intent(Intent.ACTION_GET_CONTENT);
                i.addCategory(Intent.CATEGORY_OPENABLE);
                i.setType("image/*");
                try {
                    startActivityForResult(Intent.createChooser(i, "Elige una foto"), PICK_IMAGE);
                } catch (Exception e) {
                    pendingChooser = null;
                    return false;
                }
                return true;
            }
        });
        web.addJavascriptInterface(new SaveBridge(), "Android");
        web.loadUrl(START_URL);
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == PICK_IMAGE && pendingChooser != null) {
            Uri uri = (resultCode == RESULT_OK && data != null) ? data.getData() : null;
            pendingChooser.onReceiveValue(uri != null ? new Uri[]{uri} : null);
            pendingChooser = null;
        }
    }

    @Override
    protected void onDestroy() {
        if (web != null) web.destroy();
        super.onDestroy();
    }

    /** Puente para guardar el JPEG que genera JavaScript, recibido en trozos base64. */
    private class SaveBridge {
        private OutputStream out;
        private Uri uri;
        private File legacyFile;

        @JavascriptInterface
        public synchronized String saveBegin(String name) {
            try {
                closeQuietly();
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    ContentValues v = new ContentValues();
                    v.put(MediaStore.Images.Media.DISPLAY_NAME, name);
                    v.put(MediaStore.Images.Media.MIME_TYPE, "image/jpeg");
                    v.put(MediaStore.Images.Media.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/ENTERGALACTIC");
                    v.put(MediaStore.Images.Media.IS_PENDING, 1);
                    ContentResolver cr = getContentResolver();
                    uri = cr.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, v);
                    if (uri == null) return "ERR|No se pudo crear la imagen en la galería.";
                    out = cr.openOutputStream(uri);
                } else {
                    if (checkSelfPermission(Manifest.permission.WRITE_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED) {
                        runOnUiThread(() -> requestPermissions(new String[]{Manifest.permission.WRITE_EXTERNAL_STORAGE}, REQ_STORAGE));
                        return "ERR|Concede el permiso de almacenamiento y vuelve a pulsar «Guardar».";
                    }
                    File dir = new File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_PICTURES), "ENTERGALACTIC");
                    if (!dir.exists() && !dir.mkdirs()) return "ERR|No se pudo crear la carpeta Imágenes/ENTERGALACTIC.";
                    legacyFile = new File(dir, name);
                    out = new FileOutputStream(legacyFile);
                }
                return "OK";
            } catch (Exception e) {
                return "ERR|" + e.getMessage();
            }
        }

        @JavascriptInterface
        public synchronized void saveChunk(String b64) {
            try {
                if (out != null) out.write(Base64.decode(b64, Base64.DEFAULT));
            } catch (Exception e) {
                closeQuietly();
            }
        }

        @JavascriptInterface
        public synchronized String saveEnd() {
            try {
                if (out == null) return "ERR|La imagen no se pudo escribir.";
                out.close();
                out = null;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q && uri != null) {
                    ContentValues v = new ContentValues();
                    v.put(MediaStore.Images.Media.IS_PENDING, 0);
                    getContentResolver().update(uri, v, null, null);
                    return "OK|" + uri;
                }
                if (legacyFile != null) {
                    MediaScannerConnection.scanFile(MainActivity.this, new String[]{legacyFile.getAbsolutePath()},
                            new String[]{"image/jpeg"}, null);
                    return "OK|" + legacyFile.getAbsolutePath();
                }
                return "OK";
            } catch (Exception e) {
                return "ERR|" + e.getMessage();
            }
        }

        @JavascriptInterface
        public synchronized void saveAbort() {
            closeQuietly();
            if (uri != null) {
                try { getContentResolver().delete(uri, null, null); } catch (Exception ignored) { }
            }
            if (legacyFile != null) legacyFile.delete();
            uri = null;
            legacyFile = null;
        }

        private void closeQuietly() {
            if (out != null) {
                try { out.close(); } catch (Exception ignored) { }
            }
            out = null;
        }
    }
}
