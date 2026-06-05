import config, { validateConfig } from './config/index.js';
import { runMigrations } from './db/migrate.js';
import { closeDb } from './db/connection.js';
import { createApp } from './app.js';

function start() {
  // Fail fast on bad configuration before opening sockets.
  validateConfig();

  // Ensure the schema is up to date on every boot.
  const applied = runMigrations();
  if (applied.length) {
    console.log(`Applied ${applied.length} database migration(s).`);
  }

  const app = createApp();
  const server = app.listen(config.port, () => {
    console.log(`TriagemAI backend listening on http://localhost:${config.port}`);
    console.log(`  env:          ${config.env}`);
    console.log(`  CORS origin:  ${config.cors.origin}`);
    console.log(`  AI chain:     ${config.ai.chain.join(' -> ')}`);
  });

  // Graceful shutdown: stop accepting connections, then close the DB.
  const shutdown = (signal) => {
    console.log(`\n${signal} received — shutting down…`);
    server.close(() => {
      closeDb();
      process.exit(0);
    });
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

try {
  start();
} catch (err) {
  console.error('Failed to start server:', err.message);
  process.exit(1);
}
