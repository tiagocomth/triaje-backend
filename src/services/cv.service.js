import fs from 'node:fs';
import path from 'node:path';
import config from '../config/index.js';
import AppError from '../utils/AppError.js';
import { newCvId } from '../utils/id.js';
import { getJobOrThrow } from './job.service.js';
import { extractText } from './parser/document.parser.js';
import cvRepo from '../repositories/cv.repository.js';

/**
 * Store an uploaded CV: persist the file to disk, extract its text up-front
 * (so analysis is fast), and record it against the job.
 *
 * @param {string} jobId
 * @param {{originalname:string, mimetype:string, size:number, buffer:Buffer}} file
 * @returns {Promise<{fileId, name, size, status}>}
 */
export async function storeCv(jobId, file) {
  getJobOrThrow(jobId); // 404 if the job doesn't exist

  const id = newCvId();
  const ext = file.mimetype === 'application/pdf' ? '.pdf' : '.docx';
  const filePath = path.join(config.uploads.dir, `${id}${ext}`);

  fs.mkdirSync(config.uploads.dir, { recursive: true });
  fs.writeFileSync(filePath, file.buffer);

  // Extract text now so the analysis stage doesn't re-read every file.
  // A parse failure shouldn't reject the upload — store it and surface the
  // failure later during analysis.
  let extractedText = null;
  let status = 'uploaded';
  try {
    extractedText = await extractText(file.buffer, file.mimetype);
  } catch (err) {
    status = 'parse_failed';
  }

  cvRepo.createCv({
    id,
    jobId,
    name: file.originalname,
    size: file.size,
    mimeType: file.mimetype,
    filePath,
    extractedText,
    status,
    createdAt: new Date().toISOString(),
  });

  return { fileId: id, name: file.originalname, size: file.size, status };
}

/** Resolve fileIds to CV rows scoped to the job, or throw 404 if any missing. */
export function getCvsForAnalysis(jobId, fileIds) {
  const rows = cvRepo.findCvsByIds(jobId, fileIds);
  if (rows.length !== fileIds.length) {
    const found = new Set(rows.map((r) => r.id));
    const missing = fileIds.filter((id) => !found.has(id));
    throw AppError.notFound(`CV(s) not found for this job: ${missing.join(', ')}`);
  }
  return rows;
}

export default { storeCv, getCvsForAnalysis };
