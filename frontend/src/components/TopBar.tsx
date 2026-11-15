import { SpeakerIcon, TapeRollIcon } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { useSound } from '@/hooks/use-sound'
import { blurIfPointer } from '@/lib/utils'

interface Props {
  historyCount: number
  onOpenHistory: () => void
}

export function TopBar({ historyCount, onOpenHistory }: Props) {
  const { enabled, toggle } = useSound()

  return (
    <header className="relative z-10 grid h-16 grid-cols-[1fr_auto_1fr] items-center gap-2 px-3 sm:h-20 sm:px-6">
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

      <h1 className="font-display text-[0.8rem] tracking-[0.28em] text-[var(--page-ink)] sm:text-base">
        SZLCALC <strong className="font-black">903</strong>
      </h1>

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
          {historyCount > 0 && (
            <span className="chrome-badge" aria-hidden="true">
              {historyCount}
            </span>
          )}
        </Button>
      </div>
    </header>
  )
}
