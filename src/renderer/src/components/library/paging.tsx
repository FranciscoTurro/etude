import { useLayoutEffect, useRef, useState } from 'react'
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'

export const GRID_GAP = 12

/** How many cells of at least minWidth x minHeight fit in the element (at least 1x1). */
export function useGridFit<T extends HTMLElement>(
  minWidth: number,
  minHeight: number
): [React.RefObject<T | null>, { cols: number; rows: number }] {
  const ref = useRef<T>(null)
  const [fit, setFit] = useState({ cols: 1, rows: 1 })
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      // A hidden tab measures 0x0; keep the last layout instead of collapsing to 1x1.
      if (width === 0 || height === 0) return
      const cols = Math.max(1, Math.floor((width + GRID_GAP) / (minWidth + GRID_GAP)))
      const rows = Math.max(1, Math.floor((height + GRID_GAP) / (minHeight + GRID_GAP)))
      setFit((f) => (f.cols === cols && f.rows === rows ? f : { cols, rows }))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [minWidth, minHeight])
  return [ref, fit]
}

/** Measured height of an element, for fitting a number of fixed-height rows. */
export function useHeight<T extends HTMLElement>(): [React.RefObject<T | null>, number] {
  const ref = useRef<T>(null)
  const [height, setHeight] = useState(0)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      if (entry.contentRect.height > 0) setHeight(entry.contentRect.height)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, height]
}

/** Splits items into pages of `size`, keeping the current page in range as the size changes. */
export function usePages<T>(
  items: T[],
  size: number
): { shown: T[]; page: number; pages: number; setPage: (p: number) => void } {
  const [wanted, setPage] = useState(0)
  const pages = Math.max(1, Math.ceil(items.length / size))
  const page = Math.min(wanted, pages - 1)
  return { shown: items.slice(page * size, (page + 1) * size), page, pages, setPage }
}

export function Pager({
  page,
  pages,
  onPage
}: {
  page: number
  pages: number
  onPage: (p: number) => void
}): React.JSX.Element | null {
  if (pages <= 1) return null
  return (
    <div className="flex items-center">
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => onPage(page - 1)}
        disabled={page === 0}
        title="Previous page"
        aria-label="Previous page"
      >
        <ChevronLeftIcon />
      </Button>
      <span className="min-w-12 text-center text-sm text-muted-foreground tabular-nums">
        {page + 1} / {pages}
      </span>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => onPage(page + 1)}
        disabled={page >= pages - 1}
        title="Next page"
        aria-label="Next page"
      >
        <ChevronRightIcon />
      </Button>
    </div>
  )
}

/** A grid with exactly cols x rows equal cells. */
export function gridStyle(cols: number, rows: number): React.CSSProperties {
  return {
    gap: GRID_GAP,
    gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
    gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`
  }
}
