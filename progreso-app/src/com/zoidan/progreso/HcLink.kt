package com.zoidan.progreso

import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.PermissionController
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.BloodPressureRecord
import androidx.health.connect.client.records.ExerciseSessionRecord
import androidx.health.connect.client.records.OxygenSaturationRecord
import androidx.health.connect.client.records.HeartRateRecord
import androidx.health.connect.client.records.HeartRateVariabilityRmssdRecord
import androidx.health.connect.client.records.Record
import androidx.health.connect.client.records.RestingHeartRateRecord
import androidx.health.connect.client.records.SleepSessionRecord
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject
import java.time.Instant
import kotlin.reflect.KClass

/**
 * Health Connect con la librería oficial de Jetpack: Android 8–13 (app Health Connect de Google Play)
 * y Android 14+ (integrado al sistema). Mi Fitness escribe ahí los datos del reloj; Mi Progreso solo lee.
 *
 * Estados que ve la página: unavailable · install (falta instalar/actualizar Health Connect) ·
 * checking · none · partial · granted.
 */
class HcLink(private val act: Activity, private val out: Out) {

    fun interface Out { fun js(code: String) }

    companion object {
        const val PROVIDER = "com.google.android.apps.healthdata"
        val PERMS: Set<String> = setOf(
            HealthPermission.getReadPermission(HeartRateRecord::class),
            HealthPermission.getReadPermission(RestingHeartRateRecord::class),
            HealthPermission.getReadPermission(HeartRateVariabilityRmssdRecord::class),
            HealthPermission.getReadPermission(SleepSessionRecord::class),
            HealthPermission.getReadPermission(StepsRecord::class),
            HealthPermission.getReadPermission(ExerciseSessionRecord::class),
            HealthPermission.getReadPermission(BloodPressureRecord::class),
            HealthPermission.getReadPermission(OxygenSaturationRecord::class)
        )
    }

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    @Volatile private var cached = "checking"

    private fun sdk(): Int = HealthConnectClient.getSdkStatus(act, PROVIDER)

    /** Estado conocido (síncrono para el puente); refresh() lo actualiza y avisa a la página. */
    fun status(): String {
        when (sdk()) {
            HealthConnectClient.SDK_UNAVAILABLE -> return "unavailable"
            HealthConnectClient.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED -> return "install"
        }
        if (cached == "checking") refresh(false)
        return cached
    }

    fun refresh(fromRequest: Boolean) {
        val s = sdk()
        if (s != HealthConnectClient.SDK_AVAILABLE) {
            cached = if (s == HealthConnectClient.SDK_UNAVAILABLE) "unavailable" else "install"
            out.js("window.onHcStatus && window.onHcStatus(${JSONObject.quote(cached)},$fromRequest)")
            return
        }
        scope.launch {
            cached = try {
                val granted = HealthConnectClient.getOrCreate(act, PROVIDER).permissionController.getGrantedPermissions()
                val n = PERMS.count { it in granted }
                if (n == 0) "none" else if (n == PERMS.size) "granted" else "partial"
            } catch (e: Exception) { "none" }
            out.js("window.onHcStatus && window.onHcStatus(${JSONObject.quote(cached)},$fromRequest)")
        }
    }

    /** Abre la pantalla de permisos de Health Connect; el resultado llega a onActivityResult. */
    fun request(requestCode: Int) {
        if (sdk() != HealthConnectClient.SDK_AVAILABLE) { install(); return }
        val intent = PermissionController.createRequestPermissionResultContract(PROVIDER).createIntent(act, PERMS)
        try { act.startActivityForResult(intent, requestCode) } catch (e: ActivityNotFoundException) { install() }
    }

    /** Google Play en la ficha de Health Connect (con el onboarding de Health Connect). */
    fun install() {
        val uri = Uri.parse("market://details?id=$PROVIDER&url=healthconnect%3A%2F%2Fonboarding")
        try {
            act.startActivity(Intent(Intent.ACTION_VIEW, uri).setPackage("com.android.vending"))
        } catch (e: ActivityNotFoundException) {
            act.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("https://play.google.com/store/apps/details?id=$PROVIDER")))
        }
    }

    /** Lee [from, to] y entrega JSON a window.onHcData(reqId, data); mismo formato en todas las versiones. */
    fun read(reqId: String, fromMs: Long, toMs: Long) {
        if (sdk() != HealthConnectClient.SDK_AVAILABLE) { done(reqId, "{\"error\":\"unavailable\"}"); return }
        scope.launch {
            val client = HealthConnectClient.getOrCreate(act, PROVIDER)
            val range = TimeRangeFilter.between(Instant.ofEpochMilli(fromMs), Instant.ofEpochMilli(toMs))
            val res = JSONObject()
            val origins = mutableSetOf<String>()
            suspend fun <T : Record> grab(type: KClass<T>, key: String, map: (T, JSONArray) -> Unit) {
                try {
                    val a = JSONArray()
                    for (r in client.readRecords(ReadRecordsRequest(type, range, pageSize = 5000)).records) {
                        origins.add(r.metadata.dataOrigin.packageName); map(r, a)
                    }
                    res.put(key, a)
                } catch (e: Exception) { res.put(key + "_error", if (e is SecurityException) "permission" else (e.message ?: "error")) }
            }
            grab(HeartRateRecord::class, "hr") { r, a -> r.samples.forEach { a.put(JSONArray().put(it.time.toEpochMilli()).put(it.beatsPerMinute)) } }
            grab(RestingHeartRateRecord::class, "rhr") { r, a -> a.put(JSONArray().put(r.time.toEpochMilli()).put(r.beatsPerMinute)) }
            grab(HeartRateVariabilityRmssdRecord::class, "hrv") { r, a -> a.put(JSONArray().put(r.time.toEpochMilli()).put(r.heartRateVariabilityMillis)) }
            // Sueño con fases: [inicio, fin, [[inicio, fin, tipo]...]] (4 ligero · 5 profundo · 6 REM · 1/7 despierto)
            grab(SleepSessionRecord::class, "sleep") { r, a ->
                val st = JSONArray(); r.stages.forEach { st.put(JSONArray().put(it.startTime.toEpochMilli()).put(it.endTime.toEpochMilli()).put(it.stage)) }
                a.put(JSONArray().put(r.startTime.toEpochMilli()).put(r.endTime.toEpochMilli()).put(st))
            }
            grab(BloodPressureRecord::class, "bp") { r, a -> a.put(JSONArray().put(r.time.toEpochMilli()).put(r.systolic.inMillimetersOfMercury).put(r.diastolic.inMillimetersOfMercury).put(r.metadata.dataOrigin.packageName)) }
            grab(OxygenSaturationRecord::class, "spo2") { r, a -> a.put(JSONArray().put(r.time.toEpochMilli()).put(r.percentage.value)) }
            grab(StepsRecord::class, "steps") { r, a -> a.put(JSONArray().put(r.startTime.toEpochMilli()).put(r.endTime.toEpochMilli()).put(r.count)) }
            // Entrenamientos del reloj: [inicio, fin, tipo, título, origen, vueltas[[ini, fin]], segmentos[[ini, fin, tipo, reps]]]
            grab(ExerciseSessionRecord::class, "ex") { r, a ->
                val laps = JSONArray(); r.laps.forEach { laps.put(JSONArray().put(it.startTime.toEpochMilli()).put(it.endTime.toEpochMilli())) }
                val segs = JSONArray(); r.segments.forEach { segs.put(JSONArray().put(it.startTime.toEpochMilli()).put(it.endTime.toEpochMilli()).put(it.segmentType).put(it.repetitions)) }
                a.put(JSONArray().put(r.startTime.toEpochMilli()).put(r.endTime.toEpochMilli()).put(r.exerciseType).put(r.title ?: "").put(r.metadata.dataOrigin.packageName).put(laps).put(segs))
            }
            res.put("origins", JSONArray(origins))
            done(reqId, res.toString())
        }
    }

    private fun done(reqId: String, json: String) = out.js("window.onHcData && window.onHcData(${JSONObject.quote(reqId)},$json)")
}
