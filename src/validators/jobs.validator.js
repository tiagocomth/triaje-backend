import AppError from '../utils/AppError.js';

/** Validate one criterion object; returns a normalized copy or throws 400. */
function validateCriterion(c, i) {
  if (!c || typeof c !== 'object') {
    throw AppError.badRequest(`criteria[${i}] must be an object`);
  }
  if (typeof c.id !== 'string' || !c.id.trim()) {
    throw AppError.badRequest(`criteria[${i}].id is required`);
  }
  if (typeof c.name !== 'string' || !c.name.trim()) {
    throw AppError.badRequest(`criteria[${i}].name is required`);
  }
  if (!Number.isInteger(c.weight) || c.weight < 1 || c.weight > 5) {
    throw AppError.badRequest(`criteria[${i}].weight must be an integer between 1 and 5`);
  }
  return { id: c.id.trim(), name: c.name.trim(), weight: c.weight };
}

/** Validate a non-empty criteria array. */
export function validateCriteriaArray(criteria) {
  if (!Array.isArray(criteria) || criteria.length === 0) {
    throw AppError.badRequest('criteria must be a non-empty array');
  }
  return criteria.map(validateCriterion);
}

/** POST /jobs/extract-criteria */
export function validateExtractCriteria(body) {
  const jd = body?.jobDescription;
  if (typeof jd !== 'string' || !jd.trim()) {
    throw AppError.badRequest('jobDescription is required');
  }
  return { jobDescription: jd };
}

/** PATCH /jobs/:jobId/criteria */
export function validateUpdateCriteria(body) {
  return { criteria: validateCriteriaArray(body?.criteria) };
}

export default {
  validateExtractCriteria,
  validateUpdateCriteria,
  validateCriteriaArray,
};
