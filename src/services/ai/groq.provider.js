import config from '../../config/index.js';
import { createLlmProvider, fetchWithTimeout } from './llm.shared.js';

const { apiKey, baseUrl, model } = config.ai.groq;

/**
 * Low-level transport for Groq's free, OpenAI-compatible chat API.
 * Uses response_format json_object for strict JSON output.
 * Docs: https://console.groq.com/docs/api-reference
 */
async function chat({ system, user }) {
  const res = await fetchWithTimeout(
    `${baseUrl}/chat/completions`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
    },
    config.ai.requestTimeoutMs,
  );

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Groq HTTP ${res.status}: ${detail.slice(0, 200)}`);
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error('Groq returned an empty response');
  return content;
}

// Groq requires an API key; without it the provider is skipped in the chain.
export default createLlmProvider({
  name: 'groq',
  isAvailable: () => Boolean(apiKey),
  chat,
});
