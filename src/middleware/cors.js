import config from '../config/index.js';

/**
 * CORS middleware matching spec §6 exactly. Implemented by hand (rather than
 * the `cors` package) so the headers, Max-Age and the 204 preflight behaviour
 * are precisely what the frontend expects. Applied before everything else so
 * even error responses carry the CORS headers.
 */
export default function cors(req, res, next) {
  res.setHeader('Access-Control-Allow-Origin', config.cors.origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');

  // Preflight: answer immediately with 204 and no body.
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  next();
}
