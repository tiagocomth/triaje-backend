import express from 'express';
import cors from './middleware/cors.js';
import notFound from './middleware/notFound.js';
import errorHandler from './middleware/errorHandler.js';
import apiRoutes from './routes/index.js';

/**
 * Builds the Express app. Middleware order matters:
 *   cors  -> body parser -> routes -> 404 -> global error handler
 * CORS runs first so every response (including errors) carries its headers.
 */
export function createApp() {
  const app = express();

  app.disable('x-powered-by');

  app.use(cors);
  app.use(express.json({ limit: '1mb' }));

  app.use('/api', apiRoutes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

export default createApp;
