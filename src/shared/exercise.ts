/** Songs are exercises too (same BPM history and graphs), but untimed and kept in their own tab. */
export type ExerciseKind = 'exercise' | 'song'

export interface Exercise {
  id: number
  kind: ExerciseKind
  name: string
  description: string
  bpm: number | null
  /** null for songs: they last as long as they last. */
  allocatedSeconds: number | null
  createdAt: string
  updatedAt: string
}

export interface ExerciseInput {
  kind: ExerciseKind
  name: string
  description: string
  bpm: number | null
  allocatedSeconds: number | null
}

export type ExerciseInputErrors = Partial<Record<keyof ExerciseInput, string>>

/** Shared by the form (for messages) and the main process (as the real gate). */
export function validateExerciseInput(input: ExerciseInput): ExerciseInputErrors {
  const errors: ExerciseInputErrors = {}
  if (input.kind !== 'exercise' && input.kind !== 'song') errors.kind = 'Invalid kind'
  if (!input.name.trim()) errors.name = 'Name is required'
  if (input.bpm !== null && (!Number.isInteger(input.bpm) || input.bpm <= 0 || input.bpm > 400)) {
    errors.bpm = 'BPM must be a whole number between 1 and 400'
  }
  if (input.kind === 'song') {
    if (input.allocatedSeconds !== null) errors.allocatedSeconds = 'Songs have no allocated time'
  } else if (
    input.allocatedSeconds === null ||
    !Number.isInteger(input.allocatedSeconds) ||
    input.allocatedSeconds <= 0
  ) {
    errors.allocatedSeconds = 'Allocated time must be more than 0'
  }
  return errors
}

export function formatDuration(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

/** formatDuration, with a dash for untimed (songs). */
export const formatMaybeDuration = (seconds: number | null): string =>
  seconds === null ? '—' : formatDuration(seconds)
