import { getDb } from '../db/connection.js';

/** Persists a job and its criteria atomically. `criteria` = [{id,name,weight}]. */
export function createJob({ id, jobDescription, criteria, createdAt }) {
  const db = getDb();
  const insertJob = db.prepare(
    'INSERT INTO jobs (id, job_description, created_at) VALUES (?, ?, ?)',
  );
  const insertCriterion = db.prepare(
    'INSERT INTO criteria (job_id, id, name, weight, position) VALUES (?, ?, ?, ?, ?)',
  );

  db.transaction(() => {
    insertJob.run(id, jobDescription, createdAt);
    criteria.forEach((c, i) => insertCriterion.run(id, c.id, c.name, c.weight, i));
  })();
}

export function findJobById(id) {
  return getDb().prepare('SELECT * FROM jobs WHERE id = ?').get(id);
}

export function findCriteriaByJobId(jobId) {
  return getDb()
    .prepare(
      'SELECT id, name, weight FROM criteria WHERE job_id = ? ORDER BY position',
    )
    .all(jobId);
}

/** Replaces the full criteria set for a job (used by PATCH). */
export function replaceCriteria(jobId, criteria) {
  const db = getDb();
  const del = db.prepare('DELETE FROM criteria WHERE job_id = ?');
  const insert = db.prepare(
    'INSERT INTO criteria (job_id, id, name, weight, position) VALUES (?, ?, ?, ?, ?)',
  );
  db.transaction(() => {
    del.run(jobId);
    criteria.forEach((c, i) => insert.run(jobId, c.id, c.name, c.weight, i));
  })();
}

export default { createJob, findJobById, findCriteriaByJobId, replaceCriteria };
