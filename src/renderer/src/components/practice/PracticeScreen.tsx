import { useEffect, useRef, useState } from 'react'
import { CheckIcon, PlayIcon, SkipForwardIcon, SquareIcon } from 'lucide-react'
import { cn } from 'cn'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
import { playFinishChime } from '@/lib/sounds'
import { AudioPanel } from './AudioPanel'
import { MetronomePanel } from './MetronomePanel'
import { formatDuration } from '../../../../shared/exercise'
import type { Day, Slot, SlotExercise } from '../../../../shared/day'
import type { LogStatus } from '../../../../shared/session'
import { WEEKDAY_LABELS, weekdayOf, type WeekScheduleEntry } from '../../../../shared/week'
import {
  DEFAULT_METRONOME_BPM,
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
  const liveDay = days?.find((d) => d.id === selectedId) ?? null

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

  // ---- clock ----
  const elapsedRef = useRef(0)
  const [elapsedMs, setElapsedMs] = useState(0)
  const [clockState, setClockState] = useState<'playing' | 'holding' | 'waiting'>('waiting')
  const [holdLeft, setHoldLeft] = useState(0)

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
  const [freeBpmText, setFreeBpmText] = useState<string | null>(null)
  const savedFreeBpm = Number(settings?.[SETTING.metronomeBpm])
  const freeBpm = freeBpmText ?? String(savedFreeBpm > 0 ? savedFreeBpm : DEFAULT_METRONOME_BPM)
  const metronomeFromExercise = picked?.bpm != null
  const metronomeText = metronomeFromExercise ? bpmValue : freeBpm
  const [metronomeOn, setMetronomeOn] = useState(false)
  const metronomeBpm = Number(metronomeText)
  const beat = useMetronome(
    metronomeBpm,
    metronomeEnabled && metronomeOn && !!picked && Number.isFinite(metronomeBpm) && metronomeBpm > 0
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
      await window.api.sessions.log({
        sessionId: r.sessionId,
        exerciseId: ex.id,
        exerciseName: ex.name,
        status,
        bpm,
        secondsAllocated: ex.allocatedSeconds
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
  const allocatedMs = (picked?.allocatedSeconds ?? 0) * 1000
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
      const sinceSound = now - audio.lastAboveRef.current
      const counting = noMicRef.current || sinceSound < SILENCE_HOLD_MS
      setClockState(
        noMicRef.current || sinceSound < 150 ? 'playing' : counting ? 'holding' : 'waiting'
      )
      setHoldLeft(Math.ceil((SILENCE_HOLD_MS - sinceSound) / 1000))
      if (!counting) return
      elapsedRef.current += dt
      setElapsedMs(elapsedRef.current)
      if (elapsedRef.current >= allocatedRef.current) advanceRef.current('completed')
    }, 100)
    return () => clearInterval(timer)
  }, [phase, index, audio.lastAboveRef])

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

  const name = settings?.[SETTING.userName]
  const remainingMs = Math.max(0, allocatedMs - elapsedMs)
  const dayItems = [
    { value: NO_DAY, label: 'Rest day' },
    ...(days ?? []).map((d) => ({ value: String(d.id), label: d.name }))
  ]
  const choiceFor = (i: number, s: Slot): SlotExercise =>
    s.exercises.find((e) => e.id === results[i]?.exerciseId) ??
    (i === index && picked ? picked : preselected(s))
  const totalSeconds =
    day?.slots.reduce((sum, s, i) => sum + choiceFor(i, s).allocatedSeconds, 0) ?? 0

  return (
    <div className="flex w-full flex-col gap-6 p-6 md:h-full xl:gap-8 xl:px-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            Hello{name ? ` ${name}` : ''}, today is {WEEKDAY_LABELS[today]},
          </h1>
          <p className="text-muted-foreground">
            {scheduledDay ? (
              <>
                so you have <span className="font-medium text-foreground">{scheduledDay.name}</span>
              </>
            ) : (
              "so it's a rest day. You can still pick a day to practice."
            )}
          </p>
        </div>
        {run && phase !== 'done' ? (
          <Button variant="outline" onClick={() => setConfirmEnd(true)}>
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
              <SelectTrigger className="w-48" aria-label="Day to practice">
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

      <div className="grid items-start gap-6 md:min-h-0 md:flex-1 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:items-stretch">
        {/* Timer side */}
        <div className="flex flex-col gap-4 md:min-h-0 md:overflow-y-auto">
          <div className="flex min-h-96 flex-col items-center justify-center gap-5 rounded-2xl border p-8 text-center xl:min-h-[32rem]">
            {phase === 'done' && day ? (
              <>
                <CheckIcon className="size-12 text-primary" />
                <div>
                  <h2 className="font-heading text-2xl font-semibold">Session complete</h2>
                  <p className="text-muted-foreground">
                    {Object.values(results).filter((r) => r.status === 'completed').length}{' '}
                    completed, {Object.values(results).filter((r) => r.status === 'skipped').length}{' '}
                    skipped
                  </p>
                </div>
                <Button size="lg" onClick={endSession}>
                  Practice again
                </Button>
              </>
            ) : !day ? (
              <p className="text-muted-foreground">
                Rest day. Pick a day above to practice anyway.
              </p>
            ) : !slot || !picked ? (
              <p className="text-muted-foreground">{day.name} has no exercises yet.</p>
            ) : (
              <>
                <div className="flex flex-col items-center gap-2">
                  <span className="text-xs tracking-wide text-muted-foreground uppercase">
                    {index + 1} of {day.slots.length}
                  </span>
                  {slot.exercises.length > 1 && phase === 'queued' ? (
                    <div
                      className="flex flex-wrap justify-center gap-1.5"
                      role="radiogroup"
                      aria-label="Pick an alternative"
                    >
                      {slot.exercises.map((e) => (
                        <Button
                          key={e.id}
                          role="radio"
                          aria-checked={e.id === picked.id}
                          variant={e.id === picked.id ? 'default' : 'outline'}
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
                    <h2 className="font-heading text-2xl font-semibold">{picked.name}</h2>
                  )}
                </div>

                <div
                  className={cn(
                    'font-heading text-7xl font-semibold tabular-nums transition-colors xl:text-9xl',
                    phase === 'running' && clockState === 'waiting' && 'text-muted-foreground'
                  )}
                  aria-label="Time remaining"
                >
                  {formatDuration(Math.ceil(remainingMs / 1000))}
                </div>

                <p className="h-5 text-sm text-muted-foreground" aria-live="polite">
                  {phase === 'running' &&
                    (clockState === 'playing'
                      ? 'Playing'
                      : clockState === 'holding'
                        ? `Quiet… stopping in ${holdLeft}s`
                        : 'Paused. Waiting for sound')}
                </p>

                {phase === 'queued' && (
                  <Button
                    onClick={play}
                    className="size-24 rounded-full xl:size-32 [&_svg:not([class*='size-'])]:size-10 xl:[&_svg:not([class*='size-'])]:size-14"
                    aria-label="Play"
                  >
                    <PlayIcon className="translate-x-0.5" />
                  </Button>
                )}

                <div className="flex items-center gap-3">
                  {metronomeEnabled ? null : picked.bpm !== null ? (
                    <label className="flex items-center gap-2 text-sm text-muted-foreground">
                      BPM
                      <Input
                        type="number"
                        min={1}
                        max={400}
                        value={bpmValue}
                        onChange={(e) => setBpmText(e.target.value)}
                        className="h-8 w-20"
                        aria-label="BPM for this session"
                      />
                    </label>
                  ) : (
                    <span className="text-sm text-muted-foreground">No BPM</span>
                  )}
                  <Button variant="ghost" onClick={() => logAndAdvance('skipped')}>
                    <SkipForwardIcon /> Skip
                  </Button>
                </div>
              </>
            )}
          </div>

          {metronomeEnabled && picked && phase !== 'done' && (
            <MetronomePanel
              bpmText={metronomeText}
              onBpmTextChange={changeMetronomeBpm}
              fromExercise={metronomeFromExercise}
              running={metronomeOn}
              onToggle={() => setMetronomeOn((on) => !on)}
              beat={beat}
            />
          )}

          <AudioPanel
            channelDbs={audio.channelDbs}
            thresholdDb={thresholdDb}
            onThresholdChange={changeThreshold}
            devices={audio.devices}
            deviceId={deviceId}
            onDeviceChange={changeDevice}
            error={audio.error}
          />
        </div>

        {/* Exercise list (~70%) + current exercise's observations (~30%) */}
        {day && (
          <div className="flex flex-col gap-4 md:min-h-0">
            <div className="flex flex-col gap-3 rounded-2xl border p-5 md:min-h-0 md:flex-1">
              <div className="flex items-baseline justify-between">
                <h2 className="font-heading text-lg font-semibold">{day.name}</h2>
                <span className="text-sm text-muted-foreground tabular-nums">
                  {formatDuration(totalSeconds)}
                </span>
              </div>
              <ol className="flex flex-col gap-1 md:min-h-0 md:overflow-y-auto">
                {day.slots.map((s, i) => {
                  const result = results[i]
                  const current = phase !== 'done' && i === index
                  const chosen = choiceFor(i, s)
                  return (
                    <li
                      key={i}
                      ref={current ? currentRowRef : undefined}
                      className={cn(
                        'flex items-center gap-3 rounded-lg px-3 py-2 text-sm',
                        current && 'bg-primary/10',
                        result && 'text-muted-foreground'
                      )}
                    >
                      <span className="flex w-5 shrink-0 justify-center tabular-nums">
                        {result?.status === 'completed' ? (
                          <CheckIcon className="size-4 text-primary" aria-label="Completed" />
                        ) : result?.status === 'skipped' ? (
                          <SkipForwardIcon className="size-4" aria-label="Skipped" />
                        ) : current ? (
                          <PlayIcon className="size-3.5 text-primary" />
                        ) : (
                          <span className="text-muted-foreground">{i + 1}</span>
                        )}
                      </span>
                      <span
                        className={cn(
                          'min-w-0 flex-1',
                          result?.status === 'skipped' && 'line-through'
                        )}
                      >
                        {s.exercises.map((e, j) => (
                          <span key={e.id}>
                            {j > 0 && <span className="text-muted-foreground"> / </span>}
                            <span
                              className={cn(
                                s.exercises.length > 1 &&
                                  (e.id === chosen.id ? 'font-medium' : 'text-muted-foreground')
                              )}
                            >
                              {e.name}
                            </span>
                          </span>
                        ))}
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                        {formatDuration(chosen.allocatedSeconds)}
                      </span>
                    </li>
                  )
                })}
              </ol>
            </div>

            <div className="flex flex-col gap-2 rounded-2xl border p-5 md:min-h-0 md:shrink-0 md:basis-[30%]">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="font-heading text-lg font-semibold">Observations</h2>
                {picked && (
                  <span
                    className="min-w-0 truncate text-sm text-muted-foreground"
                    title={picked.name}
                  >
                    {picked.name}
                  </span>
                )}
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto text-base leading-relaxed whitespace-pre-wrap xl:text-lg">
                {!picked ? (
                  <span className="text-muted-foreground">
                    {phase === 'done' ? 'Session complete.' : 'No exercise selected.'}
                  </span>
                ) : picked.description ? (
                  picked.description
                ) : (
                  <span className="text-muted-foreground">No observations for this exercise.</span>
                )}
              </div>
            </div>
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
