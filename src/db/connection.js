import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import config from '../config/index.js';

let db;

/**
 * Returns the shared better-sqlite3 connection, opening it on first use.
 * WAL mode + foreign keys are enabled for concurrency and integrity.
 */
export function getDb() {
  if (db) return db;

  fs.mkdirSync(path.dirname(config.db.path), { recursive: true });

  db = new Database(config.db.path);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  return db;
}

export function closeDb() {
  if (db) {
    db.close();
    db = undefined;
  }
}

export default getDb;
