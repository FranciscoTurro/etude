import { useMemo, useState } from 'react'
import { cn } from 'cn'
import {
  CopyIcon,
  MetronomeIcon,
  MusicIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
  TimerIcon,
  Trash2Icon
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
import { formatDuration, type Exercise, type ExerciseKind } from '../../../../shared/exercise'
import { Pager, gridStyle, useGridFit, usePages } from '@/components/library/paging'
import { ExerciseFormDialog } from './ExerciseFormDialog'
import { DeleteExerciseDialog } from './DeleteExerciseDialog'

interface Props {
  /** Library section switcher, shown as this panel's title */
  tabs: React.ReactNode
  /** Songs share this panel: same cards, minus the allocated time. */
  kind: ExerciseKind
  /** Only exercises of `kind` */
  exercises: Exercise[] | null
  /** Ids used by at least one day; the rest get highlighted. null while days load. */
  scheduledIds: Set<number> | null
  onChanged: () => void
}

export function ExercisesPanel({
  tabs,
  kind,
  exercises,
  scheduledIds,
  onChanged
}: Props): React.JSX.Element {
  const noun = kind === 'song' ? 'song' : 'exercise'
  const [query, setQuery] = useState('')
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!exercises || !q) return exercises ?? []
    return exercises.filter(
      (e) => e.name.toLowerCase().includes(q) || e.description.toLowerCase().includes(q)
    )
  }, [exercises, query])
  const [gridRef, { cols, rows }] = useGridFit<HTMLUListElement>(300, 124)
  const { shown, page, pages, setPage } = usePages(filtered, cols * rows)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Exercise | null>(null)
  const [deleting, setDeleting] = useState<Exercise | null>(null)

  function openCreate(): void {
    setEditing(null)
    setFormOpen(true)
  }

  function openEdit(exercise: Exercise): void {
    setEditing(exercise)
    setFormOpen(true)
  }

  async function duplicate(exercise: Exercise): Promise<void> {
    await window.api.exercises.duplicate(exercise.id)
    onChanged()
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col gap-4">
      <header className="flex shrink-0 items-center justify-between gap-3">
        {tabs}
        {exercises && exercises.length > 0 && (
          <div className="flex items-center gap-3">
            <div className="relative w-56">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  setPage(0)
                }}
                onKeyDown={(e) => e.key === 'Escape' && setQuery('')}
                placeholder={`Search ${noun}s…`}
                aria-label={`Search ${noun}s`}
                className="pl-8"
              />
            </div>
            <Pager page={page} pages={pages} onPage={setPage} />
            <Button size="sm" onClick={openCreate}>
              <PlusIcon /> New {noun}
            </Button>
          </div>
        )}
      </header>

      {exercises?.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed p-10 text-center">
          <p className="text-muted-foreground">No {noun}s yet.</p>
          <Button onClick={openCreate}>
            <PlusIcon /> Create {kind === 'song' ? 'a song' : 'an exercise'}
          </Button>
        </div>
      )}

      {exercises && exercises.length > 0 && filtered.length === 0 && (
        <p className="py-10 text-center text-muted-foreground">
          No {noun}s match “{query.trim()}”.
        </p>
      )}

      {/* Exactly as many equal cells as fit; the rest goes on other pages. */}
      <ul
        ref={gridRef}
        className={cn('grid min-h-0 flex-1', filtered.length === 0 && 'hidden')}
        style={gridStyle(cols, rows)}
      >
        {shown.map((exercise) => {
          const unscheduled = scheduledIds !== null && !scheduledIds.has(exercise.id)
          return (
            <li key={exercise.id} className="min-w-0">
              <Card
                className={cn(
                  'h-full',
                  unscheduled &&
                    'bg-[color-mix(in_oklab,var(--signal)_6%,var(--card))] ring-1 ring-signal/40'
                )}
                title={unscheduled ? `Not on any day` : undefined}
              >
                <CardHeader>
                  <CardTitle className="flex min-w-0 items-center gap-2" title={exercise.name}>
                    {exercise.kind === 'song' && (
                      <MusicIcon className="size-4 shrink-0 text-signal" aria-label="Song" />
                    )}
                    <span className="truncate">{exercise.name}</span>
                    {unscheduled && (
                      <span className="shrink-0 rounded-sm bg-signal/15 px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-signal uppercase">
                        No day
                      </span>
                    )}
                  </CardTitle>
                  <CardDescription className="flex items-center gap-4 font-mono text-xs">
                    {exercise.allocatedSeconds !== null && (
                      <span className="flex items-center gap-1">
                        <TimerIcon className="size-3.5" />
                        {formatDuration(exercise.allocatedSeconds)}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <MetronomeIcon className="size-3.5" />
                      {exercise.bpm ? `${exercise.bpm} BPM` : 'No BPM'}
                    </span>
                  </CardDescription>
                  <CardAction className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => openEdit(exercise)}
                      title="Edit"
                    >
                      <PencilIcon />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => duplicate(exercise)}
                      title="Duplicate"
                    >
                      <CopyIcon />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setDeleting(exercise)}
                      title="Delete"
                    >
                      <Trash2Icon />
                    </Button>
                  </CardAction>
                </CardHeader>
                {exercise.description && (
                  <CardContent
                    className="line-clamp-2 min-h-0 text-sm whitespace-pre-wrap text-muted-foreground"
                    title={exercise.description}
                  >
                    {exercise.description}
                  </CardContent>
                )}
              </Card>
            </li>
          )
        })}
      </ul>

      <ExerciseFormDialog
        open={formOpen}
        kind={kind}
        exercise={editing}
        onOpenChange={setFormOpen}
        onSaved={() => {
          setFormOpen(false)
          onChanged()
        }}
      />
      <DeleteExerciseDialog
        exercise={deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        onDeleted={() => {
          setDeleting(null)
          onChanged()
        }}
      />
    </section>
  )
}
