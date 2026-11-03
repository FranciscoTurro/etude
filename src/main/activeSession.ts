import { dialog, type BrowserWindow } from 'electron'
import { abandonSession } from './db/sessions'

/** The session the renderer is running right now (reported over IPC), if any. */
let activeSessionId: number | null = null

export function setActiveSession(id: number | null): void {
  activeSessionId = id
}

/**
 * Closing mid-session asks first. Quitting ends the session at its last log:
 * the exercise in progress and everything after it just aren't logged.
 */
export function guardCloseDuringSession(win: BrowserWindow): void {
  win.on('close', (e) => {
    if (activeSessionId === null) return
    const choice = dialog.showMessageBoxSync(win, {
      type: 'question',
      buttons: ['Quit', 'Keep practicing'],
      defaultId: 1,
      cancelId: 1,
      title: 'Session in progress',
      message: 'Quit in the middle of a session?',
      detail:
        "Exercises already done stay logged. The one in progress and the rest of the day won't be."
    })
    if (choice !== 0) {
      e.preventDefault()
      return
    }
    abandonSession(activeSessionId)
    activeSessionId = null
  })
}
