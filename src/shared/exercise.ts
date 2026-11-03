export interface Exercise {
  id: number
  name: string
  description: string
  bpm: number | null
  allocatedSeconds: number
  createdAt: string
  updatedAt: string
}

export interface ExerciseInput {
  name: string
  description: string
  bpm: number | null
  allocatedSeconds: number
}

export type ExerciseInputErrors = Partial<Record<keyof ExerciseInput, string>>

/** Shared by the form (for messages) and the main process (as the real gate). */
export function validateExerciseInput(input: ExerciseInput): ExerciseInputErrors {
  const errors: ExerciseInputErrors = {}
  if (!input.name.trim()) errors.name = 'Name is required'
  if (input.bpm !== null && (!Number.isInteger(input.bpm) || input.bpm <= 0 || input.bpm > 400)) {
    errors.bpm = 'BPM must be a whole number between 1 and 400'
  }
  if (!Number.isInteger(input.allocatedSeconds) || input.allocatedSeconds <= 0) {
    errors.allocatedSeconds = 'Allocated time must be more than 0'
  }
  return errors
}

export function formatDuration(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}
