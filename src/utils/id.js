import { randomBytes } from 'node:crypto';

/** Short, URL-safe, lowercase hex token (default 8 chars). */
function token(length = 8) {
  return randomBytes(Math.ceil(length / 2))
    .toString('hex')
    .slice(0, length);
}

export const newJobId = () => `job_${token(8)}`;
export const newCvId = () => `cv_${token(6)}`;
export const newAnalysisId = () => `ana_${token(6)}`;
export const newCandidateId = () => `cand_${token(8)}`;

/** Sequential criterion id: criterionId(0) -> "c1", criterionId(1) -> "c2". */
export const criterionId = (index) => `c${index + 1}`;
