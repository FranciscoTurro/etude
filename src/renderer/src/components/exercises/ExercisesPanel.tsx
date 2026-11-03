import { useState } from 'react'
import { cn } from 'cn'
import { CopyIcon, MetronomeIcon, PencilIcon, PlusIcon, TimerIcon, Trash2Icon } from 'lucide-react'
import { Button } from '@/components/ui/button'
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
  onChanged: () => void
}

export function ExercisesPanel({ tabs, kind, exercises, onChanged }: Props): React.JSX.Element {
  const noun = kind === 'song' ? 'song' : 'exercise'
  const [gridRef, { cols, rows }] = useGridFit<HTMLUListElement>(300, 124)
  const { shown, page, pages, setPage } = usePages(exercises ?? [], cols * rows)
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

      {/* Exactly as many equal cells as fit; the rest goes on other pages. */}
      <ul
        ref={gridRef}
        className={cn('grid min-h-0 flex-1', exercises?.length === 0 && 'hidden')}
        style={gridStyle(cols, rows)}
      >
        {shown.map((exercise) => (
          <li key={exercise.id} className="min-w-0">
            <Card className="h-full">
              <CardHeader>
                <CardTitle className="min-w-0 truncate" title={exercise.name}>
                  {exercise.name}
                </CardTitle>
                <CardDescription className="flex items-center gap-4">
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
        ))}
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
