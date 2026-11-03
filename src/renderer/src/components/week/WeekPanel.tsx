import { cn } from 'cn'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { formatDuration } from '../../../../shared/exercise'
import type { Day } from '../../../../shared/day'
import {
  WEEKDAY_LABELS,
  weekdayOf,
  type Weekday,
  type WeekScheduleEntry
} from '../../../../shared/week'

interface Props {
  week: WeekScheduleEntry[] | null
  days: Day[]
  onChanged: () => void
}

const REST = 'rest'

export function WeekPanel({ week, days, onChanged }: Props): React.JSX.Element {
  const today = weekdayOf(new Date())
  const byId = new Map(days.map((d) => [d.id, d]))
  const items = [
    { value: REST, label: 'Rest' },
    ...days.map((d) => ({ value: String(d.id), label: d.name }))
  ]

  async function assign(weekday: Weekday, value: string | null): Promise<void> {
    await window.api.week.set(weekday, !value || value === REST ? null : Number(value))
    onChanged()
  }

  return (
    <section className="flex shrink-0 flex-col gap-4">
      <header className="flex items-baseline justify-between">
        <h2 className="font-heading text-xl font-semibold tracking-tight">Week</h2>
        {days.length === 0 && (
          <span className="text-sm text-muted-foreground">Create a day to schedule it.</span>
        )}
      </header>

      <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-7">
        {week?.map(({ weekday, dayId }) => {
          const day = dayId === null ? undefined : byId.get(dayId)
          const isToday = weekday === today
          return (
            <li
              key={weekday}
              className={cn(
                'surface flex min-w-0 flex-col gap-2 p-3',
                isToday && 'ring-2 ring-signal'
              )}
            >
              <div className="flex items-baseline justify-between gap-1">
                <span className="text-sm font-medium" title={WEEKDAY_LABELS[weekday]}>
                  {WEEKDAY_LABELS[weekday].slice(0, 3)}
                </span>
                {isToday && <span className="text-xs font-medium text-signal">Today</span>}
              </div>
              <Select
                items={items}
                value={day ? String(day.id) : REST}
                onValueChange={(v) => assign(weekday, v as string | null)}
                disabled={days.length === 0}
              >
                <SelectTrigger
                  size="sm"
                  className="w-full min-w-0"
                  aria-label={`Day for ${WEEKDAY_LABELS[weekday]}`}
                  title={day?.name ?? 'Rest'}
                >
                  <SelectValue className="truncate" />
                </SelectTrigger>
                <SelectContent>
                  {items.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className={cn('text-xs text-muted-foreground', day && 'font-mono')}>
                {day ? formatDuration(day.totalSeconds) : 'Rest day'}
              </span>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
