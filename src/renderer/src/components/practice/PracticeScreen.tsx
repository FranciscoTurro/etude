import { useEffect, useMemo, useRef, useState } from 'react'
import {
  CheckIcon,
  MusicIcon,
  PauseIcon,
  PlayIcon,
  SkipForwardIcon,
  SquareIcon,
  Volume2Icon
} from 'lucide-react'
import { cn } from 'cn'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
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
import { useAudioInput } from '@/hooks/useAudioInput'
import { useMetronome } from '@/hooks/useMetronome'
import { playFinishChime, setClickVolume } from '@/lib/sounds'
import { AudioPanel } from './AudioPanel'
import { MetronomePanel } from './MetronomePanel'
import { SongPicker } from './SongPicker'
import { formatDuration, formatMaybeDuration } from '../../../../shared/exercise'
import type { Day, Slot, SlotExercise } from '../../../../shared/day'
import type { LogStatus } from '../../../../shared/session'
import { WEEKDAY_LABELS, weekdayOf, type WeekScheduleEntry } from '../../../../shared/week'
import {
  DEFAULT_METRONOME_BPM,
  DEFAULT_METRONOME_VOLUME,
  DEFAULT_THRESHOLD_DB,
  SETTING,
  SILENCE_HOLD_MS,
  type Settings
} from '../../../../shared/settings'

interface Props {
  days: Day[] | null
  week: WeekScheduleEntry[] | null
  settings: Settings | null
  /** Whether this screen is the visible tab (the mic stays open during a session regardless). */
  visible: boolean
  onGoToLibrary: () => void
  /** Called after a session ends so the rotation (preselected alternatives) refreshes. */
  onChanged: () => void
}

/** A running practice: the day is frozen at start, so edits made meanwhile don't apply. */
interface Run {
  sessionId: number
  day: Day
}

type Phase = 'queued' | 'running' | 'done'

const NO_DAY = 'none'

const preselected = (slot: Slot): SlotExercise =>
  slot.exercises.find((e) => e.id === slot.preselectedId) ?? slot.exercises[0]

export function PracticeScreen({
  days,
  week,
  settings,
  visible,
  onGoToLibrary,
  onChanged
}: Props): React.JSX.Element {
  // ---- which day ----
  const today = weekdayOf(new Date())
  const scheduledId = week?.find((w) => w.weekday === today)?.dayId ?? null
  const scheduledDay = days?.find((d) => d.id === scheduledId) ?? null
  const [chosenId, setChosenId] = useState<number | null | undefined>(undefined) // undefined = follow schedule
  const selectedId = chosenId === undefined ? scheduledId : chosenId
  // A Song slot is empty while there are no songs; there's nothing to play there.
  const liveDay = useMemo(() => {
    const d = days?.find((d) => d.id === selectedId)
    return d ? { ...d, slots: d.slots.filter((s) => s.exercises.length > 0) } : null
  }, [days, selectedId])

  // ---- session state ----
  const [run, setRun] = useState<Run | null>(null)
  const [index, setIndex] = useState(0)
  const [phase, setPhase] = useState<Phase>('queued')
  const [results, setResults] = useState<Record<number, { status: LogStatus; exerciseId: number }>>(
    {}
  )
  const [pickedId, setPickedId] = useState<number | null>(null)
  const [bpmText, setBpmText] = useState<string | null>(null) // null = exercise default
  const [confirmEnd, setConfirmEnd] = useState(false)

  const day = run?.day ?? liveDay
  const slot = phase === 'done' ? undefined : day?.slots[index]
  const picked = slot
    ? (slot.exercises.find((e) => e.id === pickedId) ?? preselected(slot))
    : undefined
  const bpmValue = bpmText ?? (picked?.bpm != null ? String(picked.bpm) : '')
  /** Songs have no allocated time: the clock counts up and Done finishes them. */
  const untimed = picked?.allocatedSeconds === null

  // ---- clock ----
  const elapsedRef = useRef(0)
  const [elapsedMs, setElapsedMs] = useState(0)
  const [clockState, setClockState] = useState<'playing' | 'holding' | 'waiting'>('waiting')
  const [holdLeft, setHoldLeft] = useState(0)
  /** Manual pause: stops the clock whatever the mic hears. */
  const [paused, setPaused] = useState(false)
  // When off, the clock just runs (until paused) instead of waiting for sound.
  const listens = settings?.[SETTING.clockListens] !== '0'
  const listensRef = useRef(listens)
  listensRef.current = listens
  const pausedRef = useRef(paused)
  pausedRef.current = paused
  function setListens(on: boolean): void {
    window.api.settings.set(SETTING.clockListens, on ? '1' : '0').then(onChanged)
  }

  // ---- audio ----
  const [thresholdDb, setThresholdDb] = useState(DEFAULT_THRESHOLD_DB)
  const [deviceId, setDeviceId] = useState<string | undefined>(undefined)
  const settingsLoaded = useRef(false)
  useEffect(() => {
    if (!settings || settingsLoaded.current) return
    settingsLoaded.current = true
    const saved = Number(settings[SETTING.audioThresholdDb])
    if (settings[SETTING.audioThresholdDb] !== undefined && Number.isFinite(saved))
      setThresholdDb(saved)
    setDeviceId(settings[SETTING.audioInputId] || undefined)
  }, [settings])

  const audio = useAudioInput({ deviceId, enabled: visible || run !== null, thresholdDb })

  const saveThreshold = useRef<ReturnType<typeof setTimeout>>(undefined)
  function changeThreshold(db: number): void {
    setThresholdDb(db)
    clearTimeout(saveThreshold.current)
    saveThreshold.current = setTimeout(
      () => window.api.settings.set(SETTING.audioThresholdDb, String(db)),
      400
    )
  }
  function changeDevice(id: string): void {
    setDeviceId(id)
    window.api.settings.set(SETTING.audioInputId, id)
  }

  // ---- metronome ----
  // Follows the exercise's (session) BPM; exercises without one use the metronome's own tempo.
  const metronomeEnabled = settings?.[SETTING.metronomeEnabled] !== '0'
  function setMetronomeEnabled(on: boolean): void {
    window.api.settings.set(SETTING.metronomeEnabled, on ? '1' : '0').then(onChanged)
  }
  const [volumeDraft, setVolumeDraft] = useState<number | null>(null)
  const metronomeVolume =
    volumeDraft ?? Number(settings?.[SETTING.metronomeVolume] ?? DEFAULT_METRONOME_VOLUME)
  useEffect(() => setClickVolume(metronomeVolume), [metronomeVolume])
  const saveVolume = useRef<ReturnType<typeof setTimeout>>(undefined)
  function changeMetronomeVolume(volume: number): void {
    setVolumeDraft(volume)
    clearTimeout(saveVolume.current)
    saveVolume.current = setTimeout(
      () => window.api.settings.set(SETTING.metronomeVolume, String(volume)),
      400
    )
  }
  const [freeBpmText, setFreeBpmText] = useState<string | null>(null)
  const savedFreeBpm = Number(settings?.[SETTING.metronomeBpm])
  const freeBpm = freeBpmText ?? String(savedFreeBpm > 0 ? savedFreeBpm : DEFAULT_METRONOME_BPM)
  const metronomeFromExercise = picked?.bpm != null
  const metronomeText = metronomeFromExercise ? bpmValue : freeBpm
  const [metronomeOn, setMetronomeOn] = useState(false)
  const metronomeBpm = Number(metronomeText)
  const beat = useMetronome(
    metronomeBpm,
    metronomeEnabled &&
      metronomeOn &&
      !paused &&
      !!picked &&
      Number.isFinite(metronomeBpm) &&
      metronomeBpm > 0
  )
  const saveFreeBpm = useRef<ReturnType<typeof setTimeout>>(undefined)
  function changeMetronomeBpm(text: string): void {
    if (metronomeFromExercise) return setBpmText(text)
    setFreeBpmText(text)
    clearTimeout(saveFreeBpm.current)
    const n = Number(text)
    if (Number.isFinite(n) && n > 0) {
      saveFreeBpm.current = setTimeout(
        () => window.api.settings.set(SETTING.metronomeBpm, String(Math.round(n))),
        400
      )
    }
  }

  // ---- actions ----
  const busy = useRef(false)

  async function ensureRun(): Promise<Run> {
    if (run) return run
    if (!liveDay) throw new Error('No day selected')
    const next = { sessionId: await window.api.sessions.start(liveDay.id), day: liveDay }
    setRun(next)
    return next
  }

  function resetClock(): void {
    elapsedRef.current = 0
    setElapsedMs(0)
    setClockState('waiting')
    setPaused(false)
  }

  async function play(): Promise<void> {
    if (!slot || busy.current) return
    busy.current = true
    try {
      await ensureRun()
      resetClock()
      setPhase('running')
      setMetronomeOn(true)
    } finally {
      busy.current = false
    }
  }

  /** Logs the current slot and queues the next one (or finishes the session). */
  async function logAndAdvance(status: LogStatus): Promise<void> {
    if (!slot || !picked || busy.current) return
    busy.current = true
    try {
      const r = await ensureRun()
      // Completing logs what was played; skipping logs the slot's preselected alternative.
      const ex = status === 'completed' ? picked : preselected(slot)
      const typed = Number(bpmValue)
      const bpm =
        ex.bpm === null
          ? null
          : status === 'completed' && Number.isInteger(typed) && typed > 0
            ? typed
            : ex.bpm
      // Untimed (songs): credit the time actually played, if any.
      const played = Math.round(elapsedRef.current / 1000)
      await window.api.sessions.log({
        sessionId: r.sessionId,
        exerciseId: ex.id,
        exerciseName: ex.name,
        status,
        bpm,
        secondsAllocated:
          ex.allocatedSeconds ?? (status === 'completed' && played > 0 ? played : null)
      })
      if (status === 'completed') playFinishChime()

      setResults((prev) => ({ ...prev, [index]: { status, exerciseId: ex.id } }))
      setPickedId(null)
      setBpmText(null)
      setMetronomeOn(false)
      resetClock()
      if (index + 1 >= r.day.slots.length) {
        await window.api.sessions.finish(r.sessionId)
        setPhase('done')
        onChanged()
      } else {
        setIndex(index + 1)
        setPhase('queued')
      }
    } finally {
      busy.current = false
    }
  }

  async function endSession(): Promise<void> {
    if (run && phase !== 'done') await window.api.sessions.finish(run.sessionId)
    setRun(null)
    setIndex(0)
    setPhase('queued')
    setResults({})
    setPickedId(null)
    setBpmText(null)
    setMetronomeOn(false)
    resetClock()
    onChanged()
  }

  // The clock only advances while there's sound (or within the hold after it).
  const advanceRef = useRef(logAndAdvance)
  advanceRef.current = logAndAdvance
  const allocatedMs = picked?.allocatedSeconds != null ? picked.allocatedSeconds * 1000 : null
  const allocatedRef = useRef(allocatedMs)
  allocatedRef.current = allocatedMs
  const noMicRef = useRef(false)
  noMicRef.current = audio.error !== null

  useEffect(() => {
    if (phase !== 'running') return
    let last = performance.now()
    const timer = setInterval(() => {
      const now = performance.now()
      const dt = now - last
      last = now
      if (pausedRef.current) return
      const sinceSound = now - audio.lastAboveRef.current
      const free = noMicRef.current || !listensRef.current
      const counting = free || sinceSound < SILENCE_HOLD_MS
      setClockState(free || sinceSound < 150 ? 'playing' : counting ? 'holding' : 'waiting')
      setHoldLeft(Math.ceil((SILENCE_HOLD_MS - sinceSound) / 1000))
      if (!counting) return
      elapsedRef.current += dt
      setElapsedMs(elapsedRef.current)
      if (allocatedRef.current !== null && elapsedRef.current >= allocatedRef.current) {
        advanceRef.current('completed')
      }
    }, 100)
    return () => clearInterval(timer)
  }, [phase, index, audio.lastAboveRef])

  // Main asks before the window closes while this is set.
  const activeSessionId = run && phase !== 'done' ? run.sessionId : null
  useEffect(() => {
    window.api.sessions.setActive(activeSessionId)
  }, [activeSessionId])

  // Space: play when queued, pause/resume while running.
  const spaceRef = useRef<() => void>(() => {})
  spaceRef.current = () => {
    if (phase === 'queued') play()
    else if (phase === 'running') setPaused((p) => !p)
  }
  useEffect(() => {
    if (!visible) return
    const isSpace = (e: KeyboardEvent): boolean =>
      e.code === 'Space' && !e.ctrlKey && !e.altKey && !e.metaKey && !e.shiftKey
    const ignored = (e: KeyboardEvent): boolean => {
      const t = e.target as HTMLElement | null
      // Sliders and switches stay focused after use, and Space must still pause then.
      const typing = 'input:not([type="range"], [type="checkbox"]), textarea, select'
      if (t?.closest(`${typing}, [contenteditable="true"]`)) return true
      // Leave Space alone while a dialog, menu or dropdown is open.
      return !!document.querySelector('[role="dialog"], [role="alertdialog"], [role="listbox"]')
    }
    const down = (e: KeyboardEvent): void => {
      if (!isSpace(e) || ignored(e)) return
      e.preventDefault() // otherwise it also "clicks" whichever button has focus
      if (!e.repeat) spaceRef.current()
    }
    const up = (e: KeyboardEvent): void => {
      if (isSpace(e) && !ignored(e)) e.preventDefault()
    }
    window.addEventListener('keydown', down, true)
    window.addEventListener('keyup', up, true)
    return () => {
      window.removeEventListener('keydown', down, true)
      window.removeEventListener('keyup', up, true)
    }
  }, [visible])

  const currentRowRef = useRef<HTMLLIElement>(null)
  useEffect(() => {
    currentRowRef.current?.scrollIntoView({ block: 'nearest' })
  }, [index, phase])

  // ---- render ----
  if (days && days.length === 0) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 p-16 text-center">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Nothing to practice yet
        </h1>
        <p className="text-muted-foreground">
          Create some exercises, group them into a day, and it&apos;ll show up here.
        </p>
        <Button onClick={onGoToLibrary}>Create an exercise</Button>
      </div>
    )
  }

  // Counts down for exercises, up for songs.
  const clockSeconds =
    allocatedMs === null
      ? Math.floor(elapsedMs / 1000)
      : Math.ceil(Math.max(0, allocatedMs - elapsedMs) / 1000)
  const dayItems = [
    { value: NO_DAY, label: 'Rest day' },
    ...(days ?? []).map((d) => ({ value: String(d.id), label: d.name }))
  ]
  const choiceFor = (i: number, s: Slot): SlotExercise =>
    s.exercises.find((e) => e.id === results[i]?.exerciseId) ??
    (i === index && picked ? picked : preselected(s))
  const totalSeconds =
    day?.slots.reduce((sum, s, i) => sum + (choiceFor(i, s).allocatedSeconds ?? 0), 0) ?? 0
  const hasSongs = !!day?.slots.some((s) => s.song)
  // What's still ahead today: unlogged slots, minus what's already played of the current one.
  const leftSeconds =
    (day?.slots.reduce(
      (sum, s, i) => (results[i] ? sum : sum + (choiceFor(i, s).allocatedSeconds ?? 0)),
      0
    ) ?? 0) - (untimed ? 0 : Math.floor(elapsedMs / 1000))

  const active = phase !== 'done' && !!day && !!slot && !!picked
  const status =
    phase !== 'running'
      ? null
      : paused
        ? { text: 'Paused · Space to resume', live: false }
        : clockState === 'playing'
          ? { text: 'Playing', live: true }
          : clockState === 'holding'
            ? { text: `Quiet… stopping in ${holdLeft}s`, live: true }
            : { text: 'Waiting for sound', live: false }

  return (
    <div className="flex w-full flex-col px-6 pb-6 md:h-full xl:px-10">
      <div className="grid items-start gap-6 md:min-h-0 md:flex-1 md:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] md:items-stretch">
        {/* Timer side */}
        <div className="flex flex-col gap-4 md:min-h-0 md:overflow-y-auto">
          <section className="surface flex min-h-136 flex-col p-7 md:flex-1 xl:px-11 xl:py-9">
            <header className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                {WEEKDAY_LABELS[today]} –{' '}
                <span className="font-semibold text-foreground">
                  {scheduledDay ? scheduledDay.name : 'Rest day'}
                </span>
              </p>
              {run && phase !== 'done' ? (
                <Button variant="secondary" size="sm" onClick={() => setConfirmEnd(true)}>
                  <SquareIcon /> End session
                </Button>
              ) : (
                !run && (
                  <Select
                    items={dayItems}
                    value={selectedId === null ? NO_DAY : String(selectedId)}
                    onValueChange={(v) => {
                      setChosenId(v === NO_DAY || v === null ? null : Number(v))
                      setPickedId(null)
                      setBpmText(null)
                    }}
                  >
                    <SelectTrigger className="w-52" aria-label="Day to practice">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {dayItems.map((i) => (
                        <SelectItem key={i.value} value={i.value}>
                          {i.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )
              )}
            </header>

            <div className="flex flex-1 flex-col items-center justify-center gap-4 py-8 text-center">
              {phase === 'done' && day ? (
                <>
                  <CheckIcon className="size-12 text-signal" />
                  <div>
                    <h2 className="text-3xl font-semibold">Session complete</h2>
                    <p className="text-muted-foreground">
                      {Object.values(results).filter((r) => r.status === 'completed').length}{' '}
                      completed,{' '}
                      {Object.values(results).filter((r) => r.status === 'skipped').length} skipped
                    </p>
                  </div>
                  <Button size="lg" onClick={endSession}>
                    Practice again
                  </Button>
                </>
              ) : !day ? (
                <p className="text-lg text-muted-foreground">
                  Rest day. Pick a day above to practice anyway.
                </p>
              ) : !slot || !picked ? (
                <p className="text-lg text-muted-foreground">{day.name} has no exercises yet.</p>
              ) : (
                <>
                  <span className="font-mono text-sm text-muted-foreground">
                    {String(index + 1).padStart(2, '0')} /{' '}
                    {String(day.slots.length).padStart(2, '0')}
                  </span>
                  {slot.song && slot.exercises.length > 1 && phase === 'queued' ? (
                    <SongPicker
                      songs={slot.exercises}
                      value={picked}
                      onChange={(song) => {
                        setPickedId(song.id)
                        setBpmText(null)
                      }}
                    />
                  ) : slot.exercises.length > 1 && phase === 'queued' ? (
                    <div
                      className="flex flex-wrap justify-center gap-2"
                      role="radiogroup"
                      aria-label="Pick an alternative"
                    >
                      {slot.exercises.map((e) => (
                        <Button
                          key={e.id}
                          role="radio"
                          aria-checked={e.id === picked.id}
                          variant={e.id === picked.id ? 'default' : 'secondary'}
                          size="lg"
                          onClick={() => {
                            setPickedId(e.id)
                            setBpmText(null)
                          }}
                        >
                          {e.name}
                        </Button>
                      ))}
                    </div>
                  ) : (
                    <h2 className="flex items-center gap-3 text-4xl font-semibold tracking-tight">
                      {slot.song && <MusicIcon className="size-7 text-signal" aria-label="Song" />}
                      {picked.name}
                    </h2>
                  )}

                  <div
                    className={cn(
                      'font-mono text-[7.5rem] leading-none font-medium tracking-tighter tabular-nums transition-colors xl:text-[11rem]',
                      phase === 'running' &&
                        (paused || clockState === 'waiting') &&
                        'text-muted-foreground'
                    )}
                    aria-label={untimed ? 'Time played' : 'Time remaining'}
                  >
                    {formatDuration(clockSeconds)}
                  </div>

                  <p
                    className={cn(
                      'flex h-6 items-center gap-2.5 text-[15px] font-semibold',
                      status?.live ? 'text-signal' : 'text-muted-foreground'
                    )}
                    aria-live="polite"
                  >
                    {status && (
                      <span
                        className={cn(
                          'size-2.5 rounded-full',
                          status.live ? 'bg-signal' : 'border-2 border-muted-foreground/60'
                        )}
                      />
                    )}
                    {status?.text ?? (phase === 'queued' ? 'Press Space to start' : '')}
                  </p>

                  <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm">
                    <label className="flex cursor-pointer items-center gap-2">
                      Metronome
                      <Switch
                        checked={metronomeEnabled}
                        onCheckedChange={setMetronomeEnabled}
                        aria-label="Metronome"
                      />
                    </label>
                    <label
                      className={cn(
                        'flex items-center gap-2 text-muted-foreground',
                        !metronomeEnabled && 'opacity-50'
                      )}
                    >
                      <Volume2Icon className="size-4 shrink-0" />
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={1}
                        value={metronomeVolume}
                        disabled={!metronomeEnabled}
                        onChange={(e) => changeMetronomeVolume(Number(e.target.value))}
                        className="w-36 cursor-pointer accent-primary disabled:cursor-not-allowed"
                        aria-label="Metronome volume"
                      />
                      <span className="w-8 text-right font-mono text-xs">{metronomeVolume}%</span>
                    </label>
                  </div>
                </>
              )}
            </div>

            {active && picked && (
              <footer className="flex flex-wrap items-center gap-4">
                <button
                  type="button"
                  onClick={phase === 'queued' ? play : () => setPaused((p) => !p)}
                  className="flex size-20 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform focus-visible:ring-4 focus-visible:ring-ring/50 focus-visible:outline-none active:scale-95 xl:size-24 [&_svg]:size-8 xl:[&_svg]:size-9"
                  aria-label={phase === 'queued' ? 'Play' : paused ? 'Resume' : 'Pause'}
                  title="Space"
                >
                  {phase === 'running' && !paused ? (
                    <PauseIcon fill="currentColor" strokeWidth={0} />
                  ) : (
                    <PlayIcon className="translate-x-0.5" fill="currentColor" strokeWidth={0} />
                  )}
                </button>
                {untimed && phase === 'running' && (
                  <Button size="lg" onClick={() => logAndAdvance('completed')}>
                    <CheckIcon /> Done
                  </Button>
                )}
                <Button variant="secondary" size="lg" onClick={() => logAndAdvance('skipped')}>
                  <SkipForwardIcon /> Skip
                </Button>

                <div className="ml-auto">
                  {metronomeEnabled ? (
                    <MetronomePanel
                      bpmText={metronomeText}
                      onBpmTextChange={changeMetronomeBpm}
                      fromExercise={metronomeFromExercise}
                      running={metronomeOn}
                      onToggle={() => setMetronomeOn((on) => !on)}
                      beat={beat}
                    />
                  ) : picked.bpm !== null ? (
                    <label className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Input
                        type="number"
                        min={1}
                        max={400}
                        value={bpmValue}
                        onChange={(e) => setBpmText(e.target.value)}
                        className="h-10 w-24 text-center font-mono text-lg"
                        aria-label="BPM for this session"
                      />
                      BPM
                    </label>
                  ) : (
                    <span className="text-sm text-muted-foreground">No BPM</span>
                  )}
                </div>
              </footer>
            )}
          </section>

          <AudioPanel
            channelDbs={audio.channelDbs}
            thresholdDb={thresholdDb}
            onThresholdChange={changeThreshold}
            devices={audio.devices}
            deviceId={deviceId}
            onDeviceChange={changeDevice}
            error={audio.error}
            listens={listens}
            onListensChange={setListens}
          />
        </div>

        {/* Exercise list (~70%) + current exercise's observations (~30%) */}
        {day && (
          <div className="flex flex-col gap-5 md:min-h-0">
            <section className="surface flex flex-col gap-3 p-6 md:min-h-0 md:flex-1">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="truncate text-xl font-semibold">{day.name}</h2>
                <span className="shrink-0 font-mono text-[13px] text-muted-foreground">
                  {run && phase !== 'done' && (
                    <>
                      <span className="text-foreground">
                        {formatDuration(Math.max(0, leftSeconds))}
                      </span>{' '}
                      left ·{' '}
                    </>
                  )}
                  {formatDuration(totalSeconds)}
                  {hasSongs && ' + songs'}
                </span>
              </div>
              <ol className="flex flex-col gap-0.5 md:min-h-0 md:overflow-y-auto">
                {day.slots.map((s, i) => {
                  const result = results[i]
                  const current = phase !== 'done' && i === index
                  const chosen = choiceFor(i, s)
                  return (
                    <li
                      key={i}
                      ref={current ? currentRowRef : undefined}
                      className={cn(
                        'flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px]',
                        current && 'bg-background font-semibold',
                        result && 'text-muted-foreground'
                      )}
                    >
                      <span className="flex w-6 shrink-0 justify-center font-mono text-[13px]">
                        {result?.status === 'completed' ? (
                          <CheckIcon className="size-4 text-signal" aria-label="Completed" />
                        ) : result?.status === 'skipped' ? (
                          <SkipForwardIcon className="size-4" aria-label="Skipped" />
                        ) : (
                          <span className={current ? 'text-signal' : 'text-muted-foreground'}>
                            {i + 1}
                          </span>
                        )}
                      </span>
                      <span
                        className={cn(
                          'min-w-0 flex-1',
                          result?.status === 'skipped' && 'line-through'
                        )}
                      >
                        {s.song && (
                          <span className="inline-flex items-center gap-2">
                            <MusicIcon className="size-4 shrink-0 text-signal" aria-hidden />
                            Song
                          </span>
                        )}
                        {!s.song &&
                          s.exercises.map((e, j) => (
                            <span key={e.id}>
                              {j > 0 && <span className="text-muted-foreground"> / </span>}
                              <span
                                className={cn(
                                  s.exercises.length > 1 &&
                                    e.id !== chosen.id &&
                                    'font-normal text-muted-foreground'
                                )}
                              >
                                {e.name}
                              </span>
                            </span>
                          ))}
                      </span>
                      <span className="shrink-0 font-mono text-[13px] font-normal text-muted-foreground">
                        {formatMaybeDuration(chosen.allocatedSeconds)}
                      </span>
                    </li>
                  )
                })}
              </ol>
            </section>

            <section className="flex flex-col gap-2 rounded-[calc(var(--radius)*2)] bg-primary p-6 text-primary-foreground md:min-h-0 md:shrink-0 md:basis-[30%] dark:bg-card dark:text-card-foreground dark:shadow-paper">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="text-sm font-medium opacity-70">Observations</h2>
                {picked && (
                  <span className="min-w-0 truncate text-sm opacity-70" title={picked.name}>
                    {picked.name}
                  </span>
                )}
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto text-lg leading-relaxed whitespace-pre-wrap xl:text-xl">
                {!picked ? (
                  <span className="opacity-70">
                    {phase === 'done' ? 'Session complete.' : 'No exercise selected.'}
                  </span>
                ) : picked.description ? (
                  picked.description
                ) : (
                  <span className="opacity-70">No observations for this exercise.</span>
                )}
              </div>
            </section>
          </div>
        )}
      </div>

      <AlertDialog open={confirmEnd} onOpenChange={setConfirmEnd}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>End this session?</AlertDialogTitle>
            <AlertDialogDescription>
              Exercises already done stay logged.{' '}
              {phase === 'running' && "The one in progress won't be."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep going</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                setConfirmEnd(false)
                endSession()
              }}
            >
              End session
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
