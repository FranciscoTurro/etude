import { useEffect, useMemo, useState } from 'react'
import { cn } from 'cn'
import type { BpmPoint, GraphableExercise } from '../../../../shared/history'
import { BpmChart } from './BpmChart'
import { parseLocalDate } from './dates'
import { ExerciseList } from './ExerciseList'
import { SessionsPane } from './SessionsPane'
import { StatsView } from './StatsView'

const DAY_MS = 24 * 60 * 60 * 1000
const RANGES = [
  { key: '30d', label: '30d', days: 30 },
  { key: '90d', label: '90d', days: 90 },
  { key: '1y', label: '1y', days: 365 },
  { key: 'all', label: 'All', days: null }
] as const
type RangeKey = (typeof RANGES)[number]['key']

interface Props {
  /** Reloads every time the tab is shown, so a just-finished session appears. */
  visible: boolean
}

const VIEWS = [
  { key: 'progress', label: 'Progress' },
  { key: 'stats', label: 'Stats' }
] as const
type View = (typeof VIEWS)[number]['key']

/** Progress (per-exercise graph + sessions) or Stats (totals, streaks, records). */
export function HistoryScreen({ visible }: Props): React.JSX.Element {
  const [view, setView] = useState<View>('progress')
  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 justify-center border-b py-2">
        <div className="flex rounded-md border p-0.5" role="tablist" aria-label="History view">
          {VIEWS.map((v) => (
            <button
              key={v.key}
              role="tab"
              aria-selected={view === v.key}
              onClick={() => setView(v.key)}
              className={cn(
                'rounded-sm px-3 py-1 text-xs font-medium transition-colors',
                view === v.key
                  ? 'bg-muted text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>
      <div className={cn('min-h-0 flex-1', view !== 'progress' && 'hidden')}>
        <ProgressView visible={visible && view === 'progress'} />
      </div>
      <div className={cn('min-h-0 flex-1 overflow-y-auto', view !== 'stats' && 'hidden')}>
        <StatsView visible={visible && view === 'stats'} />
      </div>
    </div>
  )
}

/** Three columns: exercise picker | BPM progress chart | session calendar + day log. */
function ProgressView({ visible }: Props): React.JSX.Element {
  const [exercises, setExercises] = useState<GraphableExercise[] | null>(null)
  const [selectedId, setSelectedId] = useState<number | null>(null)

  useEffect(() => {
    if (!visible) return
    window.api.history.exercises().then(setExercises)
  }, [visible])

  // Keep the selection if it still exists, otherwise fall back to the most recently practiced.
  const exercise =
    exercises?.find((e) => e.exerciseId === selectedId) ??
    exercises?.find((e) => !e.deleted) ??
    exercises?.[0] ??
    null

  return (
    <div className="grid h-full grid-cols-[14rem_minmax(0,1fr)_21rem] divide-x xl:grid-cols-[17rem_minmax(0,1fr)_25rem]">
      <section className="flex min-h-0 min-w-0 flex-col gap-4 p-6">
        <h2 className="font-heading text-xl font-semibold tracking-tight">Exercises</h2>
        {exercises?.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Exercises appear here once you complete one with a BPM.
          </p>
        )}
        {exercises && exercises.length > 0 && (
          <ExerciseList
            exercises={exercises}
            selectedId={exercise?.exerciseId ?? null}
            onSelect={setSelectedId}
          />
        )}
      </section>
      <ProgressSection visible={visible} exercise={exercise} empty={exercises?.length === 0} />
      <SessionsPane visible={visible} />
    </div>
  )
}

function ProgressSection({
  visible,
  exercise,
  empty
}: {
  visible: boolean
  exercise: GraphableExercise | null
  empty: boolean
}): React.JSX.Element {
  const [points, setPoints] = useState<BpmPoint[] | null>(null)
  const [range, setRange] = useState<RangeKey>('90d')
  const exerciseId = exercise?.exerciseId ?? null

  useEffect(() => {
    if (!visible || exerciseId === null) return
    let stale = false
    window.api.history.bpm(exerciseId).then((p) => !stale && setPoints(p))
    return () => {
      stale = true
    }
  }, [visible, exerciseId])

  const from = useMemo(() => {
    const days = RANGES.find((r) => r.key === range)!.days
    if (days === null) return null
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d.getTime() - days * DAY_MS
  }, [range])
  const shown = useMemo(
    () => (points ?? []).filter((p) => from === null || parseLocalDate(p.date).getTime() >= from),
    [points, from]
  )

  return (
    <section className="flex min-h-0 min-w-0 flex-col gap-4 p-6 xl:px-8">
      <header className="flex shrink-0 items-center justify-between gap-3">
        <h2
          className="min-w-0 truncate font-heading text-xl font-semibold tracking-tight"
          title={exercise?.name}
        >
          {exercise ? exercise.name : 'Progress'}
          {exercise?.deleted && (
            <span className="ml-2 text-sm font-normal text-muted-foreground">(deleted)</span>
          )}
        </h2>
        {exercise && (
          <div
            className="flex shrink-0 rounded-md border p-0.5"
            role="group"
            aria-label="Time range"
          >
            {RANGES.map((r) => (
              <button
                key={r.key}
                onClick={() => setRange(r.key)}
                aria-pressed={range === r.key}
                className={cn(
                  'rounded-sm px-2 py-0.5 text-xs font-medium transition-colors',
                  range === r.key
                    ? 'bg-muted text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {r.label}
              </button>
            ))}
          </div>
        )}
      </header>

      {empty && (
        <div className="rounded-xl border border-dashed p-10 text-center text-muted-foreground">
          No BPM history yet. Complete an exercise that has a BPM to see your progress here.
        </div>
      )}

      {exercise && points && (
        <div className="flex min-h-0 flex-1 flex-col gap-5 rounded-xl border p-5">
          <Summary points={shown} />
          {shown.length > 0 ? (
            <BpmChart points={shown} from={from} />
          ) : (
            <p className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
              Not practiced in this range.
            </p>
          )}
        </div>
      )}
    </section>
  )
}

function Summary({ points }: { points: BpmPoint[] }): React.JSX.Element | null {
  if (points.length === 0) return null
  const latest = points[points.length - 1].last
  const best = Math.max(...points.map((p) => p.max))
  const change = latest - points[0].last
  return (
    <dl className="grid grid-cols-3 gap-4">
      <Tile label="Latest" value={latest} />
      <Tile label="Best" value={best} />
      <Tile label="Change" value={change} signed />
    </dl>
  )
}

function Tile({
  label,
  value,
  signed
}: {
  label: string
  value: number
  signed?: boolean
}): React.JSX.Element {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-heading text-2xl font-semibold tabular-nums">
        {signed && value > 0 ? '+' : ''}
        {value}
        <span className="ml-1 text-sm font-normal text-muted-foreground">BPM</span>
      </dd>
    </div>
  )
}
