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

export interface HistoryGroup {
  label: string
  entries: HistoryEntry[]
}

const dayFormat = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' })

/** Splits entries (newest first) into days: "Today", "Yesterday", then dates. */
export function groupByDay(entries: HistoryEntry[], now: Date): HistoryGroup[] {
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const today = startOfDay(now)
  const yesterday = startOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1))

  const groups: HistoryGroup[] = []
  for (const entry of entries) {
    const day = startOfDay(new Date(entry.time))
    const label = day === today ? 'Today' : day === yesterday ? 'Yesterday' : dayFormat.format(day)
    const last = groups.at(-1)
    if (last?.label === label) last.entries.push(entry)
    else groups.push({ label, entries: [entry] })
  }
  return groups
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
