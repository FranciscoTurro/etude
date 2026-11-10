import { useEffect, useState } from 'react'
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
import { errorText } from '@/lib/errors'
import type { Exercise } from '../../../../shared/exercise'

interface Props {
  exercise: Exercise | null
  onOpenChange: (open: boolean) => void
  onDeleted: () => void
}

function listNames(names: string[]): string {
  if (names.length <= 1) return names.join('')
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

export function DeleteExerciseDialog({ exercise, onOpenChange, onDeleted }: Props): React.JSX.Element {
  const [days, setDays] = useState<string[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    setDays(null)
    setError(null)
    if (!exercise) return
    let cancelled = false
    window.api.exercises.daysUsing(exercise.id).then((d) => !cancelled && setDays(d))
    return () => {
      cancelled = true
    }
  }, [exercise])

  async function confirm(): Promise<void> {
    if (!exercise) return
    setDeleting(true)
    try {
      await window.api.exercises.delete(exercise.id)
      onDeleted()
    } catch (err) {
      setError(errorText(err))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <AlertDialog open={!!exercise} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {exercise?.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            {days && days.length > 0 && <>It&apos;ll be removed from {listNames(days)}. </>}
            Its practice history will be kept.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && <p className="text-xs text-destructive">{error}</p>}
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={confirm}
            disabled={deleting || days === null}
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
