// Pure operations on the day editor's working copy. Every op returns a new array
// and drops slots that end up empty, so a slot left with one alternative is
// simply a normal slot again.

export interface DraftSlot {
  key: string
  /** A Song slot holds no ids: it's filled with every song when the day loads. */
  song?: boolean
  exerciseIds: number[]
  /** Carried over from the saved day so the editor total matches the list. */
  preselectedId?: number
}

let nextKey = 0
const newKey = (): string => `slot-${nextKey++}`

export const makeSlot = (exerciseIds: number[], preselectedId?: number): DraftSlot => ({
  key: newKey(),
  exerciseIds,
  preselectedId
})

export const makeSongSlot = (): DraftSlot => ({ key: newKey(), song: true, exerciseIds: [] })

const tidy = (slots: DraftSlot[]): DraftSlot[] =>
  slots.filter((s) => s.song || s.exerciseIds.length > 0)

function withoutExercise(slots: DraftSlot[], slotKey: string, exerciseId: number): DraftSlot[] {
  return slots.map((s) =>
    s.key === slotKey ? { ...s, exerciseIds: s.exerciseIds.filter((id) => id !== exerciseId) } : s
  )
}

/** Remove one exercise from a slot. */
export function removeExercise(
  slots: DraftSlot[],
  slotKey: string,
  exerciseId: number
): DraftSlot[] {
  return tidy(withoutExercise(slots, slotKey, exerciseId))
}

/**
 * Put an exercise in a slot as an alternative. `from` is set when it's being
 * dragged out of another slot. No-op if the slot already has it.
 */
export function addToSlot(
  slots: DraftSlot[],
  targetKey: string,
  exerciseId: number,
  from?: string
): DraftSlot[] {
  if (from === targetKey) return slots
  const target = slots.find((s) => s.key === targetKey)
  if (!target || target.song || target.exerciseIds.includes(exerciseId)) return slots
  const moved = from ? withoutExercise(slots, from, exerciseId) : slots
  return tidy(
    moved.map((s) =>
      s.key === targetKey ? { ...s, exerciseIds: [...s.exerciseIds, exerciseId] } : s
    )
  )
}

/** Make an exercise its own slot, inserted before index `at` (slots.length = at the end). */
export function insertSlot(
  slots: DraftSlot[],
  at: number,
  exerciseId: number,
  from?: string
): DraftSlot[] {
  const base = from ? withoutExercise(slots, from, exerciseId) : slots.slice()
  base.splice(at, 0, makeSlot([exerciseId]))
  return tidy(base)
}

/** Insert a Song slot before index `at`. */
export function insertSongSlot(slots: DraftSlot[], at: number): DraftSlot[] {
  const next = slots.slice()
  next.splice(at, 0, makeSongSlot())
  return next
}

/** Remove a whole slot. */
export const removeSlot = (slots: DraftSlot[], slotKey: string): DraftSlot[] =>
  slots.filter((s) => s.key !== slotKey)

/** Move a whole slot so it lands before index `to`. */
export function moveSlot(slots: DraftSlot[], slotKey: string, to: number): DraftSlot[] {
  const from = slots.findIndex((s) => s.key === slotKey)
  if (from === -1) return slots
  const next = slots.slice()
  const [slot] = next.splice(from, 1)
  next.splice(to > from ? to - 1 : to, 0, slot)
  return next
}

/** What play would pick: the saved preselection if it's still there, else the first. */
export const effectiveId = (s: DraftSlot): number | undefined =>
  s.preselectedId !== undefined && s.exerciseIds.includes(s.preselectedId)
    ? s.preselectedId
    : s.exerciseIds[0]
