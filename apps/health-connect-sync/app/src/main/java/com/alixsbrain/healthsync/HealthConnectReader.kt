package com.alixsbrain.healthsync

import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.HealthConnectFeatures
import androidx.health.connect.client.aggregate.AggregateMetric
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.ExerciseSessionRecord
import androidx.health.connect.client.records.HydrationRecord
import androidx.health.connect.client.records.NutritionRecord
import androidx.health.connect.client.records.RestingHeartRateRecord
import androidx.health.connect.client.records.SleepSessionRecord
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.records.TotalCaloriesBurnedRecord
import androidx.health.connect.client.records.WeightRecord
import androidx.health.connect.client.request.AggregateRequest
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import androidx.health.connect.client.units.Mass
import java.time.LocalDate
import java.time.ZoneId

class HealthConnectReader(private val client: HealthConnectClient) {
    val requiredPermissions: Set<String> = setOf(
        HealthPermission.getReadPermission(StepsRecord::class),
        HealthPermission.getReadPermission(SleepSessionRecord::class),
        HealthPermission.getReadPermission(ExerciseSessionRecord::class),
        HealthPermission.getReadPermission(NutritionRecord::class),
        HealthPermission.getReadPermission(TotalCaloriesBurnedRecord::class),
        HealthPermission.getReadPermission(HydrationRecord::class),
        HealthPermission.getReadPermission(WeightRecord::class),
        HealthPermission.getReadPermission(RestingHeartRateRecord::class)
    )
    val historyPermission: Set<String> = setOf(HealthPermission.PERMISSION_READ_HEALTH_DATA_HISTORY)

    suspend fun hasRequiredPermissions(): Boolean =
        client.permissionController.getGrantedPermissions().containsAll(requiredPermissions)

    suspend fun hasHistoryPermission(): Boolean =
        client.permissionController.getGrantedPermissions().containsAll(historyPermission)

    fun isHistoryReadAvailable(): Boolean = client.features.getFeatureStatus(
        HealthConnectFeatures.FEATURE_READ_HEALTH_DATA_HISTORY
    ) == HealthConnectFeatures.FEATURE_STATUS_AVAILABLE

    suspend fun readSevenDays(startDate: LocalDate, zoneId: ZoneId): HealthSummary {
        return readRange(startDate, 7, zoneId)
    }

    suspend fun readDay(date: LocalDate, zoneId: ZoneId): HealthSummary = readRange(date, 1, zoneId)

    private suspend fun readRange(startDate: LocalDate, days: Int, zoneId: ZoneId): HealthSummary {
        val endDate = startDate.plusDays(days.toLong())
        val start = startDate.atStartOfDay(zoneId).toInstant()
        val end = endDate.atStartOfDay(zoneId).toInstant()
        val filter = TimeRangeFilter.between(start, end)
        val metrics = buildSet<AggregateMetric<*>> {
            add(StepsRecord.COUNT_TOTAL)
            add(SleepSessionRecord.SLEEP_DURATION_TOTAL)
            add(HydrationRecord.VOLUME_TOTAL)
            add(NutritionRecord.ENERGY_TOTAL)
            add(TotalCaloriesBurnedRecord.ENERGY_TOTAL)
            add(NutritionRecord.ENERGY_FROM_FAT_TOTAL)
            add(WeightRecord.WEIGHT_AVG)
            add(RestingHeartRateRecord.BPM_AVG)
            addAll(nutrientMetrics.values)
        }
        val aggregate = client.aggregate(AggregateRequest(metrics, filter))
        val dailyCoverage = readDailyCoverage(startDate, days, zoneId)
        val exercises = readExercises(filter)
        val sources = aggregate.dataOrigins.mapTo(mutableSetOf()) { it.packageName }
        exercises.mapTo(sources) { it.sourcePackage }

        return HealthSummary(
            startDate = startDate,
            endDateExclusive = endDate,
            steps = aggregate[StepsRecord.COUNT_TOTAL],
            sleepMinutes = aggregate[SleepSessionRecord.SLEEP_DURATION_TOTAL]?.toMinutes(),
            exercises = exercises,
            waterMilliliters = aggregate[HydrationRecord.VOLUME_TOTAL]?.inLiters?.times(1_000),
            energyKilocalories = aggregate[NutritionRecord.ENERGY_TOTAL]?.inKilocalories,
            totalEnergyBurnedKilocalories = aggregate[TotalCaloriesBurnedRecord.ENERGY_TOTAL]?.inKilocalories,
            energyFromFatKilocalories = aggregate[NutritionRecord.ENERGY_FROM_FAT_TOTAL]?.inKilocalories,
            nutrientsGrams = nutrientMetrics.mapNotNull { (name, metric) ->
                aggregate[metric]?.inGrams?.let { name to it }
            }.toMap(),
            averageWeightKilograms = aggregate[WeightRecord.WEIGHT_AVG]?.inKilograms,
            averageRestingHeartRateBpm = aggregate[RestingHeartRateRecord.BPM_AVG],
            sourcePackages = sources,
            daysInRange = days,
            sleepDaysWithData = dailyCoverage.sleep,
            waterDaysWithData = dailyCoverage.water,
            nutritionDaysWithData = dailyCoverage.nutrition
        )
    }

    private data class DailyCoverage(val sleep: Int, val water: Int, val nutrition: Int)

    private suspend fun readDailyCoverage(startDate: LocalDate, days: Int, zoneId: ZoneId): DailyCoverage {
        var sleep = 0
        var water = 0
        var nutrition = 0
        repeat(days) { offset ->
            val day = startDate.plusDays(offset.toLong())
            val filter = TimeRangeFilter.between(
                day.atStartOfDay(zoneId).toInstant(),
                day.plusDays(1).atStartOfDay(zoneId).toInstant()
            )
            val result = client.aggregate(
                AggregateRequest(
                    setOf(
                        SleepSessionRecord.SLEEP_DURATION_TOTAL,
                        HydrationRecord.VOLUME_TOTAL,
                        NutritionRecord.ENERGY_TOTAL
                    ),
                    filter
                )
            )
            if (result[SleepSessionRecord.SLEEP_DURATION_TOTAL] != null) sleep++
            if (result[HydrationRecord.VOLUME_TOTAL] != null) water++
            if (result[NutritionRecord.ENERGY_TOTAL] != null) nutrition++
        }
        return DailyCoverage(sleep, water, nutrition)
    }

    private suspend fun readExercises(filter: TimeRangeFilter): List<ExerciseSummary> {
        val records = mutableListOf<ExerciseSummary>()
        var pageToken: String? = null
        do {
            val response = client.readRecords(
                ReadRecordsRequest(
                    recordType = ExerciseSessionRecord::class,
                    timeRangeFilter = filter,
                    pageToken = pageToken
                )
            )
            response.records.mapTo(records) {
                ExerciseSummary(it.startTime, it.endTime, it.exerciseType, it.metadata.dataOrigin.packageName)
            }
            pageToken = response.pageToken
        } while (pageToken != null)
        return records.sortedBy { it.startTime }
    }

    companion object {
        val nutrientMetrics: Map<String, AggregateMetric<Mass>> = linkedMapOf(
            "Biotin" to NutritionRecord.BIOTIN_TOTAL,
            "Caffeine" to NutritionRecord.CAFFEINE_TOTAL,
            "Calcium" to NutritionRecord.CALCIUM_TOTAL,
            "Chloride" to NutritionRecord.CHLORIDE_TOTAL,
            "Cholesterol" to NutritionRecord.CHOLESTEROL_TOTAL,
            "Chromium" to NutritionRecord.CHROMIUM_TOTAL,
            "Copper" to NutritionRecord.COPPER_TOTAL,
            "Dietary fiber" to NutritionRecord.DIETARY_FIBER_TOTAL,
            "Folate" to NutritionRecord.FOLATE_TOTAL,
            "Folic acid" to NutritionRecord.FOLIC_ACID_TOTAL,
            "Iodine" to NutritionRecord.IODINE_TOTAL,
            "Iron" to NutritionRecord.IRON_TOTAL,
            "Magnesium" to NutritionRecord.MAGNESIUM_TOTAL,
            "Manganese" to NutritionRecord.MANGANESE_TOTAL,
            "Molybdenum" to NutritionRecord.MOLYBDENUM_TOTAL,
            "Monounsaturated fat" to NutritionRecord.MONOUNSATURATED_FAT_TOTAL,
            "Niacin" to NutritionRecord.NIACIN_TOTAL,
            "Pantothenic acid" to NutritionRecord.PANTOTHENIC_ACID_TOTAL,
            "Phosphorus" to NutritionRecord.PHOSPHORUS_TOTAL,
            "Polyunsaturated fat" to NutritionRecord.POLYUNSATURATED_FAT_TOTAL,
            "Potassium" to NutritionRecord.POTASSIUM_TOTAL,
            "Protein" to NutritionRecord.PROTEIN_TOTAL,
            "Riboflavin" to NutritionRecord.RIBOFLAVIN_TOTAL,
            "Saturated fat" to NutritionRecord.SATURATED_FAT_TOTAL,
            "Selenium" to NutritionRecord.SELENIUM_TOTAL,
            "Sodium" to NutritionRecord.SODIUM_TOTAL,
            "Sugar" to NutritionRecord.SUGAR_TOTAL,
            "Thiamin" to NutritionRecord.THIAMIN_TOTAL,
            "Total carbohydrate" to NutritionRecord.TOTAL_CARBOHYDRATE_TOTAL,
            "Total fat" to NutritionRecord.TOTAL_FAT_TOTAL,
            "Trans fat" to NutritionRecord.TRANS_FAT_TOTAL,
            "Unsaturated fat" to NutritionRecord.UNSATURATED_FAT_TOTAL,
            "Vitamin A" to NutritionRecord.VITAMIN_A_TOTAL,
            "Vitamin B12" to NutritionRecord.VITAMIN_B12_TOTAL,
            "Vitamin B6" to NutritionRecord.VITAMIN_B6_TOTAL,
            "Vitamin C" to NutritionRecord.VITAMIN_C_TOTAL,
            "Vitamin D" to NutritionRecord.VITAMIN_D_TOTAL,
            "Vitamin E" to NutritionRecord.VITAMIN_E_TOTAL,
            "Vitamin K" to NutritionRecord.VITAMIN_K_TOTAL,
            "Zinc" to NutritionRecord.ZINC_TOTAL
        )
    }
}
