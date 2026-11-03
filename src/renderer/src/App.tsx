import { useCallback, useEffect, useState } from 'react'
import { cn } from 'cn'
import { Segmented } from '@/components/common/Segmented'
import { SettingsIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SettingsDialog } from '@/components/settings/SettingsDialog'
import { LibraryScreen } from '@/components/library/LibraryScreen'
import { PracticeScreen } from '@/components/practice/PracticeScreen'
import { HistoryScreen } from '@/components/history/HistoryScreen'
import type { Exercise } from '../../shared/exercise'
import type { Day } from '../../shared/day'
import type { WeekScheduleEntry } from '../../shared/week'
import type { Settings } from '../../shared/settings'

type Tab = 'practice' | 'library' | 'history'
const TABS = [
  { value: 'practice', label: 'Practice' },
  { value: 'library', label: 'Library' },
  { value: 'history', label: 'History' }
] as const

function App(): React.JSX.Element {
  const [tab, setTab] = useState<Tab>('practice')
  const [settingsOpen, setSettingsOpen] = useState(false)
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
    <div className="flex h-screen flex-col bg-background text-foreground">
      <nav className="relative z-10 grid shrink-0 grid-cols-[1fr_auto_1fr] items-center px-6 py-3 xl:px-10">
        <span className="text-lg font-bold tracking-wide">Etude</span>
        <Segmented label="Section" options={TABS} value={tab} onChange={setTab} />
        <Button
          variant="ghost"
          size="icon"
          className="justify-self-end"
          onClick={() => setSettingsOpen(true)}
          title="Settings"
          aria-label="Settings"
        >
          <SettingsIcon />
        </Button>
      </nav>

      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        settings={settings}
        onChanged={refresh}
      />

      {/* Practice stays mounted so a running session survives a trip to the library. */}
      <main className={cn('min-h-0 flex-1 overflow-y-auto', tab !== 'practice' && 'hidden')}>
        <PracticeScreen
          days={days}
          week={week}
          settings={settings}
          visible={tab === 'practice'}
          onGoToLibrary={() => setTab('library')}
          onChanged={refresh}
        />
      </main>

      {/* Library never scrolls: it pages its grids to fit the window. */}
      <main className={cn('min-h-0 flex-1 overflow-hidden', tab !== 'library' && 'hidden')}>
        <LibraryScreen exercises={exercises} days={days} week={week} onChanged={refresh} />
      </main>

      {/* History manages its own scrolling: the graph pane stays put, the sessions pane scrolls. */}
      <main className={cn('min-h-0 flex-1 overflow-hidden', tab !== 'history' && 'hidden')}>
        <HistoryScreen visible={tab === 'history'} />
      </main>
    </div>
  )
}

export default App
