import { SpeakerIcon, TapeRollIcon } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { useSound } from '@/hooks/use-sound'
import { blurIfPointer } from '@/lib/utils'

interface Props {
  onOpenHistory: () => void
}

export function TopBar({ onOpenHistory }: Props) {
  const { enabled, toggle } = useSound()

  return (
    <header className="relative z-10 flex h-16 items-center justify-between gap-2 px-3 sm:absolute sm:inset-x-0 sm:top-0 sm:h-20 sm:px-6">
      {/* The name is on the calculator's nameplate; keep a heading for screen readers. */}
      <h1 className="sr-only">SZLCALC 903 calculator</h1>

      <div className="justify-self-start">
        <Button
          variant="ghost"
          className="chrome-button"
          onClick={(e) => {
            blurIfPointer(e)
            toggle()
          }}
          aria-pressed={enabled}
          aria-label={enabled ? 'Mute sound' : 'Turn sound on'}
          title={enabled ? 'Sound on' : 'Sound off'}
        >
          <SpeakerIcon on={enabled} />
          <span className="hidden sm:inline">{enabled ? 'Sound' : 'Muted'}</span>
        </Button>
      </div>

      <div className="justify-self-end">
        <Button
          variant="ghost"
          className="chrome-button"
          onClick={(e) => {
            blurIfPointer(e)
            onOpenHistory()
          }}
          aria-label="Open history"
        >
          <TapeRollIcon />
          <span className="hidden sm:inline">History</span>
        </Button>
      </div>
    </header>
  )
}
