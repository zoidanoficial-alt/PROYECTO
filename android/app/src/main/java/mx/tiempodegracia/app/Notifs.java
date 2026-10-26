package mx.tiempodegracia.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;

/** Canales y envío de notificaciones. */
final class Notifs {

    static final String CH_CULTO = "culto";
    static final String CH_EVENTOS = "eventos";

    private Notifs() {
    }

    static void createChannels(Context ctx) {
        NotificationManager nm = ctx.getSystemService(NotificationManager.class);
        NotificationChannel culto = new NotificationChannel(CH_CULTO, "Recordatorios del culto", NotificationManager.IMPORTANCE_HIGH);
        culto.setDescription("Avisos 30, 20 y 5 minutos antes del culto del domingo");
        NotificationChannel eventos = new NotificationChannel(CH_EVENTOS, "Eventos nuevos", NotificationManager.IMPORTANCE_DEFAULT);
        eventos.setDescription("Avisos cuando la iglesia publica un evento nuevo");
        nm.createNotificationChannel(culto);
        nm.createNotificationChannel(eventos);
    }

    static boolean allowed(Context ctx) {
        if (Build.VERSION.SDK_INT >= 33
                && ctx.checkSelfPermission("android.permission.POST_NOTIFICATIONS") != PackageManager.PERMISSION_GRANTED) {
            return false;
        }
        return ctx.getSystemService(NotificationManager.class).areNotificationsEnabled();
    }

    /** Muestra una notificación; al tocarla abre la app en {@code url}. */
    static void show(Context ctx, String channel, int id, String title, String text, String url) {
        if (!allowed(ctx)) return;
        createChannels(ctx);
        Intent open = new Intent(ctx, MainActivity.class)
                .setData(Uri.parse(url))
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pi = PendingIntent.getActivity(ctx, id, open,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Notification n = new Notification.Builder(ctx, channel)
                .setSmallIcon(R.mipmap.ic_launcher_foreground)
                .setColor(Color.BLACK)
                .setContentTitle(title)
                .setContentText(text)
                .setStyle(new Notification.BigTextStyle().bigText(text))
                .setContentIntent(pi)
                .setAutoCancel(true)
                .build();
        ctx.getSystemService(NotificationManager.class).notify(id, n);
    }
}
