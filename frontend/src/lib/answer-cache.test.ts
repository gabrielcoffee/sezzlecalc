import { describe, expect, it } from 'vitest'
import { ApiError } from './api'
import { AnswerCache, isDefinitive } from './answer-cache'

describe('AnswerCache', () => {
  it('stores and returns answers', () => {
    const c = new AnswerCache()
    c.set('1 + 1', { ok: true, result: 2 })
    expect(c.get('1 + 1')).toEqual({ ok: true, result: 2 })
    expect(c.has('1 + 1')).toBe(true)
    expect(c.get('2 + 2')).toBeUndefined()
  })

  it('drops the least recently used entry past the limit', () => {
    const c = new AnswerCache(2)
    c.set('a', { ok: true, result: 1 })
    c.set('b', { ok: true, result: 2 })
    c.get('a') // a is now most recent
    c.set('c', { ok: true, result: 3 })
    expect(c.has('a')).toBe(true)
    expect(c.has('b')).toBe(false)
    expect(c.size).toBe(2)
  })

  it('replaces an existing entry without growing', () => {
    const c = new AnswerCache(2)
    c.set('a', { ok: true, result: 1 })
    c.set('a', { ok: true, result: 9 })
    expect(c.size).toBe(1)
    expect(c.get('a')).toEqual({ ok: true, result: 9 })
  })
})

describe('isDefinitive', () => {
  it.each([
    [new ApiError(422, 'division_by_zero', 'x'), true],
    [new ApiError(400, 'invalid_type', 'x'), true],
    [new ApiError(429, 'rate_limited', 'x'), false],
    [new ApiError(0, 'network', 'x'), false],
    [new ApiError(502, 'http_error', 'x'), false],
    [new Error('x'), false],
  ])('%s → %s', (err, want) => {
    expect(isDefinitive(err)).toBe(want)
  })
})
