import {
  CRITERIA_SYSTEM,
  SCORING_SYSTEM,
  buildCriteriaUser,
  buildScoringUser,
  parseCriteriaResponse,
  parseScoringResponse,
} from './prompts.js';

/**
 * Builds a high-level AI provider (extractCriteria / scoreCandidate) from a
 * low-level `chat` transport. Ollama and Groq differ only in transport, so
 * they both reuse this — keeping prompting and parsing in one place.
 *
 * @param {object} opts
 * @param {string} opts.name           provider name (for logs)
 * @param {() => boolean} opts.isAvailable  whether the provider is configured
 * @param {(args: {system: string, user: string}) => Promise<string>} opts.chat
 */
export function createLlmProvider({ name, isAvailable, chat }) {
  return {
    name,
    isAvailable,

    async extractCriteria(jobDescription) {
      const content = await chat({
        system: CRITERIA_SYSTEM,
        user: buildCriteriaUser(jobDescription),
      });
      return parseCriteriaResponse(content);
    },

    async scoreCandidate({ cvText, criteria }) {
      const content = await chat({
        system: SCORING_SYSTEM,
        user: buildScoringUser(cvText, criteria),
      });
      return parseScoringResponse(content, criteria);
    },
  };
}

/** AbortController-based fetch with a timeout, shared by both transports. */
export async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}
