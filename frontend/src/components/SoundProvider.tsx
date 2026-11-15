import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { SOUND_KEY, SoundContext } from '@/hooks/use-sound'
import { createSoundEngine, type SoundEngine, type SoundName } from '@/lib/sound'
import { loadJSON, saveJSON } from '@/lib/storage'

const isBoolean = (v: unknown): v is boolean => typeof v === 'boolean'

/** Holds the sound on/off setting (persisted) and plays effects when on. */
export function SoundProvider({ children, engine }: { children: ReactNode; engine?: SoundEngine }) {
  const [enabled, setEnabled] = useState(() => loadJSON(SOUND_KEY, true, isBoolean))
  const sound = useMemo(() => engine ?? createSoundEngine(), [engine])

  const play = useCallback(
    (name: SoundName) => {
      if (enabled) sound.play(name)
    },
    [enabled, sound],
  )

  const toggle = useCallback(() => {
    const next = !enabled
    setEnabled(next)
    saveJSON(SOUND_KEY, next)
    if (next) sound.play('toggle') // audible confirmation that sound is back on
  }, [enabled, sound])

  const value = useMemo(() => ({ enabled, toggle, play }), [enabled, toggle, play])
  return <SoundContext value={value}>{children}</SoundContext>
}
