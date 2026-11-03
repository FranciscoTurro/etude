import type { Weekday } from './week'

/**
 * "Practice time" everywhere is the allocated time of completed exercises: the clock
 * only counts while you play, so a completed exercise means that much actual playing.
 */
export interface PeriodTotals {
  sessions: number
  /** Distinct dates with at least one completed exercise */
  daysPracticed: number
  completed: number
  skipped: number
  practiceSeconds: number
}

export interface ExerciseStat {
  exerciseId: number
  /** Current name, or the last logged one if deleted */
  name: string
  deleted: boolean
  completed: number
  skipped: number
  practiceSeconds: number
}

export interface BpmGain {
  exerciseId: number
  name: string
  deleted: boolean
  firstBpm: number
  bestBpm: number
  firstDate: string
  bestDate: string
}

export interface Stats {
  /** Local 'YYYY-MM-DD' the stats were computed for */
  today: string
  week: PeriodTotals
  month: PeriodTotals
  year: PeriodTotals
  allTime: PeriodTotals
  /** Same-length window right before, for "vs last month" style comparisons */
  lastWeek: PeriodTotals
  lastMonth: PeriodTotals
  lastYear: PeriodTotals

  /** Consecutive practiced days ending today (or yesterday, if today isn't done yet) */
  currentStreak: number
  longestStreak: { days: number; from: string; to: string } | null

  firstSessionDate: string | null
  bestDay: { date: string; practiceSeconds: number } | null
  longestSession: { date: string; dayName: string; seconds: number } | null
  /** Wall-clock time from start to finish, finished sessions only */
  averageSessionSeconds: number | null

  /** Practice seconds per local date, last 53 weeks (dates without practice omitted) */
  activity: { date: string; practiceSeconds: number }[]
  /** Practice seconds by weekday, all time */
  byWeekday: { weekday: Weekday; practiceSeconds: number; sessions: number }[]
  /** Sessions by the hour they started (local), all time */
  byTimeOfDay: { label: string; sessions: number }[]
  /** Routine days by number of sessions, all time */
  topDays: { name: string; sessions: number }[]

  topExercises: ExerciseStat[]
  mostSkipped: ExerciseStat[]
  bpmGains: BpmGain[]
}
