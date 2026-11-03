import { useMemo } from 'react'
import { CartesianGrid, ComposedChart, Line, XAxis, YAxis } from 'recharts'
import { ChartContainer, ChartTooltip, type ChartConfig } from '@/components/ui/chart'
import type { BpmPoint } from '../../../../shared/history'
import { formatShortDate, parseLocalDate } from './dates'

const config = {
  last: { label: 'Last BPM of the day', color: 'var(--primary)' },
  max: { label: 'Max BPM (when higher)', color: 'var(--muted-foreground)' }
} satisfies ChartConfig

interface Row {
  t: number
  date: string
  last: number
  max: number
  count: number
  /** Only set when the day's max beat its last, so the marker doesn't sit on top of the line. */
  maxOnly: number | null
}

interface Props {
  points: BpmPoint[]
  /** Inclusive start of the x axis (ms); null = from the first point */
  from: number | null
}

export function BpmChart({ points, from }: Props): React.JSX.Element {
  const rows = useMemo<Row[]>(
    () =>
      points.map((p) => ({
        ...p,
        t: parseLocalDate(p.date).getTime(),
        maxOnly: p.max > p.last ? p.max : null
      })),
    [points]
  )
  const now = Date.now()
  const start = from ?? rows[0]?.t ?? now

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <ChartContainer config={config} className="aspect-auto min-h-48 w-full flex-1">
        <ComposedChart data={rows} margin={{ top: 12, right: 12, bottom: 0, left: -12 }}>
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="t"
            type="number"
            scale="time"
            domain={[start, now]}
            tickFormatter={(t: number) => formatShortDate(new Date(t))}
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            minTickGap={40}
          />
          <YAxis
            domain={[
              (min: number) => Math.max(0, Math.floor((min - 10) / 10) * 10),
              (max: number) => Math.ceil((max + 5) / 10) * 10
            ]}
            allowDecimals={false}
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            width={48}
          />
          <ChartTooltip cursor content={<BpmTooltip />} />
          <Line
            dataKey="last"
            type="monotone"
            stroke="var(--color-last)"
            strokeWidth={2}
            dot={{ r: 3, fill: 'var(--color-last)', strokeWidth: 0 }}
            activeDot={{ r: 5, stroke: 'var(--background)', strokeWidth: 2 }}
            isAnimationActive={false}
          />
          <Line
            dataKey="maxOnly"
            stroke="none"
            dot={{ r: 4, fill: 'var(--background)', stroke: 'var(--color-max)', strokeWidth: 2 }}
            activeDot={false}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ChartContainer>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded-full bg-primary" />
          {config.last.label}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full border-2 border-muted-foreground" />
          {config.max.label}
        </span>
      </div>
    </div>
  )
}

function BpmTooltip({
  active,
  payload
}: {
  active?: boolean
  payload?: { payload: Row }[]
}): React.JSX.Element | null {
  const row = payload?.[0]?.payload
  if (!active || !row) return null
  return (
    <div className="grid min-w-36 gap-1 rounded-lg border bg-background px-2.5 py-1.5 text-xs shadow-xl">
      <div className="font-medium">
        {parseLocalDate(row.date).toLocaleDateString(undefined, {
          weekday: 'short',
          month: 'short',
          day: 'numeric'
        })}
      </div>
      <Stat label="Last" value={`${row.last} BPM`} />
      {row.max !== row.last && <Stat label="Max" value={`${row.max} BPM`} />}
      {row.count > 1 && <Stat label="Times played" value={String(row.count)} />}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono font-medium tabular-nums">{value}</span>
    </div>
  )
}
