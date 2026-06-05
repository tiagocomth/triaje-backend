/**
 * Prompt templates and response parsers shared by the LLM providers.
 *
 * The model is always asked to return strict JSON. Because small local
 * models sometimes wrap JSON in prose or code fences, `extractJson` is
 * defensive about locating the JSON payload.
 */

const MAX_CV_CHARS = 12000; // keep prompts within a sane context window

export const CRITERIA_SYSTEM = `You are an expert technical recruiter.
Given a job description, extract the most relevant hiring criteria (skills,
experience, qualifications). For each criterion assign an integer weight from
1 to 5 reflecting how important it is for this role (5 = must-have, 1 = nice
to have). Return between 3 and 8 criteria.

Respond with ONLY a JSON object, no prose, in exactly this shape:
{"criteria":[{"name":"Python","weight":5},{"name":"AWS","weight":4}]}`;

export function buildCriteriaUser(jobDescription) {
  return `Job description:\n"""\n${jobDescription}\n"""\n\nExtract the weighted criteria as JSON.`;
}

export const SCORING_SYSTEM = `You are an expert technical recruiter scoring a
candidate's CV against a set of weighted criteria.

For every criterion, give an integer score from 0 to 100 reflecting how well
the CV satisfies it, plus a one-sentence justification grounded in the CV text.
Also extract the candidate's full name and current/most-recent job title.

Respond with ONLY a JSON object, no prose, in exactly this shape:
{"name":"Ana Souza","title":"Senior Backend Engineer","scores":[{"name":"Python","score":98,"justification":"7 years building FastAPI services"}]}

Use the EXACT criterion names you are given. If the CV gives no evidence for a
criterion, score it low and say so.`;

export function buildScoringUser(cvText, criteria) {
  const names = criteria.map((c) => `- ${c.name} (weight ${c.weight})`).join('\n');
  const cv = cvText.length > MAX_CV_CHARS ? `${cvText.slice(0, MAX_CV_CHARS)}…` : cvText;
  return `Criteria to score:\n${names}\n\nCandidate CV:\n"""\n${cv}\n"""\n\nScore the candidate as JSON.`;
}

/** Locate and parse the first JSON object/array in a model response. */
export function extractJson(text) {
  if (typeof text !== 'string') {
    throw new Error('Model response was not text');
  }
  // Strip ```json ... ``` fences if present.
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;

  const start = candidate.search(/[{[]/);
  if (start === -1) throw new Error('No JSON found in model response');

  // Walk forward to the matching closing bracket.
  const open = candidate[start];
  const close = open === '{' ? '}' : ']';
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < candidate.length; i += 1) {
    const ch = candidate[i];
    if (escape) {
      escape = false;
    } else if (ch === '\\') {
      escape = true;
    } else if (ch === '"') {
      inString = !inString;
    } else if (!inString) {
      if (ch === open) depth += 1;
      else if (ch === close) {
        depth -= 1;
        if (depth === 0) {
          return JSON.parse(candidate.slice(start, i + 1));
        }
      }
    }
  }
  throw new Error('Malformed JSON in model response');
}

const clampWeight = (w) => Math.min(5, Math.max(1, Math.round(Number(w) || 1)));
const clampScore = (s) => Math.min(100, Math.max(0, Math.round(Number(s) || 0)));

/**
 * Normalize a criteria-extraction response into [{ name, weight }].
 * Throws if no usable criteria are present (caller maps to 422).
 */
export function parseCriteriaResponse(text) {
  const data = extractJson(text);
  const list = Array.isArray(data) ? data : data.criteria;
  if (!Array.isArray(list)) throw new Error('Response had no "criteria" array');

  const criteria = list
    .filter((c) => c && typeof c.name === 'string' && c.name.trim())
    .map((c) => ({ name: c.name.trim(), weight: clampWeight(c.weight) }));

  if (criteria.length === 0) throw new Error('No valid criteria extracted');
  return criteria;
}

/**
 * Normalize a scoring response, aligning the model's scores back onto the
 * authoritative `criteria` list (weights always come from the input, never
 * the model). Missing criteria default to a 0 score.
 */
export function parseScoringResponse(text, criteria) {
  const data = extractJson(text);
  const modelScores = Array.isArray(data.scores) ? data.scores : [];

  // Index model output by lowercased criterion name for tolerant matching.
  const byName = new Map();
  for (const s of modelScores) {
    if (s && typeof s.name === 'string') byName.set(s.name.trim().toLowerCase(), s);
  }

  const breakdown = criteria.map((c) => {
    const match = byName.get(c.name.toLowerCase());
    return {
      name: c.name,
      weight: c.weight,
      score: match ? clampScore(match.score) : 0,
      justification:
        match && typeof match.justification === 'string' && match.justification.trim()
          ? match.justification.trim()
          : 'No evidence found in the CV for this criterion.',
    };
  });

  return {
    name: typeof data.name === 'string' && data.name.trim() ? data.name.trim() : 'Unknown candidate',
    title: typeof data.title === 'string' ? data.title.trim() : '',
    breakdown,
  };
}
