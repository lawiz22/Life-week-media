import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { app } from 'electron';
import path from 'path';
import * as schema from './schema';

let dbInstance: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getDb() {
  if (dbInstance) return dbInstance;

  // In dev, use local file. In prod, use userData.
  const isDev = !app.isPackaged;
  const dbPath = isDev
    ? 'library.db'
    : path.join(app.getPath('userData'), 'library.db');

  const sqlite = new Database(dbPath);
  dbInstance = drizzle(sqlite, { schema });

  // Create tables if not exist (simple migration for now)
  // In production, use 'drizzle-kit migrate' or embedded migrations
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS media_files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filepath TEXT NOT NULL UNIQUE,
      filename TEXT NOT NULL,
      type TEXT NOT NULL,
      size INTEGER,
      created_at INTEGER,
      hash TEXT,
      metadata TEXT
    );
  `);

  // Simple migration to add metadata column if missing
  try {
    const info = sqlite.prepare("PRAGMA table_info(media_files)").all() as any[];
    const hasMetadata = info.some(c => c.name === 'metadata');
    if (!hasMetadata) {
      sqlite.exec("ALTER TABLE media_files ADD COLUMN metadata TEXT");
    }
    const hasCategory = info.some(c => c.name === 'category');
    if (!hasCategory) {
      sqlite.exec("ALTER TABLE media_files ADD COLUMN category TEXT");
    }
  } catch (e) { /* ignore */ }

  sqlite.exec(`

    CREATE TABLE IF NOT EXISTS thumbnails (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      media_id INTEGER,
      data BLOB NOT NULL,
      format TEXT NOT NULL,
      FOREIGN KEY(media_id) REFERENCES media_files(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS user_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS life_stages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      color TEXT NOT NULL,
      start_age INTEGER NOT NULL,
      end_age INTEGER NOT NULL,
      visible INTEGER DEFAULT 1
    );
  `);

  // Migration for life_stages.visible
  try {
    const info = sqlite.prepare("PRAGMA table_info(life_stages)").all() as any[];
    const hasVisible = info.some(c => c.name === 'visible');
    if (!hasVisible) {
      sqlite.exec("ALTER TABLE life_stages ADD COLUMN visible INTEGER DEFAULT 1");
    }
  } catch (e) { /* ignore */ }

  return dbInstance;
}
