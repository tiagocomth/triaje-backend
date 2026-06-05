/**
 * Pure scoring rules from the spec (§4). No I/O — easy to reason about/test.
 */

/**
 * Weighted average of per-criterion scores, rounded to an integer.
 *   overall = round( Σ(score_i × weight_i) / Σ(weight_i) )
 * @param {Array<{score:number, weight:number}>} breakdown
 * @returns {number} 0..100
 */
export function computeOverall(breakdown) {
  const denom = breakdown.reduce((sum, b) => sum + b.weight, 0);
  if (denom === 0) return 0;
  const numer = breakdown.reduce((sum, b) => sum + b.score * b.weight, 0);
  return Math.round(numer / denom);
}

/**
 * Map an overall score to its band (§4.2).
 * @param {number} overall
 * @returns {"Recommended"|"Review"|"Discard"}
 */
export function bandFor(overall) {
  if (overall >= 80) return 'Recommended';
  if (overall >= 60) return 'Review';
  return 'Discard';
}

/** Sort candidates by overall desc, tie-break by name asc (§4.4). In place. */
export function sortCandidates(candidates) {
  return candidates.sort(
    (a, b) => b.overall - a.overall || a.name.localeCompare(b.name),
  );
}

export default { computeOverall, bandFor, sortCandidates };
