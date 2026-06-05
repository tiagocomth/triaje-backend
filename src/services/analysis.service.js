import AppError from '../utils/AppError.js';
import { newAnalysisId, newCandidateId } from '../utils/id.js';
import { getJobOrThrow } from './job.service.js';
import { getCvsForAnalysis } from './cv.service.js';
import * as ai from './ai/index.js';
import { computeOverall, bandFor, sortCandidates } from './scoring.service.js';
import analysisRepo from '../repositories/analysis.repository.js';

/**
 * Kick off an analysis. Returns immediately (HTTP 202); the heavy work runs in
 * the background and writes stage/progress to the DB for the client to poll.
 *
 * @returns {{analysisId:string, status:string, totalCandidates:number}}
 */
export function startAnalysis(jobId, { fileIds, criteria }) {
  getJobOrThrow(jobId);
  const cvs = getCvsForAnalysis(jobId, fileIds); // 404 if any missing

  const id = newAnalysisId();
  const createdAt = new Date().toISOString();
  analysisRepo.createAnalysis({
    id,
    jobId,
    status: 'processing',
    stage: 'parsing',
    progress: 0,
    totalCandidates: cvs.length,
    criteriaJson: JSON.stringify(criteria),
    createdAt,
  });

  // Run after the response is sent. Errors are caught and recorded as failed.
  setImmediate(() => {
    processAnalysis(id, cvs, criteria).catch((err) => {
      console.error(`[analysis] ${id} crashed:`, err);
      analysisRepo.markFailed(id, err.message || 'Unknown error');
    });
  });

  return { analysisId: id, status: 'processing', totalCandidates: cvs.length };
}

/** The background pipeline: parsing → matching → scoring. */
async function processAnalysis(analysisId, cvs, criteria) {
  // ── Stage 1: parsing ──────────────────────────────────────────────
  analysisRepo.updateProgress(analysisId, { stage: 'parsing', progress: 5 });
  for (const cv of cvs) {
    if (cv.status === 'parse_failed' || !cv.extracted_text) {
      throw new AppError(422, `Failed to read text from ${cv.name} (${cv.id})`);
    }
  }
  analysisRepo.updateProgress(analysisId, { stage: 'parsing', progress: 10 });

  // ── Stages 2 & 3: matching + scoring (per candidate) ──────────────
  const candidates = [];
  for (let i = 0; i < cvs.length; i += 1) {
    const cv = cvs[i];

    analysisRepo.updateProgress(analysisId, {
      stage: 'matching',
      progress: Math.round(10 + (i / cvs.length) * 90),
    });

    const result = await ai.scoreCandidate({ cvText: cv.extracted_text, criteria });

    analysisRepo.updateProgress(analysisId, {
      stage: 'scoring',
      progress: Math.round(10 + ((i + 0.5) / cvs.length) * 90),
    });

    const overall = computeOverall(result.breakdown);
    candidates.push({
      id: newCandidateId(),
      cvId: cv.id,
      name: result.name || cv.name,
      title: result.title || '',
      overall,
      band: bandFor(overall),
      breakdown: result.breakdown,
    });
  }

  sortCandidates(candidates);
  analysisRepo.saveCandidates(analysisId, candidates);
  analysisRepo.markCompleted(analysisId, new Date().toISOString());
}

/**
 * Read an analysis for polling. Shape matches §2.5 / §3 (AnalysisResult):
 * lean while processing, full candidate list when completed, error when failed.
 */
export function getAnalysis(analysisId) {
  const row = analysisRepo.findAnalysisById(analysisId);
  if (!row) throw AppError.notFound(`Analysis not found: ${analysisId}`);

  const base = {
    analysisId: row.id,
    jobId: row.job_id,
    status: row.status,
    totalCandidates: row.total_candidates,
    createdAt: row.created_at,
  };

  if (row.status === 'failed') {
    return { ...base, error: row.error || 'Analysis failed' };
  }

  if (row.status === 'processing') {
    return { ...base, stage: row.stage, progress: row.progress, candidates: [] };
  }

  // completed
  return {
    ...base,
    progress: 100,
    candidates: analysisRepo.findCandidatesByAnalysisId(analysisId),
    completedAt: row.completed_at,
  };
}

/** Load completed analysis + its criteria snapshot for CSV export. */
export function getCompletedAnalysisOrThrow(analysisId) {
  const row = analysisRepo.findAnalysisById(analysisId);
  if (!row) throw AppError.notFound(`Analysis not found: ${analysisId}`);
  if (row.status !== 'completed') {
    throw AppError.badRequest(
      `Analysis is not ready for export (status: ${row.status})`,
    );
  }
  return {
    analysisId: row.id,
    criteria: JSON.parse(row.criteria_json),
    candidates: analysisRepo.findCandidatesByAnalysisId(analysisId),
  };
}

export default { startAnalysis, getAnalysis, getCompletedAnalysisOrThrow };
