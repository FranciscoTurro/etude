/** Keys of the Setting table. Values are always stored as strings. */
export const SETTING = {
  userName: 'user_name',
  audioInputId: 'audio_input_id',
  /** dBFS level above which the practice clock runs. */
  audioThresholdDb: 'audio_threshold_db'
} as const

export type Settings = Record<string, string>

export const DEFAULT_THRESHOLD_DB = -45
/** How long the clock keeps running after the input goes quiet. */
export const SILENCE_HOLD_MS = 5000
