import { getDb } from './index'
import type { ExerciseLogInput } from '../../shared/session'

function localDate(d = new Date()): string {
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Starts a practice run for a day; the day's name is copied so history survives renames/deletes. */
export function startSession(dayId: number): number {
  const db = getDb()
  const day = db.prepare('SELECT name FROM Day WHERE id = ?').get(dayId) as
    | { name: string }
    | undefined
  if (!day) throw new Error(`Day ${dayId} not found`)
  const { lastInsertRowid } = db
    .prepare('INSERT INTO PracticeSession (date, day_id, day_name) VALUES (?, ?, ?)')
    .run(localDate(), dayId, day.name)
  return Number(lastInsertRowid)
}

export function logExercise(input: ExerciseLogInput): void {
  if (input.status !== 'completed' && input.status !== 'skipped') {
    throw new Error(`Invalid status: ${input.status}`)
  }
  getDb()
    .prepare(
      `INSERT INTO ExerciseLog (session_id, exercise_id, exercise_name, status, bpm, seconds_allocated)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(
      input.sessionId,
      input.exerciseId,
      input.exerciseName,
      input.status,
      input.bpm,
      input.secondsAllocated
    )
}

export function finishSession(sessionId: number): void {
  getDb()
    .prepare(
      `UPDATE PracticeSession SET finished_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
       WHERE id = ? AND finished_at IS NULL`
    )
    .run(sessionId)
}
