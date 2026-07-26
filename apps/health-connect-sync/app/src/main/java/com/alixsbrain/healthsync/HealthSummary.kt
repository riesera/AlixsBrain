package com.alixsbrain.healthsync

import java.time.Instant
import java.time.LocalDate

data class ExerciseSummary(
    val startTime: Instant,
    val endTime: Instant,
    val exerciseType: Int,
    val sourcePackage: String
)

data class HealthSummary(
    val startDate: LocalDate,
    val endDateExclusive: LocalDate,
    val steps: Long?,
    val sleepMinutes: Long?,
    val exercises: List<ExerciseSummary>,
    val waterMilliliters: Double?,
    val energyKilocalories: Double?,
    val totalEnergyBurnedKilocalories: Double? = null,
    val energyFromFatKilocalories: Double?,
    val nutrientsGrams: Map<String, Double>,
    val averageWeightKilograms: Double?,
    val averageRestingHeartRateBpm: Long?,
    val sourcePackages: Set<String>,
    val daysInRange: Int = 7,
    val sleepDaysWithData: Int = 0,
    val waterDaysWithData: Int = 0,
    val nutritionDaysWithData: Int = 0
)

object HealthSummaryText {
    fun render(summary: HealthSummary): String = buildString {
        appendLine("LOCAL HEALTH CONNECT PROOF OF CONCEPT")
        appendLine("${summary.startDate} through ${summary.endDateExclusive.minusDays(1)} (${summary.daysInRange} calendar days)")
        appendLine("No data was uploaded from this phone.")
        appendLine()
        appendMetric("Steps — ${summary.daysInRange}-day total", summary.steps?.toString())
        appendMetric("Steps — average per calendar day", summary.steps?.let { "%.0f".format(it.toDouble() / summary.daysInRange) })
        appendMetric("Sleep — ${summary.daysInRange}-day total", summary.sleepMinutes?.let { "$it minutes" })
        appendMetric("Sleep — average per day with data", average(summary.sleepMinutes?.toDouble(), summary.sleepDaysWithData, "minutes"))
        appendLine("Sleep coverage: ${summary.sleepDaysWithData}/${summary.daysInRange} days")
        appendMetric("Exercise sessions — ${summary.daysInRange}-day total", summary.exercises.size.toString())
        appendMetric("Water logged — ${summary.daysInRange}-day total", summary.waterMilliliters?.let { "%.0f mL".format(it) })
        appendMetric("Water — average per logged day", average(summary.waterMilliliters, summary.waterDaysWithData, "mL"))
        appendLine("Water logging coverage: ${summary.waterDaysWithData}/${summary.daysInRange} days")
        appendMetric("Food energy consumed/logged — ${summary.daysInRange}-day total", summary.energyKilocalories?.let { "%.0f kcal".format(it) })
        appendMetric("Food energy — average per logged day", average(summary.energyKilocalories, summary.nutritionDaysWithData, "kcal"))
        appendLine("Food logging coverage: ${summary.nutritionDaysWithData}/${summary.daysInRange} days")
        appendMetric("Energy burned (basal + active) — ${summary.daysInRange}-day total", summary.totalEnergyBurnedKilocalories?.let { "%.0f kcal".format(it) })
        appendMetric(
            "Logged energy balance (food minus burned)",
            if (summary.energyKilocalories == null || summary.totalEnergyBurnedKilocalories == null) null
            else "%+.0f kcal".format(summary.energyKilocalories - summary.totalEnergyBurnedKilocalories)
        )
        appendMetric("Energy from logged fat — ${summary.daysInRange}-day total", summary.energyFromFatKilocalories?.let { "%.0f kcal".format(it) })
        appendMetric("Average weight", summary.averageWeightKilograms?.let { "%.2f kg".format(it) })
        appendMetric("Average resting heart rate", summary.averageRestingHeartRateBpm?.let { "$it bpm" })

        appendLine()
        appendLine("NUTRITION")
        if (summary.nutrientsGrams.isEmpty()) appendLine("No nutrient values returned.")
        else summary.nutrientsGrams.toSortedMap().forEach { (name, grams) ->
            val display = if (grams < 0.1) "%.2f mg".format(grams * 1_000) else "%.2f g".format(grams)
            appendLine("$name: $display")
        }

        appendLine()
        appendLine("EXERCISE")
        if (summary.exercises.isEmpty()) appendLine("No exercise sessions returned.")
        else summary.exercises.forEach { exercise ->
            val minutes = java.time.Duration.between(exercise.startTime, exercise.endTime).toMinutes()
            appendLine("${ExerciseTypeNames.name(exercise.exerciseType)}: $minutes minutes (${exercise.sourcePackage})")
        }

        appendLine()
        appendLine("SOURCE COVERAGE")
        if (summary.sourcePackages.isEmpty()) appendLine("No source packages returned.")
        else summary.sourcePackages.sorted().forEach(::appendLine)
        appendLine()
        appendLine("Missing means Health Connect did not return a value; it does not mean zero.")
        appendLine("Food energy is calories consumed from nutrition logs. It is not calories burned.")
        appendLine("Energy balance is only meaningful when food logging coverage is complete.")
    }

    private fun average(total: Double?, count: Int, unit: String): String? =
        if (total == null || count == 0) null else "%.0f %s".format(total / count, unit)

    private fun StringBuilder.appendMetric(label: String, value: String?) {
        appendLine("$label: ${value ?: "Missing"}")
    }
}

object ExerciseTypeNames {
    private val names = mapOf(
        0 to "Other workout", 2 to "Badminton", 4 to "Baseball", 5 to "Basketball",
        8 to "Biking", 9 to "Stationary biking", 10 to "Boot camp", 11 to "Boxing",
        13 to "Calisthenics", 14 to "Cricket", 16 to "Dancing", 25 to "Elliptical",
        26 to "Exercise class", 27 to "Fencing", 28 to "American football",
        29 to "Australian football", 31 to "Disc frisbee", 32 to "Golf",
        33 to "Guided breathing", 34 to "Gymnastics", 35 to "Handball", 36 to "HIIT",
        37 to "Hiking", 38 to "Ice hockey", 39 to "Ice skating", 44 to "Martial arts",
        46 to "Paddling", 47 to "Paragliding", 48 to "Pilates", 50 to "Racquetball",
        51 to "Rock climbing", 52 to "Roller hockey", 53 to "Rowing",
        54 to "Rowing machine", 55 to "Rugby", 56 to "Running", 57 to "Treadmill running",
        58 to "Sailing", 59 to "Scuba diving", 60 to "Skating", 61 to "Skiing",
        62 to "Snowboarding", 63 to "Snowshoeing", 64 to "Soccer", 65 to "Softball",
        66 to "Squash", 68 to "Stair climbing", 69 to "Stair-climbing machine",
        70 to "Strength training", 71 to "Stretching", 72 to "Surfing",
        73 to "Open-water swimming", 74 to "Pool swimming", 75 to "Table tennis",
        76 to "Tennis", 78 to "Volleyball", 79 to "Walking", 80 to "Water polo",
        81 to "Weightlifting", 82 to "Wheelchair exercise", 83 to "Yoga"
    )

    fun name(type: Int): String = names[type] ?: "Other/unknown exercise (type $type)"
}
