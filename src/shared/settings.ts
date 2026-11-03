/** Keys of the Setting table. Values are always stored as strings. */
export const SETTING = {
  userName: 'user_name',
  audioInputId: 'audio_input_id',
  /** dBFS level above which the practice clock runs. */
  audioThresholdDb: 'audio_threshold_db',
  /** '1' | '0'. Missing = on. */
  metronomeEnabled: 'metronome_enabled',
  /** Metronome tempo for exercises that have no BPM of their own. */
  metronomeBpm: 'metronome_bpm',
  /** 'light' | 'dark'. Missing = follow the OS. */
  theme: 'theme'
} as const

export type Theme = 'light' | 'dark'
export const isTheme = (v: unknown): v is Theme => v === 'light' || v === 'dark'

export const DEFAULT_METRONOME_BPM = 100

export type Settings = Record<string, string>

export const DEFAULT_THRESHOLD_DB = -45
/** How long the clock keeps running after the input goes quiet. */
export const SILENCE_HOLD_MS = 5000
