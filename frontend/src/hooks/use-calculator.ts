import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import type { KeyDef } from '@/components/calculator/keys'
import { useSound } from '@/hooks/use-sound'
import { ApiError, evaluateExpression } from '@/lib/api'
import { display, initialState, prepare, reduce, type Action, type CalcState } from '@/lib/calculator'

interface Options {
  onResult?: (expression: string, result: number) => void
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
 * While the user pauses typing, the current expression is already sent to the
 * API, so pressing "=" usually shows the answer without waiting on the network.
 */
export function useCalculator({ onResult }: Options = {}) {
  const { play } = useSound()
  const [state, setState] = useState<CalcState>(initialState)
  const [rejections, setRejections] = useState(0)
  const [flashes, setFlashes] = useState(0)

  // The ref always holds the latest state, so handlers never act on a stale copy.
  const stateRef = useRef(state)
  const abortRef = useRef<AbortController | null>(null)
  const prefetchRef = useRef<Prefetch | null>(null)
  const onResultRef = useRef(onResult)
  useEffect(() => {
    onResultRef.current = onResult
  })

  // Pre-calculate the expression once typing pauses. Only the answer for the
  // latest expression is kept; an older request still in flight is aborted.
  useEffect(() => {
    if (state.tokens.length < 2) return // a lone number needs no math
    const prepared = prepare(state)
    if (!prepared.ok || prefetchRef.current?.expression === prepared.expression) return
    const { expression } = prepared
    const timer = setTimeout(() => {
      prefetchRef.current?.controller.abort()
      const controller = new AbortController()
      const promise = evaluateExpression(expression, { signal: controller.signal })
      promise.catch(() => {}) // errors surface only if "=" ends up using this answer
      prefetchRef.current = { expression, promise, controller }
    }, PREFETCH_DELAY_MS)
    return () => clearTimeout(timer)
  }, [state])

  useEffect(() => () => prefetchRef.current?.controller.abort(), [])

  /** The answer for `expression`: the pre-calculated one when available. */
  const request = useCallback((expression: string, signal: AbortSignal) => {
    const pre = prefetchRef.current
    if (pre?.expression !== expression) return evaluateExpression(expression, { signal })
    return withAbort(pre.promise, signal).catch((err: unknown) => {
      if (signal.aborted) throw err
      // Reuse definitive API answers (e.g. division by zero); retry if the
      // early request failed in transit or was dropped.
      if (err instanceof ApiError && err.status !== 0) throw err
      return evaluateExpression(expression, { signal })
    })
  }, [])

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
      apply({ type: 'evaluate-success', expression, result })
      setFlashes((n) => n + 1)
      onResultRef.current?.(expression, result)
    } catch (err) {
      if (controller.signal.aborted) return // cleared by the user
      const message = err instanceof ApiError ? err.message : 'Something went wrong'
      apply({ type: 'evaluate-error', expression, message })
      setRejections((n) => n + 1)
      play('error')
      toast.error(message)
    } finally {
      if (abortRef.current === controller) abortRef.current = null
    }
  }, [apply, play, reject, request])

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

  return { state, view: display(state), press, insert, rejections, flashes }
}
