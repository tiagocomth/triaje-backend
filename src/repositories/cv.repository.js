import { getDb } from '../db/connection.js';

export function createCv(cv) {
  getDb()
    .prepare(
      `INSERT INTO cvs (id, job_id, name, size, mime_type, file_path, extracted_text, status, created_at)
       VALUES (@id, @jobId, @name, @size, @mimeType, @filePath, @extractedText, @status, @createdAt)`,
    )
    .run(cv);
}

export function findCvById(id) {
  return getDb().prepare('SELECT * FROM cvs WHERE id = ?').get(id);
}

/** Fetch multiple CVs by id, scoped to a job. Returns rows in input order. */
export function findCvsByIds(jobId, ids) {
  if (ids.length === 0) return [];
  const placeholders = ids.map(() => '?').join(',');
  const rows = getDb()
    .prepare(`SELECT * FROM cvs WHERE job_id = ? AND id IN (${placeholders})`)
    .all(jobId, ...ids);
  const byId = new Map(rows.map((r) => [r.id, r]));
  return ids.map((id) => byId.get(id)).filter(Boolean);
}

export default { createCv, findCvById, findCvsByIds };
