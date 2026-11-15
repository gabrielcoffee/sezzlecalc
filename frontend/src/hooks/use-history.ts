import { useCallback, useEffect, useState } from 'react'
import { loadJSON, saveJSON } from '@/lib/storage'

export interface HistoryEntry {
  id: string
  expression: string
  result: number
  time: number
}

export const HISTORY_KEY = 'szlcalc:history'
export const HISTORY_LIMIT = 50

function isEntry(v: unknown): v is HistoryEntry {
  if (typeof v !== 'object' || v === null) return false
  const e = v as Record<string, unknown>
  return (
    typeof e.id === 'string' &&
    typeof e.expression === 'string' &&
    typeof e.result === 'number' &&
    Number.isFinite(e.result) &&
    typeof e.time === 'number'
  )
}

function isEntryList(v: unknown): v is HistoryEntry[] {
  return Array.isArray(v) && v.every(isEntry)
}

let counter = 0

/** Calculation history, newest first, kept in localStorage. */
export function useHistory() {
  const [entries, setEntries] = useState<HistoryEntry[]>(() => loadJSON(HISTORY_KEY, [], isEntryList))

  useEffect(() => saveJSON(HISTORY_KEY, entries), [entries])

  const add = useCallback((expression: string, result: number) => {
    const time = Date.now()
    const entry = { id: `${time}-${counter++}`, expression, result, time }
    setEntries((prev) => [entry, ...prev].slice(0, HISTORY_LIMIT))
  }, [])

  const clear = useCallback(() => setEntries([]), [])

  return { entries, add, clear }
}
