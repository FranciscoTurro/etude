import { useEffect, useRef, useState } from 'react'
import { audioOut, scheduleClick } from '@/lib/sounds'

const LOOKAHEAD_MS = 25 // how often the scheduler wakes up
const SCHEDULE_AHEAD_S = 0.12 // how far ahead clicks are queued on the audio clock

/**
 * Plain clicks at `bpm` while `running`. Clicks are scheduled on the audio clock
 * a little ahead of time (the "two clocks" pattern), so timer jitter never makes
 * the beat drift. A tempo change applies from the next click.
 *
 * Returns a counter that bumps on every audible click, for a visual pulse.
 */
export function useMetronome(bpm: number, running: boolean): number {
  const [beat, setBeat] = useState(0)
  const bpmRef = useRef(bpm)
  bpmRef.current = bpm

  useEffect(() => {
    if (!running) return
    const c = audioOut()
    let next = c.currentTime + 0.05
    const visuals: ReturnType<typeof setTimeout>[] = []

    const tick = (): void => {
      while (next < c.currentTime + SCHEDULE_AHEAD_S) {
        scheduleClick(next)
        const delay = Math.max(0, (next - c.currentTime) * 1000)
        visuals.push(setTimeout(() => setBeat((b) => b + 1), delay))
        next += 60 / Math.min(400, Math.max(20, bpmRef.current || 0))
      }
      if (visuals.length > 32) visuals.splice(0, visuals.length - 32)
    }
    tick()
    const timer = setInterval(tick, LOOKAHEAD_MS)
    return () => {
      clearInterval(timer)
      visuals.forEach(clearTimeout)
    }
  }, [running])

  return beat
}
