import { Button } from '@/components/ui/button'
import { useSound } from '@/hooks/use-sound'
import { blurIfPointer } from '@/lib/utils'

interface Props {
  onOpenHistory: () => void
}

/** Text-only controls in the title font. Sound off shows the word crossed out. */
export function TopBar({ onOpenHistory }: Props) {
  const { enabled, toggle } = useSound()

  return (
    <header className="topbar relative z-10 flex h-16 items-center justify-between gap-2 px-3 sm:absolute sm:inset-x-0 sm:top-0 sm:h-20 sm:px-6">
      {/* The name is on the calculator's nameplate; keep a heading for screen readers. */}
      <h1 className="sr-only">SZLCALC 903 calculator</h1>

      <Button
        variant="ghost"
        className="chrome-button"
        data-off={enabled ? undefined : true}
        onClick={(e) => {
          blurIfPointer(e)
          toggle()
        }}
        aria-pressed={enabled}
        aria-label={enabled ? 'Mute sound' : 'Turn sound on'}
      >
        Sound
      </Button>

      <Button
        variant="ghost"
        className="chrome-button"
        onClick={(e) => {
          blurIfPointer(e)
          onOpenHistory()
        }}
        aria-label="Open history"
      >
        History
      </Button>
    </header>
  )
}
