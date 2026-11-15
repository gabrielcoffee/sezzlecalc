import { useAnimate, useReducedMotion } from 'motion/react'
import { useEffect, useLayoutEffect, useRef } from 'react'
import type { DisplayModel } from '@/lib/calculator'
import { DISPLAY_DIGITS, formatDisplay } from '@/lib/format'

interface Props {
  view: DisplayModel
  /** Changes on every refused input; triggers a shake. */
  rejections: number
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

export function Display({ view, rejections }: Props) {
  const [scope, animate] = useAnimate()
  const reduceMotion = useReducedMotion()
  const expressionRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (rejections === 0 || reduceMotion) return
    animate(scope.current, { x: [0, -7, 6, -4, 3, 0] }, { duration: 0.32, ease: 'easeOut' })
  }, [rejections, reduceMotion, animate, scope])

  // Keep the end of a long expression in view as it grows; the user can
  // scroll back to see the start.
  useLayoutEffect(() => {
    const el = expressionRef.current
    if (el) el.scrollLeft = el.scrollWidth
  }, [view.expression])

  const text = mainText(view.main)

  return (
    <div ref={scope} className="calc-display">
      <div
        ref={expressionRef}
        className="display-expression"
        tabIndex={view.expression ? 0 : -1}
        aria-label={view.expression ? `Expression: ${view.expression}` : undefined}
      >
        <span>{view.expression || ' '}</span>
      </div>
      <div className="display-main" role="status" aria-live="polite" aria-label={text === 'Err' ? 'Error' : text}>
        <span className="display-ghost" aria-hidden="true">
          {GHOST}
        </span>
        <span className="display-value" aria-hidden="true" data-testid="display-value">
          {text}
        </span>
      </div>
    </div>
  )
}
