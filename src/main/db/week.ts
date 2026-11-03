import { getDb } from './index'
import { WEEKDAYS, isWeekday, type Weekday, type WeekScheduleEntry } from '../../shared/week'

/** Always 7 entries, Monday first. */
export function getWeekSchedule(): WeekScheduleEntry[] {
  const rows = getDb().prepare('SELECT weekday, day_id FROM WeekSchedule').all() as {
    weekday: Weekday
    day_id: number | null
  }[]
  const byWeekday = new Map(rows.map((r) => [r.weekday, r.day_id]))
  return WEEKDAYS.map((weekday) => ({ weekday, dayId: byWeekday.get(weekday) ?? null }))
}

/** Assign a day to a weekday, or null to make it a rest day. */
export function setWeekday(weekday: Weekday, dayId: number | null): void {
  if (!isWeekday(weekday)) throw new Error(`Invalid weekday: ${weekday}`)
  // Upsert so it works even if a row was ever missing; the FK rejects unknown day ids.
  getDb()
    .prepare(
      `INSERT INTO WeekSchedule (weekday, day_id) VALUES (?, ?)
       ON CONFLICT (weekday) DO UPDATE SET day_id = excluded.day_id`
    )
    .run(weekday, dayId)
}
