import { createContext, useContext } from 'react'
import type { SoundName } from '@/lib/sound'

export const SOUND_KEY = 'szlcalc:sound'

export interface SoundContextValue {
  enabled: boolean
  toggle: () => void
  play: (name: SoundName) => void
}

export const SoundContext = createContext<SoundContextValue | null>(null)

export function useSound(): SoundContextValue {
  const ctx = useContext(SoundContext)
  if (!ctx) throw new Error('useSound must be used inside <SoundProvider>')
  return ctx
}
