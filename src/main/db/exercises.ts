import { getDb } from './index'
import {
  validateExerciseInput,
  type Exercise,
  type ExerciseInput,
  type ExerciseKind
} from '../../shared/exercise'

interface ExerciseRow {
  id: number
  kind: ExerciseKind
  name: string
  description: string
  bpm: number | null
  allocated_seconds: number | null
  created_at: string
  updated_at: string
}

const toExercise = (r: ExerciseRow): Exercise => ({
  id: r.id,
  kind: r.kind,
  name: r.name,
  description: r.description,
  bpm: r.bpm,
  allocatedSeconds: r.allocated_seconds,
  createdAt: r.created_at,
  updatedAt: r.updated_at
})

function clean(input: ExerciseInput): ExerciseInput {
  const errors = validateExerciseInput(input)
  const first = Object.values(errors)[0]
  if (first) throw new Error(first)
  return { ...input, name: input.name.trim(), description: input.description.trim() }
}

function get(id: number): Exercise {
  const row = getDb().prepare('SELECT * FROM Exercise WHERE id = ?').get(id) as
    ExerciseRow | undefined
  if (!row) throw new Error(`Exercise ${id} not found`)
  return toExercise(row)
}

export function listExercises(): Exercise[] {
  const rows = getDb()
    .prepare('SELECT * FROM Exercise ORDER BY name COLLATE NOCASE, id')
    .all() as ExerciseRow[]
  return rows.map(toExercise)
}

export function createExercise(input: ExerciseInput): Exercise {
  const e = clean(input)
  const { lastInsertRowid } = getDb()
    .prepare(
      'INSERT INTO Exercise (kind, name, description, bpm, allocated_seconds) VALUES (?, ?, ?, ?, ?)'
    )
    .run(e.kind, e.name, e.description, e.bpm, e.allocatedSeconds)
  return get(Number(lastInsertRowid))
}

/** The kind can't change: a song slot and an exercise slot aren't interchangeable. */
export function updateExercise(id: number, input: ExerciseInput): Exercise {
  const e = clean(input)
  if (get(id).kind !== e.kind) throw new Error("An exercise can't become a song, or the other way")
  getDb()
    .prepare(
      'UPDATE Exercise SET name = ?, description = ?, bpm = ?, allocated_seconds = ? WHERE id = ?'
    )
    .run(e.name, e.description, e.bpm, e.allocatedSeconds, id)
  return get(id)
}

/** New id, no history, no day slots. */
export function duplicateExercise(id: number): Exercise {
  const src = get(id)
  return createExercise({
    kind: src.kind,
    name: `${src.name} (copy)`,
    description: src.description,
    bpm: src.bpm,
    allocatedSeconds: src.allocatedSeconds
  })
}

/** Names of the days an exercise appears in, for the delete confirmation. */
export function daysUsingExercise(id: number): string[] {
  return getDb()
    .prepare(
      `SELECT DISTINCT d.name FROM DayExercise de JOIN Day d ON d.id = de.day_id
       WHERE de.exercise_id = ? ORDER BY d.name COLLATE NOCASE`
    )
    .pluck()
    .all(id) as string[]
}

/** Removes the exercise and its day slots (FK cascade). Practice logs are untouched. */
export function deleteExercise(id: number): void {
  const { changes } = getDb().prepare('DELETE FROM Exercise WHERE id = ?').run(id)
  if (!changes) throw new Error(`Exercise ${id} not found`)
}
