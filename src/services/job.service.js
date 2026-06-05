import AppError from '../utils/AppError.js';
import { newJobId, criterionId } from '../utils/id.js';
import * as ai from './ai/index.js';
import jobRepo from '../repositories/job.repository.js';

const MIN_JD_LENGTH = 30;

/** Fetch a job (with criteria) or throw 404. */
export function getJobOrThrow(jobId) {
  const job = jobRepo.findJobById(jobId);
  if (!job) throw AppError.notFound(`Job not found: ${jobId}`);
  return {
    id: job.id,
    jobDescription: job.job_description,
    criteria: jobRepo.findCriteriaByJobId(jobId),
    createdAt: job.created_at,
  };
}

/**
 * Extract weighted criteria from a JD via the AI service, persist a new job,
 * and return it. Throws 422 when the JD is too short or yields no criteria.
 */
export async function extractCriteria(jobDescription) {
  if (jobDescription.trim().length < MIN_JD_LENGTH) {
    throw AppError.unprocessable(
      'Job description is too short to extract meaningful criteria',
      { code: 'JD_TOO_SHORT' },
    );
  }

  let raw;
  try {
    raw = await ai.extractCriteria(jobDescription);
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError(502, 'Failed to extract criteria', { cause: err });
  }

  if (!raw || raw.length === 0) {
    throw AppError.unprocessable('No criteria could be extracted from this job description', {
      code: 'NO_CRITERIA',
    });
  }

  // Assign stable sequential ids (c1, c2, …).
  const criteria = raw.map((c, i) => ({ id: criterionId(i), name: c.name, weight: c.weight }));

  const id = newJobId();
  const createdAt = new Date().toISOString();
  jobRepo.createJob({ id, jobDescription, criteria, createdAt });

  return { jobId: id, criteria };
}

/** Replace a job's criteria (PATCH). Returns { jobId, updatedAt }. */
export function updateCriteria(jobId, criteria) {
  getJobOrThrow(jobId); // 404 if missing
  jobRepo.replaceCriteria(jobId, criteria);
  return { jobId, updatedAt: new Date().toISOString() };
}

export default { getJobOrThrow, extractCriteria, updateCriteria };
