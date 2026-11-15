// Mechanical key sounds synthesized with the Web Audio API. No audio files.
//
// A physical key press is two clicks, press and release, each a very short
// burst of noise shaped by the plastic it hits, plus a low "body" thump from
// the case. Each sound below is a list of such clicks; slight random
// variation keeps repeated presses from sounding identical.

export type SoundName =
  | 'digit'
  | 'operator'
  | 'function'
  | 'equals'
  | 'clear'
  | 'backspace'
  | 'error'
  | 'reject'
  | 'toggle'
  | 'select'

interface Click {
  delay?: number // seconds after the start of the sound
  tone: number // centre frequency of the click's noise burst, Hz
  q?: number // resonance; higher sounds more like hard plastic
  decay: number // seconds for the click to die away
  gain: number
  body?: number // gain of the low thump (0 or missing: none)
}

/** Press plus a quieter release about 70 ms later. Soft: low gain, mellow tone. */
const keystroke = (tone: number, gain: number, body: number): Click[] => [
  { tone, decay: 0.025, gain, body },
  { delay: 0.07, tone: tone * 1.15, decay: 0.016, gain: gain * 0.4 },
]

const RECIPES: Record<SoundName, Click[]> = {
  digit: keystroke(2000, 0.2, 0.08),
  operator: keystroke(1700, 0.22, 0.1),
  function: keystroke(1850, 0.2, 0.09),
  backspace: keystroke(1900, 0.18, 0.08),
  select: keystroke(2100, 0.16, 0.06),
  equals: keystroke(1450, 0.24, 0.14), // bigger key: a little deeper
  clear: [
    { tone: 1300, q: 0.8, decay: 0.035, gain: 0.24, body: 0.14 },
    { delay: 0.09, tone: 1600, decay: 0.02, gain: 0.1 },
  ],
  // A dull, damped double knock.
  error: [
    { tone: 700, q: 0.7, decay: 0.05, gain: 0.28, body: 0.2 },
    { delay: 0.11, tone: 620, q: 0.7, decay: 0.06, gain: 0.24, body: 0.2 },
  ],
  reject: [{ tone: 850, q: 0.7, decay: 0.035, gain: 0.2, body: 0.12 }],
  // A slide switch: two soft snaps close together.
  toggle: [
    { tone: 2600, q: 1.4, decay: 0.014, gain: 0.18 },
    { delay: 0.025, tone: 2000, q: 1.2, decay: 0.018, gain: 0.15, body: 0.06 },
  ],
}

type ContextFactory = () => AudioContext | null

const browserContext: ContextFactory = () => {
  const Ctor =
    globalThis.AudioContext ?? (globalThis as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  return Ctor ? new Ctor() : null
}

export interface SoundEngine {
  play(name: SoundName): void
}

/**
 * Creates a sound engine. The AudioContext is created lazily on the first
 * sound, i.e. inside a user gesture as browsers require. Without Web Audio
 * support every call is a no-op. `random` is injectable for tests.
 */
export function createSoundEngine(factory: ContextFactory = browserContext, random = Math.random): SoundEngine {
  let ctx: AudioContext | null | undefined
  let noise: AudioBuffer | undefined

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
      noise ??= whiteNoise(ctx, random)
      const now = ctx.currentTime
      const vary = 1 + (random() - 0.5) * 0.12 // ±6% pitch per press
      for (const click of RECIPES[name]) schedule(ctx, noise, click, now, vary, random)
    },
  }
}

function whiteNoise(ctx: AudioContext, random: () => number): AudioBuffer {
  const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.5), ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = random() * 2 - 1
  return buffer
}

function schedule(ctx: AudioContext, noise: AudioBuffer, click: Click, now: number, vary: number, random: () => number) {
  const start = now + (click.delay ?? 0)
  const end = start + click.decay

  // The click: a short noise burst through a resonant band-pass filter.
  const src = ctx.createBufferSource()
  src.buffer = noise
  const filter = ctx.createBiquadFilter()
  filter.type = 'bandpass'
  filter.frequency.setValueAtTime(click.tone * vary, start)
  filter.Q.setValueAtTime(click.q ?? 1, start)
  const gain = ctx.createGain()
  envelope(gain, click.gain, start, end)
  src.connect(filter).connect(gain).connect(ctx.destination)
  src.start(start, random() * 0.4) // random slice of the noise
  src.stop(end + 0.01)

  // The body: a short low sine thump that falls in pitch.
  if (click.body) {
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(190 * vary, start)
    osc.frequency.exponentialRampToValueAtTime(80, start + 0.03)
    const bodyGain = ctx.createGain()
    envelope(bodyGain, click.body, start, start + 0.035)
    osc.connect(bodyGain).connect(ctx.destination)
    osc.start(start)
    osc.stop(start + 0.05)
  }
}

/** Short soft attack, exponential decay: no audible pops at either end. */
function envelope(node: GainNode, peak: number, start: number, end: number) {
  node.gain.setValueAtTime(0.0001, start)
  node.gain.exponentialRampToValueAtTime(peak, start + 0.003)
  node.gain.exponentialRampToValueAtTime(0.0001, end)
}
