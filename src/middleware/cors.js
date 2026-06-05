import config from '../config/index.js';

const ALLOWED = new Set(config.cors.origins);

/**
 * CORS middleware. Echoes the request Origin back only when it matches the
 * allowlist — this handles multiple origins (Lovable preview + production)
 * and is immune to trailing-slash mismatches.
 */
export default function cors(req, res, next) {
  const origin = req.headers.origin;
  const allowed = origin && ALLOWED.has(origin) ? origin : config.cors.origins[0];

  res.setHeader('Access-Control-Allow-Origin', allowed);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  next();
}
