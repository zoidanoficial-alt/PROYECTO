package com.zoidan.progreso;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/**
 * Aviso de fin de descanso cuando la app está minimizada o con la pantalla apagada.
 * Si la app está a la vista, el propio cronómetro vibra y esta notificación se omite.
 */
public class RestReceiver extends BroadcastReceiver {

    static final String CHANNEL = "descanso";
    static final int NOTIFICATION_ID = 7;

    @Override
    public void onReceive(Context context, Intent intent) {
        if (MainActivity.visible) {
            return;
        }
        NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) {
            return;
        }
        ensureChannel(nm);
        Intent open = new Intent(context, MainActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pi = PendingIntent.getActivity(context, 0, open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        Notification n = new Notification.Builder(context, CHANNEL)
                .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
                .setContentTitle(intent.getStringExtra("title"))
                .setContentText(intent.getStringExtra("text"))
                .setCategory(Notification.CATEGORY_ALARM)
                .setAutoCancel(true)
                .setContentIntent(pi)
                .build();
        nm.notify(NOTIFICATION_ID, n);
    }

    static void ensureChannel(NotificationManager nm) {
        if (nm.getNotificationChannel(CHANNEL) == null) {
            NotificationChannel ch = new NotificationChannel(CHANNEL, "Fin del descanso", NotificationManager.IMPORTANCE_HIGH);
            ch.setDescription("Avisa cuando termina el descanso entre series");
            ch.enableVibration(true);
            ch.setVibrationPattern(new long[] { 0, 400, 200, 400 });
            nm.createNotificationChannel(ch);
        }
    }
}
