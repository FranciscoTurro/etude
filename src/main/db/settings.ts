import { getDb } from './index'
import type { Settings } from '../../shared/settings'

export function getSettings(): Settings {
  const rows = getDb().prepare('SELECT key, value FROM Setting').all() as {
    key: string
    value: string
  }[]
  return Object.fromEntries(rows.map((r) => [r.key, r.value]))
}

export function setSetting(key: string, value: string): void {
  if (typeof key !== 'string' || !key) throw new Error('Setting key is required')
  getDb()
    .prepare(
      'INSERT INTO Setting (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value'
    )
    .run(key, String(value))
}
