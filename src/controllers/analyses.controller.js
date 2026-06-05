import analysisService from '../services/analysis.service.js';
import { buildRankingCsv } from '../services/csv.service.js';

/** GET /api/analyses/:analysisId (polling) */
export async function getAnalysis(req, res) {
  const result = analysisService.getAnalysis(req.params.analysisId);
  res.status(200).json(result);
}

/** GET /api/analyses/:analysisId/export.csv */
export async function exportCsv(req, res) {
  const { analysisId } = req.params;
  const data = analysisService.getCompletedAnalysisOrThrow(analysisId);
  const csv = buildRankingCsv(data);

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="triagemai-ranking-${analysisId}.csv"`,
  );
  res.status(200).send(csv);
}

export default { getAnalysis, exportCsv };
