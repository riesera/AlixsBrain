export interface DailyHealthRow {
  local_date: string;
  collected_at: string;
  received_at: string;
  steps: number | null;
  sleep_minutes: number | null;
  exercise: Record<string, { sessions: number; minutes: number }>;
  water_milliliters: number | null;
  food_energy_kilocalories: number | null;
  energy_burned_kilocalories: number | null;
  nutrients: Record<string, number>;
  average_weight_kilograms: number | null;
  average_resting_heart_rate_bpm: number | null;
  source_packages: string[];
}

type Metric = { coverage_days: number; total: number | null; average_recorded_day: number | null; minimum: number | null; maximum: number | null };

const parseObject = <T>(value: unknown, fallback: T): T => {
  if (typeof value !== "string") return fallback;
  try { return JSON.parse(value) as T; } catch { return fallback; }
};

const metric = (values: Array<number | null>): Metric => {
  const present = values.filter((value): value is number => value !== null);
  const total = present.length ? present.reduce((sum, value) => sum + value, 0) : null;
  return {
    coverage_days: present.length,
    total,
    average_recorded_day: total === null ? null : total / present.length,
    minimum: present.length ? Math.min(...present) : null,
    maximum: present.length ? Math.max(...present) : null
  };
};

const averageMetric = (values: Array<number | null>) => {
  const result = metric(values);
  return { coverage_days: result.coverage_days, average: result.average_recorded_day, minimum: result.minimum, maximum: result.maximum };
};

export function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

const localToday = (timezone: string): string => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
};

export async function readWeeklyHealthSummary(db: D1Database, weekStart: string, timezone: string) {
  const weekEndExclusive = addDays(weekStart, 7);
  const result = await db.prepare(`
    SELECT * FROM health_daily_summary
    WHERE local_date >= ? AND local_date < ? AND timezone = ?
    ORDER BY local_date ASC, received_at DESC
  `).bind(weekStart, weekEndExclusive, timezone).all<Record<string, unknown>>();

  const deviceCount = new Set(result.results.map(row => String(row.device_id))).size;
  const byDate = new Map<string, Record<string, unknown>>();
  for (const row of result.results) {
    const date = String(row.local_date);
    if (!byDate.has(date)) byDate.set(date, row);
  }
  const days: DailyHealthRow[] = [...byDate.values()].map(row => ({
    local_date: String(row.local_date),
    collected_at: String(row.collected_at),
    received_at: String(row.received_at),
    steps: row.steps as number | null,
    sleep_minutes: row.sleep_minutes as number | null,
    exercise: parseObject(row.exercise_json, {}),
    water_milliliters: row.water_milliliters as number | null,
    food_energy_kilocalories: row.food_energy_kilocalories as number | null,
    energy_burned_kilocalories: row.energy_burned_kilocalories as number | null,
    nutrients: parseObject(row.nutrients_json, {}),
    average_weight_kilograms: row.average_weight_kilograms as number | null,
    average_resting_heart_rate_bpm: row.average_resting_heart_rate_bpm as number | null,
    source_packages: parseObject(row.source_packages_json, [])
  }));

  const exercises: Record<string, { sessions: number; minutes: number; coverage_days: number }> = {};
  const nutrients: Record<string, { total: number; coverage_days: number; average_logged_day: number }> = {};
  const sources = new Set<string>();
  for (const day of days) {
    day.source_packages.forEach(source => sources.add(source));
    for (const [name, value] of Object.entries(day.exercise)) {
      const current = exercises[name] ?? { sessions: 0, minutes: 0, coverage_days: 0 };
      current.sessions += value.sessions;
      current.minutes += value.minutes;
      current.coverage_days += 1;
      exercises[name] = current;
    }
    for (const [name, value] of Object.entries(day.nutrients)) {
      const current = nutrients[name] ?? { total: 0, coverage_days: 0, average_logged_day: 0 };
      current.total += value;
      current.coverage_days += 1;
      current.average_logged_day = current.total / current.coverage_days;
      nutrients[name] = current;
    }
  }

  const food = metric(days.map(day => day.food_energy_kilocalories));
  const burned = metric(days.map(day => day.energy_burned_kilocalories));
  const warnings: string[] = [];
  if (days.length < 7) warnings.push(`Only ${days.length} of 7 requested dates have stored summaries.`);
  if (food.coverage_days < 7) warnings.push(`Food energy was logged on ${food.coverage_days} of 7 days; do not interpret the weekly energy balance as complete.`);
  if (burned.coverage_days < 7) warnings.push(`Energy burned is available on ${burned.coverage_days} of 7 days.`);
  if (deviceCount > 1) warnings.push("More than one device supplied this range; the most recently received summary for each date was used.");
  if (weekEndExclusive > localToday(timezone)) warnings.push("This range includes today or a future date; those daily values may be incomplete.");

  return {
    week_start: weekStart,
    week_end: addDays(weekStart, 6),
    timezone,
    retrieved_at: new Date().toISOString(),
    coverage: { requested_days: 7, stored_days: days.length, device_count: deviceCount },
    metrics: {
      steps: metric(days.map(day => day.steps)),
      sleep_minutes: metric(days.map(day => day.sleep_minutes)),
      water_milliliters: metric(days.map(day => day.water_milliliters)),
      food_energy_kilocalories: food,
      energy_burned_kilocalories: burned,
      energy_balance_kilocalories: food.coverage_days === 7 && burned.coverage_days === 7
        ? (food.total as number) - (burned.total as number) : null,
      weight_kilograms: averageMetric(days.map(day => day.average_weight_kilograms)),
      resting_heart_rate_bpm: averageMetric(days.map(day => day.average_resting_heart_rate_bpm))
    },
    exercises,
    nutrients,
    source_packages: [...sources].sort(),
    warnings,
    days
  };
}

export type WeeklyHealthSummary = Awaited<ReturnType<typeof readWeeklyHealthSummary>>;
