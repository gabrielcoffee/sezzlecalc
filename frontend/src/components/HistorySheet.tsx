import { XIcon } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useState, type KeyboardEvent, type PointerEvent } from 'react'
import { TrashIcon } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Sheet, SheetClose, SheetContent, SheetFooter, SheetTitle } from '@/components/ui/sheet'
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

// Desktop: the panel width the user dragged to, remembered between visits.
const WIDTH_KEY = 'szlcalc:history-width'
const MIN_WIDTH = 260
const STEP = 32
const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

// Phones: the panel opens at a default height and snaps, on release, to that
// height, to the full screen, or closes when dragged well below the default.
const DEFAULT_SHARE = 0.55
const CLOSE_BELOW = 0.6 // of the default height

export function HistorySheet({ open, openedAt, onOpenChange, entries, onSelect, onClear }: Props) {
  const desktop = useMediaQuery('(min-width: 640px)')
  const [width, setWidth] = useState(() => loadJSON(WIDTH_KEY, 384, isNumber))
  const [mobileHeight, setMobileHeight] = useState<number | null>(null) // null: default
  const [dragging, setDragging] = useState(false)
  const groups = groupByDay(entries, openedAt)

  const maxWidth = window.innerWidth * 0.9
  const fullHeight = window.innerHeight
  const defaultHeight = Math.round(fullHeight * DEFAULT_SHARE)
  const clampWidth = (w: number) => Math.round(Math.min(Math.max(w, MIN_WIDTH), maxWidth))
  const currentWidth = clampWidth(width)
  const currentHeight = mobileHeight ?? defaultHeight

  const resizeWidth = (w: number) => {
    const next = clampWidth(w)
    setWidth(next)
    saveJSON(WIDTH_KEY, next)
  }

  const snap = (h: number) => {
    if (h < defaultHeight * CLOSE_BELOW) {
      onOpenChange(false)
      return
    }
    setMobileHeight(h > (defaultHeight + fullHeight) / 2 ? fullHeight : null)
  }

  // Dragging follows the pointer directly, with no easing, so the panel and
  // its list never lag behind the finger or mouse.
  const onPointerDown = (e: PointerEvent<HTMLElement>) => {
    if (e.target instanceof Element && e.target.closest('button')) return
    e.preventDefault()
    const handle = e.currentTarget
    handle.setPointerCapture(e.pointerId)
    setDragging(true)
    let last = desktop ? currentWidth : currentHeight
    const move = (ev: globalThis.PointerEvent) => {
      if (desktop) {
        last = window.innerWidth - ev.clientX
        resizeWidth(last)
      } else {
        last = Math.min(Math.max(window.innerHeight - ev.clientY, 0), fullHeight)
        setMobileHeight(last)
      }
    }
    const stop = () => {
      handle.removeEventListener('pointermove', move)
      handle.removeEventListener('pointerup', stop)
      handle.removeEventListener('pointercancel', stop)
      setDragging(false)
      if (!desktop) snap(last)
    }
    handle.addEventListener('pointermove', move)
    handle.addEventListener('pointerup', stop)
    handle.addEventListener('pointercancel', stop)
  }

  // Keyboard resizing for the same handle.
  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    const grow = desktop ? 'ArrowLeft' : 'ArrowUp'
    const shrink = desktop ? 'ArrowRight' : 'ArrowDown'
    if (e.key !== grow && e.key !== shrink) return
    e.preventDefault()
    if (desktop) resizeWidth(currentWidth + (e.key === grow ? STEP : -STEP))
    else setMobileHeight(e.key === grow ? fullHeight : null)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={desktop ? 'right' : 'bottom'}
        showCloseButton={false}
        aria-describedby={undefined}
        // Don't hand focus back to the History button on close: a focused
        // button would catch Enter meant for "=".
        onCloseAutoFocus={(e) => e.preventDefault()}
        className="history-sheet flex flex-col gap-0 p-0"
        data-dragging={dragging || undefined}
        style={desktop ? { width: currentWidth, maxWidth: 'none' } : { height: currentHeight, maxHeight: 'none' }}
      >
        <div
          role="separator"
          aria-orientation={desktop ? 'vertical' : 'horizontal'}
          aria-label="Resize history panel"
          aria-valuenow={desktop ? currentWidth : currentHeight}
          aria-valuemin={desktop ? MIN_WIDTH : defaultHeight}
          aria-valuemax={Math.round(desktop ? maxWidth : fullHeight)}
          tabIndex={0}
          className="history-resize"
          data-side={desktop ? 'right' : 'bottom'}
          onPointerDown={onPointerDown}
          onKeyDown={onKeyDown}
        />

        {/* On phones the header is a drag area too. */}
        <div className="history-header" onPointerDown={desktop ? undefined : onPointerDown}>
          <SheetTitle className="history-title">History</SheetTitle>
          <SheetClose asChild>
            <Button variant="ghost" size="icon-sm" className="chrome-button" aria-label="Close history">
              <XIcon />
            </Button>
          </SheetClose>
        </div>

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
