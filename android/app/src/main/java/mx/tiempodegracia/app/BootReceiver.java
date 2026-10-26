package mx.tiempodegracia.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Después de reiniciar, actualizar la app o cambiar la hora: vuelve a programar todo. */
public class BootReceiver extends BroadcastReceiver {

    @Override
    public void onReceive(Context ctx, Intent intent) {
        CultoReminders.schedule(ctx);
        EventsCheck.schedulePeriodic(ctx);
    }
}
