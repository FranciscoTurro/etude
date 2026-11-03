import { useState } from 'react'
import { PencilIcon, PlusIcon, TimerIcon, Trash2Icon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog'
import { formatDuration, type Exercise } from '../../../../shared/exercise'
import type { Day } from '../../../../shared/day'
import { WEEKDAY_LABELS, type WeekScheduleEntry } from '../../../../shared/week'
import { DayEditorDialog } from './DayEditorDialog'

interface Props {
  days: Day[] | null
  week: WeekScheduleEntry[]
  exercises: Exercise[]
  onChanged: () => void
}

export function DaysPanel({ days, week, exercises, onChanged }: Props): React.JSX.Element {
  const [editorOpen, setEditorOpen] = useState(false)
  const [editing, setEditing] = useState<Day | null>(null)
  const [deleting, setDeleting] = useState<Day | null>(null)

  function openCreate(): void {
    setEditing(null)
    setEditorOpen(true)
  }

  function openEdit(day: Day): void {
    setEditing(day)
    setEditorOpen(true)
  }

  async function confirmDelete(): Promise<void> {
    if (!deleting) return
    await window.api.days.delete(deleting.id)
    setDeleting(null)
    onChanged()
  }

  const canCreate = exercises.length > 0
  const deletingWeekdays = deleting
    ? week.filter((w) => w.dayId === deleting.id).map((w) => WEEKDAY_LABELS[w.weekday])
    : []

  return (
    <section className="flex flex-col gap-4">
      <header className="flex items-center justify-between">
        <h2 className="font-heading text-xl font-semibold tracking-tight">Days</h2>
        {days && days.length > 0 && (
          <Button size="sm" onClick={openCreate} disabled={!canCreate}>
            <PlusIcon /> New day
          </Button>
        )}
      </header>

      {days?.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed p-10 text-center">
          <p className="text-muted-foreground">
            {canCreate ? 'No days yet.' : 'Create an exercise first, then group them into days.'}
          </p>
          <Button onClick={openCreate} disabled={!canCreate}>
            <PlusIcon /> Create a day
          </Button>
        </div>
      )}

      <ul className="flex flex-col gap-3">
        {days?.map((day) => (
          <li key={day.id}>
            <Card>
              <CardHeader>
                <CardTitle>{day.name}</CardTitle>
                <CardDescription className="flex items-center gap-4">
                  <span className="flex items-center gap-1">
                    <TimerIcon className="size-3.5" />
                    {formatDuration(day.totalSeconds)}
                  </span>
                  <span>
                    {day.slots.length} {day.slots.length === 1 ? 'exercise' : 'exercises'}
                  </span>
                </CardDescription>
                <CardAction className="flex gap-1">
                  <Button variant="ghost" size="icon-sm" onClick={() => openEdit(day)} title="Edit">
                    <PencilIcon />
                  </Button>
                  <Button variant="ghost" size="icon-sm" onClick={() => setDeleting(day)} title="Delete">
                    <Trash2Icon />
                  </Button>
                </CardAction>
              </CardHeader>
              {day.slots.length > 0 && (
                <CardContent>
                  <ol className="flex list-decimal flex-col gap-1 pl-5 text-sm">
                    {day.slots.map((slot, i) => (
                      <li key={i}>
                        {slot.exercises.map((e, j) => (
                          <span key={e.id}>
                            {j > 0 && <span className="text-muted-foreground"> / </span>}
                            <span
                              className={
                                slot.exercises.length > 1 && e.id === slot.preselectedId
                                  ? 'font-medium'
                                  : slot.exercises.length > 1
                                    ? 'text-muted-foreground'
                                    : undefined
                              }
                            >
                              {e.name}
                            </span>
                          </span>
                        ))}
                      </li>
                    ))}
                  </ol>
                </CardContent>
              )}
            </Card>
          </li>
        ))}
      </ul>

      <DayEditorDialog
        open={editorOpen}
        day={editing}
        exercises={exercises}
        onOpenChange={setEditorOpen}
        onSaved={() => {
          setEditorOpen(false)
          onChanged()
        }}
      />

      <AlertDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleting?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              {deletingWeekdays.length > 0 && (
                <>
                  {listNames(deletingWeekdays)} will become{' '}
                  {deletingWeekdays.length === 1 ? 'a rest day' : 'rest days'}.{' '}
                </>
              )}
              Its exercises are kept, and past sessions keep their history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={confirmDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}

function listNames(names: string[]): string {
  if (names.length <= 1) return names.join('')
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}
