import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..', '..');

/** Resolve a path from .env relative to the project root (absolute paths pass through). */
function resolveFromRoot(p, fallback) {
  const value = p && p.trim() ? p.trim() : fallback;
  return path.isAbsolute(value) ? value : path.resolve(ROOT_DIR, value);
}

function toInt(value, fallback) {
  const n = Number.parseInt(value ?? '', 10);
  return Number.isFinite(n) ? n : fallback;
}

const config = {
  rootDir: ROOT_DIR,
  env: process.env.NODE_ENV || 'development',
  port: toInt(process.env.PORT, 3000),

  cors: {
    // Comma-separated list of allowed origins; trailing slashes are stripped.
    origins: (process.env.CORS_ORIGIN || 'http://localhost:5173')
      .split(',')
      .map((o) => o.trim().replace(/\/$/, ''))
      .filter(Boolean),
  },

  db: {
    path: resolveFromRoot(process.env.DATABASE_PATH, './data/triagemai.db'),
  },

  uploads: {
    dir: resolveFromRoot(process.env.UPLOAD_DIR, './uploads'),
    maxBytes: toInt(process.env.MAX_UPLOAD_BYTES, 10 * 1024 * 1024),
    allowedMimeTypes: [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ],
  },

  ai: {
    chain: (process.env.AI_PROVIDER_CHAIN || 'ollama,groq,heuristic')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
    requestTimeoutMs: toInt(process.env.AI_REQUEST_TIMEOUT_MS, 60000),
    ollama: {
      baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
      model: process.env.OLLAMA_MODEL || 'llama3',
    },
    groq: {
      apiKey: process.env.GROQ_API_KEY || '',
      baseUrl: process.env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1',
      model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
    },
  },
};

/** Fail fast on obviously invalid configuration. */
export function validateConfig() {
  const errors = [];

  if (!Number.isInteger(config.port) || config.port <= 0 || config.port > 65535) {
    errors.push(`PORT must be a valid port number (got "${process.env.PORT}")`);
  }
  if (config.ai.chain.length === 0) {
    errors.push('AI_PROVIDER_CHAIN must list at least one provider');
  }
  const known = new Set(['ollama', 'groq', 'heuristic']);
  for (const provider of config.ai.chain) {
    if (!known.has(provider)) {
      errors.push(`Unknown AI provider in AI_PROVIDER_CHAIN: "${provider}"`);
    }
  }
  if (config.uploads.maxBytes <= 0) {
    errors.push('MAX_UPLOAD_BYTES must be a positive integer');
  }

  if (errors.length) {
    throw new Error(`Invalid configuration:\n  - ${errors.join('\n  - ')}`);
  }
}

export default config;
