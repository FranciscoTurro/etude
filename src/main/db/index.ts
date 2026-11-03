import { app } from 'electron'
import { join } from 'path'
import Database from 'better-sqlite3'
import { migrate } from './migrations'

let db: Database.Database | null = null

/**
 * Root of all app data: the SQLite file and the attachments/ folder live here.
 * Set ETUDE_DATA_DIR to point the app at a throwaway folder (dev/testing).
 */
export function dataDir(): string {
  return process.env.ETUDE_DATA_DIR || app.getPath('userData')
}

export function dbPath(): string {
  return join(dataDir(), 'etude.db')
}

export function openDb(): Database.Database {
  if (db) return db
  db = new Database(dbPath())
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON') // per-connection; required for the ON DELETE rules
  db.pragma('busy_timeout = 5000')
  migrate(db)
  return db
}

export function getDb(): Database.Database {
  if (!db) throw new Error('Database not opened; call openDb() first')
  return db
}

export function closeDb(): void {
  db?.close()
  db = null
}
