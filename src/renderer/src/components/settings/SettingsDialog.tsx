import { useEffect, useState } from 'react'
import { MetronomeIcon, MoonIcon } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { SETTING, type Settings } from '../../../../shared/settings'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  settings: Settings | null
  onChanged: () => void
}

const prefersDark = (): boolean => window.matchMedia('(prefers-color-scheme: dark)').matches

export function SettingsDialog({ open, onOpenChange, settings, onChanged }: Props): React.JSX.Element {
  const metronomeOn = settings?.[SETTING.metronomeEnabled] !== '0'
  const [dark, setDark] = useState(prefersDark)

  // Reflects the effective theme, including "follow the OS" before it's ever been set.
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const update = (): void => setDark(mq.matches)
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  async function setMetronome(on: boolean): Promise<void> {
    await window.api.settings.set(SETTING.metronomeEnabled, on ? '1' : '0')
    onChanged()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col divide-y">
          <Row
            icon={<MetronomeIcon className="size-4" />}
            label="Metronome"
            hint="Clicks at the exercise's BPM while you practice"
          >
            <Switch checked={metronomeOn} onCheckedChange={setMetronome} aria-label="Metronome" />
          </Row>
          <Row icon={<MoonIcon className="size-4" />} label="Dark mode">
            <Switch
              checked={dark}
              onCheckedChange={(on) => window.api.settings.setTheme(on ? 'dark' : 'light')}
              aria-label="Dark mode"
            />
          </Row>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function Row({
  icon,
  label,
  hint,
  children
}: {
  icon: React.ReactNode
  label: string
  hint?: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <label className="flex cursor-pointer items-center gap-3 py-3">
      <span className="text-muted-foreground">{icon}</span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-sm font-medium">{label}</span>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </span>
      {children}
    </label>
  )
}
