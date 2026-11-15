import { History, Volume2, VolumeX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useSound } from '@/hooks/use-sound'

interface Props {
  historyCount: number
  onOpenHistory: () => void
}

export function TopBar({ historyCount, onOpenHistory }: Props) {
  const { enabled, toggle } = useSound()

  return (
    <header className="relative z-10 grid h-14 grid-cols-[1fr_auto_1fr] items-center px-3 sm:h-16 sm:px-6">
      <div className="justify-self-start">
        <Button variant="ghost" className="topbar-button" onClick={onOpenHistory} aria-label="Open history">
          <History aria-hidden="true" />
          <span className="hidden sm:inline">History</span>
          {historyCount > 0 && (
            <span className="topbar-badge" aria-hidden="true">
              {historyCount}
            </span>
          )}
        </Button>
      </div>

      <h1 className="font-display text-[0.8rem] tracking-[0.28em] text-[var(--page-ink)] sm:text-base">
        SZLCALC <strong className="font-black">903</strong>
      </h1>

      <div className="justify-self-end">
        <Button
          variant="ghost"
          className="topbar-button"
          onClick={toggle}
          aria-pressed={enabled}
          aria-label={enabled ? 'Mute sound' : 'Turn sound on'}
          title={enabled ? 'Sound on' : 'Sound off'}
        >
          {enabled ? <Volume2 aria-hidden="true" /> : <VolumeX aria-hidden="true" />}
          <span className="hidden sm:inline">{enabled ? 'Sound on' : 'Sound off'}</span>
        </Button>
      </div>
    </header>
  )
}
