import { useState } from 'react'
import { cn } from 'cn'
import { PencilIcon, PlusIcon, TimerIcon, Trash2Icon, MusicIcon } from 'lucide-react'
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
import type { Day, Slot } from '../../../../shared/day'
import { WEEKDAY_LABELS, type WeekScheduleEntry } from '../../../../shared/week'
import { DayEditorDialog } from './DayEditorDialog'
import { Pager, gridStyle, useGridFit, useHeight, usePages } from '@/components/library/paging'

/** Height of one slot row (h-5) plus the list gap (gap-1), in px. */
const SLOT_ROW_PX = 24
/** Card padding top + bottom and the header/content gap (3 x --card-spacing), in px. */
const CARD_CHROME_PX = 48

const slotLabel = (slot: Slot): string =>
  slot.song
    ? `Song: ${slot.exercises.find((e) => e.id === slot.preselectedId)?.name ?? 'none yet'}`
    : slot.exercises.map((e) => e.name).join(' / ')

interface Props {
  /** Library section switcher, shown as this panel's title */
  tabs: React.ReactNode
  days: Day[] | null
  week: WeekScheduleEntry[]
  exercises: Exercise[]
  onChanged: () => void
}

export function DaysPanel({ tabs, days, week, exercises, onChanged }: Props): React.JSX.Element {
  const [gridRef, { cols, rows }] = useGridFit<HTMLUListElement>(280, 360)
  const { shown, page, pages, setPage } = usePages(days ?? [], cols * rows)
  // Every card is sized for the longest day (across all pages), so they all match.
  const maxSlots = Math.max(1, ...(days ?? []).map((d) => d.slots.length))
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
    <section className="flex min-h-0 flex-1 flex-col gap-4">
      <header className="flex shrink-0 items-center justify-between gap-3">
        {tabs}
        {days && days.length > 0 && (
          <div className="flex items-center gap-3">
            <Pager page={page} pages={pages} onPage={setPage} />
            <Button size="sm" onClick={openCreate} disabled={!canCreate}>
              <PlusIcon /> New day
            </Button>
          </div>
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

      {/* Exactly as many equal cells as fit; the rest goes on other pages. */}
      <ul
        ref={gridRef}
        className={cn('grid min-h-0 flex-1', days?.length === 0 && 'hidden')}
        // Only as many rows as this page uses, so a single row of days gets the full height.
        style={gridStyle(cols, Math.max(1, Math.ceil(shown.length / cols)))}
      >
        {shown.map((day) => (
          <DayCard
            key={day.id}
            day={day}
            maxSlots={maxSlots}
            onEdit={() => openEdit(day)}
            onDelete={() => setDeleting(day)}
          />
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

function DayCard({
  day,
  maxSlots,
  onEdit,
  onDelete
}: {
  day: Day
  /** Slot count of the longest day: every card reserves room for that many rows */
  maxSlots: number
  onEdit: () => void
  onDelete: () => void
}): React.JSX.Element {
  // All cards share one height: room for the longest day's slots, capped at what fits the grid
  // cell. Slots beyond that collapse into "+N more" (listed on hover). Measuring the cell, not
  // the card, keeps this stable.
  const [cellRef, cellHeight] = useHeight<HTMLLIElement>()
  const [headerRef, headerHeight] = useHeight<HTMLDivElement>()
  const height = cellHeight - headerHeight - CARD_CHROME_PX
  const rows = Math.min(maxSlots, Math.max(1, Math.floor((height + 4) / SLOT_ROW_PX)))
  const visible = day.slots.length <= rows ? day.slots.length : rows - 1
  const hidden = day.slots.slice(visible)

  return (
    <li ref={cellRef} className="min-h-0 min-w-0">
      <Card className="max-h-full">
        <CardHeader ref={headerRef} className="shrink-0">
          <CardTitle className="min-w-0 truncate" title={day.name}>
            {day.name}
          </CardTitle>
          <CardDescription className="flex items-center gap-4">
            <span className="flex items-center gap-1 font-mono text-xs">
              <TimerIcon className="size-3.5" />
              {formatDuration(day.totalSeconds)}
            </span>
            <span>
              {day.slots.length} {day.slots.length === 1 ? 'exercise' : 'exercises'}
            </span>
          </CardDescription>
          <CardAction className="flex gap-1">
            <Button variant="ghost" size="icon-sm" onClick={onEdit} title="Edit">
              <PencilIcon />
            </Button>
            <Button variant="ghost" size="icon-sm" onClick={onDelete} title="Delete">
              <Trash2Icon />
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="overflow-hidden" style={{ height: rows * SLOT_ROW_PX - 4 }}>
          <ol className="flex flex-col gap-1 text-sm">
            {cellHeight > 0 &&
              day.slots.slice(0, visible).map((slot, i) => (
                <li key={i} className="flex h-5 min-w-0 gap-2" title={slotLabel(slot)}>
                  <span className="w-5 shrink-0 text-right font-mono text-xs leading-5 text-muted-foreground">
                    {i + 1}
                  </span>
                  <span className="min-w-0 truncate">
                    {slot.song && (
                      <span className="inline-flex items-center gap-1.5">
                        <MusicIcon className="size-3.5 shrink-0 text-signal" aria-label="Song" />
                        {slot.exercises.find((e) => e.id === slot.preselectedId)?.name ??
                          'No songs yet'}
                      </span>
                    )}
                    {!slot.song &&
                      slot.exercises.map((e, j) => (
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
                  </span>
                </li>
              ))}
            {cellHeight > 0 && hidden.length > 0 && (
              <li
                className="h-5 pl-7 text-muted-foreground"
                title={hidden.map((s, i) => `${visible + i + 1}. ${slotLabel(s)}`).join('\n')}
              >
                +{hidden.length} more
              </li>
            )}
          </ol>
        </CardContent>
      </Card>
    </li>
  )
}
