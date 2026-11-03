import { useMemo, useState } from 'react'
import { cn } from 'cn'
import { WeekPanel } from '@/components/week/WeekPanel'
import { ExercisesPanel } from '@/components/exercises/ExercisesPanel'
import { DaysPanel } from '@/components/days/DaysPanel'
import type { Exercise } from '../../../../shared/exercise'
import type { Day } from '../../../../shared/day'
import type { WeekScheduleEntry } from '../../../../shared/week'

type Section = 'days' | 'exercises' | 'songs'

interface Props {
  exercises: Exercise[] | null
  days: Day[] | null
  week: WeekScheduleEntry[] | null
  onChanged: () => void
}

/** Week strip on top; below it, days, exercises or songs as a paged grid that never scrolls. */
export function LibraryScreen({ exercises, days, week, onChanged }: Props): React.JSX.Element {
  const [section, setSection] = useState<Section>('days')
  const [plain, songs] = useMemo(
    () =>
      exercises
        ? [
            exercises.filter((e) => e.kind === 'exercise'),
            exercises.filter((e) => e.kind === 'song')
          ]
        : [null, null],
    [exercises]
  )

  const tabs = (
    <div className="flex rounded-lg border p-0.5" role="tablist" aria-label="Library section">
      {(['days', 'exercises', 'songs'] as const).map((s) => (
        <button
          key={s}
          role="tab"
          aria-selected={section === s}
          onClick={() => setSection(s)}
          className={cn(
            'rounded-md px-3 py-1 font-heading text-base font-semibold capitalize tracking-tight transition-colors',
            section === s
              ? 'bg-muted text-foreground'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {s}
        </button>
      ))}
    </div>
  )

  return (
    <div className="flex h-full flex-col gap-6 p-6 xl:px-10">
      <WeekPanel week={week} days={days ?? []} onChanged={onChanged} />
      {section === 'days' ? (
        <DaysPanel
          tabs={tabs}
          days={days}
          week={week ?? []}
          exercises={plain ?? []}
          onChanged={onChanged}
        />
      ) : (
        <ExercisesPanel
          key={section}
          kind={section === 'songs' ? 'song' : 'exercise'}
          tabs={tabs}
          exercises={section === 'songs' ? songs : plain}
          onChanged={onChanged}
        />
      )}
    </div>
  )
}
