import { Trash2 } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import type { HistoryEntry } from '@/hooks/use-history'
import { useMediaQuery } from '@/hooks/use-media-query'
import { formatFull } from '@/lib/format'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  entries: HistoryEntry[]
  onSelect: (entry: HistoryEntry) => void
  onClear: () => void
}

const timeFormat = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' })

export function HistorySheet({ open, onOpenChange, entries, onSelect, onClear }: Props) {
  const desktop = useMediaQuery('(min-width: 640px)')

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={desktop ? 'right' : 'bottom'}
        className="history-sheet flex flex-col gap-0 p-0 data-[side=bottom]:max-h-[75dvh] data-[side=right]:w-full sm:max-w-sm"
      >
        <SheetHeader className="border-b border-border/60 px-5 py-4">
          <SheetTitle className="font-display text-sm tracking-[0.2em]">HISTORY</SheetTitle>
          <SheetDescription>Tap a result to use it in the calculator.</SheetDescription>
        </SheetHeader>

        <ScrollArea className="min-h-0 flex-1">
          {entries.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-muted-foreground">No calculations yet.</p>
          ) : (
            <ul className="flex flex-col py-2" aria-label="Past calculations">
              <AnimatePresence initial={false}>
                {entries.map((entry) => (
                  <motion.li
                    key={entry.id}
                    layout
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
                      <span className="flex w-full justify-between gap-3 text-xs text-muted-foreground">
                        <span className="truncate">{entry.expression}</span>
                        <time dateTime={new Date(entry.time).toISOString()}>{timeFormat.format(entry.time)}</time>
                      </span>
                      <span className="history-result">= {formatFull(entry.result)}</span>
                    </button>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          )}
        </ScrollArea>

        <SheetFooter className="border-t border-border/60 px-5 py-4">
          <Button variant="outline" onClick={onClear} disabled={entries.length === 0}>
            <Trash2 aria-hidden="true" />
            Clear history
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
