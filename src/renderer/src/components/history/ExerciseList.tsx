import { useMemo, useState } from 'react'
import { cn } from 'cn'
import { SearchIcon } from 'lucide-react'
import { Input } from '@/components/ui/input'
import type { GraphableExercise } from '../../../../shared/history'
import { formatRelativeDay } from './dates'

interface Props {
  /** 'exercises' | 'songs', for the search box */
  noun: string
  exercises: GraphableExercise[]
  selectedId: number | null
  onSelect: (id: number) => void
}

/** Searchable list of graphable exercises, alphabetical; deleted ones last. */
export function ExerciseList({ noun, exercises, selectedId, onSelect }: Props): React.JSX.Element {
  const [query, setQuery] = useState('')

  const [active, deleted] = useMemo(() => {
    const q = query.trim().toLowerCase()
    const matches = exercises
      .filter((e) => !q || e.name.toLowerCase().includes(q))
      .sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
      )
    return [matches.filter((e) => !e.deleted), matches.filter((e) => e.deleted)]
  }, [exercises, query])

  const row = (e: GraphableExercise): React.JSX.Element => (
    <li key={e.exerciseId}>
      <button
        onClick={() => onSelect(e.exerciseId)}
        aria-current={e.exerciseId === selectedId ? 'true' : undefined}
        title={e.name}
        className={cn(
          'flex w-full flex-col items-start gap-0.5 rounded-md px-2.5 py-1.5 text-left transition-colors',
          e.exerciseId === selectedId
            ? 'bg-muted text-foreground'
            : 'text-foreground/80 hover:bg-muted/50 hover:text-foreground'
        )}
      >
        <span className="w-full truncate text-sm font-medium">{e.name}</span>
        <span className="text-xs text-muted-foreground">{formatRelativeDay(e.lastPracticed)}</span>
      </button>
    </li>
  )

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="relative shrink-0">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Search ${noun}`}
          aria-label={`Search ${noun}`}
          className="pl-8"
        />
      </div>
      <div className="-mx-2 min-h-0 flex-1 overflow-y-auto px-2">
        {active.length === 0 && deleted.length === 0 && (
          <p className="px-2.5 py-1.5 text-sm text-muted-foreground">No matches.</p>
        )}
        <ul className="flex flex-col gap-0.5">{active.map(row)}</ul>
        {deleted.length > 0 && (
          <>
            <h3 className="mt-4 mb-1 px-2.5 text-xs font-medium text-muted-foreground">Deleted</h3>
            <ul className="flex flex-col gap-0.5">{deleted.map(row)}</ul>
          </>
        )}
      </div>
    </div>
  )
}
