export type LogStatus = 'completed' | 'skipped'

export interface ExerciseLogInput {
  sessionId: number
  exerciseId: number
  exerciseName: string
  status: LogStatus
  bpm: number | null
  secondsAllocated: number
}
