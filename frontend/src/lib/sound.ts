// Sound effects synthesized with the Web Audio API. No audio files.

export type SoundName =
  | 'digit'
  | 'operator'
  | 'function'
  | 'equals'
  | 'clear'
  | 'backspace'
  | 'success'
  | 'error'
  | 'reject'
  | 'toggle'
  | 'open'
  | 'close'
  | 'select'

interface Tone {
  type: OscillatorType
  from: number // Hz
  to?: number // Hz, glides from `from` when set
  duration: number // seconds
  gain: number
  delay?: number // seconds
}

const RECIPES: Record<SoundName, Tone[]> = {
  // Mechanical key clicks: very short, bright, slightly falling.
  digit: [{ type: 'triangle', from: 1900, to: 1100, duration: 0.028, gain: 0.18 }],
  operator: [{ type: 'square', from: 900, to: 650, duration: 0.04, gain: 0.06 }],
  function: [{ type: 'triangle', from: 650, to: 980, duration: 0.05, gain: 0.16 }],
  backspace: [{ type: 'triangle', from: 700, to: 380, duration: 0.045, gain: 0.16 }],
  clear: [{ type: 'triangle', from: 1000, to: 260, duration: 0.14, gain: 0.16 }],
  equals: [
    { type: 'square', from: 660, duration: 0.05, gain: 0.05 },
    { type: 'square', from: 990, duration: 0.06, gain: 0.05, delay: 0.05 },
  ],
  success: [
    { type: 'sine', from: 880, duration: 0.12, gain: 0.12 },
    { type: 'sine', from: 1320, duration: 0.18, gain: 0.1, delay: 0.07 },
  ],
  error: [
    { type: 'sawtooth', from: 180, to: 140, duration: 0.18, gain: 0.07 },
    { type: 'sawtooth', from: 120, to: 90, duration: 0.2, gain: 0.07, delay: 0.12 },
  ],
  reject: [{ type: 'sawtooth', from: 150, duration: 0.06, gain: 0.06 }],
  toggle: [{ type: 'sine', from: 1050, duration: 0.05, gain: 0.12 }],
  open: [{ type: 'sine', from: 420, to: 760, duration: 0.1, gain: 0.1 }],
  close: [{ type: 'sine', from: 760, to: 420, duration: 0.1, gain: 0.1 }],
  select: [{ type: 'sine', from: 1250, duration: 0.06, gain: 0.12 }],
}

type ContextFactory = () => AudioContext | null

const browserContext: ContextFactory = () => {
  const Ctor = globalThis.AudioContext ?? (globalThis as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  return Ctor ? new Ctor() : null
}

export interface SoundEngine {
  play(name: SoundName): void
}

/**
 * Creates a sound engine. The AudioContext is created lazily on the first
 * sound, i.e. inside a user gesture as browsers require. Without Web Audio
 * support every call is a no-op.
 */
export function createSoundEngine(factory: ContextFactory = browserContext): SoundEngine {
  let ctx: AudioContext | null | undefined

  return {
    play(name) {
      if (ctx === undefined) {
        try {
          ctx = factory()
        } catch {
          ctx = null
        }
      }
      if (!ctx) return
      if (ctx.state === 'suspended') void ctx.resume()
      const now = ctx.currentTime
      for (const tone of RECIPES[name]) schedule(ctx, tone, now)
    },
  }
}

function schedule(ctx: AudioContext, tone: Tone, now: number) {
  const start = now + (tone.delay ?? 0)
  const end = start + tone.duration
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = tone.type
  osc.frequency.setValueAtTime(tone.from, start)
  if (tone.to) osc.frequency.exponentialRampToValueAtTime(tone.to, end)
  // Fast attack and exponential decay avoid clicks at start and end.
  gain.gain.setValueAtTime(0.0001, start)
  gain.gain.exponentialRampToValueAtTime(tone.gain, start + 0.004)
  gain.gain.exponentialRampToValueAtTime(0.0001, end)
  osc.connect(gain).connect(ctx.destination)
  osc.start(start)
  osc.stop(end + 0.02)
}
