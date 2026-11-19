package com.zoidan.progreso;

import android.content.Context;
import android.content.pm.PackageManager;
import android.health.connect.HealthConnectException;
import android.health.connect.HealthConnectManager;
import android.health.connect.HealthPermissions;
import android.health.connect.ReadRecordsRequestUsingFilters;
import android.health.connect.ReadRecordsResponse;
import android.health.connect.TimeInstantRangeFilter;
import android.health.connect.datatypes.ExerciseSessionRecord;
import android.health.connect.datatypes.HeartRateRecord;
import android.health.connect.datatypes.HeartRateVariabilityRmssdRecord;
import android.health.connect.datatypes.Record;
import android.health.connect.datatypes.RestingHeartRateRecord;
import android.health.connect.datatypes.SleepSessionRecord;
import android.health.connect.datatypes.StepsRecord;
import android.os.Build;
import android.os.OutcomeReceiver;

import org.json.JSONArray;
import org.json.JSONObject;

import java.time.Instant;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.Executor;
import java.util.concurrent.Executors;

/**
 * Lectura de Health Connect (Android 14+, API del sistema; sin librerías).
 * Mi Fitness escribe ahí el pulso, el sueño y los entrenos del reloj; Mi Progreso solo lee.
 */
class HcLink {

    interface Out { void js(String code); }

    static final String[] PERMS = {
            HealthPermissions.READ_HEART_RATE, HealthPermissions.READ_RESTING_HEART_RATE, HealthPermissions.READ_HEART_RATE_VARIABILITY,
            HealthPermissions.READ_SLEEP, HealthPermissions.READ_STEPS, HealthPermissions.READ_EXERCISE
    };

    private final Context ctx;
    private final Out out;
    private final Executor exec = Executors.newSingleThreadExecutor();

    HcLink(Context ctx, Out out) { this.ctx = ctx; this.out = out; }

    static boolean supported() { return Build.VERSION.SDK_INT >= 34; }

    /** unsupported (Android < 14) · unavailable · none · partial · granted */
    String status() {
        if (!supported()) return "unsupported";
        if (ctx.getSystemService(HealthConnectManager.class) == null) return "unavailable";
        int ok = 0;
        for (String p : PERMS) if (ctx.checkSelfPermission(p) == PackageManager.PERMISSION_GRANTED) ok++;
        return ok == 0 ? "none" : ok == PERMS.length ? "granted" : "partial";
    }

    /** Lee [from, to] y entrega un JSON a window.onHcData(reqId, data). */
    void read(final String reqId, long fromMs, long toMs) {
        if (!supported()) { done(reqId, "{\"error\":\"unsupported\"}"); return; }
        final HealthConnectManager hc = ctx.getSystemService(HealthConnectManager.class);
        if (hc == null) { done(reqId, "{\"error\":\"unavailable\"}"); return; }
        final TimeInstantRangeFilter range = new TimeInstantRangeFilter.Builder().setStartTime(Instant.ofEpochMilli(fromMs)).setEndTime(Instant.ofEpochMilli(toMs)).build();
        final JSONObject res = new JSONObject();
        final Set<String> origins = new HashSet<String>();
        final int[] pending = { 6 };
        final Runnable finish = new Runnable() {
            @Override public void run() {
                synchronized (pending) {
                    if (--pending[0] > 0) return;
                }
                try { res.put("origins", new JSONArray(origins)); } catch (Exception ignored) { }
                done(reqId, res.toString());
            }
        };
        readType(hc, HeartRateRecord.class, range, new Sink<HeartRateRecord>() {
            @Override public void take(List<HeartRateRecord> rs, JSONArray a) throws Exception {
                for (HeartRateRecord r : rs) { origin(r, origins); for (HeartRateRecord.HeartRateSample s : r.getSamples()) a.put(new JSONArray().put(s.getTime().toEpochMilli()).put(s.getBeatsPerMinute())); }
            }
        }, "hr", res, finish);
        readType(hc, RestingHeartRateRecord.class, range, new Sink<RestingHeartRateRecord>() {
            @Override public void take(List<RestingHeartRateRecord> rs, JSONArray a) throws Exception {
                for (RestingHeartRateRecord r : rs) { origin(r, origins); a.put(new JSONArray().put(r.getTime().toEpochMilli()).put(r.getBeatsPerMinute())); }
            }
        }, "rhr", res, finish);
        readType(hc, HeartRateVariabilityRmssdRecord.class, range, new Sink<HeartRateVariabilityRmssdRecord>() {
            @Override public void take(List<HeartRateVariabilityRmssdRecord> rs, JSONArray a) throws Exception {
                for (HeartRateVariabilityRmssdRecord r : rs) { origin(r, origins); a.put(new JSONArray().put(r.getTime().toEpochMilli()).put(r.getHeartRateVariabilityMillis())); }
            }
        }, "hrv", res, finish);
        readType(hc, SleepSessionRecord.class, range, new Sink<SleepSessionRecord>() {
            @Override public void take(List<SleepSessionRecord> rs, JSONArray a) throws Exception {
                for (SleepSessionRecord r : rs) { origin(r, origins); a.put(new JSONArray().put(r.getStartTime().toEpochMilli()).put(r.getEndTime().toEpochMilli())); }
            }
        }, "sleep", res, finish);
        readType(hc, StepsRecord.class, range, new Sink<StepsRecord>() {
            @Override public void take(List<StepsRecord> rs, JSONArray a) throws Exception {
                for (StepsRecord r : rs) { origin(r, origins); a.put(new JSONArray().put(r.getStartTime().toEpochMilli()).put(r.getEndTime().toEpochMilli()).put(r.getCount())); }
            }
        }, "steps", res, finish);
        readType(hc, ExerciseSessionRecord.class, range, new Sink<ExerciseSessionRecord>() {
            @Override public void take(List<ExerciseSessionRecord> rs, JSONArray a) throws Exception {
                for (ExerciseSessionRecord r : rs) { origin(r, origins); a.put(new JSONArray().put(r.getStartTime().toEpochMilli()).put(r.getEndTime().toEpochMilli()).put(r.getExerciseType()).put(r.getTitle() != null ? r.getTitle().toString() : "")); }
            }
        }, "ex", res, finish);
    }

    private interface Sink<T> { void take(List<T> records, JSONArray into) throws Exception; }

    private static void origin(Record r, Set<String> origins) {
        try { origins.add(r.getMetadata().getDataOrigin().getPackageName()); } catch (Exception ignored) { }
    }

    private <T extends Record> void readType(HealthConnectManager hc, Class<T> type, TimeInstantRangeFilter range, final Sink<T> sink, final String key, final JSONObject res, final Runnable finish) {
        try {
            hc.readRecords(new ReadRecordsRequestUsingFilters.Builder<T>(type).setTimeRangeFilter(range).setPageSize(5000).build(), exec,
                    new OutcomeReceiver<ReadRecordsResponse<T>, HealthConnectException>() {
                        @Override public void onResult(ReadRecordsResponse<T> r) {
                            JSONArray a = new JSONArray();
                            try { sink.take(r.getRecords(), a); synchronized (res) { res.put(key, a); } } catch (Exception ignored) { }
                            finish.run();
                        }
                        @Override public void onError(HealthConnectException e) {
                            try { synchronized (res) { res.put(key + "_error", String.valueOf(e.getErrorCode())); } } catch (Exception ignored) { }
                            finish.run();
                        }
                    });
        } catch (Exception e) {   // SecurityException si falta el permiso de ese tipo
            try { synchronized (res) { res.put(key + "_error", "permission"); } } catch (Exception ignored) { }
            finish.run();
        }
    }

    private void done(String reqId, String json) {
        out.js("window.onHcData && window.onHcData(" + JSONObject.quote(reqId) + "," + json + ")");
    }
}
