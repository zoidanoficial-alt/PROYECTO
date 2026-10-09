package com.zoidan.progreso;

import android.Manifest;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.graphics.Color;
import android.util.Base64;
import android.view.View;
import android.os.Environment;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.provider.MediaStore;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.view.WindowManager;
import android.widget.Toast;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

/**
 * Contenedor nativo de la app web en assets/www.
 *
 * Los assets se sirven bajo https://progreso.local/ (en vez de file://) para que
 * la página tenga un origen estable y localStorage/IndexedDB funcionen sin trucos.
 */
public class MainActivity extends Activity {

    private static final String HOST = "progreso.local";
    private static final String START_URL = "https://" + HOST + "/index.html";
    private static final int REQ_FILE = 1;
    private static final int REQ_CAMERA = 2;

    private WebView web;
    private ValueCallback<Uri[]> fileCallback;
    private PermissionRequest pendingPermission;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        web = new WebView(this);
        setContentView(web);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(true);
        s.setMediaPlaybackRequiresUserGesture(false);

        web.setWebViewClient(new AssetClient());
        web.setWebChromeClient(new ChromeClient());
        web.addJavascriptInterface(new Bridge(), "AndroidBridge");

        if (savedInstanceState != null) {
            web.restoreState(savedInstanceState);
        } else {
            web.loadUrl(START_URL);
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        web.saveState(outState);
    }

    @Override
    public void onBackPressed() {
        // La página decide: si tiene un modal o pestaña que cerrar devuelve "true".
        web.evaluateJavascript("window.onAndroidBack ? String(window.onAndroidBack()) : 'false'",
                new ValueCallback<String>() {
                    @Override
                    public void onReceiveValue(String handled) {
                        if (!"\"true\"".equals(handled)) {
                            MainActivity.super.onBackPressed();
                        }
                    }
                });
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == REQ_FILE && fileCallback != null) {
            fileCallback.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(resultCode, data));
            fileCallback = null;
            return;
        }
        super.onActivityResult(requestCode, resultCode, data);
    }

    private class AssetClient extends WebViewClient {
        @Override
        public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
            Uri url = request.getUrl();
            if (!HOST.equals(url.getHost())) {
                return null;
            }
            String path = url.getPath();
            if (path == null || path.equals("/")) {
                path = "/index.html";
            }
            try {
                InputStream in = getAssets().open("www" + path);
                return new WebResourceResponse(mimeFor(path), "utf-8", in);
            } catch (IOException e) {
                return new WebResourceResponse("text/plain", "utf-8", 404, "Not Found", null, null);
            }
        }

        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            Uri url = request.getUrl();
            if (HOST.equals(url.getHost())) {
                return false;
            }
            try {
                startActivity(new Intent(Intent.ACTION_VIEW, url));
            } catch (ActivityNotFoundException ignored) {
            }
            return true;
        }
    }

    private class ChromeClient extends WebChromeClient {
        @Override
        public void onPermissionRequest(final PermissionRequest request) {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    handlePermission(request);
                }
            });
        }

        @Override
        public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
            if (fileCallback != null) {
                fileCallback.onReceiveValue(null);
            }
            fileCallback = callback;
            Intent intent = params.createIntent();
            String[] types = params.getAcceptTypes();
            if (types != null && types.length > 0 && types[0].startsWith("video")) {
                // Para videos de técnica: ofrecer grabar con la cámara además de elegir uno existente.
                Intent chooser = Intent.createChooser(intent, "Video de técnica");
                chooser.putExtra(Intent.EXTRA_INITIAL_INTENTS, new Intent[] { new Intent(MediaStore.ACTION_VIDEO_CAPTURE) });
                intent = chooser;
            }
            try {
                startActivityForResult(intent, REQ_FILE);
            } catch (ActivityNotFoundException e) {
                fileCallback = null;
                callback.onReceiveValue(null);
                return false;
            }
            return true;
        }
    }

    /** La cámara en vivo (fotos con silueta) usa getUserMedia: se concede si Android ya dio el permiso. */
    private void handlePermission(PermissionRequest request) {
        for (String r : request.getResources()) {
            if (!PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(r)) {
                request.deny();
                return;
            }
        }
        if (checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
            request.grant(request.getResources());
        } else {
            pendingPermission = request;
            requestPermissions(new String[] { Manifest.permission.CAMERA }, REQ_CAMERA);
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] results) {
        if (requestCode == REQ_CAMERA && pendingPermission != null) {
            if (results.length > 0 && results[0] == PackageManager.PERMISSION_GRANTED) {
                pendingPermission.grant(pendingPermission.getResources());
            } else {
                pendingPermission.deny();
            }
            pendingPermission = null;
        }
    }

    /** Escribe bytes en Descargas/MiProgreso y devuelve su content:// (o "" si falla). */
    private Uri writeDownload(String name, String mime, byte[] bytes) throws IOException {
        String safeName = name.replaceAll("[^A-Za-z0-9._-]", "_");
        if (Build.VERSION.SDK_INT < 29) {
            File file = new File(getExternalFilesDir(null), safeName);
            FileOutputStream out = new FileOutputStream(file);
            try {
                out.write(bytes);
            } finally {
                out.close();
            }
            return Uri.fromFile(file);
        }
        ContentResolver resolver = getContentResolver();
        ContentValues values = new ContentValues();
        values.put(MediaStore.MediaColumns.DISPLAY_NAME, safeName);
        values.put(MediaStore.MediaColumns.MIME_TYPE, mime);
        values.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/MiProgreso");
        Uri uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
        if (uri == null) {
            throw new IOException("MediaStore insert");
        }
        OutputStream out = resolver.openOutputStream(uri);
        try {
            out.write(bytes);
        } finally {
            out.close();
        }
        return uri;
    }

    /** Puente expuesto a JavaScript como window.AndroidBridge. */
    public class Bridge {
        /** Guarda un archivo binario (PDF, Excel) recibido en base64. Devuelve su URI o "". */
        @JavascriptInterface
        public String saveBase64(String name, String mime, String base64) {
            try {
                return writeDownload(name, mime, Base64.decode(base64, Base64.DEFAULT)).toString();
            } catch (Exception e) {
                return "";
            }
        }

        /** Abre el menú de compartir de Android con un archivo ya guardado. */
        @JavascriptInterface
        public void shareFile(final String uri, final String mime, final String text) {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    Intent send = new Intent(Intent.ACTION_SEND);
                    send.setType(mime);
                    send.putExtra(Intent.EXTRA_STREAM, Uri.parse(uri));
                    send.putExtra(Intent.EXTRA_TEXT, text);
                    send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                    try {
                        startActivity(Intent.createChooser(send, "Compartir progreso"));
                    } catch (ActivityNotFoundException ignored) {
                    }
                }
            });
        }

        @JavascriptInterface
        public void copyText(String text) {
            ClipboardManager cm = (ClipboardManager) getSystemService(CLIPBOARD_SERVICE);
            if (cm != null) {
                cm.setPrimaryClip(ClipData.newPlainText("Mi Progreso", text));
            }
        }

        /** Colorea las barras del sistema según el tema de la app (íconos oscuros en tema claro). */
        @JavascriptInterface
        public void setBars(final String color, final boolean light) {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    try {
                        int c = Color.parseColor(color.trim());
                        getWindow().setStatusBarColor(c);
                        getWindow().setNavigationBarColor(c);
                        web.setBackgroundColor(c);
                        View decor = getWindow().getDecorView();
                        int flags = decor.getSystemUiVisibility();
                        int lightBits = View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
                        decor.setSystemUiVisibility(light ? (flags | lightBits) : (flags & ~lightBits));
                    } catch (IllegalArgumentException ignored) {
                    }
                }
            });
        }

        /** Vibra al terminar el descanso entre series. */
        @JavascriptInterface
        public void vibrate(long ms) {
            Vibrator v = (Vibrator) getSystemService(VIBRATOR_SERVICE);
            if (v != null && v.hasVibrator()) {
                v.vibrate(VibrationEffect.createOneShot(Math.min(ms, 2000), VibrationEffect.DEFAULT_AMPLITUDE));
            }
        }

        /** Mantiene la pantalla encendida mientras hay un entreno en curso. */
        @JavascriptInterface
        public void keepScreenOn(final boolean on) {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    if (on) {
                        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                    } else {
                        getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                    }
                }
            });
        }

        /** Guarda un archivo de texto en Descargas/MiProgreso y devuelve dónde quedó (o "" si falla). */
        @JavascriptInterface
        public String saveFile(String name, String content) {
            byte[] bytes = content.getBytes(StandardCharsets.UTF_8);
            String safeName = name.replaceAll("[^A-Za-z0-9._-]", "_");
            try {
                String where;
                if (Build.VERSION.SDK_INT >= 29) {
                    ContentResolver resolver = getContentResolver();
                    ContentValues values = new ContentValues();
                    values.put(MediaStore.MediaColumns.DISPLAY_NAME, safeName);
                    values.put(MediaStore.MediaColumns.MIME_TYPE, "application/json");
                    values.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/MiProgreso");
                    Uri uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
                    if (uri == null) {
                        return "";
                    }
                    OutputStream out = resolver.openOutputStream(uri);
                    try {
                        out.write(bytes);
                    } finally {
                        out.close();
                    }
                    where = "Descargas/MiProgreso/" + safeName;
                } else {
                    File dir = getExternalFilesDir(null);
                    File file = new File(dir, safeName);
                    FileOutputStream out = new FileOutputStream(file);
                    try {
                        out.write(bytes);
                    } finally {
                        out.close();
                    }
                    where = file.getAbsolutePath();
                }
                final String msg = "Guardado en " + where;
                runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        Toast.makeText(MainActivity.this, msg, Toast.LENGTH_LONG).show();
                    }
                });
                return where;
            } catch (Exception e) {
                return "";
            }
        }
    }

    private static String mimeFor(String path) {
        if (path.endsWith(".html")) return "text/html";
        if (path.endsWith(".js")) return "application/javascript";
        if (path.endsWith(".css")) return "text/css";
        if (path.endsWith(".svg")) return "image/svg+xml";
        if (path.endsWith(".png")) return "image/png";
        if (path.endsWith(".json")) return "application/json";
        return "application/octet-stream";
    }
}
