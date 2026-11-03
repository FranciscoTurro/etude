import { useCallback, useEffect, useState } from 'react'
import { cn } from 'cn'
import { ExercisesPanel } from '@/components/exercises/ExercisesPanel'
import { DaysPanel } from '@/components/days/DaysPanel'
import { WeekPanel } from '@/components/week/WeekPanel'
import { PracticeScreen } from '@/components/practice/PracticeScreen'
import type { Exercise } from '../../shared/exercise'
import type { Day } from '../../shared/day'
import type { WeekScheduleEntry } from '../../shared/week'
import type { Settings } from '../../shared/settings'

type Tab = 'practice' | 'library'

function App(): React.JSX.Element {
  const [tab, setTab] = useState<Tab>('practice')
  const [exercises, setExercises] = useState<Exercise[] | null>(null)
  const [days, setDays] = useState<Day[] | null>(null)
  const [week, setWeek] = useState<WeekScheduleEntry[] | null>(null)
  const [settings, setSettings] = useState<Settings | null>(null)

  // Changes ripple (exercise edits change days, deleting a day frees weekdays,
  // finishing a session moves the alternative rotation), so everything reloads together.
  const refresh = useCallback(async () => {
    const [e, d, w, s] = await Promise.all([
      window.api.exercises.list(),
      window.api.days.list(),
      window.api.week.get(),
      window.api.settings.getAll()
    ])
    setExercises(e)
    setDays(d)
    setWeek(w)
    setSettings(s)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return (
    <div className="min-h-screen bg-background text-foreground">
      <nav className="sticky top-0 z-10 flex justify-center gap-1 border-b bg-background/80 p-2 backdrop-blur">
        {(['practice', 'library'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            aria-current={tab === t ? 'page' : undefined}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm font-medium capitalize transition-colors',
              tab === t ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {t}
          </button>
        ))}
      </nav>

      {/* Practice stays mounted so a running session survives a trip to the library. */}
      <main className={cn(tab !== 'practice' && 'hidden')}>
        <PracticeScreen
          days={days}
          week={week}
          settings={settings}
          visible={tab === 'practice'}
          onGoToLibrary={() => setTab('library')}
          onChanged={refresh}
        />
      </main>

      <main className={cn(tab !== 'library' && 'hidden')}>
        <div className="grid w-full items-start gap-8 p-6 md:grid-cols-2 xl:gap-10 xl:px-10">
          <WeekPanel week={week} days={days ?? []} onChanged={refresh} />
          <ExercisesPanel exercises={exercises} onChanged={refresh} />
          <DaysPanel days={days} week={week ?? []} exercises={exercises ?? []} onChanged={refresh} />
        </div>
      </main>
    </div>
  )
}

export default App
