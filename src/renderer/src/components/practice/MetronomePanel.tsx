import { MinusIcon, PlusIcon } from 'lucide-react'
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

/** Four dots that step with the clicks: a visual cue only, the clicks have no accent. */
const DOTS = 4

/** Inline metronome: beat dots, BPM with ±5, and on/off. Sits in the practice card's footer. */
export function MetronomePanel(props: Props): React.JSX.Element {
  const { bpmText, fromExercise, running, beat } = props
  const n = Number(bpmText)
  const valid = Number.isFinite(n) && n > 0
  const nudge = (d: number): void => props.onBpmTextChange(String(clampBpm((valid ? n : 100) + d)))
  const lit = running && beat > 0 ? (beat - 1) % DOTS : -1

  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        onClick={props.onToggle}
        disabled={!valid}
        className="flex items-center gap-2 rounded-full p-2 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50"
        aria-label={running ? 'Stop metronome' : 'Start metronome'}
        aria-pressed={running}
        title={running ? 'Stop metronome' : 'Start metronome'}
      >
        {Array.from({ length: DOTS }, (_, i) =>
          i === lit ? (
            <span
              key={`${i}-${beat}`}
              className="size-3.5 rounded-full bg-signal"
              style={{ animation: 'metronome-pulse 220ms ease-out forwards' }}
            />
          ) : (
            <span
              key={i}
              className={cn(
                'size-3.5 rounded-full border-2',
                running ? 'border-signal/40' : 'border-muted-foreground/40'
              )}
            />
          )
        )}
      </button>

      <div className="flex flex-col items-end gap-0.5">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => nudge(-5)}
            title="−5 BPM"
            aria-label="Slower"
          >
            <MinusIcon />
          </Button>
          <Input
            type="number"
            min={20}
            max={400}
            value={bpmText}
            onChange={(e) => props.onBpmTextChange(e.target.value)}
            className="h-10 w-20 border-transparent bg-transparent text-center font-mono text-2xl font-semibold shadow-none [appearance:textfield] focus-visible:border-input [&::-webkit-inner-spin-button]:appearance-none"
            aria-label="Metronome BPM"
            title={
              fromExercise
                ? 'Logged with this exercise'
                : 'No BPM on this exercise, so nothing is logged'
            }
          />
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => nudge(5)}
            title="+5 BPM"
            aria-label="Faster"
          >
            <PlusIcon />
          </Button>
          <span className="text-sm text-muted-foreground">BPM</span>
        </div>
        {!fromExercise && <span className="text-xs text-muted-foreground">Not logged</span>}
      </div>
    </div>
  )
}
