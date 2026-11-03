import { useState } from 'react'
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
import { formatDuration, type Exercise } from '../../../../shared/exercise'
import { ExerciseFormDialog } from './ExerciseFormDialog'
import { DeleteExerciseDialog } from './DeleteExerciseDialog'

interface Props {
  exercises: Exercise[] | null
  onChanged: () => void
}

export function ExercisesPanel({ exercises, onChanged }: Props): React.JSX.Element {
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
    <section className="flex flex-col gap-4">
      <header className="flex items-center justify-between">
        <h2 className="font-heading text-xl font-semibold tracking-tight">Exercises</h2>
        {exercises && exercises.length > 0 && (
          <Button size="sm" onClick={openCreate}>
            <PlusIcon /> New exercise
          </Button>
        )}
      </header>

      {exercises?.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed p-10 text-center">
          <p className="text-muted-foreground">No exercises yet.</p>
          <Button onClick={openCreate}>
            <PlusIcon /> Create an exercise
          </Button>
        </div>
      )}

      <ul className="flex flex-col gap-3">
        {exercises?.map((exercise) => (
          <li key={exercise.id}>
            <Card>
              <CardHeader>
                <CardTitle>{exercise.name}</CardTitle>
                <CardDescription className="flex items-center gap-4">
                  <span className="flex items-center gap-1">
                    <TimerIcon className="size-3.5" />
                    {formatDuration(exercise.allocatedSeconds)}
                  </span>
                  <span className="flex items-center gap-1">
                    <MetronomeIcon className="size-3.5" />
                    {exercise.bpm ? `${exercise.bpm} BPM` : 'No BPM'}
                  </span>
                </CardDescription>
                <CardAction className="flex gap-1">
                  <Button variant="ghost" size="icon-sm" onClick={() => openEdit(exercise)} title="Edit">
                    <PencilIcon />
                  </Button>
                  <Button variant="ghost" size="icon-sm" onClick={() => duplicate(exercise)} title="Duplicate">
                    <CopyIcon />
                  </Button>
                  <Button variant="ghost" size="icon-sm" onClick={() => setDeleting(exercise)} title="Delete">
                    <Trash2Icon />
                  </Button>
                </CardAction>
              </CardHeader>
              {exercise.description && (
                <CardContent className="text-sm whitespace-pre-wrap text-muted-foreground">
                  {exercise.description}
                </CardContent>
              )}
            </Card>
          </li>
        ))}
      </ul>

      <ExerciseFormDialog
        open={formOpen}
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
