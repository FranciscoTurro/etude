import { useEffect, useMemo, useState } from 'react'
import { cn } from 'cn'
import { FlameIcon } from 'lucide-react'
import type { ExerciseStat, PeriodTotals, Stats } from '../../../../shared/stats'
import { WEEKDAY_LABELS } from '../../../../shared/week'
import { formatLongDate, parseLocalDate, toLocalDate } from './dates'

/** '2h 05m', '45m', '0m' */
function formatHours(seconds: number): string {
  const totalMin = Math.round(seconds / 60)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  return h ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`
}

const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? '' : 's'}`

export function StatsView({ visible }: { visible: boolean }): React.JSX.Element {
  const [stats, setStats] = useState<Stats | null>(null)

  useEffect(() => {
    if (visible) window.api.history.stats().then(setStats)
  }, [visible])

  if (!stats) return <div className="p-6" />
  if (stats.allTime.sessions === 0) {
    return (
      <div className="p-6">
        <div className="rounded-xl border border-dashed p-10 text-center text-muted-foreground">
          No practice yet. Your stats show up here after your first session.
        </div>
      </div>
    )
  }

  const all = stats.allTime
  const logged = all.completed + all.skipped
  const sinceNote = stats.recordsSince ? `since ${formatLongDate(stats.recordsSince)}` : undefined
  const year = parseLocalDate(stats.today).getFullYear()

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 p-6 xl:px-8">
      <p className="text-muted-foreground">{headline(stats)}</p>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <PeriodCard title="This week" t={stats.week} prev={stats.lastWeek} prevLabel="last week" />
        <PeriodCard
          title="This month"
          t={stats.month}
          prev={stats.lastMonth}
          prevLabel="last month"
        />
        <PeriodCard
          title={`${year}`}
          t={stats.year}
          prev={stats.lastYear}
          prevLabel={`${year - 1}`}
        />
        <PeriodCard
          title={stats.recordsSince ? 'Total' : 'All time'}
          t={all}
          note={
            sinceNote ??
            (stats.firstSessionDate ? `since ${formatLongDate(stats.firstSessionDate)}` : undefined)
          }
        />
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Fact
          label="Current streak"
          value={plural(stats.currentStreak, 'day')}
          icon={stats.currentStreak > 1 ? <FlameIcon className="size-4 text-signal" /> : null}
          note={stats.currentStreak === 0 ? 'Practice today to start one' : sinceNote}
        />
        <Fact
          label="Longest streak"
          value={stats.longestStreak ? plural(stats.longestStreak.days, 'day') : '–'}
          note={
            stats.longestStreak && stats.longestStreak.days > 1
              ? `${formatLongDate(stats.longestStreak.from)} – ${formatLongDate(stats.longestStreak.to)}`
              : sinceNote
          }
        />
        <Fact
          label="Completed"
          value={logged ? `${Math.round((all.completed / logged) * 100)}%` : '–'}
          note={`${all.completed} done, ${all.skipped} skipped${sinceNote ? ` ${sinceNote}` : ''}`}
        />
        <Fact
          label="Average session"
          value={
            stats.averageSessionSeconds !== null ? formatHours(stats.averageSessionSeconds) : '–'
          }
          note={sinceNote ? `start to finish, ${sinceNote}` : 'start to finish'}
        />
      </div>

      <Card title="Activity" subtitle="Practice time per day, last 12 months">
        <Heatmap stats={stats} />
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="By weekday" subtitle={`Practice time, ${sinceNote ?? 'all time'}`}>
          <Bars
            rows={stats.byWeekday.map((w) => ({
              label: WEEKDAY_LABELS[w.weekday].slice(0, 3),
              value: w.practiceSeconds,
              text: formatHours(w.practiceSeconds),
              hint: `${WEEKDAY_LABELS[w.weekday]}: ${formatHours(w.practiceSeconds)} over ${plural(w.sessions, 'session')}`
            }))}
          />
        </Card>
        <Card title="Time of day" subtitle="When sessions start">
          <Bars
            rows={stats.byTimeOfDay.map((b) => ({
              label: b.label,
              value: b.sessions,
              text: String(b.sessions),
              hint: `${b.label}: ${plural(b.sessions, 'session')}`
            }))}
          />
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Most practiced" subtitle="By practice time">
          <ExerciseRows
            rows={stats.topExercises}
            right={(e) => formatHours(e.practiceSeconds)}
            sub={(e) => plural(e.completed, 'time')}
            empty="Nothing completed yet."
          />
        </Card>
        <Card title="Biggest BPM gains" subtitle="First logged BPM to best">
          {stats.bpmGains.length === 0 ? (
            <Empty>No BPM gains yet. Keep pushing.</Empty>
          ) : (
            <ul className="flex flex-col divide-y">
              {stats.bpmGains.map((g) => (
                <li key={g.exerciseId} className="flex items-center gap-3 py-2 text-sm">
                  <Name name={g.name} deleted={g.deleted} />
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {g.firstBpm} → {g.bestBpm}
                  </span>
                  <span className="w-14 text-right font-medium tabular-nums">
                    +{g.bestBpm - g.firstBpm}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Most skipped" subtitle="Maybe they need a rethink">
          <ExerciseRows
            rows={stats.mostSkipped}
            right={(e) => plural(e.skipped, 'skip')}
            sub={(e) => `${Math.round((e.skipped / (e.skipped + e.completed)) * 100)}% of the time`}
            empty="You haven't skipped anything."
          />
        </Card>
        <Card title="Records" subtitle={sinceNote && `Counting ${sinceNote}`}>
          <ul className="flex flex-col divide-y text-sm">
            {stats.bestDay && (
              <Record
                label="Most practice in a day"
                value={formatHours(stats.bestDay.practiceSeconds)}
                note={formatLongDate(stats.bestDay.date)}
              />
            )}
            {stats.longestSession && (
              <Record
                label="Longest session"
                value={formatHours(stats.longestSession.seconds)}
                note={`${stats.longestSession.dayName}, ${formatLongDate(stats.longestSession.date)}`}
              />
            )}
            {stats.topDays[0] && (
              <Record
                label="Most played day"
                value={stats.topDays[0].name}
                note={plural(stats.topDays[0].sessions, 'session')}
              />
            )}
            <Record
              label="Total practice"
              value={formatHours(all.practiceSeconds)}
              note={`${plural(all.sessions, 'session')} on ${plural(all.daysPracticed, 'day')}`}
            />
          </ul>
        </Card>
      </div>
    </div>
  )
}

function headline(s: Stats): string {
  const parts = [
    `You practiced on ${plural(s.month.daysPracticed, 'day')} this month and ${plural(s.year.daysPracticed, 'day')} this year`
  ]
  if (s.currentStreak > 1) parts.push(`and you're on a ${s.currentStreak}-day streak`)
  const counting = s.recordsSince ? ` Counting practice since ${formatLongDate(s.recordsSince)}.` : ''
  return parts.join(', ') + '.' + counting
}

// ---- pieces ----

function Card({
  title,
  subtitle,
  children
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <section className="surface flex flex-col gap-3 p-6">
      <header>
        <h3 className="font-heading font-semibold">{title}</h3>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </header>
      {children}
    </section>
  )
}

function PeriodCard({
  title,
  t,
  prev,
  prevLabel,
  note
}: {
  title: string
  t: PeriodTotals
  prev?: PeriodTotals
  prevLabel?: string
  note?: string
}): React.JSX.Element {
  return (
    <div className="surface flex flex-col gap-1 p-5">
      <span className="text-xs text-muted-foreground">{title}</span>
      <span className="font-heading text-3xl font-semibold tabular-nums">
        {formatHours(t.practiceSeconds)}
      </span>
      <span className="text-sm">
        {plural(t.sessions, 'session')} · {plural(t.daysPracticed, 'day')}
      </span>
      <span className="text-xs text-muted-foreground">
        {prev && prevLabel ? `${formatHours(prev.practiceSeconds)} ${prevLabel}` : note}
      </span>
    </div>
  )
}

function Fact({
  label,
  value,
  note,
  icon
}: {
  label: string
  value: string
  note?: string
  icon?: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="surface flex flex-col gap-0.5 p-5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="flex items-center gap-1.5 font-heading text-2xl font-semibold tabular-nums">
        {value}
        {icon}
      </span>
      {note && <span className="truncate text-xs text-muted-foreground">{note}</span>}
    </div>
  )
}

function Record({
  label,
  value,
  note
}: {
  label: string
  value: string
  note: string
}): React.JSX.Element {
  return (
    <li className="flex items-center gap-3 py-2">
      <span className="flex min-w-0 flex-1 flex-col">
        <span>{label}</span>
        <span className="truncate text-xs text-muted-foreground">{note}</span>
      </span>
      <span className="max-w-[50%] truncate font-medium tabular-nums">{value}</span>
    </li>
  )
}

function Name({ name, deleted }: { name: string; deleted: boolean }): React.JSX.Element {
  return (
    <span className="min-w-0 flex-1 truncate" title={name}>
      {name}
      {deleted && <span className="ml-1.5 text-xs text-muted-foreground">(deleted)</span>}
    </span>
  )
}

function Empty({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <p className="py-2 text-sm text-muted-foreground">{children}</p>
}

function ExerciseRows({
  rows,
  right,
  sub,
  empty
}: {
  rows: ExerciseStat[]
  right: (e: ExerciseStat) => string
  sub: (e: ExerciseStat) => string
  empty: string
}): React.JSX.Element {
  if (rows.length === 0) return <Empty>{empty}</Empty>
  return (
    <ul className="flex flex-col divide-y">
      {rows.map((e) => (
        <li key={e.exerciseId} className="flex items-center gap-3 py-2 text-sm">
          <Name name={e.name} deleted={e.deleted} />
          <span className="text-xs text-muted-foreground">{sub(e)}</span>
          <span className="w-16 text-right font-medium tabular-nums">{right(e)}</span>
        </li>
      ))}
    </ul>
  )
}

/** Horizontal bars, one series: single hue, value labels in text ink. */
function Bars({
  rows
}: {
  rows: { label: string; value: number; text: string; hint: string }[]
}): React.JSX.Element {
  const max = Math.max(1, ...rows.map((r) => r.value))
  return (
    <ul className="flex flex-col gap-1.5">
      {rows.map((r) => (
        <li key={r.label} className="group flex items-center gap-3 text-sm" title={r.hint}>
          <span className="w-20 shrink-0 text-muted-foreground">{r.label}</span>
          <span className="relative h-5 flex-1">
            <span
              className="absolute inset-y-0 left-0 rounded-r-[4px] bg-primary transition-opacity group-hover:opacity-80"
              style={{ width: `${(r.value / max) * 100}%`, minWidth: r.value ? 2 : 0 }}
            />
          </span>
          <span className="w-16 shrink-0 text-right tabular-nums">{r.text}</span>
        </li>
      ))}
    </ul>
  )
}

const LEVEL_CLASSES = ['bg-muted', 'bg-signal/25', 'bg-signal/50', 'bg-signal/75', 'bg-signal']
const DAY_MS = 24 * 60 * 60 * 1000

/** 53 weeks × 7 days, Monday on top. Shade = practice time, split into quartiles of active days. */
function Heatmap({ stats }: { stats: Stats }): React.JSX.Element {
  const [hover, setHover] = useState<string | null>(null)
  const { weeks, months, thresholds, byDate } = useMemo(() => {
    const byDate = new Map(stats.activity.map((a) => [a.date, a.practiceSeconds]))
    const values = [...byDate.values()].sort((a, b) => a - b)
    const q = (p: number): number =>
      values[Math.min(values.length - 1, Math.floor(p * values.length))]
    const thresholds = values.length ? [q(0.25), q(0.5), q(0.75)] : []

    const today = parseLocalDate(stats.today)
    const endOfToday = new Date(today.getTime() + DAY_MS - 1)
    const mondayOffset = (today.getDay() + 6) % 7
    const start = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() - mondayOffset - 52 * 7
    )
    const weeks: (string | null)[][] = []
    const months: { col: number; label: string }[] = []
    for (let w = 0; w < 53; w++) {
      const col: (string | null)[] = []
      for (let d = 0; d < 7; d++) {
        const date = new Date(start.getTime() + (w * 7 + d) * DAY_MS + 12 * 60 * 60 * 1000) // noon: DST-safe
        col.push(date > endOfToday ? null : toLocalDate(date))
        if (date.getDate() === 1 && date <= endOfToday) {
          months.push({ col: w, label: date.toLocaleDateString(undefined, { month: 'short' }) })
        }
      }
      weeks.push(col)
    }
    return { weeks, months, thresholds, byDate }
  }, [stats])

  const level = (secs: number | undefined): number => {
    if (!secs) return 0
    return 1 + thresholds.filter((t) => secs > t).length
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Fills the card: 53 equal week columns, square cells. Scrolls only when too narrow. */}
      <div className="overflow-x-auto">
        <div className="flex min-w-[40rem] flex-col gap-1.5">
          <div className="relative h-4 text-xs text-muted-foreground">
            {months.map((m) => (
              <span
                key={`${m.col}-${m.label}`}
                className="absolute"
                style={{ left: `${(m.col / weeks.length) * 100}%` }}
              >
                {m.label}
              </span>
            ))}
          </div>
          <div
            className="grid gap-[3px]"
            style={{ gridTemplateColumns: `repeat(${weeks.length}, minmax(0, 1fr))` }}
            onMouseLeave={() => setHover(null)}
          >
            {weeks.map((col, w) => (
              <div key={w} className="flex flex-col gap-[3px]">
                {col.map((date, d) =>
                  date === null ? (
                    <span key={d} className="aspect-square w-full" />
                  ) : (
                    <span
                      key={d}
                      className={cn(
                        'aspect-square w-full rounded-[3px] ring-foreground/60 hover:ring-1',
                        LEVEL_CLASSES[level(byDate.get(date))]
                      )}
                      onMouseEnter={() => setHover(date)}
                      aria-label={`${formatLongDate(date)}: ${formatHours(byDate.get(date) ?? 0)}`}
                    />
                  )
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <span className="h-4 tabular-nums" aria-live="polite">
          {hover
            ? `${formatLongDate(hover)}: ${byDate.get(hover) ? formatHours(byDate.get(hover)!) : 'no practice'}`
            : 'Hover a day for details'}
        </span>
        <span className="flex items-center gap-1">
          Less
          {LEVEL_CLASSES.map((c) => (
            <span key={c} className={cn('size-3 rounded-[3px]', c)} />
          ))}
          More
        </span>
      </div>
    </div>
  )
}
