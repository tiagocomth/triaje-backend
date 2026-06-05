import { Router } from 'express';
import asyncHandler from '../utils/asyncHandler.js';
import { uploadSingleCv } from '../middleware/upload.js';
import jobsController from '../controllers/jobs.controller.js';

const router = Router();

// POST /api/jobs/extract-criteria
router.post('/extract-criteria', asyncHandler(jobsController.extractCriteria));

// PATCH /api/jobs/:jobId/criteria
router.patch('/:jobId/criteria', asyncHandler(jobsController.updateCriteria));

// POST /api/jobs/:jobId/cvs  (multipart upload)
router.post('/:jobId/cvs', uploadSingleCv, asyncHandler(jobsController.uploadCv));

// POST /api/jobs/:jobId/analyze
router.post('/:jobId/analyze', asyncHandler(jobsController.analyze));

export default router;
