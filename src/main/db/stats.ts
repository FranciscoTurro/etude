import { getDb } from './index'
import { WEEKDAYS, weekdayOf } from '../../shared/week'
import type { BpmGain, ExerciseStat, PeriodTotals, Stats } from '../../shared/stats'
import type { LogStatus } from '../../shared/session'
import { SETTING } from '../../shared/settings'

interface SessionRow {
  id: number
  date: string
  day_name: string
  started_at: string
  finished_at: string | null
}

interface LogRow {
  session_id: number
  date: string
  exercise_id: number
  exercise_name: string
  status: LogStatus
  bpm: number | null
  /** null for songs played without timing (e.g. imported history) */
  seconds_allocated: number | null
}

const pad = (n: number): string => String(n).padStart(2, '0')
const toLocalDate = (d: Date): string =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const parseLocalDate = (s: string): Date => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}
const addDays = (d: Date, n: number): Date =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)

/** Everything for the Stats tab. The data is one person's practice log, so it's computed in JS. */
export function getStats(now = new Date()): Stats {
  const db = getDb()
  const sinceRow = db
    .prepare('SELECT value FROM Setting WHERE key = ?')
    .pluck()
    .get(SETTING.recordsSince) as string | undefined
  const since = sinceRow && /^\d{4}-\d{2}-\d{2}$/.test(sinceRow) ? sinceRow : null
  // Every figure below is computed from these two, so nothing before the cut-off counts.
  const sessions = db
    // Sessions with nothing logged (started, then abandoned) aren't practice.
    .prepare(
      `SELECT id, date, day_name, started_at, finished_at FROM PracticeSession s
       WHERE s.date >= ? AND EXISTS (SELECT 1 FROM ExerciseLog l WHERE l.session_id = s.id)`
    )
    .all(since ?? '') as SessionRow[]
  const logs = db
    .prepare(
      `SELECT l.session_id, s.date, l.exercise_id, l.exercise_name, l.status, l.bpm, l.seconds_allocated
       FROM ExerciseLog l JOIN PracticeSession s ON s.id = l.session_id
       WHERE s.date >= ?
       ORDER BY l.logged_at, l.id`
    )
    .all(since ?? '') as LogRow[]
  const liveNames = new Map(
    (db.prepare('SELECT id, name FROM Exercise').all() as { id: number; name: string }[]).map(
      (e) => [e.id, e.name]
    )
  )

  // ---- periods ([from, to) as local dates) ----
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const weekStart = addDays(today, -WEEKDAYS.indexOf(weekdayOf(today)))
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
  const yearStart = new Date(today.getFullYear(), 0, 1)
  const tomorrow = addDays(today, 1)

  const totals = (from: Date | null, to: Date): PeriodTotals => {
    const f = from ? toLocalDate(from) : ''
    const t = toLocalDate(to)
    const inRange = (date: string): boolean => date >= f && date < t
    const ls = logs.filter((l) => inRange(l.date))
    const done = ls.filter((l) => l.status === 'completed')
    return {
      sessions: sessions.filter((s) => inRange(s.date)).length,
      daysPracticed: new Set(done.map((l) => l.date)).size,
      completed: done.length,
      skipped: ls.length - done.length,
      practiceSeconds: done.reduce((sum, l) => sum + (l.seconds_allocated ?? 0), 0)
    }
  }

  // ---- per date ----
  const perDate = new Map<string, number>()
  for (const l of logs) {
    if (l.status !== 'completed') continue
    perDate.set(l.date, (perDate.get(l.date) ?? 0) + (l.seconds_allocated ?? 0))
  }
  const practicedDates = [...perDate.keys()].sort()

  // ---- streaks ----
  let longest: Stats['longestStreak'] = null
  let runStart = ''
  let runLen = 0
  let prev: string | null = null
  for (const d of practicedDates) {
    const consecutive = prev !== null && toLocalDate(addDays(parseLocalDate(prev), 1)) === d
    if (consecutive) runLen++
    else {
      runStart = d
      runLen = 1
    }
    if (!longest || runLen > longest.days) longest = { days: runLen, from: runStart, to: d }
    prev = d
  }
  let currentStreak = 0
  let cursor = perDate.has(toLocalDate(today)) ? today : addDays(today, -1)
  while (perDate.has(toLocalDate(cursor))) {
    currentStreak++
    cursor = addDays(cursor, -1)
  }

  // ---- records ----
  let bestDay: Stats['bestDay'] = null
  for (const date of practicedDates) {
    const secs = perDate.get(date)!
    if (!bestDay || secs > bestDay.practiceSeconds) bestDay = { date, practiceSeconds: secs }
  }
  const finished = sessions
    .filter((s) => s.finished_at)
    .map((s) => ({
      s,
      seconds: Math.max(0, (Date.parse(s.finished_at!) - Date.parse(s.started_at)) / 1000)
    }))
    .filter((x) => x.seconds > 0)
  const longestSession = finished.reduce<Stats['longestSession']>(
    (best, x) =>
      !best || x.seconds > best.seconds
        ? { date: x.s.date, dayName: x.s.day_name, seconds: Math.round(x.seconds) }
        : best,
    null
  )
  const averageSessionSeconds = finished.length
    ? Math.round(finished.reduce((sum, x) => sum + x.seconds, 0) / finished.length)
    : null

  // ---- distributions ----
  const activityFrom = toLocalDate(addDays(weekStart, -52 * 7))
  const activity = practicedDates
    .filter((d) => d >= activityFrom)
    .map((date) => ({ date, practiceSeconds: perDate.get(date)! }))

  const byWeekday = WEEKDAYS.map((weekday) => ({ weekday, practiceSeconds: 0, sessions: 0 }))
  for (const [date, secs] of perDate) {
    byWeekday[WEEKDAYS.indexOf(weekdayOf(parseLocalDate(date)))].practiceSeconds += secs
  }
  for (const s of sessions)
    byWeekday[WEEKDAYS.indexOf(weekdayOf(parseLocalDate(s.date)))].sessions++

  const buckets = [
    { label: 'Morning', from: 5, to: 12 },
    { label: 'Afternoon', from: 12, to: 18 },
    { label: 'Evening', from: 18, to: 23 },
    { label: 'Night', from: 23, to: 29 } // wraps past midnight to 5am
  ]
  const byTimeOfDay = buckets.map((b) => ({ label: b.label, sessions: 0 }))
  for (const s of sessions) {
    let h = new Date(s.started_at).getHours()
    if (h < 5) h += 24
    byTimeOfDay[buckets.findIndex((b) => h >= b.from && h < b.to)].sessions++
  }

  const dayCounts = new Map<string, number>()
  for (const s of sessions) dayCounts.set(s.day_name, (dayCounts.get(s.day_name) ?? 0) + 1)
  const topDays = [...dayCounts]
    .map(([name, n]) => ({ name, sessions: n }))
    .sort((a, b) => b.sessions - a.sessions)
    .slice(0, 5)

  // ---- per exercise ----
  const perExercise = new Map<number, ExerciseStat>()
  const gains = new Map<number, BpmGain>()
  for (const l of logs) {
    const name = liveNames.get(l.exercise_id) ?? l.exercise_name // logs are oldest first: last wins
    const deleted = !liveNames.has(l.exercise_id)
    const e = perExercise.get(l.exercise_id) ?? {
      exerciseId: l.exercise_id,
      name,
      deleted,
      completed: 0,
      skipped: 0,
      practiceSeconds: 0
    }
    e.name = name
    if (l.status === 'completed') {
      e.completed++
      e.practiceSeconds += l.seconds_allocated ?? 0
    } else e.skipped++
    perExercise.set(l.exercise_id, e)

    if (l.status === 'completed' && l.bpm !== null) {
      const g = gains.get(l.exercise_id)
      if (!g) {
        gains.set(l.exercise_id, {
          exerciseId: l.exercise_id,
          name,
          deleted,
          firstBpm: l.bpm,
          bestBpm: l.bpm,
          firstDate: l.date,
          bestDate: l.date
        })
      } else {
        g.name = name
        if (l.bpm > g.bestBpm) {
          g.bestBpm = l.bpm
          g.bestDate = l.date
        }
      }
    }
  }
  const exercises = [...perExercise.values()]

  return {
    today: toLocalDate(today),
    week: totals(weekStart, tomorrow),
    month: totals(monthStart, tomorrow),
    year: totals(yearStart, tomorrow),
    allTime: totals(null, tomorrow),
    recordsSince: since,
    lastWeek: totals(addDays(weekStart, -7), weekStart),
    lastMonth: totals(new Date(today.getFullYear(), today.getMonth() - 1, 1), monthStart),
    lastYear: totals(new Date(today.getFullYear() - 1, 0, 1), yearStart),
    currentStreak,
    longestStreak: longest,
    firstSessionDate: sessions.length ? sessions.map((s) => s.date).sort()[0] : null,
    bestDay,
    longestSession,
    averageSessionSeconds,
    activity,
    byWeekday,
    byTimeOfDay,
    topDays,
    topExercises: exercises
      .filter((e) => e.completed > 0)
      .sort((a, b) => b.practiceSeconds - a.practiceSeconds || b.completed - a.completed)
      .slice(0, 5),
    mostSkipped: exercises
      .filter((e) => e.skipped > 0)
      .sort((a, b) => b.skipped - a.skipped || a.completed - b.completed)
      .slice(0, 5),
    bpmGains: [...gains.values()]
      .filter((g) => g.bestBpm > g.firstBpm)
      .sort((a, b) => b.bestBpm - b.firstBpm - (a.bestBpm - a.firstBpm))
      .slice(0, 5)
  }
}
