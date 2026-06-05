/**
 * Wraps an async Express handler so rejected promises are forwarded to
 * `next()` (and thus to the global error middleware) instead of crashing
 * the process with an unhandled rejection.
 *
 * Usage: router.post('/x', asyncHandler(controller.create))
 */
export default function asyncHandler(fn) {
  return function wrapped(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
