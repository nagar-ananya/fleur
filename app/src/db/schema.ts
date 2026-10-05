export const DATABASE_NAME = 'fleur.db';

export const SCHEMA_VERSION = 4;

export const TABLE_NAMES = [
  'profile',
  'checkin',
  'environment',
  'wearable',
  'prediction',
  'journal_entry',
  'ai_opinion',
] as const;

const CREATE_META = `
CREATE TABLE IF NOT EXISTS meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);`;

const CREATE_PROFILE = `
CREATE TABLE IF NOT EXISTS profile (
  id                INTEGER PRIMARY KEY CHECK (id = 1),
  psoriasis_type    TEXT NOT NULL,
  onset_year        INTEGER,
  on_systemic       INTEGER NOT NULL DEFAULT 0,
  latitude          REAL,
  longitude         REAL,
  city_label        TEXT,
  disclaimer_ack_at TEXT NOT NULL,
  created_at        TEXT NOT NULL
);`;

const CREATE_CHECKIN = `
CREATE TABLE IF NOT EXISTS checkin (
  date              TEXT PRIMARY KEY,
  severity          INTEGER NOT NULL CHECK (severity BETWEEN 0 AND 10),
  itch              INTEGER CHECK (itch BETWEEN 0 AND 10),
  stress            INTEGER CHECK (stress BETWEEN 0 AND 10),
  sleep_hours       REAL    CHECK (sleep_hours BETWEEN 0 AND 16),
  water_glasses     INTEGER CHECK (water_glasses BETWEEN 0 AND 25),
  alcohol_units     REAL    CHECK (alcohol_units BETWEEN 0 AND 20),
  diet_dairy        INTEGER DEFAULT 0,
  diet_gluten       INTEGER DEFAULT 0,
  diet_processed    INTEGER DEFAULT 0,
  diet_sugar        INTEGER DEFAULT 0,
  diet_red_meat     INTEGER DEFAULT 0,
  illness           INTEGER DEFAULT 0,
  sore_throat       INTEGER DEFAULT 0,
  skin_injury       INTEGER DEFAULT 0,
  new_product       INTEGER DEFAULT 0,
  med_taken         INTEGER DEFAULT 0,
  notes             TEXT,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL
);`;

const CREATE_ENVIRONMENT = `
CREATE TABLE IF NOT EXISTS environment (
  date              TEXT PRIMARY KEY,
  temp_mean_c       REAL,
  temp_min_c        REAL,
  temp_max_c        REAL,
  humidity_mean_pct REAL,
  dew_point_c       REAL,
  pressure_hpa      REAL,
  uv_index_max      REAL,
  precipitation_mm  REAL,
  wind_speed_max    REAL,
  pm2_5             REAL,
  pm10              REAL,
  ozone             REAL,
  pollen_total      REAL,
  is_forecast       INTEGER NOT NULL DEFAULT 0,
  fetched_at        TEXT NOT NULL
);`;

const CREATE_WEARABLE = `
CREATE TABLE IF NOT EXISTS wearable (
  date              TEXT PRIMARY KEY,
  sleep_hours       REAL,
  sleep_efficiency  REAL,
  resting_hr        REAL,
  steps             INTEGER,
  source            TEXT,
  fetched_at        TEXT NOT NULL
);`;

const CREATE_PREDICTION = `
CREATE TABLE IF NOT EXISTS prediction (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  computed_at       TEXT NOT NULL,
  for_date          TEXT NOT NULL,
  probability       REAL NOT NULL,
  band              TEXT NOT NULL,
  model_version     TEXT NOT NULL,
  top_features      TEXT NOT NULL
);`;

const CREATE_JOURNAL_ENTRY = `
CREATE TABLE IF NOT EXISTS journal_entry (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  date              TEXT NOT NULL,
  body              TEXT NOT NULL,
  created_at        TEXT NOT NULL
);`;

const CREATE_AI_OPINION = `
CREATE TABLE IF NOT EXISTS ai_opinion (
  date              TEXT PRIMARY KEY,
  score             INTEGER NOT NULL,
  band              TEXT NOT NULL,
  factor_ids        TEXT NOT NULL,
  summary           TEXT NOT NULL,
  model             TEXT NOT NULL,
  created_at        TEXT NOT NULL
);`;

export const MIGRATIONS: readonly string[][] = [
  [
    CREATE_META,
    CREATE_PROFILE,
    CREATE_CHECKIN,
    CREATE_ENVIRONMENT,
    CREATE_WEARABLE,
    CREATE_PREDICTION,
    'CREATE INDEX IF NOT EXISTS idx_checkin_date ON checkin(date DESC);',
    'CREATE INDEX IF NOT EXISTS idx_prediction_for_date ON prediction(for_date DESC);',
  ],
  [
    'ALTER TABLE checkin ADD COLUMN areas TEXT;',
    CREATE_JOURNAL_ENTRY,
    'CREATE INDEX IF NOT EXISTS idx_journal_date ON journal_entry(date DESC);',
  ],
  ['ALTER TABLE wearable ADD COLUMN hrv REAL;'],
  [
    "ALTER TABLE prediction ADD COLUMN source TEXT NOT NULL DEFAULT 'local';",
    CREATE_AI_OPINION,
  ],
];

export const DROP_ALL = [
  ...TABLE_NAMES.map((name) => `DROP TABLE IF EXISTS ${name};`),
  'DROP TABLE IF EXISTS meta;',
];
