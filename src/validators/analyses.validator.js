import AppError from '../utils/AppError.js';
import { validateCriteriaArray } from './jobs.validator.js';

/** POST /jobs/:jobId/analyze */
export function validateAnalyze(body) {
  const { fileIds } = body ?? {};
  if (!Array.isArray(fileIds) || fileIds.length === 0) {
    throw AppError.badRequest('fileIds must be a non-empty array');
  }
  if (!fileIds.every((id) => typeof id === 'string' && id.trim())) {
    throw AppError.badRequest('every fileId must be a non-empty string');
  }
  const criteria = validateCriteriaArray(body?.criteria);
  return { fileIds: fileIds.map((id) => id.trim()), criteria };
}

export default { validateAnalyze };
