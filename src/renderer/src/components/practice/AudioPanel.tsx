import { MicIcon, MicOffIcon } from 'lucide-react'
import { cn } from 'cn'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface Props {
  /** One entry per channel; a stereo interface gets a meter per input. */
  channelDbs: number[]
  thresholdDb: number
  onThresholdChange: (db: number) => void
  devices: MediaDeviceInfo[]
  deviceId: string | undefined
  onDeviceChange: (id: string) => void
  error: string | null
  /** Whether the clock waits for sound (off = it just runs until paused). */
  listens: boolean
  onListensChange: (on: boolean) => void
}

const MIN_DB = -80
const pct = (db: number): number => Math.min(100, Math.max(0, ((db - MIN_DB) / -MIN_DB) * 100))

/** Mic picker, live level meter and the "clock runs above this" threshold. */
export function AudioPanel(props: Props): React.JSX.Element {
  const { channelDbs, thresholdDb, devices, deviceId, error, listens } = props
  const meters = channelDbs.length ? channelDbs : [-Infinity]
  const items = devices.map((d, i) => ({ value: d.deviceId, label: d.label || `Input ${i + 1}` }))
  const selected = items.some((i) => i.value === deviceId) ? deviceId : (items[0]?.value ?? '')

  return (
    <div className="flex flex-col gap-3 rounded-xl border p-4">
      <div className="flex items-center gap-2">
        {error ? (
          <MicOffIcon className="size-4 shrink-0 text-destructive" />
        ) : (
          <MicIcon className="size-4 shrink-0 text-muted-foreground" />
        )}
        {items.length > 0 ? (
          <Select items={items} value={selected} onValueChange={(v) => v && props.onDeviceChange(v as string)}>
            <SelectTrigger size="sm" className="min-w-0 flex-1" aria-label="Audio input">
              <SelectValue className="truncate" />
            </SelectTrigger>
            <SelectContent>
              {items.map((i) => (
                <SelectItem key={i.value} value={i.value}>
                  {i.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <span className="text-sm text-muted-foreground">{error ? 'No microphone' : 'Opening microphone…'}</span>
        )}
      </div>

      <label className="flex cursor-pointer items-center justify-between gap-3 text-sm">
        <span className="flex flex-col">
          <span>Run the clock only while playing</span>
          <span className="text-xs text-muted-foreground">
            {listens ? 'It waits for sound above the threshold' : 'It runs until you pause it'}
          </span>
        </span>
        <Switch
          checked={listens}
          onCheckedChange={props.onListensChange}
          aria-label="Run the clock only while playing"
        />
      </label>

      {error && listens && (
        <p className="text-xs text-destructive">
          {error}. Retrying… Until then the clock runs without sound detection.
        </p>
      )}
      {!error && (
        <>
          <div className="flex flex-col gap-1.5">
            {meters.map((db, i) => (
              <div key={i} className="flex items-center gap-2">
                {meters.length > 1 && (
                  <span className="w-3 shrink-0 text-xs text-muted-foreground tabular-nums">{i + 1}</span>
                )}
                <div
                  className="relative h-2 flex-1 overflow-hidden rounded-full bg-muted"
                  aria-label={meters.length > 1 ? `Input ${i + 1} level` : 'Input level'}
                >
                  <div
                    className={cn(
                      'h-full rounded-full transition-[width] duration-75',
                      db > thresholdDb ? 'bg-primary' : 'bg-muted-foreground/40'
                    )}
                    style={{ width: `${pct(db)}%` }}
                  />
                  <div
                    className="absolute inset-y-0 w-0.5 bg-foreground"
                    style={{ left: `${pct(thresholdDb)}%` }}
                    title="Threshold"
                  />
                </div>
              </div>
            ))}
          </div>
          <label className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="shrink-0">Threshold</span>
            <input
              type="range"
              min={MIN_DB}
              max={0}
              step={1}
              value={thresholdDb}
              onChange={(e) => props.onThresholdChange(Number(e.target.value))}
              className="min-w-0 flex-1 cursor-pointer accent-primary"
              aria-label="Sound threshold"
            />
            <span className="w-12 shrink-0 text-right tabular-nums">{thresholdDb} dB</span>
          </label>
        </>
      )}
    </div>
  )
}
