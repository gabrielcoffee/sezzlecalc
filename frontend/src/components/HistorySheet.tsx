import { AnimatePresence, motion } from 'motion/react'
import { useState, type KeyboardEvent, type PointerEvent } from 'react'
import { TrashIcon } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { groupByDay, type HistoryEntry } from '@/hooks/use-history'
import { useMediaQuery } from '@/hooks/use-media-query'
import { formatFull } from '@/lib/format'
import { loadJSON, saveJSON } from '@/lib/storage'
import { blurIfPointer } from '@/lib/utils'

interface Props {
  open: boolean
  /** When the panel was opened; decides which day is "Today". */
  openedAt: Date
  onOpenChange: (open: boolean) => void
  entries: HistoryEntry[]
  onSelect: (entry: HistoryEntry) => void
  onClear: () => void
}

// Panel size the user dragged to, remembered between visits.
// Width applies on desktop (panel on the right), height on phones (bottom).
const SIZE_KEY = 'szlcalc:history-size'
const MIN = 260
const STEP = 32
type Size = { width: number; height: number }
const isSize = (v: unknown): v is Size =>
  typeof v === 'object' && v !== null && typeof (v as Size).width === 'number' && typeof (v as Size).height === 'number'

const clamp = (value: number, max: number) => Math.round(Math.min(Math.max(value, MIN), max))

export function HistorySheet({ open, openedAt, onOpenChange, entries, onSelect, onClear }: Props) {
  const desktop = useMediaQuery('(min-width: 640px)')
  const [size, setSize] = useState<Size>(() => loadJSON(SIZE_KEY, { width: 384, height: 480 }, isSize))
  const groups = groupByDay(entries, openedAt)

  const maxWidth = window.innerWidth * 0.9
  const maxHeight = window.innerHeight * 0.92
  const current = desktop ? clamp(size.width, maxWidth) : clamp(size.height, maxHeight)

  const resize = (value: number) => {
    setSize((prev) => {
      const next = desktop ? { ...prev, width: clamp(value, maxWidth) } : { ...prev, height: clamp(value, maxHeight) }
      saveJSON(SIZE_KEY, next)
      return next
    })
  }

  // Drag the handle: the panel edge follows the pointer.
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    const handle = e.currentTarget
    handle.setPointerCapture(e.pointerId)
    const move = (ev: globalThis.PointerEvent) =>
      resize(desktop ? window.innerWidth - ev.clientX : window.innerHeight - ev.clientY)
    const stop = () => {
      handle.removeEventListener('pointermove', move)
      handle.removeEventListener('pointerup', stop)
      handle.removeEventListener('pointercancel', stop)
    }
    handle.addEventListener('pointermove', move)
    handle.addEventListener('pointerup', stop)
    handle.addEventListener('pointercancel', stop)
  }

  // Keyboard resizing for the same handle.
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const grow = desktop ? 'ArrowLeft' : 'ArrowUp'
    const shrink = desktop ? 'ArrowRight' : 'ArrowDown'
    if (e.key !== grow && e.key !== shrink) return
    e.preventDefault()
    resize(current + (e.key === grow ? STEP : -STEP))
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={desktop ? 'right' : 'bottom'}
        aria-describedby={undefined}
        // Don't hand focus back to the History button on close: a focused
        // button would catch Enter meant for "=".
        onCloseAutoFocus={(e) => e.preventDefault()}
        className="history-sheet flex flex-col gap-0 p-0"
        style={desktop ? { width: current, maxWidth: 'none' } : { height: current, maxHeight: 'none' }}
      >
        <div
          role="separator"
          aria-orientation={desktop ? 'vertical' : 'horizontal'}
          aria-label="Resize history panel"
          aria-valuenow={current}
          aria-valuemin={MIN}
          aria-valuemax={Math.round(desktop ? maxWidth : maxHeight)}
          tabIndex={0}
          className="history-resize"
          data-side={desktop ? 'right' : 'bottom'}
          onPointerDown={onPointerDown}
          onKeyDown={onKeyDown}
        />

        <SheetHeader className="border-b border-border/60 px-5 py-4">
          <SheetTitle className="font-display text-sm tracking-[0.2em]">HISTORY</SheetTitle>
        </SheetHeader>

        <ScrollArea className="min-h-0 flex-1">
          {entries.length === 0 ? (
            <p className="px-5 py-10 text-center font-display text-xs tracking-[0.12em] text-muted-foreground">
              NO CALCULATIONS YET
            </p>
          ) : (
            groups.map((group) => (
              <section key={group.label} aria-label={group.label}>
                <h3 className="history-day">{group.label}</h3>
                <ul className="flex flex-col">
                  <AnimatePresence initial={false}>
                    {group.entries.map((entry) => (
                      <motion.li
                        key={entry.id}
                        initial={{ opacity: 0, x: 24 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -24 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 34 }}
                      >
                        <button
                          type="button"
                          className="history-entry"
                          onClick={() => onSelect(entry)}
                          aria-label={`${entry.expression} equals ${formatFull(entry.result)}`}
                        >
                          <span className="history-expression">{entry.expression}</span>
                          <span className="history-result">{formatFull(entry.result)}</span>
                        </button>
                      </motion.li>
                    ))}
                  </AnimatePresence>
                </ul>
              </section>
            ))
          )}
        </ScrollArea>

        <SheetFooter className="border-t border-border/60 px-5 py-4">
          <Button
            variant="outline"
            className="chrome-button w-full"
            onClick={(e) => {
              blurIfPointer(e)
              onClear()
            }}
            disabled={entries.length === 0}
          >
            <TrashIcon />
            Clear history
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
