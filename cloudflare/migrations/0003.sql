-- D1 schema for water consumption history
CREATE TABLE IF NOT EXISTS water_consumption (
  date TEXT PRIMARY KEY,
  volume_liters REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_water_consumption_date ON water_consumption (date);
