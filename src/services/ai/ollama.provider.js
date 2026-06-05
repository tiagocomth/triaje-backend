import config from '../../config/index.js';
import { createLlmProvider, fetchWithTimeout } from './llm.shared.js';

const { baseUrl, model } = config.ai.ollama;

/**
 * Low-level transport for a local Ollama server.
 * Uses the /api/chat endpoint with format:"json" to coax JSON output.
 * Docs: https://github.com/ollama/ollama/blob/main/docs/api.md
 */
async function chat({ system, user }) {
  const res = await fetchWithTimeout(
    `${baseUrl}/api/chat`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        stream: false,
        format: 'json',
        options: { temperature: 0 },
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
    throw new Error(`Ollama HTTP ${res.status}: ${detail.slice(0, 200)}`);
  }

  const data = await res.json();
  const content = data?.message?.content;
  if (!content) throw new Error('Ollama returned an empty response');
  return content;
}

// Ollama has no API key; we optimistically mark it available when it's in the
// chain. If the server isn't running, the call fails and the chain falls back.
export default createLlmProvider({
  name: 'ollama',
  isAvailable: () => Boolean(baseUrl),
  chat,
});
