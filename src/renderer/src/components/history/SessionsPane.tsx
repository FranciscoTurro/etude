import { useEffect, useMemo, useState } from 'react'
import { cn } from 'cn'
import { CheckIcon, ChevronLeftIcon, ChevronRightIcon, RedoIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { formatMaybeDuration } from '../../../../shared/exercise'
import type { HistorySession, SessionSummary } from '../../../../shared/history'
import { formatLongDate, formatTime, parseLocalDate, toLocalDate } from './dates'

interface Props {
  /** Reloads every time the tab is shown, so a just-finished session appears. */
  visible: boolean
}

/** A calendar of practiced days (others greyed out) and the selected day's session(s). */
export function SessionsPane({ visible }: Props): React.JSX.Element {
  const [sessions, setSessions] = useState<SessionSummary[] | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [month, setMonth] = useState<Date>(new Date())
  const [shown, setShown] = useState<HistorySession[]>([])

  useEffect(() => {
    if (!visible) return
    window.api.history.sessions().then(setSessions)
  }, [visible])

  /** Practiced dates, newest first, each with its sessions oldest first. */
  const dates = useMemo(() => {
    const byDate = new Map<string, SessionSummary[]>()
    for (const s of sessions ?? []) byDate.set(s.date, [s, ...(byDate.get(s.date) ?? [])])
    return byDate
  }, [sessions])
  const dateList = useMemo(() => [...dates.keys()], [dates])

  // Keep the selected date if it was practiced, otherwise show the most recent one.
  const date = selected !== null && dates.has(selected) ? selected : (dateList[0] ?? null)
  const index = date === null ? -1 : dateList.indexOf(date)

  const ids =
    date === null
      ? ''
      : dates
          .get(date)!
          .map((s) => s.id)
          .join(',')
  useEffect(() => {
    if (!visible || !ids) return
    let stale = false
    Promise.all(ids.split(',').map((id) => window.api.history.session(Number(id)))).then(
      (list) => !stale && setShown(list.filter((s): s is HistorySession => s !== null))
    )
    return () => {
      stale = true
    }
  }, [visible, ids])

  function select(d: string): void {
    setSelected(d)
    setMonth(parseLocalDate(d))
  }

  // Jump the calendar to the latest session once the list arrives.
  useEffect(() => {
    if (selected === null && dateList[0]) setMonth(parseLocalDate(dateList[0]))
  }, [selected, dateList])

  const first = dateList[dateList.length - 1]

  return (
    <section className="flex min-h-0 min-w-0 flex-col gap-4 p-6">
      <header className="flex shrink-0 items-center justify-between gap-2">
        <h2 className="font-heading text-xl font-semibold tracking-tight">Sessions</h2>
        {date !== null && (
          <div className="flex items-center">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => select(dateList[index + 1])}
              disabled={index >= dateList.length - 1}
              title="Previous practice day"
              aria-label="Previous practice day"
            >
              <ChevronLeftIcon />
            </Button>
            <span className="w-28 text-center text-sm font-medium">{formatLongDate(date)}</span>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => select(dateList[index - 1])}
              disabled={index <= 0}
              title="Next practice day"
              aria-label="Next practice day"
            >
              <ChevronRightIcon />
            </Button>
          </div>
        )}
      </header>

      {sessions?.length === 0 && (
        <div className="rounded-xl border border-dashed p-10 text-center text-muted-foreground">
          No sessions yet.
        </div>
      )}

      {date !== null && (
        <div className="-mx-2 flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-2 pb-1">
          <Calendar
            mode="single"
            required
            selected={parseLocalDate(date)}
            onSelect={(d: Date) => select(toLocalDate(d))}
            month={month}
            onMonthChange={setMonth}
            startMonth={first ? parseLocalDate(first) : undefined}
            endMonth={new Date()}
            disabled={(d: Date) => !dates.has(toLocalDate(d))}
            weekStartsOn={1}
            showOutsideDays={false}
            // Stretch to the column width, but keep rows short instead of square cells.
            className="surface shrink-0 p-3 [--cell-size:--spacing(8)] [&_.rdp-day]:aspect-auto [&_.rdp-day]:h-(--cell-size) [&_.rdp-day_button]:aspect-auto [&_.rdp-day_button]:h-full"
            classNames={{ root: 'w-full' }}
          />
          <div className="flex flex-col gap-3">
            {shown.map((s) => (
              <SessionCard key={s.id} session={s} />
            ))}
          </div>
        </div>
      )}
    </section>
  )
}

function SessionCard({ session: s }: { session: HistorySession }): React.JSX.Element {
  const completed = s.logs.filter((l) => l.status === 'completed').length
  const skipped = s.logs.length - completed
  return (
    <div className="surface overflow-hidden">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b px-4 py-2.5">
        <span className="min-w-0 truncate font-medium" title={s.dayName}>
          {s.dayName}
        </span>
        <span className="text-xs text-muted-foreground tabular-nums">
          {completed} done{skipped > 0 && ` · ${skipped} skipped`} · {formatTime(s.startedAt)}
          {s.finishedAt ? `–${formatTime(s.finishedAt)}` : ' · unfinished'}
        </span>
      </div>
      {s.logs.length === 0 ? (
        <p className="px-4 py-2.5 text-sm text-muted-foreground">Nothing logged.</p>
      ) : (
        <ul className="divide-y">
          {s.logs.map((l) => (
            <li
              key={l.id}
              className={cn(
                'grid grid-cols-[auto_1fr_auto_auto] items-center gap-3 px-4 py-2 text-sm',
                l.status === 'skipped' && 'text-muted-foreground'
              )}
            >
              {l.status === 'completed' ? (
                <CheckIcon className="size-4" aria-label="Completed" />
              ) : (
                <RedoIcon className="size-4" aria-label="Skipped" />
              )}
              <span className="truncate" title={l.exerciseName}>
                {l.exerciseName}
              </span>
              <span className="text-right tabular-nums">
                {l.status === 'skipped' ? 'skipped' : l.bpm !== null ? `${l.bpm} BPM` : '—'}
              </span>
              <span className="w-10 text-right text-muted-foreground tabular-nums">
                {formatMaybeDuration(l.secondsAllocated)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
