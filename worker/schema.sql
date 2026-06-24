-- D1 schema for the benefitoffers sync worker.
-- Apply with:  wrangler d1 execute benefitoffers --remote --file=./schema.sql

-- Single-row key/value store for the SimpleFIN access URL (the secret that can
-- read your transactions) and sync bookkeeping.
CREATE TABLE IF NOT EXISTS kv (
  key   TEXT PRIMARY KEY,
  value TEXT
);

-- Cached raw SimpleFIN `/accounts` JSON from the most recent successful pull.
-- We keep just the latest snapshot; the app diffs/dedupes client-side.
CREATE TABLE IF NOT EXISTS snapshot (
  id         INTEGER PRIMARY KEY CHECK (id = 1),
  json       TEXT,
  fetched_at INTEGER
);
