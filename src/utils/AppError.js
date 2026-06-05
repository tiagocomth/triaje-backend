/**
 * Operational error with an HTTP status code.
 * Thrown anywhere in the stack; the global error handler turns it into a
 * clean JSON response. `isOperational` distinguishes expected errors
 * (bad input, missing resource) from unexpected bugs.
 */
export default class AppError extends Error {
  /**
   * @param {number} statusCode HTTP status (e.g. 400, 404, 422)
   * @param {string} message    Human-readable message (sent to the client)
   * @param {object} [options]
   * @param {string} [options.code]    Optional machine-readable code
   * @param {Error}  [options.cause]   Underlying error, kept for logging
   */
  constructor(statusCode, message, { code, cause } = {}) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
    if (cause) this.cause = cause;
    Error.captureStackTrace?.(this, AppError);
  }

  static badRequest(message, opts) {
    return new AppError(400, message, opts);
  }

  static notFound(message = 'Resource not found', opts) {
    return new AppError(404, message, opts);
  }

  static unprocessable(message, opts) {
    return new AppError(422, message, opts);
  }
}
