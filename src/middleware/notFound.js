import AppError from '../utils/AppError.js';

/** Catch-all for unmatched routes; forwards a 404 to the error handler. */
export default function notFound(req, res, next) {
  next(AppError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
}
