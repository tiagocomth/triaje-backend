import AppError from '../utils/AppError.js';
import jobService from '../services/job.service.js';
import cvService from '../services/cv.service.js';
import analysisService from '../services/analysis.service.js';
import { validateExtractCriteria, validateUpdateCriteria } from '../validators/jobs.validator.js';
import { validateAnalyze } from '../validators/analyses.validator.js';

/** POST /api/jobs/extract-criteria */
export async function extractCriteria(req, res) {
  const { jobDescription } = validateExtractCriteria(req.body);
  const result = await jobService.extractCriteria(jobDescription);
  res.status(200).json(result);
}

/** PATCH /api/jobs/:jobId/criteria */
export async function updateCriteria(req, res) {
  const { criteria } = validateUpdateCriteria(req.body);
  const result = jobService.updateCriteria(req.params.jobId, criteria);
  res.status(200).json(result);
}

/** POST /api/jobs/:jobId/cvs (multipart) */
export async function uploadCv(req, res) {
  if (!req.file) {
    throw AppError.badRequest('file is required (multipart field "file")');
  }
  const result = await cvService.storeCv(req.params.jobId, req.file);
  res.status(201).json(result);
}

/** POST /api/jobs/:jobId/analyze */
export async function analyze(req, res) {
  const input = validateAnalyze(req.body);
  const result = analysisService.startAnalysis(req.params.jobId, input);
  res.status(202).json(result);
}

export default { extractCriteria, updateCriteria, uploadCv, analyze };
