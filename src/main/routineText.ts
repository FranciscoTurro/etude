import { listDays } from './db/days'
import { getWeekSchedule } from './db/week'
import { WEEKDAYS, WEEKDAY_LABELS } from '../shared/week'
import { formatDuration } from '../shared/exercise'
import type { SlotExercise } from '../shared/day'

/** The week as plain text: each weekday, its day's exercises, their observations and time. */
export function routineText(): string {
  const days = new Map(listDays().map((d) => [d.id, d]))
  const schedule = new Map(getWeekSchedule().map((e) => [e.weekday, e.dayId]))
  const out: string[] = []

  for (const weekday of WEEKDAYS) {
    const dayId = schedule.get(weekday) ?? null
    const day = dayId === null ? undefined : days.get(dayId)
    const label = WEEKDAY_LABELS[weekday].toUpperCase()

    if (!day) {
      out.push(`${label}: Rest day`, '')
      continue
    }
    out.push(`${label}: ${day.name}`)
    if (day.slots.length === 0) out.push('  (no exercises)')

    day.slots.forEach((slot, i) => {
      const n = `${i + 1}.`
      if (slot.song) {
        out.push(`  ${n} Song (any song, untimed)`)
        return
      }
      if (slot.exercises.length === 1) {
        out.push(...exerciseLines(slot.exercises[0], `  ${n} `))
        return
      }
      out.push(`  ${n} One of:`)
      for (const ex of slot.exercises) out.push(...exerciseLines(ex, '     - '))
    })
    out.push('')
  }

  return out.join('\r\n').trimEnd() + '\r\n'
}

function exerciseLines(ex: SlotExercise, prefix: string): string[] {
  const time = ex.allocatedSeconds === null ? 'untimed' : formatDuration(ex.allocatedSeconds)
  const indent = ' '.repeat(prefix.length)
  const lines = [`${prefix}${ex.name} (${time})`]
  const obs = ex.description.trim()
  if (obs) {
    const [first, ...rest] = obs.split(/\r?\n/)
    lines.push(`${indent}Observations: ${first}`)
    for (const line of rest) lines.push(`${indent}  ${line}`)
  }
  return lines
}
