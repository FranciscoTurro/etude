import { useMemo, useRef, useState } from 'react'
import { GripVerticalIcon, MusicIcon, PlusIcon, XIcon } from 'lucide-react'
import { cn } from 'cn'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatDuration, type Exercise } from '../../../../shared/exercise'
import { SONG_SLOT, validateDayInput, type Day } from '../../../../shared/day'
import {
  addToSlot,
  effectiveId,
  insertSlot,
  insertSongSlot,
  makeSlot,
  makeSongSlot,
  moveSlot,
  removeExercise,
  removeSlot,
  type DraftSlot
} from './slotDraft'

interface Props {
  open: boolean
  /** null = create a new day */
  day: Day | null
  /** Plain exercises only: songs come in through a Song slot */
  exercises: Exercise[]
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}

export function DayEditorDialog({
  open,
  day,
  exercises,
  onOpenChange,
  onSaved
}: Props): React.JSX.Element {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl lg:max-w-5xl xl:max-w-6xl">
        <DialogHeader>
          <DialogTitle>{day ? 'Edit day' : 'New day'}</DialogTitle>
          <DialogDescription>
            Drag an exercise onto a slot to add it as an alternative, or between slots to give it
            its own slot.
          </DialogDescription>
        </DialogHeader>
        {open && (
          <DayEditor key={day?.id ?? 'new'} day={day} exercises={exercises} onSaved={onSaved} />
        )}
      </DialogContent>
    </Dialog>
  )
}

/** What's being dragged. Kept in a ref: dataTransfer can't be read during dragover. */
type Drag =
  | { kind: 'exercise'; exerciseId: number; fromSlot?: string }
  | { kind: 'song' }
  | { kind: 'slot'; slotKey: string }

function DayEditor({
  day,
  exercises,
  onSaved
}: {
  day: Day | null
  exercises: Exercise[]
  onSaved: () => void
}): React.JSX.Element {
  const [name, setName] = useState(day?.name ?? '')
  const [slots, setSlots] = useState<DraftSlot[]>(
    () =>
      day?.slots.map((s) =>
        s.song
          ? makeSongSlot()
          : makeSlot(
              s.exercises.map((e) => e.id),
              s.preselectedId ?? undefined
            )
      ) ?? []
  )
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [dragging, setDragging] = useState<Drag | null>(null)
  const [over, setOver] = useState<string | null>(null) // drop target id, for highlighting
  const drag = useRef<Drag | null>(null)

  const byId = useMemo(() => new Map(exercises.map((e) => [e.id, e])), [exercises])
  const totalSeconds = slots.reduce((sum, s) => {
    const id = effectiveId(s)
    return sum + ((id !== undefined && byId.get(id)?.allocatedSeconds) || 0)
  }, 0)
  const hasSongs = slots.some((s) => s.song)

  function startDrag(e: React.DragEvent, d: Drag): void {
    drag.current = d
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', '') // required for the drag to start everywhere
    // defer so the browser snapshots the element before it gets restyled
    requestAnimationFrame(() => setDragging(d))
  }

  function endDrag(): void {
    drag.current = null
    setDragging(null)
    setOver(null)
  }

  /** Props that make an element a drop target; `accepts` decides per drag. */
  function dropTarget(id: string, accepts: (d: Drag) => boolean, onDrop: (d: Drag) => void) {
    return {
      onDragOver: (e: React.DragEvent) => {
        if (!drag.current || !accepts(drag.current)) return
        e.preventDefault()
        e.stopPropagation()
        if (over !== id) setOver(id)
      },
      onDragLeave: (e: React.DragEvent) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node))
          setOver((o) => (o === id ? null : o))
      },
      onDrop: (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        if (drag.current && accepts(drag.current)) onDrop(drag.current)
        endDrag()
      }
    }
  }

  const gap = (at: number) =>
    dropTarget(
      `gap-${at}`,
      () => true,
      (d) =>
        setSlots((s) =>
          d.kind === 'slot'
            ? moveSlot(s, d.slotKey, at)
            : d.kind === 'song'
              ? insertSongSlot(s, at)
              : insertSlot(s, at, d.exerciseId, d.fromSlot)
        )
    )

  async function save(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    const input = { name, slots: slots.map((s) => (s.song ? SONG_SLOT : s.exerciseIds)) }
    const invalid = validateDayInput(input)
    if (invalid) return setError(invalid)
    setSaving(true)
    setError(null)
    try {
      await window.api.days.save(day?.id, input)
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={save} className="grid gap-4">
      <div className="grid gap-1.5">
        <Label htmlFor="day-name">Name</Label>
        <Input
          id="day-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Day 1"
          autoFocus
        />
      </div>

      <div className="grid min-h-0 grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-4">
        {/* Library */}
        <div className="flex min-h-0 flex-col gap-2">
          <Label>Exercises</Label>
          <ul className="flex max-h-[60vh] flex-col gap-0.5 overflow-y-auto rounded-2xl bg-background p-2">
            <li
              draggable
              onDragStart={(e) => startDrag(e, { kind: 'song' })}
              onDragEnd={endDrag}
              title="Rotates through every song in the Songs tab, least recently played first"
              className="group flex cursor-grab items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-card active:cursor-grabbing"
            >
              <GripVerticalIcon className="size-3.5 shrink-0 text-muted-foreground" />
              <MusicIcon className="size-3.5 shrink-0 text-signal" />
              <span className="min-w-0 flex-1 truncate">Song</span>
              <span className="text-xs text-muted-foreground">untimed</span>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                title="Add as new slot"
                onClick={() => setSlots((s) => insertSongSlot(s, s.length))}
              >
                <PlusIcon />
              </Button>
            </li>
            {exercises.map((ex) => (
              <li
                key={ex.id}
                draggable
                onDragStart={(e) => startDrag(e, { kind: 'exercise', exerciseId: ex.id })}
                onDragEnd={endDrag}
                className="group flex cursor-grab items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-card active:cursor-grabbing"
              >
                <GripVerticalIcon className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate">{ex.name}</span>
                <span className="font-mono text-xs text-muted-foreground">
                  {formatDuration(ex.allocatedSeconds ?? 0)}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  title="Add as new slot"
                  onClick={() => setSlots((s) => insertSlot(s, s.length, ex.id))}
                >
                  <PlusIcon />
                </Button>
              </li>
            ))}
          </ul>
        </div>

        {/* Slots */}
        <div className="flex min-h-0 flex-col gap-2">
          <div className="flex items-baseline justify-between">
            <Label>Slots</Label>
            <span className="font-mono text-xs text-muted-foreground">
              Total {formatDuration(totalSeconds)}
              {hasSongs && ' + songs'}
            </span>
          </div>
          <div className="flex max-h-[60vh] min-h-40 flex-col overflow-y-auto rounded-2xl bg-background p-2">
            {slots.length === 0 ? (
              <div
                {...gap(0)}
                className={cn(
                  'flex flex-1 items-center justify-center rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground',
                  over === 'gap-0' && 'border-signal bg-signal/5 text-foreground'
                )}
              >
                Drag exercises here, or use + to add them.
              </div>
            ) : (
              <>
                <Gap active={!!dragging} over={over === 'gap-0'} {...gap(0)} />
                {slots.map((slot, i) => {
                  const targetId = `slot-${slot.key}`
                  const alternatives = slot.exerciseIds.length > 1
                  return (
                    <div key={slot.key}>
                      <div
                        {...dropTarget(
                          targetId,
                          (d) =>
                            !slot.song &&
                            d.kind === 'exercise' &&
                            d.fromSlot !== slot.key &&
                            !slot.exerciseIds.includes(d.exerciseId),
                          (d) =>
                            d.kind === 'exercise' &&
                            setSlots((s) => addToSlot(s, slot.key, d.exerciseId, d.fromSlot))
                        )}
                        className={cn(
                          'flex items-start gap-2 rounded-xl border border-transparent bg-card p-2.5 shadow-paper transition-colors',
                          over === targetId && 'border-signal bg-signal/5',
                          dragging?.kind === 'slot' && dragging.slotKey === slot.key && 'opacity-40'
                        )}
                      >
                        <span
                          draggable
                          onDragStart={(e) => startDrag(e, { kind: 'slot', slotKey: slot.key })}
                          onDragEnd={endDrag}
                          title="Drag to reorder"
                          className="mt-1 flex cursor-grab items-center gap-1 text-xs text-muted-foreground tabular-nums active:cursor-grabbing"
                        >
                          <GripVerticalIcon className="size-3.5" />
                          {i + 1}
                        </span>
                        <div className="flex min-w-0 flex-1 flex-col gap-1">
                          {slot.song && (
                            <>
                              <div className="flex flex-wrap gap-1">
                                <span className="inline-flex items-center gap-1.5 rounded-full bg-muted py-0.5 pr-0.5 pl-2.5 text-sm">
                                  <MusicIcon className="size-3.5 text-signal" />
                                  Song
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon-xs"
                                    title="Remove"
                                    onClick={() => setSlots((s) => removeSlot(s, slot.key))}
                                  >
                                    <XIcon />
                                  </Button>
                                </span>
                              </div>
                              <span className="text-xs text-muted-foreground">
                                Any song: the least recently played one comes up first
                              </span>
                            </>
                          )}
                          <div className={cn('flex flex-wrap gap-1', slot.song && 'hidden')}>
                            {slot.exerciseIds.map((id) => {
                              const ex = byId.get(id)
                              return (
                                <span
                                  key={id}
                                  draggable
                                  onDragStart={(e) => {
                                    e.stopPropagation()
                                    startDrag(e, {
                                      kind: 'exercise',
                                      exerciseId: id,
                                      fromSlot: slot.key
                                    })
                                  }}
                                  onDragEnd={endDrag}
                                  className={cn(
                                    'inline-flex cursor-grab items-center gap-1.5 rounded-full bg-muted py-0.5 pr-0.5 pl-2.5 text-sm active:cursor-grabbing',
                                    dragging?.kind === 'exercise' &&
                                      dragging.fromSlot === slot.key &&
                                      dragging.exerciseId === id &&
                                      'opacity-40'
                                  )}
                                >
                                  {ex?.name ?? `#${id}`}
                                  <span className="font-mono text-xs text-muted-foreground">
                                    {ex && formatDuration(ex.allocatedSeconds ?? 0)}
                                  </span>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon-xs"
                                    title="Remove"
                                    onClick={() => setSlots((s) => removeExercise(s, slot.key, id))}
                                  >
                                    <XIcon />
                                  </Button>
                                </span>
                              )
                            })}
                          </div>
                          {alternatives && (
                            <span className="text-xs text-muted-foreground">
                              Alternatives: pick one when this slot comes up
                            </span>
                          )}
                        </div>
                      </div>
                      <Gap active={!!dragging} over={over === `gap-${i + 1}`} {...gap(i + 1)} />
                    </div>
                  )
                })}
              </>
            )}
          </div>
        </div>
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      <DialogFooter>
        <Button type="submit" disabled={saving}>
          {day ? 'Save changes' : 'Create day'}
        </Button>
      </DialogFooter>
    </form>
  )
}

/** Drop zone between slots. Thin at rest, grows while something is being dragged. */
function Gap({
  active,
  over,
  ...handlers
}: { active: boolean; over: boolean } & React.HTMLAttributes<HTMLDivElement>): React.JSX.Element {
  return (
    <div {...handlers} className={cn('flex items-center transition-all', active ? 'h-6' : 'h-1.5')}>
      <div
        className={cn(
          'h-0.5 w-full rounded-full transition-colors',
          over ? 'bg-signal' : active ? 'bg-border' : 'bg-transparent'
        )}
      />
    </div>
  )
}
