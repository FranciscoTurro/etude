export type LogStatus = 'completed' | 'skipped'

export interface ExerciseLogInput {
  sessionId: number
  exerciseId: number
  exerciseName: string
  status: LogStatus
  bpm: number | null
  /** Allocated time; for songs, the seconds actually played (null if none/unknown). */
  secondsAllocated: number | null
}
