import { useCallback, useEffect, useState } from 'react'
import { ExercisesPanel } from '@/components/exercises/ExercisesPanel'
import { DaysPanel } from '@/components/days/DaysPanel'
import { WeekPanel } from '@/components/week/WeekPanel'
import type { Exercise } from '../../shared/exercise'
import type { Day } from '../../shared/day'
import type { WeekScheduleEntry } from '../../shared/week'

function App(): React.JSX.Element {
  const [exercises, setExercises] = useState<Exercise[] | null>(null)
  const [days, setDays] = useState<Day[] | null>(null)
  const [week, setWeek] = useState<WeekScheduleEntry[] | null>(null)

  // Changes ripple (exercise edits change days, deleting a day frees weekdays),
  // so everything reloads together.
  const refresh = useCallback(async () => {
    const [e, d, w] = await Promise.all([
      window.api.exercises.list(),
      window.api.days.list(),
      window.api.week.get()
    ])
    setExercises(e)
    setDays(d)
    setWeek(w)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto grid w-full max-w-5xl items-start gap-8 p-6 md:grid-cols-2">
        <WeekPanel week={week} days={days ?? []} onChanged={refresh} />
        <ExercisesPanel exercises={exercises} onChanged={refresh} />
        <DaysPanel days={days} week={week ?? []} exercises={exercises ?? []} onChanged={refresh} />
      </div>
    </main>
  )
}

export default App
