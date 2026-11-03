import type { LogStatus } from './session'
import type { ExerciseKind } from './exercise'

export interface HistoryLog {
  id: number
  exerciseId: number
  exerciseName: string
  status: LogStatus
  bpm: number | null
  secondsAllocated: number | null
  loggedAt: string
}

export interface SessionSummary {
  id: number
  /** Local date, 'YYYY-MM-DD' */
  date: string
  dayName: string
  startedAt: string
  finishedAt: string | null
}

export interface HistorySession extends SessionSummary {
  logs: HistoryLog[]
}

/** An exercise that can be graphed: it has at least one completed log with a BPM. */
export interface GraphableExercise {
  exerciseId: number
  /** Current name, or the most recent logged name if the exercise was deleted */
  name: string
  /** Deleted ones have no row left to tell, so they count as exercises */
  kind: ExerciseKind
  deleted: boolean
  lastPracticed: string
}

/** One point per local date, from completed logs only. */
export interface BpmPoint {
  date: string
  /** BPM of the last completed log that day */
  last: number
  max: number
  count: number
}
