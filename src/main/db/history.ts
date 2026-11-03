import { getDb } from './index'
import type { LogStatus } from '../../shared/session'
import type {
  BpmPoint,
  GraphableExercise,
  HistorySession,
  SessionSummary
} from '../../shared/history'

interface SessionRow {
  id: number
  date: string
  day_name: string
  started_at: string
  finished_at: string | null
}

function toSummary(s: SessionRow): SessionSummary {
  return {
    id: s.id,
    date: s.date,
    dayName: s.day_name,
    startedAt: s.started_at,
    finishedAt: s.finished_at
  }
}

/** Every session, newest first, without logs (for the session picker). */
export function listSessionSummaries(): SessionSummary[] {
  return (
    getDb()
      .prepare(
        `SELECT id, date, day_name, started_at, finished_at FROM PracticeSession
         ORDER BY started_at DESC, id DESC`
      )
      .all() as SessionRow[]
  ).map(toSummary)
}

/** One session with its logs in the order they happened. */
export function getSession(id: number): HistorySession | null {
  const db = getDb()
  const s = db
    .prepare('SELECT id, date, day_name, started_at, finished_at FROM PracticeSession WHERE id = ?')
    .get(id) as SessionRow | undefined
  if (!s) return null
  const logs = db
    .prepare(
      `SELECT id, exercise_id, exercise_name, status, bpm, seconds_allocated, logged_at
       FROM ExerciseLog WHERE session_id = ? ORDER BY logged_at, id`
    )
    .all(id) as {
    id: number
    exercise_id: number
    exercise_name: string
    status: LogStatus
    bpm: number | null
    seconds_allocated: number
    logged_at: string
  }[]
  return {
    ...toSummary(s),
    logs: logs.map((l) => ({
      id: l.id,
      exerciseId: l.exercise_id,
      exerciseName: l.exercise_name,
      status: l.status,
      bpm: l.bpm,
      secondsAllocated: l.seconds_allocated,
      loggedAt: l.logged_at
    }))
  }
}

/** Exercises with completed BPM logs, live or deleted, most recently practiced first. */
export function listGraphableExercises(): GraphableExercise[] {
  const rows = getDb()
    .prepare(
      `WITH ranked AS (
         SELECT exercise_id, exercise_name, logged_at,
                ROW_NUMBER() OVER (PARTITION BY exercise_id ORDER BY logged_at DESC, id DESC) AS rn
         FROM ExerciseLog
         WHERE status = 'completed' AND bpm IS NOT NULL
       )
       SELECT r.exercise_id, COALESCE(e.name, r.exercise_name) AS name,
              e.id IS NULL AS deleted, r.logged_at
       FROM ranked r LEFT JOIN Exercise e ON e.id = r.exercise_id
       WHERE r.rn = 1
       ORDER BY r.logged_at DESC`
    )
    .all() as { exercise_id: number; name: string; deleted: number; logged_at: string }[]
  return rows.map((r) => ({
    exerciseId: r.exercise_id,
    name: r.name,
    deleted: r.deleted === 1,
    lastPracticed: r.logged_at
  }))
}

/** Per local date: last and max completed BPM for one exercise, oldest first. */
export function exerciseBpmHistory(exerciseId: number): BpmPoint[] {
  return getDb()
    .prepare(
      `WITH logs AS (
         SELECT s.date, l.bpm,
                ROW_NUMBER() OVER (PARTITION BY s.date ORDER BY l.logged_at DESC, l.id DESC) AS rn
         FROM ExerciseLog l JOIN PracticeSession s ON s.id = l.session_id
         WHERE l.exercise_id = ? AND l.status = 'completed' AND l.bpm IS NOT NULL
       )
       SELECT date,
              MAX(CASE WHEN rn = 1 THEN bpm END) AS last,
              MAX(bpm) AS max,
              COUNT(*) AS count
       FROM logs GROUP BY date ORDER BY date`
    )
    .all(exerciseId) as BpmPoint[]
}
