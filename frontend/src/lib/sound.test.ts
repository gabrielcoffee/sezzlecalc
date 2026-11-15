import { describe, expect, it, vi } from 'vitest'
import { createSoundEngine, type SoundName } from './sound'

function fakeContext(state: AudioContextState = 'running') {
  const param = () => ({ setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() })
  const node = () => ({ connect: vi.fn((n: unknown) => n) })
  const sources: { start: ReturnType<typeof vi.fn> }[] = []
  const oscillators: { start: ReturnType<typeof vi.fn> }[] = []
  const raw = {
    state,
    currentTime: 0,
    sampleRate: 8000,
    destination: {},
    resume: vi.fn(async () => {}),
    createBuffer: vi.fn((_ch: number, length: number) => {
      const data = new Float32Array(length)
      return { getChannelData: () => data }
    }),
    createBufferSource: vi.fn(() => {
      const s = { ...node(), buffer: null, start: vi.fn(), stop: vi.fn() }
      sources.push(s)
      return s
    }),
    createBiquadFilter: vi.fn(() => ({ ...node(), type: '', frequency: param(), Q: param() })),
    createOscillator: vi.fn(() => {
      const o = { ...node(), type: '', frequency: param(), start: vi.fn(), stop: vi.fn() }
      oscillators.push(o)
      return o
    }),
    createGain: vi.fn(() => ({ ...node(), gain: param() })),
  }
  return { ctx: raw as unknown as AudioContext, raw, sources, oscillators }
}

const ALL: SoundName[] = [
  'digit', 'operator', 'function', 'equals', 'clear', 'backspace',
  'error', 'reject', 'toggle', 'select',
]

describe('createSoundEngine', () => {
  it('creates the AudioContext and noise buffer lazily, once', () => {
    const { ctx, raw } = fakeContext()
    const factory = vi.fn(() => ctx)
    const engine = createSoundEngine(factory)
    expect(factory).not.toHaveBeenCalled()
    engine.play('digit')
    engine.play('operator')
    expect(factory).toHaveBeenCalledTimes(1)
    expect(raw.createBuffer).toHaveBeenCalledTimes(1)
  })

  it('plays a key press as a press and a release click with a body thump', () => {
    const { ctx, sources, oscillators } = fakeContext()
    createSoundEngine(() => ctx).play('digit')
    expect(sources).toHaveLength(2) // press + release
    expect(oscillators).toHaveLength(1) // body on the press only
    expect(sources[1].start.mock.calls[0][0]).toBeGreaterThan(sources[0].start.mock.calls[0][0])
  })

  it('has a recipe for every sound', () => {
    const { ctx } = fakeContext()
    const engine = createSoundEngine(() => ctx)
    for (const name of ALL) expect(() => engine.play(name)).not.toThrow()
  })

  it('resumes a suspended context (autoplay policy)', () => {
    const { ctx, raw } = fakeContext('suspended')
    createSoundEngine(() => ctx).play('digit')
    expect(raw.resume).toHaveBeenCalled()
  })

  it('is a no-op without Web Audio', () => {
    expect(() => createSoundEngine(() => null).play('digit')).not.toThrow()
  })

  it('is a no-op when creating the context throws', () => {
    const engine = createSoundEngine(() => {
      throw new Error('blocked')
    })
    expect(() => engine.play('digit')).not.toThrow()
  })

  it('uses the browser AudioContext by default', () => {
    const { ctx, raw } = fakeContext()
    vi.stubGlobal('AudioContext', function () {
      return ctx
    })
    createSoundEngine().play('digit')
    expect(raw.createBufferSource).toHaveBeenCalled()
  })
})
