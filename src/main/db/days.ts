import { getDb } from './index'
import {
  pickAlternative,
  validateDayInput,
  type Day,
  type DayInput,
  type Slot,
  type SlotExercise
} from '../../shared/day'

interface DayRow {
  id: number
  name: string
  created_at: string
}

interface SlotRow {
  day_id: number
  position: number
  id: number
  name: string
  bpm: number | null
  allocated_seconds: number
}

export function listDays(): Day[] {
  const db = getDb()
  const days = db.prepare('SELECT * FROM Day ORDER BY name COLLATE NOCASE, id').all() as DayRow[]
  const rows = db
    .prepare(
      `SELECT de.day_id, de.position, e.id, e.name, e.bpm, e.allocated_seconds
       FROM DayExercise de JOIN Exercise e ON e.id = de.exercise_id
       ORDER BY de.day_id, de.position, de.id`
    )
    .all() as SlotRow[]
  const lastCompleted = new Map(
    (
      db
        .prepare(
          `SELECT exercise_id, MAX(logged_at) AS at FROM ExerciseLog
           WHERE status = 'completed' GROUP BY exercise_id`
        )
        .all() as { exercise_id: number; at: string }[]
    ).map((r) => [r.exercise_id, r.at])
  )

  // day_id -> position -> exercises
  const byDay = new Map<number, Map<number, SlotExercise[]>>()
  for (const r of rows) {
    const slots = byDay.get(r.day_id) ?? byDay.set(r.day_id, new Map()).get(r.day_id)!
    const slot = slots.get(r.position) ?? slots.set(r.position, []).get(r.position)!
    slot.push({ id: r.id, name: r.name, bpm: r.bpm, allocatedSeconds: r.allocated_seconds })
  }

  return days.map((d) => {
    const slots: Slot[] = [...(byDay.get(d.id)?.values() ?? [])].map((exercises) => ({
      exercises,
      preselectedId: pickAlternative(
        exercises.map((e) => e.id),
        lastCompleted
      )
    }))
    const totalSeconds = slots.reduce(
      (sum, s) => sum + s.exercises.find((e) => e.id === s.preselectedId)!.allocatedSeconds,
      0
    )
    return { id: d.id, name: d.name, createdAt: d.created_at, slots, totalSeconds }
  })
}

/** Creates (id undefined) or replaces a day's name and slots. Positions are renumbered 0, 1, 2... */
export function saveDay(id: number | undefined, input: DayInput): number {
  const error = validateDayInput(input)
  if (error) throw new Error(error)
  const db = getDb()
  const name = input.name.trim()

  return db.transaction(() => {
    let dayId: number
    if (id === undefined) {
      dayId = Number(db.prepare('INSERT INTO Day (name) VALUES (?)').run(name).lastInsertRowid)
    } else {
      if (!db.prepare('UPDATE Day SET name = ? WHERE id = ?').run(name, id).changes) {
        throw new Error(`Day ${id} not found`)
      }
      dayId = id
      db.prepare('DELETE FROM DayExercise WHERE day_id = ?').run(dayId)
    }
    const insert = db.prepare(
      'INSERT INTO DayExercise (day_id, exercise_id, position) VALUES (?, ?, ?)'
    )
    input.slots.forEach((slot, position) => {
      for (const exerciseId of slot) insert.run(dayId, exerciseId, position)
    })
    return dayId
  })()
}

export function deleteDay(id: number): void {
  // DayExercise cascades; WeekSchedule / PracticeSession day_id become NULL
  if (!getDb().prepare('DELETE FROM Day WHERE id = ?').run(id).changes) {
    throw new Error(`Day ${id} not found`)
  }
}
