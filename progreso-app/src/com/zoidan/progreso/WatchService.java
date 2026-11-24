package com.zoidan.progreso;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ServiceInfo;
import android.media.AudioAttributes;
import android.media.AudioFormat;
import android.media.AudioTrack;
import android.media.MediaMetadata;
import android.media.session.MediaSession;
import android.media.session.PlaybackState;
import android.os.Build;
import android.os.IBinder;
import android.os.SystemClock;
import android.view.KeyEvent;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Control remoto del temporizador HYROX desde el reloj.
 *
 * Xiaomi no permite apps de terceros en el Mi Watch, pero el reloj controla la música del
 * teléfono. Este servicio se presenta como un reproductor (MediaSession + audio silencioso):
 * play/pausa del reloj inicia o pausa el temporizador, "siguiente" marca la siguiente estación
 * y "anterior" deshace. La pantalla de música del reloj muestra la estación y el tiempo.
 *
 * Cada toque se guarda con su hora exacta en SharedPreferences, así los parciales son correctos
 * aunque Android cierre la página: la app los aplica al volver (watchDrain).
 */
public class WatchService extends Service {

    interface Listener { void onCmd(String cmd, long at); }

    static volatile Listener listener;
    static volatile boolean running;
    static final String CHANNEL = "hyrox_timer";
    static final int NOTIFICATION_ID = 7301;
    private static final String PREFS = "watch";

    private MediaSession session;
    private AudioTrack silence;
    private String title = "HYROX Lab";
    private String subtitle = "Listo";
    private boolean playing;
    private long positionMs;

    @Override
    public IBinder onBind(Intent intent) { return null; }

    @Override
    public void onCreate() {
        super.onCreate();
        running = true;
        NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (nm != null && nm.getNotificationChannel(CHANNEL) == null) {
            NotificationChannel ch = new NotificationChannel(CHANNEL, "Temporizador HYROX", NotificationManager.IMPORTANCE_LOW);
            ch.setDescription("Controla el temporizador desde tu reloj o la pantalla de bloqueo");
            ch.setShowBadge(false);
            nm.createNotificationChannel(ch);
        }
        session = new MediaSession(this, "HyroxTimer");
        session.setCallback(new MediaSession.Callback() {
            @Override public void onPlay() { cmd("play"); }
            @Override public void onPause() { cmd("pause"); }
            @Override public void onSkipToNext() { cmd("next"); }
            @Override public void onSkipToPrevious() { cmd("prev"); }
            @Override public void onStop() { cmd("pause"); }
            @Override public boolean onMediaButtonEvent(Intent intent) {
                KeyEvent ev = intent != null ? (KeyEvent) intent.getParcelableExtra(Intent.EXTRA_KEY_EVENT) : null;
                if (ev != null && ev.getAction() == KeyEvent.ACTION_DOWN
                        && (ev.getKeyCode() == KeyEvent.KEYCODE_HEADSETHOOK || ev.getKeyCode() == KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE)) {
                    cmd(playing ? "pause" : "play");
                    return true;
                }
                return super.onMediaButtonEvent(intent);
            }
        });
        session.setActive(true);
        startSilence();
        publish();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent != null ? intent.getAction() : null;
        if ("cmd".equals(action)) {
            cmd(intent.getStringExtra("c"));
        } else if ("update".equals(action)) {
            if (intent.hasExtra("title")) title = intent.getStringExtra("title");
            if (intent.hasExtra("sub")) subtitle = intent.getStringExtra("sub");
            playing = intent.getBooleanExtra("playing", playing);
            positionMs = intent.getLongExtra("pos", positionMs);
        } else if ("stop".equals(action)) {
            stopForeground(true);
            stopSelf();
            return START_NOT_STICKY;
        }
        Notification n = buildNotification();
        if (Build.VERSION.SDK_INT >= 29) startForeground(NOTIFICATION_ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
        else startForeground(NOTIFICATION_ID, n);
        publish();
        return START_STICKY;
    }

    /** Un toque del reloj, de la notificación o de unos audífonos. */
    private void cmd(String c) {
        if (c == null) return;
        long at = System.currentTimeMillis();
        enqueue(this, c, at);
        Listener l = listener;
        if (l != null) l.onCmd(c, at);
    }

    static synchronized void enqueue(Context ctx, String c, long at) {
        SharedPreferences p = ctx.getSharedPreferences(PREFS, MODE_PRIVATE);
        try {
            JSONArray q = new JSONArray(p.getString("q", "[]"));
            JSONObject o = new JSONObject();
            o.put("c", c);
            o.put("at", at);
            q.put(o);
            p.edit().putString("q", q.toString()).apply();
        } catch (Exception ignored) {
        }
    }

    /** Devuelve y borra los toques pendientes (la página los aplica con su hora real). */
    static synchronized String drain(Context ctx) {
        SharedPreferences p = ctx.getSharedPreferences(PREFS, MODE_PRIVATE);
        String q = p.getString("q", "[]");
        p.edit().putString("q", "[]").apply();
        return q;
    }

    private void publish() {
        if (session == null) return;
        long actions = PlaybackState.ACTION_PLAY | PlaybackState.ACTION_PAUSE | PlaybackState.ACTION_PLAY_PAUSE
                | PlaybackState.ACTION_SKIP_TO_NEXT | PlaybackState.ACTION_SKIP_TO_PREVIOUS | PlaybackState.ACTION_STOP;
        session.setPlaybackState(new PlaybackState.Builder()
                .setActions(actions)
                .setState(playing ? PlaybackState.STATE_PLAYING : PlaybackState.STATE_PAUSED, positionMs, playing ? 1f : 0f, SystemClock.elapsedRealtime())
                .build());
        session.setMetadata(new MediaMetadata.Builder()
                .putString(MediaMetadata.METADATA_KEY_TITLE, title)
                .putString(MediaMetadata.METADATA_KEY_ARTIST, subtitle)
                .putString(MediaMetadata.METADATA_KEY_ALBUM, "Mi Progreso · HYROX Lab")
                .build());
        NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (nm != null) nm.notify(NOTIFICATION_ID, buildNotification());
    }

    private PendingIntent action(String c, int code) {
        Intent i = new Intent(this, WatchService.class).setAction("cmd").putExtra("c", c);
        return PendingIntent.getService(this, code, i, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    @SuppressWarnings("deprecation")
    private Notification buildNotification() {
        Intent open = new Intent(this, MainActivity.class).putExtra("tab", "train").addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent content = PendingIntent.getActivity(this, 40, open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        Notification.Builder b = new Notification.Builder(this, CHANNEL)
                .setSmallIcon(android.R.drawable.ic_media_play)
                .setContentTitle(title)
                .setContentText(subtitle)
                .setContentIntent(content)
                .setOngoing(true)
                .setShowWhen(false)
                .setVisibility(Notification.VISIBILITY_PUBLIC)
                .addAction(new Notification.Action.Builder(null, "Deshacer", action("prev", 41)).build())
                .addAction(new Notification.Action.Builder(null, playing ? "Pausa" : "Iniciar", action(playing ? "pause" : "play", 42)).build())
                .addAction(new Notification.Action.Builder(null, "Siguiente", action("next", 43)).build())
                .setStyle(new Notification.MediaStyle().setMediaSession(session.getSessionToken()).setShowActionsInCompactView(0, 1, 2));
        return b.build();
    }

    /** Audio silencioso en bucle: Android envía los botones multimedia a la sesión que "suena". */
    private void startSilence() {
        try {
            int rate = 8000, frames = rate;   // 1 s de silencio en bucle
            silence = new AudioTrack.Builder()
                    .setAudioAttributes(new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_MEDIA).setContentType(AudioAttributes.CONTENT_TYPE_MUSIC).build())
                    .setAudioFormat(new AudioFormat.Builder().setEncoding(AudioFormat.ENCODING_PCM_16BIT).setSampleRate(rate).setChannelMask(AudioFormat.CHANNEL_OUT_MONO).build())
                    .setBufferSizeInBytes(frames * 2)
                    .setTransferMode(AudioTrack.MODE_STATIC)
                    .build();
            silence.write(new short[frames], 0, frames);
            silence.setLoopPoints(0, frames, -1);
            silence.play();
        } catch (Exception e) {
            silence = null;
        }
    }

    @Override
    public void onDestroy() {
        running = false;
        if (silence != null) { try { silence.stop(); } catch (Exception ignored) { } silence.release(); }
        if (session != null) { session.setActive(false); session.release(); }
        super.onDestroy();
    }
}
