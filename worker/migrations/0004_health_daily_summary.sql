CREATE TABLE health_daily_summary (
    device_id TEXT NOT NULL,
    local_date TEXT NOT NULL,
    timezone TEXT NOT NULL,
    collected_at TEXT NOT NULL,
    received_at TEXT NOT NULL,
    steps INTEGER,
    sleep_minutes INTEGER,
    exercise_json TEXT,
    water_milliliters REAL,
    food_energy_kilocalories REAL,
    energy_burned_kilocalories REAL,
    nutrients_json TEXT,
    average_weight_kilograms REAL,
    average_resting_heart_rate_bpm INTEGER,
    source_packages_json TEXT NOT NULL,
    PRIMARY KEY (device_id, local_date, timezone),
    CHECK (length(local_date) = 10),
    CHECK (steps IS NULL OR steps >= 0),
    CHECK (sleep_minutes IS NULL OR sleep_minutes >= 0),
    CHECK (water_milliliters IS NULL OR water_milliliters >= 0),
    CHECK (food_energy_kilocalories IS NULL OR food_energy_kilocalories >= 0),
    CHECK (energy_burned_kilocalories IS NULL OR energy_burned_kilocalories >= 0)
);

CREATE INDEX idx_health_daily_summary_date ON health_daily_summary(local_date DESC);
