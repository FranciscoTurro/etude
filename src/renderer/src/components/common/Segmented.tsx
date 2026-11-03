import { cn } from 'cn'

interface Option<T extends string> {
  value: T
  label: React.ReactNode
}

interface Props<T extends string> {
  options: readonly Option<T>[]
  value: T
  onChange: (value: T) => void
  /** Accessible name of the group */
  label: string
  /** 'tabs' switches views (role=tablist); 'toggle' picks a value (pressed buttons). */
  kind?: 'tabs' | 'toggle'
  size?: 'default' | 'sm'
  className?: string
}

/** The one pill switcher used everywhere: app nav, library sections, history views, ranges. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  kind = 'tabs',
  size = 'default',
  className
}: Props<T>): React.JSX.Element {
  const tabs = kind === 'tabs'
  return (
    <div
      role={tabs ? 'tablist' : 'group'}
      aria-label={label}
      className={cn('inline-flex shrink-0 gap-1 rounded-full bg-muted p-1', className)}
    >
      {options.map((o) => {
        const on = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role={tabs ? 'tab' : undefined}
            aria-selected={tabs ? on : undefined}
            aria-pressed={tabs ? undefined : on}
            onClick={() => onChange(o.value)}
            className={cn(
              'rounded-full font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
              size === 'sm' ? 'px-3 py-1 text-xs' : 'px-4 py-1.5 text-sm',
              on
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
