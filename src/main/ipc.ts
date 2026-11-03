import { ipcMain } from 'electron'
import {
  createExercise,
  daysUsingExercise,
  deleteExercise,
  duplicateExercise,
  listExercises,
  updateExercise
} from './db/exercises'
import { deleteDay, listDays, saveDay } from './db/days'
import type { ExerciseInput } from '../shared/exercise'
import type { DayInput } from '../shared/day'
import { getWeekSchedule, setWeekday } from './db/week'
import type { Weekday } from '../shared/week'
import { getSettings, setSetting } from './db/settings'
import { finishSession, logExercise, startSession } from './db/sessions'
import type { ExerciseLogInput } from '../shared/session'

export function registerIpc(): void {
  ipcMain.handle('exercises:list', () => listExercises())
  ipcMain.handle('exercises:create', (_, input: ExerciseInput) => createExercise(input))
  ipcMain.handle('exercises:update', (_, id: number, input: ExerciseInput) =>
    updateExercise(id, input)
  )
  ipcMain.handle('exercises:duplicate', (_, id: number) => duplicateExercise(id))
  ipcMain.handle('exercises:daysUsing', (_, id: number) => daysUsingExercise(id))
  ipcMain.handle('exercises:delete', (_, id: number) => deleteExercise(id))

  ipcMain.handle('days:list', () => listDays())
  ipcMain.handle('days:save', (_, id: number | undefined, input: DayInput) => saveDay(id, input))
  ipcMain.handle('days:delete', (_, id: number) => deleteDay(id))

  ipcMain.handle('week:get', () => getWeekSchedule())
  ipcMain.handle('week:set', (_, weekday: Weekday, dayId: number | null) => setWeekday(weekday, dayId))

  ipcMain.handle('settings:getAll', () => getSettings())
  ipcMain.handle('settings:set', (_, key: string, value: string) => setSetting(key, value))

  ipcMain.handle('sessions:start', (_, dayId: number) => startSession(dayId))
  ipcMain.handle('sessions:log', (_, input: ExerciseLogInput) => logExercise(input))
  ipcMain.handle('sessions:finish', (_, sessionId: number) => finishSession(sessionId))
}
