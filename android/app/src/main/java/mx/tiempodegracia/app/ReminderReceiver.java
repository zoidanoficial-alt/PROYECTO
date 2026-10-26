package mx.tiempodegracia.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Suena antes del culto: muestra el aviso y programa el siguiente. */
public class ReminderReceiver extends BroadcastReceiver {

    private static final long MAX_RETRASO_MS = 10 * 60 * 1000L;

    @Override
    public void onReceive(Context ctx, Intent intent) {
        int minutes = intent.getIntExtra(CultoReminders.EXTRA_MIN, 0);
        long at = intent.getLongExtra(CultoReminders.EXTRA_AT, 0);
        // Si el celular estuvo apagado y el aviso llega muy tarde, ya no se muestra
        if (minutes > 0 && System.currentTimeMillis() - at < MAX_RETRASO_MS) {
            Notifs.show(ctx, Notifs.CH_CULTO, 10 + minutes,
                    CultoReminders.title(minutes), CultoReminders.text(minutes),
                    MainActivity.SITE + "#ubicacion");
        }
        CultoReminders.schedule(ctx);
    }
}
