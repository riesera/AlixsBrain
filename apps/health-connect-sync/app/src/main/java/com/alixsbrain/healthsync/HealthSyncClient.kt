package com.alixsbrain.healthsync

import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.time.Instant
import java.time.ZoneId

class HealthSyncClient(private val endpoint: String, private val token: String) {
    val isConfigured: Boolean get() = endpoint.startsWith("https://") && token.isNotBlank()

    fun upload(deviceId: String, zoneId: ZoneId, summary: HealthSummary) {
        require(summary.daysInRange == 1)
        val exercise = JSONObject()
        summary.exercises.groupBy { ExerciseTypeNames.name(it.exerciseType) }.forEach { (name, sessions) ->
            exercise.put(name, JSONObject().apply {
                put("sessions", sessions.size)
                put("minutes", sessions.sumOf { java.time.Duration.between(it.startTime, it.endTime).toMinutes() })
            })
        }
        val payload = JSONObject().apply {
            put("device_id", deviceId)
            put("local_date", summary.startDate.toString())
            put("timezone", zoneId.id)
            put("collected_at", Instant.now().toString())
            putNullable("steps", summary.steps)
            putNullable("sleep_minutes", summary.sleepMinutes)
            put("exercise", exercise)
            putNullable("water_milliliters", summary.waterMilliliters)
            putNullable("food_energy_kilocalories", summary.energyKilocalories)
            putNullable("energy_burned_kilocalories", summary.totalEnergyBurnedKilocalories)
            put("nutrients", JSONObject(summary.nutrientsGrams))
            putNullable("average_weight_kilograms", summary.averageWeightKilograms)
            putNullable("average_resting_heart_rate_bpm", summary.averageRestingHeartRateBpm)
            put("source_packages", JSONArray(summary.sourcePackages.sorted()))
        }
        val connection = URL(endpoint).openConnection() as HttpURLConnection
        try {
            connection.requestMethod = "PUT"
            connection.connectTimeout = 15_000
            connection.readTimeout = 30_000
            connection.doOutput = true
            connection.setRequestProperty("Authorization", "Bearer $token")
            connection.setRequestProperty("Content-Type", "application/json; charset=utf-8")
            connection.outputStream.use { it.write(payload.toString().toByteArray(Charsets.UTF_8)) }
            if (connection.responseCode !in 200..299) {
                val detail = connection.errorStream?.bufferedReader()?.use { it.readText() }.orEmpty()
                throw IllegalStateException("Sync failed (${connection.responseCode}): $detail")
            }
        } finally {
            connection.disconnect()
        }
    }

    private fun JSONObject.putNullable(name: String, value: Any?) {
        put(name, value ?: JSONObject.NULL)
    }
}
