import config from '../../config/index.js';
import AppError from '../../utils/AppError.js';
import ollama from './ollama.provider.js';
import groq from './groq.provider.js';
import heuristic from './heuristic.provider.js';

const REGISTRY = { ollama, groq, heuristic };

/** Providers in the configured order that are actually usable right now. */
function activeProviders() {
  return config.ai.chain
    .map((name) => REGISTRY[name])
    .filter((p) => p && p.isAvailable());
}

/**
 * Runs `operation` against each provider in the chain, falling back to the
 * next one on failure. Returns the first success. If all providers fail, the
 * collected errors are surfaced as a 502.
 *
 * @param {string} label          for logging (e.g. "extractCriteria")
 * @param {(p: object) => Promise<any>} operation
 */
async function withFallback(label, operation) {
  const providers = activeProviders();
  if (providers.length === 0) {
    throw new AppError(503, 'No AI provider is configured or available', {
      code: 'NO_AI_PROVIDER',
    });
  }

  const failures = [];
  for (const provider of providers) {
    try {
      const result = await operation(provider);
      if (provider.name !== providers[0].name || failures.length) {
        console.warn(`[ai] ${label}: served by fallback "${provider.name}"`);
      }
      return result;
    } catch (err) {
      failures.push(`${provider.name}: ${err.message}`);
      console.warn(`[ai] ${label}: provider "${provider.name}" failed — ${err.message}`);
    }
  }

  throw new AppError(502, `All AI providers failed for ${label}`, {
    code: 'AI_UNAVAILABLE',
    cause: new Error(failures.join(' | ')),
  });
}

/**
 * Extract weighted criteria from a job description.
 * @returns {Promise<Array<{name: string, weight: number}>>}
 */
export function extractCriteria(jobDescription) {
  return withFallback('extractCriteria', (p) => p.extractCriteria(jobDescription));
}

/**
 * Score one CV against the given criteria.
 * @returns {Promise<{name: string, title: string, breakdown: Array}>}
 */
export function scoreCandidate({ cvText, criteria }) {
  return withFallback('scoreCandidate', (p) => p.scoreCandidate({ cvText, criteria }));
}

export default { extractCriteria, scoreCandidate };
