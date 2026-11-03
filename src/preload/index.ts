import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { Exercise, ExerciseInput } from '../shared/exercise'
import type { Day, DayInput } from '../shared/day'
import type { Weekday, WeekScheduleEntry } from '../shared/week'
import type { Settings, Theme } from '../shared/settings'
import type { ExerciseLogInput } from '../shared/session'

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
    set: (key: string, value: string): Promise<void> => ipcRenderer.invoke('settings:set', key, value),
    setTheme: (theme: Theme): Promise<void> => ipcRenderer.invoke('theme:set', theme)
  },
  sessions: {
    /** Resolves to the new session id. */
    start: (dayId: number): Promise<number> => ipcRenderer.invoke('sessions:start', dayId),
    log: (input: ExerciseLogInput): Promise<void> => ipcRenderer.invoke('sessions:log', input),
    finish: (sessionId: number): Promise<void> => ipcRenderer.invoke('sessions:finish', sessionId)
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
