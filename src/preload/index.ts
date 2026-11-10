import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { Exercise, ExerciseInput } from '../shared/exercise'
import type { Day, DayInput } from '../shared/day'
import type { Weekday, WeekScheduleEntry } from '../shared/week'
import type { Settings, Theme } from '../shared/settings'
import type { ExerciseLogInput } from '../shared/session'
import type { BpmPoint, GraphableExercise, HistorySession, SessionSummary } from '../shared/history'
import type { Stats } from '../shared/stats'

// Custom APIs for renderer
const api = {
  exercises: {
    list: (): Promise<Exercise[]> => ipcRenderer.invoke('exercises:list'),
    create: (input: ExerciseInput): Promise<Exercise> =>
      ipcRenderer.invoke('exercises:create', input),
    update: (id: number, input: ExerciseInput): Promise<Exercise> =>
      ipcRenderer.invoke('exercises:update', id, input),
    duplicate: (id: number): Promise<Exercise> => ipcRenderer.invoke('exercises:duplicate', id),
    daysUsing: (id: number): Promise<string[]> => ipcRenderer.invoke('exercises:daysUsing', id),
    delete: (id: number): Promise<void> => ipcRenderer.invoke('exercises:delete', id)
  },
  days: {
    list: (): Promise<Day[]> => ipcRenderer.invoke('days:list'),
    /** Omit id to create. Resolves to the day's id. */
    save: (id: number | undefined, input: DayInput): Promise<number> =>
      ipcRenderer.invoke('days:save', id, input),
    delete: (id: number): Promise<void> => ipcRenderer.invoke('days:delete', id)
  },
  week: {
    get: (): Promise<WeekScheduleEntry[]> => ipcRenderer.invoke('week:get'),
    /** dayId null = rest day */
    set: (weekday: Weekday, dayId: number | null): Promise<void> =>
      ipcRenderer.invoke('week:set', weekday, dayId)
  },
  settings: {
    getAll: (): Promise<Settings> => ipcRenderer.invoke('settings:getAll'),
    set: (key: string, value: string): Promise<void> =>
      ipcRenderer.invoke('settings:set', key, value),
    setTheme: (theme: Theme): Promise<void> => ipcRenderer.invoke('theme:set', theme)
  },
  sessions: {
    /** Resolves to the new session id. */
    start: (dayId: number): Promise<number> => ipcRenderer.invoke('sessions:start', dayId),
    log: (input: ExerciseLogInput): Promise<void> => ipcRenderer.invoke('sessions:log', input),
    finish: (sessionId: number): Promise<void> => ipcRenderer.invoke('sessions:finish', sessionId),
    /** Tells main which session is running, so closing the window can ask first. */
    setActive: (sessionId: number | null): Promise<void> =>
      ipcRenderer.invoke('sessions:setActive', sessionId)
  },
  history: {
    /** Every session, newest first, without logs. */
    sessions: (): Promise<SessionSummary[]> => ipcRenderer.invoke('history:sessions'),
    session: (id: number): Promise<HistorySession | null> =>
      ipcRenderer.invoke('history:session', id),
    exercises: (): Promise<GraphableExercise[]> => ipcRenderer.invoke('history:exercises'),
    bpm: (exerciseId: number): Promise<BpmPoint[]> => ipcRenderer.invoke('history:bpm', exerciseId),
    stats: (): Promise<Stats> => ipcRenderer.invoke('history:stats')
  },
  data: {
    /** Saves a full backup. Resolves to its path, or null if cancelled. */
    export: (): Promise<string | null> => ipcRenderer.invoke('data:export'),
    /** Saves the week's routine as a .txt. Resolves to its path, or null if cancelled. */
    exportText: (): Promise<string | null> => ipcRenderer.invoke('data:exportText'),
    /** Replaces all data with a backup. Resolves to false if cancelled. */
    import: (): Promise<boolean> => ipcRenderer.invoke('data:import')
  }
}

export type Api = typeof api

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
