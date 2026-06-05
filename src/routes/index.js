import { Router } from 'express';
import jobsRoutes from './jobs.routes.js';
import analysesRoutes from './analyses.routes.js';

const router = Router();

// Lightweight health check (handy for uptime probes / smoke tests).
router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

router.use('/jobs', jobsRoutes);
router.use('/analyses', analysesRoutes);

export default router;
