import { useEffect, useState } from 'react'
import { DownloadIcon, FileTextIcon, MoonIcon, UploadIcon } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const prefersDark = (): boolean => window.matchMedia('(prefers-color-scheme: dark)').matches

export function SettingsDialog({ open, onOpenChange }: Props): React.JSX.Element {
  const [dark, setDark] = useState(prefersDark)

  // Reflects the effective theme, including "follow the OS" before it's ever been set.
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const update = (): void => setDark(mq.matches)
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  const [confirmImport, setConfirmImport] = useState(false)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null)

  useEffect(() => {
    if (open) setStatus(null)
  }, [open])

  async function exportData(): Promise<void> {
    setBusy(true)
    setStatus(null)
    try {
      const path = await window.api.data.export()
      if (path) setStatus({ ok: true, text: `Saved to ${path}` })
    } catch (err) {
      setStatus({ ok: false, text: errorText(err) })
    } finally {
      setBusy(false)
    }
  }

  async function exportText(): Promise<void> {
    setBusy(true)
    setStatus(null)
    try {
      const path = await window.api.data.exportText()
      if (path) setStatus({ ok: true, text: `Saved to ${path}` })
    } catch (err) {
      setStatus({ ok: false, text: errorText(err) })
    } finally {
      setBusy(false)
    }
  }

  async function importData(): Promise<void> {
    setConfirmImport(false)
    setBusy(true)
    setStatus(null)
    try {
      // Reload so every screen (and any running session) starts over on the new data.
      if (await window.api.data.import()) window.location.reload()
    } catch (err) {
      setStatus({ ok: false, text: errorText(err) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col divide-y">
          <Row icon={<MoonIcon className="size-4" />} label="Dark mode">
            <Switch
              checked={dark}
              onCheckedChange={(on) => window.api.settings.setTheme(on ? 'dark' : 'light')}
              aria-label="Dark mode"
            />
          </Row>
        </div>

        <div className="flex flex-col gap-2 border-t pt-3">
          <div className="flex flex-col">
            <span className="text-sm font-medium">Data</span>
            <span className="text-xs text-muted-foreground">
              Exercises, days, week, history and settings, in one file. Use it to move to another
              computer.
            </span>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={busy} onClick={exportData}>
              <DownloadIcon /> Export
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => setConfirmImport(true)}
            >
              <UploadIcon /> Import
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-2 border-t pt-3">
          <div className="flex flex-col">
            <span className="text-sm font-medium">Routine as text</span>
            <span className="text-xs text-muted-foreground">
              A .txt with each day of the week, its exercises, their observations and time.
            </span>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={busy} onClick={exportText}>
              <FileTextIcon /> Export .txt
            </Button>
          </div>
          {status && (
            <p
              className={
                status.ok ? 'text-xs break-all text-muted-foreground' : 'text-xs text-destructive'
              }
            >
              {status.text}
            </p>
          )}
        </div>
      </DialogContent>

      <AlertDialog open={confirmImport} onOpenChange={setConfirmImport}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Replace all data?</AlertDialogTitle>
            <AlertDialogDescription>
              Everything here (exercises, days, week, history and settings) will be replaced by the
              backup you pick. A session in progress will end without saving. Export first if you
              want to keep the current data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={importData}>
              Choose backup…
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  )
}

/** IPC errors arrive as "Error invoking remote method 'x': Error: <message>". */
function errorText(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err)
  return msg.replace(/^Error invoking remote method '[^']+': (Error: )?/, '')
}

function Row({
  icon,
  label,
  children
}: {
  icon: React.ReactNode
  label: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <label className="flex cursor-pointer items-center gap-3 py-3">
      <span className="text-muted-foreground">{icon}</span>
      <span className="min-w-0 flex-1 text-sm font-medium">{label}</span>
      {children}
    </label>
  )
}
