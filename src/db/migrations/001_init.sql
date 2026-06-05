-- TriagemAI — initial schema
-- Entities: jobs -> criteria, cvs ; analyses -> candidates -> candidate_scores

CREATE TABLE IF NOT EXISTS jobs (
  id              TEXT PRIMARY KEY,
  job_description TEXT NOT NULL,
  created_at      TEXT NOT NULL
);

-- Criteria belong to a job. The criterion id ("c1", "c2", ...) is unique
-- per job, so the primary key is composite. `position` preserves order.
CREATE TABLE IF NOT EXISTS criteria (
  job_id    TEXT NOT NULL,
  id        TEXT NOT NULL,
  name      TEXT NOT NULL,
  weight    INTEGER NOT NULL CHECK (weight BETWEEN 1 AND 5),
  position  INTEGER NOT NULL,
  PRIMARY KEY (job_id, id),
  FOREIGN KEY (job_id) REFERENCES jobs (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS cvs (
  id             TEXT PRIMARY KEY,
  job_id         TEXT NOT NULL,
  name           TEXT NOT NULL,
  size           INTEGER NOT NULL,
  mime_type      TEXT NOT NULL,
  file_path      TEXT NOT NULL,
  extracted_text TEXT,
  status         TEXT NOT NULL DEFAULT 'uploaded',
  created_at     TEXT NOT NULL,
  FOREIGN KEY (job_id) REFERENCES jobs (id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_cvs_job ON cvs (job_id);

CREATE TABLE IF NOT EXISTS analyses (
  id               TEXT PRIMARY KEY,
  job_id           TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'processing',  -- processing|completed|failed
  stage            TEXT,                                -- parsing|matching|scoring
  progress         INTEGER NOT NULL DEFAULT 0,
  total_candidates INTEGER NOT NULL DEFAULT 0,
  criteria_json    TEXT NOT NULL,                       -- snapshot of criteria used
  error            TEXT,
  created_at       TEXT NOT NULL,
  completed_at     TEXT,
  FOREIGN KEY (job_id) REFERENCES jobs (id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_analyses_job ON analyses (job_id);

CREATE TABLE IF NOT EXISTS candidates (
  id           TEXT PRIMARY KEY,
  analysis_id  TEXT NOT NULL,
  cv_id        TEXT,
  name         TEXT NOT NULL,
  title        TEXT,
  overall      INTEGER NOT NULL,
  band         TEXT NOT NULL,                           -- Recommended|Review|Discard
  FOREIGN KEY (analysis_id) REFERENCES analyses (id) ON DELETE CASCADE,
  FOREIGN KEY (cv_id) REFERENCES cvs (id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_candidates_analysis ON candidates (analysis_id);

CREATE TABLE IF NOT EXISTS candidate_scores (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  candidate_id   TEXT NOT NULL,
  criterion_name TEXT NOT NULL,
  weight         INTEGER NOT NULL,
  score          INTEGER NOT NULL,
  justification  TEXT,
  position       INTEGER NOT NULL,
  FOREIGN KEY (candidate_id) REFERENCES candidates (id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_scores_candidate ON candidate_scores (candidate_id);
