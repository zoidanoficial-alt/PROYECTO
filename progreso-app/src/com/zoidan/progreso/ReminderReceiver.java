package com.zoidan.progreso;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Recordatorios locales (17.0). La página calcula la agenda de los próximos días con tus datos
 * (qué entreno toca, si ya te pesaste, cuánta agua llevas...) y la entrega con setReminders().
 * Aquí se guarda, se programa con AlarmManager y se vuelve a programar al reiniciar el teléfono.
 * Todo es local: no hay servidor ni cuenta, así que no salen datos del teléfono.
 */
public class ReminderReceiver extends BroadcastReceiver {

    static final String CHANNEL = "recordatorios";
    static final String PREFS = "recordatorios";
    static final String ACTION_FIRE = "com.zoidan.progreso.RECORDATORIO";
    static final int BASE_CODE = 1000;
    static final int MAX = 40;

    @Override
    public void onReceive(Context context, Intent intent) {
        if (!ACTION_FIRE.equals(intent.getAction())) return;
        // Con la app a la vista no hace falta avisar: la propia pantalla ya lo muestra.
        if (MainActivity.visible) return;
        post(context, intent.getIntExtra("nid", 100), intent.getStringExtra("title"), intent.getStringExtra("text"), intent.getStringExtra("tab"));
    }

    static void post(Context context, int nid, String title, String text, String tab) {
        NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;
        ensureChannel(nm);
        Intent open = new Intent(context, MainActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        open.putExtra("tab", tab == null ? "home" : tab);
        PendingIntent pi = PendingIntent.getActivity(context, nid, open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        Notification n = new Notification.Builder(context, CHANNEL)
                .setSmallIcon(android.R.drawable.ic_popup_reminder)
                .setContentTitle(title)
                .setContentText(text)
                .setStyle(new Notification.BigTextStyle().bigText(text))
                .setCategory(Notification.CATEGORY_REMINDER)
                .setAutoCancel(true)
                .setContentIntent(pi)
                .build();
        nm.notify(nid, n);
    }

    static void ensureChannel(NotificationManager nm) {
        if (nm.getNotificationChannel(CHANNEL) == null) {
            NotificationChannel ch = new NotificationChannel(CHANNEL, "Recordatorios", NotificationManager.IMPORTANCE_DEFAULT);
            ch.setDescription("Entreno del día, chequeo, peso, agua, running y tus compromisos");
            nm.createNotificationChannel(ch);
        }
    }

    private static PendingIntent fireIntent(Context context, int code, JSONObject r) {
        Intent i = new Intent(context, ReminderReceiver.class);
        i.setAction(ACTION_FIRE);
        if (r != null) {
            i.putExtra("nid", r.optInt("nid", 100));
            i.putExtra("title", r.optString("title"));
            i.putExtra("text", r.optString("text"));
            i.putExtra("tab", r.optString("tab", "home"));
        }
        return PendingIntent.getBroadcast(context, code, i, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    /** Cancela la agenda anterior y programa la nueva. Devuelve cuántos quedaron programados. */
    static int schedule(Context context, String json) {
        AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return 0;
        SharedPreferences p = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        int prev = p.getInt("count", MAX);
        for (int k = 0; k < Math.max(prev, 0) && k < MAX; k++) am.cancel(fireIntent(context, BASE_CODE + k, null));
        int n = 0;
        long now = System.currentTimeMillis();
        try {
            JSONArray a = new JSONArray(json == null ? "[]" : json);
            for (int k = 0; k < a.length() && n < MAX; k++) {
                JSONObject r = a.getJSONObject(k);
                long at = r.optLong("at", 0);
                if (at <= now) continue;
                // Ventana de 10 min: Android agrupa alarmas y ahorra batería; un recordatorio no necesita exactitud al segundo.
                am.setWindow(AlarmManager.RTC_WAKEUP, at, 10 * 60 * 1000L, fireIntent(context, BASE_CODE + n, r));
                n++;
            }
        } catch (Exception ignored) {
        }
        p.edit().putString("json", json == null ? "[]" : json).putInt("count", n).apply();
        return n;
    }
}
