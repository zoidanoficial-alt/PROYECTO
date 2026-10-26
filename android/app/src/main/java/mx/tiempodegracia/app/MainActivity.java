package mx.tiempodegracia.app;

import android.app.Activity;
import android.app.AlarmManager;
import android.app.AlertDialog;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;

/**
 * Muestra el sitio publicado en GitHub Pages. Así, cualquier cambio al sitio
 * aparece en la app sin tener que instalar un APK nuevo.
 */
public class MainActivity extends Activity {

    static final String HOST = "zoidanoficial-alt.github.io";
    static final String SITE = "https://" + HOST + "/PROYECTO/";
    static final String OFFLINE = "file:///android_asset/offline.html";

    private WebView web;
    private FrameLayout root;
    private View fullscreenView;
    private WebChromeClient.CustomViewCallback fullscreenCallback;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        root = new FrameLayout(this);
        root.setBackgroundColor(Color.parseColor("#0d1020"));
        web = new WebView(this);
        root.addView(web, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        setContentView(root);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true); // el sitio recuerda el tema claro/oscuro
        s.setMediaPlaybackRequiresUserGesture(true);

        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (HOST.equals(uri.getHost()) || "file".equals(uri.getScheme())) return false;
                // Instagram, YouTube, Maps y WhatsApp se abren en su propia app
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, uri));
                } catch (ActivityNotFoundException ignored) {
                }
                return true;
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) view.loadUrl(OFFLINE);
            }
        });

        // Permite ver el video de YouTube en pantalla completa
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onShowCustomView(View view, CustomViewCallback callback) {
                if (fullscreenView != null) {
                    callback.onCustomViewHidden();
                    return;
                }
                fullscreenView = view;
                fullscreenCallback = callback;
                root.addView(view, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
                web.setVisibility(View.GONE);
            }

            @Override
            public void onHideCustomView() {
                if (fullscreenView == null) return;
                root.removeView(fullscreenView);
                fullscreenView = null;
                web.setVisibility(View.VISIBLE);
                if (fullscreenCallback != null) fullscreenCallback.onCustomViewHidden();
                fullscreenCallback = null;
            }
        });

        if (savedInstanceState != null) {
            web.restoreState(savedInstanceState);
        } else {
            web.loadUrl(urlFrom(getIntent()));
        }

        // Notificaciones: recordatorios del culto y revisión de eventos nuevos
        Notifs.createChannels(this);
        CultoReminders.schedule(this);
        EventsCheck.schedulePeriodic(this);
        if (!getSharedPreferences("eventos", MODE_PRIVATE).getBoolean("iniciado", false)) {
            EventsCheck.runSoon(this); // la primera vez solo registra los eventos que ya existen
        }
        askPermissions();
    }

    /** Al tocar una notificación con la app ya abierta, ir a la página del aviso. */
    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        if (intent.getData() != null) web.loadUrl(urlFrom(intent));
    }

    private static String urlFrom(Intent intent) {
        Uri data = intent.getData();
        return data != null && HOST.equals(data.getHost()) ? data.toString() : SITE;
    }

    private void askPermissions() {
        if (Build.VERSION.SDK_INT >= 33
                && checkSelfPermission("android.permission.POST_NOTIFICATIONS") != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{"android.permission.POST_NOTIFICATIONS"}, 1);
        } else {
            askExactAlarms();
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] results) {
        super.onRequestPermissionsResult(requestCode, permissions, results);
        if (results.length > 0 && results[0] == PackageManager.PERMISSION_GRANTED) askExactAlarms();
    }

    /** En Android 12+ el aviso de "5 minutos antes" necesita permiso de hora exacta. Se pide una sola vez. */
    private void askExactAlarms() {
        if (Build.VERSION.SDK_INT < 31 || getSystemService(AlarmManager.class).canScheduleExactAlarms()) return;
        SharedPreferences p = getSharedPreferences("permisos", MODE_PRIVATE);
        if (p.getBoolean("alarmas_pedidas", false)) return;
        p.edit().putBoolean("alarmas_pedidas", true).apply();
        new AlertDialog.Builder(this)
                .setTitle("Recordatorios a tiempo")
                .setMessage("Para avisarte 30, 20 y 5 minutos antes del culto justo a tiempo, permite que la app use alarmas y recordatorios.")
                .setPositiveButton("Permitir", (d, w) -> {
                    try {
                        startActivity(new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, Uri.parse("package:" + getPackageName())));
                    } catch (ActivityNotFoundException ignored) {
                    }
                })
                .setNegativeButton("Ahora no", null)
                .show();
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        web.saveState(outState);
    }

    @Override
    public void onBackPressed() {
        if (fullscreenView != null) {
            web.getWebChromeClient().onHideCustomView();
        } else if (web.canGoBack()) {
            web.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onPause() {
        super.onPause();
        web.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        web.onResume();
        CultoReminders.schedule(this); // por si se acaba de dar el permiso de hora exacta
    }
}
