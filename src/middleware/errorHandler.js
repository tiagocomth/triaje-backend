import multer from 'multer';
import config from '../config/index.js';
import AppError from '../utils/AppError.js';

/**
 * Global error handler (must be the last middleware, 4 args). Every error path
 * in the app converges here and produces a consistent JSON shape:
 *   { "error": "message", "code"?: "MACHINE_CODE" }
 *
 * CORS headers are already set by the cors middleware (it runs first), so error
 * responses remain CORS-safe per spec §6.
 */
// eslint-disable-next-line no-unused-vars -- Express needs the 4-arg signature
export default function errorHandler(err, req, res, next) {
  let statusCode = 500;
  let message = 'Internal server error';
  let code;

  if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
    code = err.code;
  } else if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      statusCode = 413;
      message = 'File too large (max 10MB)';
    } else {
      statusCode = 400;
      message = `Upload error: ${err.message}`;
    }
    code = err.code;
  } else if (err.type === 'entity.parse.failed') {
    // Thrown by express.json() on malformed JSON bodies.
    statusCode = 400;
    message = 'Invalid JSON in request body';
  } else if (err.type === 'entity.too.large') {
    statusCode = 413;
    message = 'Request body too large';
  }

  // Log unexpected (non-operational) errors with the stack for debugging.
  if (statusCode >= 500) {
    console.error('[error]', err.stack || err);
  }

  const payload = { error: message };
  if (code) payload.code = code;
  // Surface the underlying cause only in development to aid debugging.
  if (config.env === 'development' && err.cause) {
    payload.detail = err.cause.message;
  }

  res.status(statusCode).json(payload);
}
