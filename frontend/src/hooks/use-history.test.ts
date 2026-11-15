import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { groupByDay, HISTORY_KEY, HISTORY_LIMIT, useHistory, type HistoryEntry } from './use-history'

describe('useHistory', () => {
  it('starts empty and adds entries newest first', () => {
    const { result } = renderHook(() => useHistory())
    expect(result.current.entries).toEqual([])
    act(() => result.current.add('1 + 1', 2))
    act(() => result.current.add('2 × 3', 6))
    expect(result.current.entries.map((e) => e.result)).toEqual([6, 2])
    expect(new Set(result.current.entries.map((e) => e.id)).size).toBe(2)
  })

  it('persists to localStorage and loads it back', () => {
    const first = renderHook(() => useHistory())
    act(() => first.result.current.add('1 + 1', 2))
    first.unmount()

    const second = renderHook(() => useHistory())
    expect(second.result.current.entries).toMatchObject([{ expression: '1 + 1', result: 2 }])
  })

  it(`keeps at most ${HISTORY_LIMIT} entries`, () => {
    const { result } = renderHook(() => useHistory())
    act(() => {
      for (let i = 0; i < HISTORY_LIMIT + 5; i++) result.current.add(`${i}`, i)
    })
    expect(result.current.entries).toHaveLength(HISTORY_LIMIT)
    expect(result.current.entries[0].result).toBe(HISTORY_LIMIT + 4)
  })

  it('clears', () => {
    const { result } = renderHook(() => useHistory())
    act(() => result.current.add('1 + 1', 2))
    act(() => result.current.clear())
    expect(result.current.entries).toEqual([])
    expect(JSON.parse(localStorage.getItem(HISTORY_KEY)!)).toEqual([])
  })

  it.each([
    ['invalid JSON', '{not json'],
    ['not an array', '{"a":1}'],
    ['bad entry', '[{"id":"1","expression":"x","result":"2","time":1}]'],
  ])('ignores corrupt storage: %s', (_, raw) => {
    localStorage.setItem(HISTORY_KEY, raw)
    expect(renderHook(() => useHistory()).result.current.entries).toEqual([])
  })

  it('keeps working when storage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied')
    })
    const { result } = renderHook(() => useHistory())
    act(() => result.current.add('1 + 1', 2))
    expect(result.current.entries).toHaveLength(1)
  })
})

describe('groupByDay', () => {
  const now = new Date(2026, 10, 15, 11, 0)
  const at = (y: number, m: number, d: number, h = 12): HistoryEntry => ({
    id: `${y}-${m}-${d}-${h}`,
    expression: 'x',
    result: 1,
    time: new Date(y, m, d, h).getTime(),
  })

  it('labels today, yesterday and older days, keeping order', () => {
    const entries = [at(2026, 10, 15, 10), at(2026, 10, 15, 1), at(2026, 10, 14, 23), at(2026, 10, 9)]
    const groups = groupByDay(entries, now)
    expect(groups.map((g) => [g.label, g.entries.length])).toEqual([
      ['Today', 2],
      ['Yesterday', 1],
      ['Mon, Nov 9', 1],
    ])
  })

  it('handles yesterday across a month boundary', () => {
    expect(groupByDay([at(2026, 9, 31)], new Date(2026, 10, 1, 9))[0].label).toBe('Yesterday')
  })

  it('returns no groups for no entries', () => {
    expect(groupByDay([], now)).toEqual([])
  })
})
