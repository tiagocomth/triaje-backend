import { Router } from 'express';
import asyncHandler from '../utils/asyncHandler.js';
import analysesController from '../controllers/analyses.controller.js';

const router = Router();

// GET /api/analyses/:analysisId/export.csv  (declared before :id to be explicit)
router.get('/:analysisId/export.csv', asyncHandler(analysesController.exportCsv));

// GET /api/analyses/:analysisId  (polling)
router.get('/:analysisId', asyncHandler(analysesController.getAnalysis));

export default router;
