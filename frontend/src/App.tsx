import { MotionConfig } from 'motion/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Calculator } from '@/components/calculator/Calculator'
import { KEYS_BY_ID, type KeyDef } from '@/components/calculator/keys'
import { HistorySheet } from '@/components/HistorySheet'
import { SoundProvider } from '@/components/SoundProvider'
import { TopBar } from '@/components/TopBar'
import { Toaster } from '@/components/ui/sonner'
import { useCalculator } from '@/hooks/use-calculator'
import { useHistory, type HistoryEntry } from '@/hooks/use-history'
import { useKeyboard } from '@/hooks/use-keyboard'
import { useSound } from '@/hooks/use-sound'
import type { SoundEngine } from '@/lib/sound'

export default function App({ soundEngine }: { soundEngine?: SoundEngine }) {
  return (
    <SoundProvider engine={soundEngine}>
      {/* Honors the OS "reduce motion" setting for every animation. */}
      <MotionConfig reducedMotion="user">
        <Page />
      </MotionConfig>
      <Toaster position="top-center" />
    </SoundProvider>
  )
}

function Page() {
  const { play } = useSound()
  const history = useHistory()
  const calc = useCalculator({ onResult: history.add })
  const [historyOpen, setHistoryOpen] = useState(false)
  const [historyOpenedAt, setHistoryOpenedAt] = useState(() => new Date())
  const [activeKey, setActiveKey] = useState<string | null>(null)
  const releaseTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => () => clearTimeout(releaseTimer.current), [])

  const onPress = calc.press

  // Keyboard input presses the matching on-screen key and shows it held briefly.
  const onKeyboard = useCallback(
    (id: string) => {
      const key: KeyDef = KEYS_BY_ID[id]
      onPress(key)
      setActiveKey(id)
      clearTimeout(releaseTimer.current)
      releaseTimer.current = setTimeout(() => setActiveKey(null), 120)
    },
    [onPress],
  )
  useKeyboard(onKeyboard, !historyOpen)

  const setOpen = (open: boolean) => {
    if (open) setHistoryOpenedAt(new Date())
    setHistoryOpen(open)
    play(open ? 'open' : 'close')
  }

  const selectEntry = (entry: HistoryEntry) => {
    calc.insert(entry.result)
    setHistoryOpen(false)
  }

  const clearHistory = () => {
    history.clear()
    play('clear')
  }

  return (
    <div className="page flex min-h-dvh flex-col">
      <TopBar onOpenHistory={() => setOpen(true)} />
      <main className="flex flex-1 items-start justify-center sm:items-center sm:p-6 sm:pb-12">
        <Calculator calc={calc} activeKey={activeKey} onPress={onPress} />
      </main>
      <HistorySheet
        open={historyOpen}
        openedAt={historyOpenedAt}
        onOpenChange={setOpen}
        entries={history.entries}
        onSelect={selectEntry}
        onClear={clearHistory}
      />
    </div>
  )
}
