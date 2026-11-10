import { copyFileSync, renameSync, rmSync } from 'fs'
import Database from 'better-sqlite3'
import { closeDb, dbPath, getDb, openDb } from './index'
import { LATEST_SCHEMA_VERSION, migrate } from './migrations'

/** Tables a backup must have to be accepted (Attachment is gone since v2). */
const REQUIRED_TABLES = [
  'Exercise',
  'Day',
  'DayExercise',
  'WeekSchedule',
  'PracticeSession',
  'ExerciseLog',
  'Setting'
]

/**
 * Writes a self-contained copy of the whole DB (exercises, days, week, history,
 * settings) to `dest`. VACUUM INTO folds in the WAL, so the result is one file.
 */
export function exportDb(dest: string): void {
  // VACUUM INTO refuses to overwrite, so it writes beside `dest` and the result replaces
  // it (the save dialog already confirmed that). If anything fails, `dest` is untouched.
  const tmp = `${dest}.tmp`
  rmSync(tmp, { force: true })
  try {
    getDb().prepare('VACUUM INTO ?').run(tmp)
    renameSync(tmp, dest)
  } catch (err) {
    rmSync(tmp, { force: true })
    throw err
  }
}

/**
 * Replaces all current data with the backup at `src`. The backup is checked and
 * migrated on a temp copy first, so a bad file never touches the live DB.
 */
export function importDb(src: string): void {
  const live = dbPath()
  const tmp = `${live}.import`
  rmSync(tmp, { force: true })
  copyFileSync(src, tmp)

  try {
    const db = new Database(tmp, { fileMustExist: true })
    try {
      validate(db)
      db.pragma('foreign_keys = ON')
      migrate(db) // brings older exports up to the current schema
      const fkProblems = db.pragma('foreign_key_check') as unknown[]
      if (fkProblems.length) throw new Error('The backup has broken references between tables')
      db.pragma('journal_mode = DELETE') // fold any WAL back in before the swap
    } finally {
      db.close()
    }
  } catch (err) {
    rmSync(tmp, { force: true })
    throw err
  }

  closeDb()
  try {
    for (const ext of ['-wal', '-shm']) rmSync(live + ext, { force: true })
    renameSync(tmp, live)
  } finally {
    openDb() // reopens the new DB, or the old one if the swap failed
  }
}

function validate(db: Database.Database): void {
  let ok: string
  try {
    ok = db.pragma('quick_check', { simple: true }) as string
  } catch {
    throw new Error("That file isn't an Etude backup")
  }
  if (ok !== 'ok') throw new Error('The backup file is corrupted')

  const version = db.pragma('user_version', { simple: true }) as number
  if (version > LATEST_SCHEMA_VERSION) {
    throw new Error('That backup was made by a newer version of Etude. Update the app first.')
  }

  const tables = new Set(
    (db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as { name: string }[]).map(
      (r) => r.name
    )
  )
  if (version === 0 || REQUIRED_TABLES.some((t) => !tables.has(t))) {
    throw new Error("That file isn't an Etude backup")
  }
}
