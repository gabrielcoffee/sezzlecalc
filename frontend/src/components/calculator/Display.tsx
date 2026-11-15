import { useAnimate, useReducedMotion } from 'motion/react'
import { useEffect, useLayoutEffect, useRef } from 'react'
import type { DisplayModel } from '@/lib/calculator'
import { DISPLAY_CELLS, formatDisplay } from '@/lib/format'

interface Props {
  view: DisplayModel
  /** Changes on every refused key press; shakes the number. */
  rejections: number
  /** Changes on every result (and on "=" with nothing new); blinks the number. */
  flashes: number
}

// Unlit segments drawn behind the lit ones, as on a real 7-segment display.
const GHOST = '8.'.repeat(DISPLAY_CELLS)

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

export function Display({ view, rejections, flashes }: Props) {
  const [value, animate] = useAnimate<HTMLSpanElement>()
  const reduceMotion = useReducedMotion()
  const expressionRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (rejections === 0 || reduceMotion) return
    animate(value.current, { x: [0, -7, 6, -4, 3, 0] }, { duration: 0.3, ease: 'easeOut' })
  }, [rejections, reduceMotion, animate, value])

  // Layout effect: starts the fade before the browser paints, so the new
  // number never shows one frame at full brightness first.
  useLayoutEffect(() => {
    if (flashes === 0) return
    animate(value.current, { opacity: [0.15, 1] }, { duration: 0.08, ease: 'easeOut' })
  }, [flashes, animate, value])

  // Keep the end of a long expression in view as it grows; the user can
  // scroll back to see the start.
  useLayoutEffect(() => {
    const el = expressionRef.current
    if (el) el.scrollLeft = el.scrollWidth
  }, [view.expression])

  const text = mainText(view.main)

  return (
    <div className="calc-display">
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
        <span ref={value} className="display-value" aria-hidden="true" data-testid="display-value">
          {text}
        </span>
      </div>
    </div>
  )
}
