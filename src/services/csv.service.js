/**
 * CSV export for an analysis ranking (spec §7).
 *   - UTF-8 BOM prefix (Excel pt-BR opens it correctly)
 *   - comma separator, CRLF line breaks
 *   - fields containing , " or newline are quoted; inner " escaped as ""
 *   - columns: Rank, Name, Title, Overall Score, Band,
 *     then "<Criterion> Score" per criterion, then "<Criterion> Justification".
 */

const BOM = '﻿';

/** Quote a single CSV field if it contains a special character. */
function escapeField(value) {
  const s = value == null ? '' : String(value);
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

const toRow = (fields) => fields.map(escapeField).join(',');

/**
 * Build the CSV text.
 * @param {object} args
 * @param {Array<{name:string}>} args.criteria   ordered criterion list
 * @param {Array} args.candidates                ordered candidate list
 * @returns {string}
 */
export function buildRankingCsv({ criteria, candidates }) {
  const criterionNames = criteria.map((c) => c.name);

  const header = [
    'Rank',
    'Name',
    'Title',
    'Overall Score',
    'Band',
    ...criterionNames.map((n) => `${n} Score`),
    ...criterionNames.map((n) => `${n} Justification`),
  ];

  const lines = [toRow(header)];

  candidates.forEach((cand, index) => {
    // Index this candidate's breakdown by criterion name for stable columns.
    const byName = new Map(cand.breakdown.map((b) => [b.name, b]));
    const scores = criterionNames.map((n) => byName.get(n)?.score ?? '');
    const justifications = criterionNames.map((n) => byName.get(n)?.justification ?? '');

    lines.push(
      toRow([
        index + 1,
        cand.name,
        cand.title,
        cand.overall,
        cand.band,
        ...scores,
        ...justifications,
      ]),
    );
  });

  return BOM + lines.join('\r\n') + '\r\n';
}

export default { buildRankingCsv };
