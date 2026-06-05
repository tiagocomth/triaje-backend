import { getDb } from '../db/connection.js';

export function createAnalysis(analysis) {
  getDb()
    .prepare(
      `INSERT INTO analyses (id, job_id, status, stage, progress, total_candidates, criteria_json, created_at)
       VALUES (@id, @jobId, @status, @stage, @progress, @totalCandidates, @criteriaJson, @createdAt)`,
    )
    .run(analysis);
}

export function findAnalysisById(id) {
  return getDb().prepare('SELECT * FROM analyses WHERE id = ?').get(id);
}

/** Update progress fields during processing. */
export function updateProgress(id, { stage, progress }) {
  getDb()
    .prepare('UPDATE analyses SET stage = ?, progress = ? WHERE id = ?')
    .run(stage, progress, id);
}

export function markCompleted(id, completedAt) {
  getDb()
    .prepare(
      `UPDATE analyses SET status = 'completed', stage = 'scoring', progress = 100, completed_at = ? WHERE id = ?`,
    )
    .run(completedAt, id);
}

export function markFailed(id, error) {
  getDb()
    .prepare(`UPDATE analyses SET status = 'failed', error = ? WHERE id = ?`)
    .run(error, id);
}

/** Persist all candidates + their score breakdowns for an analysis. */
export function saveCandidates(analysisId, candidates) {
  const db = getDb();
  const insertCandidate = db.prepare(
    `INSERT INTO candidates (id, analysis_id, cv_id, name, title, overall, band)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );
  const insertScore = db.prepare(
    `INSERT INTO candidate_scores (candidate_id, criterion_name, weight, score, justification, position)
     VALUES (?, ?, ?, ?, ?, ?)`,
  );

  db.transaction(() => {
    for (const cand of candidates) {
      insertCandidate.run(
        cand.id,
        analysisId,
        cand.cvId ?? null,
        cand.name,
        cand.title,
        cand.overall,
        cand.band,
      );
      cand.breakdown.forEach((b, i) =>
        insertScore.run(cand.id, b.name, b.weight, b.score, b.justification, i),
      );
    }
  })();
}

/** Load candidates with breakdowns, ordered overall desc, then name asc. */
export function findCandidatesByAnalysisId(analysisId) {
  const db = getDb();
  const candidates = db
    .prepare(
      `SELECT id, name, title, overall, band FROM candidates
       WHERE analysis_id = ? ORDER BY overall DESC, name ASC`,
    )
    .all(analysisId);

  const scoreStmt = db.prepare(
    `SELECT criterion_name AS name, weight, score, justification
     FROM candidate_scores WHERE candidate_id = ? ORDER BY position`,
  );

  return candidates.map((c) => ({
    id: c.id,
    name: c.name,
    title: c.title,
    overall: c.overall,
    band: c.band,
    breakdown: scoreStmt.all(c.id),
  }));
}

export default {
  createAnalysis,
  findAnalysisById,
  updateProgress,
  markCompleted,
  markFailed,
  saveCandidates,
  findCandidatesByAnalysisId,
};
