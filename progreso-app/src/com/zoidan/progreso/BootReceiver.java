package com.zoidan.progreso;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/**
 * Al reiniciar el teléfono (o actualizar la app) Android borra las alarmas: se vuelven a programar
 * los recordatorios guardados. Es el único receptor expuesto y solo atiende estas dos acciones del sistema.
 */
public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        String a = intent.getAction();
        if (Intent.ACTION_BOOT_COMPLETED.equals(a) || Intent.ACTION_MY_PACKAGE_REPLACED.equals(a)) {
            ReminderReceiver.schedule(context, context.getSharedPreferences(ReminderReceiver.PREFS, Context.MODE_PRIVATE).getString("json", "[]"));
        }
    }
}
