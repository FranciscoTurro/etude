/** 'YYYY-MM-DD' (a local date) -> Date at local midnight. `new Date(str)` would treat it as UTC. */
export function parseLocalDate(date: string): Date {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** Date -> its local 'YYYY-MM-DD' (the format PracticeSession.date uses). */
export function toLocalDate(d: Date): string {
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function formatShortDate(d: Date): string {
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

/** 'Mon, Nov 2', with the year added when it isn't the current one. */
export function formatLongDate(date: string): string {
  const d = parseLocalDate(date)
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric'
  })
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

/** 'Today', 'Yesterday', '3 days ago', or a short date beyond a week. */
export function formatRelativeDay(iso: string): string {
  const d = new Date(iso)
  d.setHours(0, 0, 0, 0)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const days = Math.round((today.getTime() - d.getTime()) / (24 * 60 * 60 * 1000))
  if (days <= 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days} days ago`
  return d.getFullYear() === today.getFullYear()
    ? formatShortDate(d)
    : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}
