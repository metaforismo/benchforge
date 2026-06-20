CREATE TABLE IF NOT EXISTS challenges (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  version TEXT NOT NULL,
  score_direction TEXT NOT NULL CHECK (score_direction IN ('minimize', 'maximize')),
  primary_metric TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS submissions (
  id TEXT PRIMARY KEY,
  challenge_id TEXT NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  candidate_score REAL,
  candidate_metrics_json TEXT,
  files_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT
);

CREATE INDEX IF NOT EXISTS submissions_challenge_status_idx
  ON submissions (challenge_id, status);

CREATE TABLE IF NOT EXISTS runs (
  id TEXT PRIMARY KEY,
  challenge_id TEXT NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  submission_id TEXT REFERENCES submissions(id) ON DELETE SET NULL,
  status TEXT NOT NULL CHECK (status IN ('verified', 'promoted', 'replicated')),
  score REAL NOT NULL,
  metrics_json TEXT NOT NULL,
  verifier_kind TEXT NOT NULL,
  verifier_trusted INTEGER NOT NULL CHECK (verifier_trusted IN (0, 1)),
  receipt_hash TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS runs_challenge_score_idx
  ON runs (challenge_id, score);

CREATE INDEX IF NOT EXISTS runs_challenge_created_idx
  ON runs (challenge_id, created_at);

CREATE TABLE IF NOT EXISTS verifier_results (
  run_id TEXT PRIMARY KEY REFERENCES runs(id) ON DELETE CASCADE,
  challenge_id TEXT NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  submission_id TEXT NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS notes (
  id TEXT PRIMARY KEY,
  challenge_id TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  author TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS notes_challenge_created_idx
  ON notes (challenge_id, created_at);

CREATE TABLE IF NOT EXISTS cli_events (
  id TEXT PRIMARY KEY,
  challenge_id TEXT,
  event_name TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS cli_events_challenge_created_idx
  ON cli_events (challenge_id, created_at);
