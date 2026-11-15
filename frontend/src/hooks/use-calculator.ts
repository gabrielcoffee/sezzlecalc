import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import type { KeyDef } from '@/components/calculator/keys'
import { useSound } from '@/hooks/use-sound'
import { AnswerCache, isDefinitive } from '@/lib/answer-cache'
import { ApiError, evaluateExpression } from '@/lib/api'
import {
  actionsFromText,
  display,
  initialState,
  prepare,
  reduce,
  type Action,
  type CalcState,
} from '@/lib/calculator'

interface Options {
  onResult?: (expression: string, result: number) => void
  /** Known answers (e.g. history) so those expressions show instantly. Read once. */
  seed?: { expression: string; result: number }[]
}

/** Idle time after the last key press before the expression is sent ahead of "=". */
export const PREFETCH_DELAY_MS = 500

interface Prefetch {
  expression: string
  promise: Promise<number>
  controller: AbortController
}

/** Settles like `promise`, or rejects as soon as `signal` aborts. */
function withAbort<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true })
    promise.then(resolve, reject)
  })
}

/**
 * Connects the pure calculator reducer to the API, sounds and toasts.
 * `rejections` increments on every refused key press so the UI can shake the
 * number; `flashes` increments when a result shows so the UI can blink it.
 *
 * Two things make "=" feel instant:
 *  - every answer is cached by expression (seeded from history), so an
 *    expression seen before never waits on the network;
 *  - while the user pauses typing, the current expression is sent ahead.
 */
export function useCalculator({ onResult, seed = [] }: Options = {}) {
  const { play } = useSound()
  const [state, setState] = useState<CalcState>(initialState)
  const [rejections, setRejections] = useState(0)
  const [flashes, setFlashes] = useState(0)

  // The ref always holds the latest state, so handlers never act on a stale copy.
  const stateRef = useRef(state)
  const abortRef = useRef<AbortController | null>(null)
  const prefetchRef = useRef<Prefetch | null>(null)
  const [cache] = useState(() => {
    const c = new AnswerCache()
    for (const e of [...seed].reverse()) c.set(e.expression, { ok: true, result: e.result })
    return c
  })

  /** Stores an outcome if it will never change for this expression. */
  const remember = useCallback(
    (expression: string, outcome: { result: number } | { error: unknown }) => {
      if ('result' in outcome) cache.set(expression, { ok: true, result: outcome.result })
      else if (isDefinitive(outcome.error)) cache.set(expression, { ok: false, error: outcome.error })
    },
    [cache],
  )
  const onResultRef = useRef(onResult)
  useEffect(() => {
    onResultRef.current = onResult
  })

  // Pre-calculate the expression once typing pauses. At most one early
  // request is in flight: starting one cancels the previous, so every older
  // request is already cancelled by then. Skipped when there's nothing to
  // calculate ("2 +" leaves "2") or the answer is already cached.
  useEffect(() => {
    const prepared = prepare(state)
    if (!prepared.ok || prepared.trivial) return
    const { expression } = prepared
    if (cache.has(expression) || prefetchRef.current?.expression === expression) return
    const timer = setTimeout(() => {
      prefetchRef.current?.controller.abort()
      const controller = new AbortController()
      const promise = evaluateExpression(expression, { signal: controller.signal })
      promise.then(
        (result) => remember(expression, { result }),
        (error: unknown) => remember(expression, { error }),
      )
      prefetchRef.current = { expression, promise, controller }
    }, PREFETCH_DELAY_MS)
    return () => clearTimeout(timer)
  }, [state, cache, remember])

  useEffect(() => () => prefetchRef.current?.controller.abort(), [])

  /** The answer for `expression`: cached, pre-calculated, or fetched now. */
  const request = useCallback((expression: string, signal: AbortSignal): Promise<number> => {
    const cached = cache.get(expression)
    if (cached) return cached.ok ? Promise.resolve(cached.result) : Promise.reject(cached.error)
    const pre = prefetchRef.current
    if (pre?.expression !== expression) return evaluateExpression(expression, { signal })
    return withAbort(pre.promise, signal).catch((err: unknown) => {
      if (signal.aborted) throw err
      // Reuse definitive API answers (e.g. division by zero); retry if the
      // early request failed in transit or was dropped.
      if (err instanceof ApiError && err.status !== 0) throw err
      return evaluateExpression(expression, { signal })
    })
  }, [cache])

  const apply = useCallback((action: Action): boolean => {
    const next = reduce(stateRef.current, action)
    if (next === stateRef.current) return false
    stateRef.current = next
    setState(next)
    return true
  }, [])

  const reject = useCallback(() => {
    play('reject')
    setRejections((n) => n + 1)
  }, [play])

  const evaluate = useCallback(async () => {
    const prepared = prepare(stateRef.current)
    if (!prepared.ok) {
      if (prepared.reason === 'pending') return // a request is already running
      if (prepared.reason === 'empty') {
        // Nothing new to calculate, e.g. "=" again on a shown result: blink it.
        play('equals')
        setFlashes((n) => n + 1)
        return
      }
      reject()
      toast.error('The expression is too long')
      return
    }

    const { expression } = prepared
    play('equals')
    apply({ type: 'evaluate-start' })
    const controller = new AbortController()
    abortRef.current = controller
    try {
      const result = await request(expression, controller.signal)
      remember(expression, { result })
      apply({ type: 'evaluate-success', expression, result })
      setFlashes((n) => n + 1)
      onResultRef.current?.(expression, result)
    } catch (err) {
      if (controller.signal.aborted) return // cleared by the user
      remember(expression, { error: err })
      const message = err instanceof ApiError ? err.message : 'Something went wrong'
      apply({ type: 'evaluate-error', expression, message })
      setRejections((n) => n + 1)
      play('error')
      toast.error(message)
    } finally {
      if (abortRef.current === controller) abortRef.current = null
    }
  }, [apply, play, reject, request, remember])

  const press = useCallback(
    (key: KeyDef) => {
      if (key.action === 'evaluate') {
        void evaluate()
        return
      }
      if (key.action.type === 'clear') {
        abortRef.current?.abort()
        abortRef.current = null
        prefetchRef.current?.controller.abort()
        prefetchRef.current = null
        apply(key.action)
        play('clear')
        return
      }
      if (apply(key.action)) play(key.sound)
      else reject()
    },
    [apply, evaluate, play, reject],
  )

  const insert = useCallback(
    (value: number) => {
      if (apply({ type: 'insert', value })) play('select')
      else reject()
    },
    [apply, play, reject],
  )

  /**
   * Pasted text is typed in key by key. Text with anything that isn't
   * calculator input is refused whole; keys out of place are skipped by the
   * reducer, so the input stays valid.
   */
  const paste = useCallback(
    (text: string) => {
      const actions = actionsFromText(text)
      if (!actions) {
        reject()
        toast.error("That isn't a calculation")
        return
      }
      let accepted = 0
      for (const action of actions) if (apply(action)) accepted++
      if (accepted > 0) play('select')
      else reject()
    },
    [apply, play, reject],
  )

  return { state, view: display(state), press, insert, paste, rejections, flashes }
}
