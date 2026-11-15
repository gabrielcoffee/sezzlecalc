import { motion, useAnimate, useReducedMotion } from 'motion/react'
import { useEffect } from 'react'
import type { DisplayModel } from '@/lib/calculator'
import { DISPLAY_DIGITS, formatDisplay } from '@/lib/format'

interface Props {
  view: DisplayModel
  hint: string | null
  pending: boolean
  /** Changes on every refused input; triggers a shake. */
  rejections: number
  /** Changes on every new result; triggers a flash. */
  results: number
}

// Unlit segments drawn behind the lit ones, as on a real 7-segment display.
// One extra cell for a leading minus sign.
const GHOST = '8.'.repeat(DISPLAY_DIGITS + 1)

function mainText(main: DisplayModel['main']): string {
  switch (main.kind) {
    case 'error':
      return 'Err'
    case 'number':
      return formatDisplay(main.value)
    case 'typed':
      return main.text
  }
}

export function Display({ view, hint, pending, rejections, results }: Props) {
  const [scope, animate] = useAnimate()
  const reduceMotion = useReducedMotion()

  useEffect(() => {
    if (rejections === 0 || reduceMotion) return
    animate(scope.current, { x: [0, -7, 6, -4, 3, 0] }, { duration: 0.32, ease: 'easeOut' })
  }, [rejections, reduceMotion, animate, scope])

  const text = mainText(view.main)

  return (
    <div ref={scope} className="calc-display" data-pending={pending || undefined}>
      <div className="display-expression" data-hint={hint ? true : undefined}>
        <span>{hint ?? (view.expression || ' ')}</span>
      </div>
      <div className="display-main" role="status" aria-live="polite" aria-label={text === 'Err' ? 'Error' : text}>
        <span className="display-ghost" aria-hidden="true">
          {GHOST}
        </span>
        <motion.span
          key={results}
          className="display-value"
          aria-hidden="true"
          data-testid="display-value"
          initial={results === 0 ? false : { opacity: 0.15 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.25 }}
        >
          {text}
        </motion.span>
      </div>
    </div>
  )
}
