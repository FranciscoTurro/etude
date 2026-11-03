import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  validateExerciseInput,
  type Exercise,
  type ExerciseInput,
  type ExerciseInputErrors
} from '../../../../shared/exercise'

interface Props {
  open: boolean
  /** null = create a new exercise */
  exercise: Exercise | null
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}

export function ExerciseFormDialog({ open, exercise, onOpenChange, onSaved }: Props): React.JSX.Element {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{exercise ? 'Edit exercise' : 'New exercise'}</DialogTitle>
        </DialogHeader>
        {/* keyed so the fields reset every time the dialog opens for a different exercise */}
        {open && (
          <ExerciseForm key={exercise?.id ?? 'new'} exercise={exercise} onSaved={onSaved} />
        )}
      </DialogContent>
    </Dialog>
  )
}

function ExerciseForm({
  exercise,
  onSaved
}: {
  exercise: Exercise | null
  onSaved: () => void
}): React.JSX.Element {
  const [name, setName] = useState(exercise?.name ?? '')
  const [description, setDescription] = useState(exercise?.description ?? '')
  const [bpm, setBpm] = useState(exercise?.bpm?.toString() ?? '')
  const [minutes, setMinutes] = useState(
    exercise ? String(Math.floor(exercise.allocatedSeconds / 60)) : '5'
  )
  const [seconds, setSeconds] = useState(exercise ? String(exercise.allocatedSeconds % 60) : '0')
  const [errors, setErrors] = useState<ExerciseInputErrors>({})
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function submit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    const input: ExerciseInput = {
      name,
      description,
      bpm: bpm.trim() === '' ? null : Number(bpm),
      allocatedSeconds: (Number(minutes) || 0) * 60 + (Number(seconds) || 0)
    }
    const found = validateExerciseInput(input)
    setErrors(found)
    if (Object.keys(found).length) return

    setSaving(true)
    setSaveError(null)
    try {
      if (exercise) await window.api.exercises.update(exercise.id, input)
      else await window.api.exercises.create(input)
      onSaved()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      <div className="grid gap-1.5">
        <Label htmlFor="ex-name">Name</Label>
        <Input
          id="ex-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-invalid={!!errors.name}
          autoFocus
        />
        <FieldError message={errors.name} />
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="ex-description">Observations</Label>
        <Textarea
          id="ex-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
        />
      </div>

      <div className="grid grid-cols-2 items-start gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="ex-bpm">BPM</Label>
          <Input
            id="ex-bpm"
            type="number"
            min={1}
            max={400}
            placeholder="None"
            value={bpm}
            onChange={(e) => setBpm(e.target.value)}
            aria-invalid={!!errors.bpm}
          />
          <FieldError message={errors.bpm} />
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="ex-minutes">Time (min : sec)</Label>
          <div className="flex items-center gap-1.5">
            <Input
              id="ex-minutes"
              type="number"
              min={0}
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
              aria-invalid={!!errors.allocatedSeconds}
              aria-label="Minutes"
            />
            <span className="text-muted-foreground">:</span>
            <Input
              type="number"
              min={0}
              max={59}
              value={seconds}
              onChange={(e) => setSeconds(e.target.value)}
              aria-invalid={!!errors.allocatedSeconds}
              aria-label="Seconds"
            />
          </div>
          <FieldError message={errors.allocatedSeconds} />
        </div>
      </div>

      <FieldError message={saveError ?? undefined} />

      <DialogFooter>
        <Button type="submit" disabled={saving}>
          {exercise ? 'Save changes' : 'Create exercise'}
        </Button>
      </DialogFooter>
    </form>
  )
}

function FieldError({ message }: { message?: string }): React.JSX.Element | null {
  return message ? <p className="text-xs text-destructive">{message}</p> : null
}
