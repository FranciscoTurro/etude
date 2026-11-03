import type Database from 'better-sqlite3'
import { initial } from './001_initial'
import { dropAttachment } from './002_drop_attachment'

export interface Migration {
  /** Target PRAGMA user_version after this migration runs. Must be sequential, starting at 1. */
  version: number
  name: string
  up: string | ((db: Database.Database) => void)
}

// Append new migrations here. Never edit one that has shipped.
export const migrations: Migration[] = [initial, dropAttachment]

export const LATEST_SCHEMA_VERSION = migrations.length

/**
 * Brings the DB up to LATEST_SCHEMA_VERSION. Each migration runs in its own
 * transaction together with its user_version bump, so a failure leaves the DB
 * at the last good version. Also used on import to upgrade older backups.
 */
export function migrate(db: Database.Database): void {
  migrations.forEach((m, i) => {
    if (m.version !== i + 1) throw new Error(`Migration ${m.name} has version ${m.version}, expected ${i + 1}`)
  })

  const current = db.pragma('user_version', { simple: true }) as number
  if (current > LATEST_SCHEMA_VERSION) {
    throw new Error(
      `Database schema version ${current} is newer than this app supports (${LATEST_SCHEMA_VERSION})`
    )
  }

  for (const m of migrations.slice(current)) {
    db.transaction(() => {
      if (typeof m.up === 'string') db.exec(m.up)
      else m.up(db)
      db.pragma(`user_version = ${m.version}`)
    })()
  }
}
