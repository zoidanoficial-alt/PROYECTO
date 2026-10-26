package mx.tiempodegracia.app;

import android.app.job.JobInfo;
import android.app.job.JobScheduler;
import android.content.ComponentName;
import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;

/**
 * Revisa eventos.json del sitio y avisa de los eventos que no había visto.
 * La primera vez solo guarda los que ya existen, para no avisar de eventos viejos.
 */
final class EventsCheck {

    static final String JSON_URL = MainActivity.SITE + "eventos.json";
    static final int JOB_PERIODIC = 200, JOB_NOW = 201;
    static final long CADA_MS = 3 * 60 * 60 * 1000L; // cada 3 horas

    private EventsCheck() {
    }

    static void schedulePeriodic(Context ctx) {
        JobScheduler js = ctx.getSystemService(JobScheduler.class);
        if (js.getPendingJob(JOB_PERIODIC) != null) return;
        js.schedule(new JobInfo.Builder(JOB_PERIODIC, new ComponentName(ctx, EventsJobService.class))
                .setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY)
                .setPeriodic(CADA_MS)
                .setPersisted(true)
                .build());
    }

    static void runSoon(Context ctx) {
        ctx.getSystemService(JobScheduler.class).schedule(
                new JobInfo.Builder(JOB_NOW, new ComponentName(ctx, EventsJobService.class))
                        .setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY)
                        .build());
    }

    /** Se ejecuta en segundo plano (nunca en el hilo principal). */
    static void run(Context ctx) throws Exception {
        JSONArray eventos = new JSONObject(fetch(JSON_URL + "?t=" + System.currentTimeMillis())).getJSONArray("eventos");
        SharedPreferences p = ctx.getSharedPreferences("eventos", Context.MODE_PRIVATE);
        Set<String> vistos = new HashSet<>(p.getStringSet("vistos", new HashSet<>()));
        boolean iniciado = p.getBoolean("iniciado", false);
        LocalDate hoy = LocalDate.now(CultoReminders.MX);
        for (int i = 0; i < eventos.length(); i++) {
            JSONObject e = eventos.getJSONObject(i);
            String id = e.getString("id");
            if (vistos.contains(id)) continue;
            vistos.add(id);
            LocalDate fecha = LocalDate.parse(e.getString("fecha"));
            if (iniciado && !fecha.isBefore(hoy)) {
                String cuando = fechaLarga(fecha);
                String hora = e.optString("hora", "");
                if (!hora.isEmpty()) cuando += ", " + hora + " hrs";
                Notifs.show(ctx, Notifs.CH_EVENTOS, 1000 + (id.hashCode() & 0xffff),
                        "Nuevo evento: " + e.getString("titulo"),
                        cuando + ". Toca para ver los detalles.",
                        MainActivity.SITE + "eventos.html#" + id);
            }
        }
        p.edit().putStringSet("vistos", vistos).putBoolean("iniciado", true).apply();
    }

    static String fechaLarga(LocalDate d) {
        String s = d.format(DateTimeFormatter.ofPattern("EEEE d 'de' MMMM", new Locale("es", "MX")));
        return Character.toUpperCase(s.charAt(0)) + s.substring(1);
    }

    private static String fetch(String url) throws Exception {
        HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
        c.setConnectTimeout(15000);
        c.setReadTimeout(15000);
        c.setUseCaches(false);
        try (InputStream in = c.getInputStream()) {
            if (c.getResponseCode() != 200) throw new IllegalStateException("HTTP " + c.getResponseCode());
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            byte[] buf = new byte[8192];
            for (int n; (n = in.read(buf)) > 0; ) out.write(buf, 0, n);
            return out.toString(StandardCharsets.UTF_8.name());
        } finally {
            c.disconnect();
        }
    }
}
