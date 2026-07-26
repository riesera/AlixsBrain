package com.alixsbrain.healthsync

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.LocalDate

class HealthSummaryTextTest {
    @Test
    fun `renders missing distinctly from zero and formats micronutrients`() {
        val text = HealthSummaryText.render(
            HealthSummary(
                startDate = LocalDate.of(2026, 7, 20),
                endDateExclusive = LocalDate.of(2026, 7, 27),
                steps = 0,
                sleepMinutes = null,
                exercises = emptyList(),
                waterMilliliters = null,
                energyKilocalories = null,
                totalEnergyBurnedKilocalories = null,
                energyFromFatKilocalories = null,
                nutrientsGrams = mapOf("Protein" to 700.0, "Iron" to 0.012),
                averageWeightKilograms = null,
                averageRestingHeartRateBpm = null,
                sourcePackages = setOf("com.example.source"),
                sleepDaysWithData = 0,
                waterDaysWithData = 0,
                nutritionDaysWithData = 0
            )
        )

        assertTrue(text.contains("Steps — 7-day total: 0"))
        assertTrue(text.contains("Sleep — 7-day total: Missing"))
        assertTrue(text.contains("Iron: 12.00 mg"))
        assertTrue(text.contains("Protein: 700.00 g"))
        assertTrue(text.contains("com.example.source"))
        assertFalse(text.contains("Sleep — 7-day total: 0"))
    }

    @Test
    fun `states that the proof of concept does not upload`() {
        val text = HealthSummaryText.render(
            HealthSummary(
                LocalDate.of(2026, 7, 20), LocalDate.of(2026, 7, 27),
                null, null, emptyList(), null, null, null, null, emptyMap(), null, null, emptySet()
            )
        )
        assertTrue(text.contains("No data was uploaded"))
        assertTrue(text.contains("does not mean zero"))
        assertTrue(text.contains("not calories burned"))
    }

    @Test
    fun `labels totals and exposes logging coverage`() {
        val text = HealthSummaryText.render(
            HealthSummary(
                LocalDate.of(2026, 7, 20), LocalDate.of(2026, 7, 27),
                47_208, 2_400, listOf(ExerciseSummary(java.time.Instant.EPOCH, java.time.Instant.EPOCH.plusSeconds(1800), 74, "source")), 3_000.0, 3_447.0, 14_000.0, null,
                emptyMap(), null, null, emptySet(),
                sleepDaysWithData = 5, waterDaysWithData = 3, nutritionDaysWithData = 2
            )
        )
        assertTrue(text.contains("Steps — 7-day total: 47208"))
        assertTrue(text.contains("Steps — average per calendar day: 6744"))
        assertTrue(text.contains("Food energy consumed/logged — 7-day total: 3447 kcal"))
        assertTrue(text.contains("Food energy — average per logged day: 1724 kcal"))
        assertTrue(text.contains("Food logging coverage: 2/7 days"))
        assertTrue(text.contains("Energy burned (basal + active) — 7-day total: 14000 kcal"))
        assertTrue(text.contains("Logged energy balance (food minus burned): -10553 kcal"))
        assertTrue(text.contains("Pool swimming: 30 minutes"))
    }


    @Test
    fun `maps known exercise types and preserves unknown code`() {
        assertTrue(ExerciseTypeNames.name(79) == "Walking")
        assertTrue(ExerciseTypeNames.name(74) == "Pool swimming")
        assertTrue(ExerciseTypeNames.name(999).contains("999"))
    }
}
