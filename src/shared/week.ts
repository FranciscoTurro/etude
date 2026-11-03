export const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
export type Weekday = (typeof WEEKDAYS)[number]

export const WEEKDAY_LABELS: Record<Weekday, string> = {
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday',
  sat: 'Saturday',
  sun: 'Sunday'
}

export interface WeekScheduleEntry {
  weekday: Weekday
  /** null = rest day */
  dayId: number | null
}

export const isWeekday = (v: unknown): v is Weekday => WEEKDAYS.includes(v as Weekday)

/** Local weekday of a date (JS getDay() is 0 = Sunday). */
export const weekdayOf = (date: Date): Weekday => WEEKDAYS[(date.getDay() + 6) % 7]
