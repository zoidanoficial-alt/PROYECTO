package mx.tiempodegracia.app;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.temporal.TemporalAdjusters;

/**
 * Recordatorios del culto: domingos a las 11:00 (hora de la Ciudad de México),
 * avisando 30, 20 y 5 minutos antes. Se programa solo el siguiente aviso y,
 * cuando suena, ese mismo aviso programa el que sigue.
 */
final class CultoReminders {

    static final ZoneId MX = ZoneId.of("America/Mexico_City");
    static final DayOfWeek DIA = DayOfWeek.SUNDAY;
    static final int HORA = 11, MINUTO = 0;
    static final int[] MINUTOS_ANTES = {30, 20, 5};

    static final String EXTRA_MIN = "minutos";
    static final String EXTRA_AT = "hora";

    private CultoReminders() {
    }

    /** Siguiente aviso después de {@code nowMs}: {hora en ms, minutos antes del culto}. */
    static long[] next(long nowMs) {
        LocalDate today = Instant.ofEpochMilli(nowMs).atZone(MX).toLocalDate();
        LocalDate sunday = today.with(TemporalAdjusters.nextOrSame(DIA));
        for (int week = 0; week < 3; week++) {
            ZonedDateTime start = sunday.plusWeeks(week).atTime(HORA, MINUTO).atZone(MX);
            for (int m : MINUTOS_ANTES) {
                long t = start.minusMinutes(m).toInstant().toEpochMilli();
                if (t > nowMs + 1000) return new long[]{t, m};
            }
        }
        throw new IllegalStateException("sin aviso siguiente");
    }

    static void schedule(Context ctx) {
        long[] n = next(System.currentTimeMillis());
        Intent i = new Intent(ctx, ReminderReceiver.class)
                .putExtra(EXTRA_MIN, (int) n[1])
                .putExtra(EXTRA_AT, n[0]);
        PendingIntent pi = PendingIntent.getBroadcast(ctx, 100, i,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        AlarmManager am = ctx.getSystemService(AlarmManager.class);
        try {
            if (Build.VERSION.SDK_INT < 31 || am.canScheduleExactAlarms()) {
                am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, n[0], pi);
            } else {
                // Sin permiso de hora exacta Android puede retrasarlo unos minutos
                am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, n[0], pi);
            }
        } catch (SecurityException e) {
            am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, n[0], pi);
        }
    }

    static String title(int minutes) {
        if (minutes <= 5) return "¡Ya casi empezamos!";
        return "El culto empieza en " + minutes + " minutos";
    }

    static String text(int minutes) {
        if (minutes <= 5) return "Faltan 5 minutos para el culto. Te esperamos en Priv. de los Cipreses 2, 1.º piso.";
        return "Te esperamos a las 11:00 hrs en Priv. de los Cipreses 2, 1.º piso, Jardines de San Mateo.";
    }
}
