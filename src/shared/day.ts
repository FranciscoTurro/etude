export interface SlotExercise {
  id: number
  name: string
  bpm: number | null
  allocatedSeconds: number
}

export interface Slot {
  /** One exercise = normal slot; several = alternatives, in the order they were added. */
  exercises: SlotExercise[]
  /** The alternative completed least recently (what play will pick by default). */
  preselectedId: number
}

export interface Day {
  id: number
  name: string
  createdAt: string
  slots: Slot[]
  /** Sum over slots, using each slot's preselected alternative. */
  totalSeconds: number
}

export interface DayInput {
  name: string
  /** Ordered slots, each a list of exercise ids. Saved as positions 0, 1, 2... */
  slots: number[][]
}

export function validateDayInput(input: DayInput): string | null {
  if (!input.name.trim()) return 'Name is required'
  for (const slot of input.slots) {
    if (slot.length === 0) return 'A slot cannot be empty'
    if (new Set(slot).size !== slot.length) return 'The same exercise cannot be twice in one slot'
  }
  return null
}

/**
 * Least recently completed wins; never-completed beats everything. Ties keep
 * slot order, so a brand new slot starts with its first alternative.
 */
export function pickAlternative(
  exerciseIds: number[],
  lastCompleted: Map<number, string>
): number {
  let best = exerciseIds[0]
  let bestAt = lastCompleted.get(best)
  for (const id of exerciseIds.slice(1)) {
    if (bestAt === undefined) break
    const at = lastCompleted.get(id)
    if (at === undefined || at < bestAt) {
      best = id
      bestAt = at
    }
  }
  return best
}
