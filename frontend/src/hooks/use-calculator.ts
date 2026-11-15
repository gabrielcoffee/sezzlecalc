import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import type { KeyDef } from '@/components/calculator/keys'
import { useSound } from '@/hooks/use-sound'
import { ApiError, evaluateExpression } from '@/lib/api'
import { display, initialState, prepare, reduce, type Action, type CalcState } from '@/lib/calculator'

interface Options {
  onResult?: (expression: string, result: number) => void
}

/**
 * Connects the pure calculator reducer to the API, sounds and toasts.
 * `rejections` increments on every refused key press so the UI can shake.
 */
export function useCalculator({ onResult }: Options = {}) {
  const { play } = useSound()
  const [state, setState] = useState<CalcState>(initialState)
  const [rejections, setRejections] = useState(0)
  const [results, setResults] = useState(0)

  // The ref always holds the latest state, so handlers never act on a stale copy.
  const stateRef = useRef(state)
  const abortRef = useRef<AbortController | null>(null)
  const onResultRef = useRef(onResult)
  useEffect(() => {
    onResultRef.current = onResult
  })

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
      if (stateRef.current.pending) return // a request is already running
      reject()
      apply({ type: 'hint', message: prepared.message })
      return
    }

    const { expression } = prepared
    play('equals')
    apply({ type: 'evaluate-start' })
    const controller = new AbortController()
    abortRef.current = controller
    try {
      const result = await evaluateExpression(expression, { signal: controller.signal })
      apply({ type: 'evaluate-success', expression, result })
      setResults((n) => n + 1)
      play('success')
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
  }, [apply, play, reject])

  const press = useCallback(
    (key: KeyDef) => {
      if (key.action === 'evaluate') {
        void evaluate()
        return
      }
      if (key.action.type === 'clear') {
        abortRef.current?.abort()
        abortRef.current = null
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

  return { state, view: display(state), press, insert, rejections, results }
}
