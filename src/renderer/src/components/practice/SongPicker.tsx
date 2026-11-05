import { Combobox } from '@base-ui/react/combobox'
import { CheckIcon, ChevronDownIcon, MusicIcon, SearchIcon } from 'lucide-react'
import type { SlotExercise } from '../../../../shared/day'

interface Props {
  songs: SlotExercise[]
  value: SlotExercise
  onChange: (song: SlotExercise) => void
}

/** Searchable song dropdown: the button shows the current pick, the popup filters as you type. */
export function SongPicker({ songs, value, onChange }: Props): React.JSX.Element {
  return (
    <Combobox.Root
      items={songs}
      value={value}
      onValueChange={(song) => song && onChange(song)}
      itemToStringLabel={(song) => song.name}
      isItemEqualToValue={(a, b) => a.id === b.id}
      autoHighlight
    >
      <Combobox.Trigger
        className="flex max-w-full min-w-0 items-center gap-3 rounded-2xl border border-input px-4 py-2 text-3xl font-semibold tracking-tight transition-colors outline-none hover:bg-accent focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30 dark:hover:bg-input/50"
        aria-label="Song to play"
      >
        <MusicIcon className="size-6 shrink-0 text-signal" />
        <span className="min-w-0 truncate">
          <Combobox.Value />
        </span>
        <ChevronDownIcon className="size-5 shrink-0 text-muted-foreground" />
      </Combobox.Trigger>

      <Combobox.Portal>
        <Combobox.Positioner sideOffset={6} className="isolate z-50">
          <Combobox.Popup className="flex max-h-(--available-height) w-88 max-w-(--available-width) flex-col overflow-hidden rounded-xl bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10 outline-none">
            <div className="flex items-center gap-2 border-b px-3">
              <SearchIcon className="size-4 shrink-0 text-muted-foreground" />
              <Combobox.Input
                placeholder="Search songs…"
                className="h-10 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                aria-label="Search songs"
              />
            </div>
            <Combobox.Empty className="p-4 text-center text-sm text-muted-foreground empty:hidden">
              No songs match
            </Combobox.Empty>
            <Combobox.List className="max-h-72 overflow-y-auto p-1 empty:hidden">
              {(song: SlotExercise) => (
                <Combobox.Item
                  key={song.id}
                  value={song}
                  className="flex cursor-default items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none select-none data-highlighted:bg-accent data-highlighted:text-accent-foreground"
                >
                  <span className="min-w-0 flex-1 truncate" title={song.name}>
                    {song.name}
                  </span>
                  <Combobox.ItemIndicator>
                    <CheckIcon className="size-4 shrink-0" />
                  </Combobox.ItemIndicator>
                </Combobox.Item>
              )}
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  )
}
