import { MinusIcon, PlayIcon, PlusIcon, SquareIcon } from 'lucide-react'
import { cn } from 'cn'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface Props {
  /** Text in the BPM field (kept as text so it can be mid-edit). */
  bpmText: string
  onBpmTextChange: (text: string) => void
  /** true: the tempo is the exercise's (and gets logged); false: the metronome's own tempo. */
  fromExercise: boolean
  running: boolean
  onToggle: () => void
  /** Bumps on every click. */
  beat: number
}

export const clampBpm = (n: number): number => Math.min(400, Math.max(20, Math.round(n)))

export function MetronomePanel(props: Props): React.JSX.Element {
  const { bpmText, fromExercise, running, beat } = props
  const n = Number(bpmText)
  const valid = Number.isFinite(n) && n > 0
  const nudge = (d: number): void => props.onBpmTextChange(String(clampBpm((valid ? n : 100) + d)))

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-xl border p-4">
      <div className="flex items-center gap-2.5">
        <span className="relative flex size-3">
          {running ? (
            <span
              key={beat}
              className="size-3 rounded-full bg-primary"
              style={{ animation: 'metronome-pulse 220ms ease-out forwards' }}
            />
          ) : (
            <span className="size-3 rounded-full bg-muted-foreground/30" />
          )}
        </span>
        <span className="text-sm font-medium">Metronome</span>
      </div>

      <div className="flex items-center gap-1">
        <Button variant="outline" size="icon-sm" onClick={() => nudge(-5)} title="−5 BPM" aria-label="Slower">
          <MinusIcon />
        </Button>
        <Input
          type="number"
          min={20}
          max={400}
          value={bpmText}
          onChange={(e) => props.onBpmTextChange(e.target.value)}
          className="h-8 w-20 text-center tabular-nums"
          aria-label="Metronome BPM"
        />
        <Button variant="outline" size="icon-sm" onClick={() => nudge(5)} title="+5 BPM" aria-label="Faster">
          <PlusIcon />
        </Button>
        <span className="ml-1 text-sm text-muted-foreground">BPM</span>
      </div>

      <span className={cn('text-xs text-muted-foreground', 'min-w-0 flex-1')}>
        {fromExercise ? 'Logged with this exercise' : 'No BPM on this exercise, so nothing is logged'}
      </span>

      <Button variant={running ? 'secondary' : 'outline'} size="sm" onClick={props.onToggle} disabled={!valid}>
        {running ? <SquareIcon /> : <PlayIcon />}
        {running ? 'Stop' : 'Start'}
      </Button>
    </div>
  )
}
