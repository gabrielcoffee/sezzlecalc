import { describe, expect, it, vi } from 'vitest'
import { createSoundEngine, type SoundName } from './sound'

function fakeContext(state: AudioContextState = 'running') {
  const param = () => ({ setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() })
  const oscillators: { start: ReturnType<typeof vi.fn> }[] = []
  const ctx = {
    state,
    currentTime: 0,
    destination: {},
    resume: vi.fn(async () => {}),
    createOscillator: vi.fn(() => {
      const osc = { type: 'sine', frequency: param(), connect: vi.fn((n) => n), start: vi.fn(), stop: vi.fn() }
      oscillators.push(osc)
      return osc
    }),
    createGain: vi.fn(() => ({ gain: param(), connect: vi.fn((n) => n) })),
  }
  return { ctx: ctx as unknown as AudioContext, oscillators, raw: ctx }
}

describe('createSoundEngine', () => {
  it('creates the AudioContext lazily, once', () => {
    const { ctx } = fakeContext()
    const factory = vi.fn(() => ctx)
    const engine = createSoundEngine(factory)
    expect(factory).not.toHaveBeenCalled()
    engine.play('digit')
    engine.play('operator')
    expect(factory).toHaveBeenCalledTimes(1)
  })

  it('schedules one oscillator per tone', () => {
    const { ctx, oscillators } = fakeContext()
    const engine = createSoundEngine(() => ctx)
    engine.play('success') // two tones
    expect(oscillators).toHaveLength(2)
    expect(oscillators.every((o) => o.start.mock.calls.length === 1)).toBe(true)
  })

  it('has a recipe for every sound', () => {
    const { ctx } = fakeContext()
    const engine = createSoundEngine(() => ctx)
    const names: SoundName[] = [
      'digit', 'operator', 'function', 'equals', 'clear', 'backspace', 'success',
      'error', 'reject', 'toggle', 'open', 'close', 'select',
    ]
    for (const name of names) expect(() => engine.play(name)).not.toThrow()
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
    const { ctx } = fakeContext()
    vi.stubGlobal('AudioContext', function () {
      return ctx
    })
    expect(() => createSoundEngine().play('digit')).not.toThrow()
    expect((ctx as unknown as ReturnType<typeof fakeContext>['raw']).createOscillator).toHaveBeenCalled()
  })
})
