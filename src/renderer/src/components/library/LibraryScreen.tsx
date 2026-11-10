import { useMemo, useState } from 'react'
import { Segmented } from '@/components/common/Segmented'
import { WeekPanel } from '@/components/week/WeekPanel'
import { ExercisesPanel } from '@/components/exercises/ExercisesPanel'
import { DaysPanel } from '@/components/days/DaysPanel'
import type { Exercise } from '../../../../shared/exercise'
import type { Day } from '../../../../shared/day'
import type { WeekScheduleEntry } from '../../../../shared/week'

type Section = 'days' | 'exercises' | 'songs'
const SECTIONS = [
  { value: 'days', label: 'Days' },
  { value: 'exercises', label: 'Exercises' },
  { value: 'songs', label: 'Songs' }
] as const

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
  // Song slots list every song as an alternative, so this covers songs too.
  const scheduledIds = useMemo(
    () =>
      days
        ? new Set(days.flatMap((d) => d.slots.flatMap((s) => s.exercises.map((e) => e.id))))
        : null,
    [days]
  )

  const tabs = (
    <Segmented label="Library section" options={SECTIONS} value={section} onChange={setSection} />
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
          scheduledIds={scheduledIds}
          onChanged={onChanged}
        />
      )}
    </div>
  )
}
