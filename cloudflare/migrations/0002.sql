-- D1 schema for daily aggregated stats
CREATE TABLE IF NOT EXISTS stats_daily (
  date TEXT PRIMARY KEY,
  cars_washed INTEGER NOT NULL DEFAULT 0,
  total_revenue REAL NOT NULL DEFAULT 0,
  rain_probability REAL
);

CREATE INDEX IF NOT EXISTS idx_stats_daily_date ON stats_daily (date);
