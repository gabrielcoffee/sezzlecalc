import { useAnimate, useReducedMotion } from 'motion/react'
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type PointerEvent } from 'react'
import type { DisplayModel } from '@/lib/calculator'
import { DISPLAY_CELLS, formatDisplay } from '@/lib/format'
import { TypedText } from './TypedText'

interface Props {
  view: DisplayModel
  /** Changes on every refused key press; shakes the number. */
  rejections: number
  /** Changes on every result (and on "=" with nothing new); blinks the number. */
  flashes: number
}

// Unlit segments drawn behind the lit ones, as on a real 7-segment display.
const GHOST = '8.'.repeat(DISPLAY_CELLS)
const SCROLL_SPEED = 0.35 // px per ms while an arrow is held

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
  const lineRef = useRef<HTMLDivElement>(null)
  const [canScroll, setCanScroll] = useState({ left: false, right: false })
  const holdRef = useRef<number | null>(null)

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

  const updateArrows = useCallback(() => {
    const el = lineRef.current
    if (!el) return
    const max = el.scrollWidth - el.clientWidth
    setCanScroll({ left: el.scrollLeft > 1, right: el.scrollLeft < max - 1 })
  }, [])

  // Keep the end of a long expression in view as it grows. The typing glide
  // briefly widens the line, so settle again once it has finished.
  useLayoutEffect(() => {
    const toEnd = () => {
      const el = lineRef.current
      if (el) el.scrollLeft = el.scrollWidth
      updateArrows()
    }
    toEnd()
    const settle = setTimeout(toEnd, 150)
    return () => clearTimeout(settle)
  }, [view.expression, updateArrows])

  useEffect(() => {
    const el = lineRef.current
    if (!el) return
    const ro = new ResizeObserver(updateArrows)
    ro.observe(el)
    return () => ro.disconnect()
  }, [updateArrows])

  // Press and hold an arrow to scroll the expression line.
  const startHold = (direction: -1 | 1) => (e: PointerEvent<HTMLButtonElement>) => {
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    let last = performance.now()
    const step = (now: number) => {
      const el = lineRef.current
      if (el) el.scrollLeft += direction * SCROLL_SPEED * (now - last)
      last = now
      holdRef.current = requestAnimationFrame(step)
    }
    holdRef.current = requestAnimationFrame(step)
  }
  const stopHold = () => {
    if (holdRef.current !== null) cancelAnimationFrame(holdRef.current)
    holdRef.current = null
  }
  useEffect(() => stopHold, [])

  const text = mainText(view.main)

  return (
    <div className="calc-display">
      <div className="display-expression-row">
        <button
          type="button"
          className="display-arrow"
          aria-label="Scroll expression left"
          data-visible={canScroll.left || undefined}
          tabIndex={-1}
          onPointerDown={startHold(-1)}
          onPointerUp={stopHold}
          onPointerCancel={stopHold}
          onLostPointerCapture={stopHold}
        >
          ‹
        </button>
        <div
          ref={lineRef}
          className="display-expression"
          tabIndex={view.expression ? 0 : -1}
          aria-label={view.expression ? `Expression: ${view.expression}` : undefined}
          onScroll={updateArrows}
        >
          <span>
            {view.expression ? <TypedText text={view.expression} live={view.live} generation={flashes} /> : ' '}
          </span>
        </div>
        <button
          type="button"
          className="display-arrow"
          aria-label="Scroll expression right"
          data-visible={canScroll.right || undefined}
          tabIndex={-1}
          onPointerDown={startHold(1)}
          onPointerUp={stopHold}
          onPointerCancel={stopHold}
          onLostPointerCapture={stopHold}
        >
          ›
        </button>
      </div>
      <div className="display-main" role="status" aria-live="polite" aria-label={text === 'Err' ? 'Error' : text}>
        <span className="display-ghost" aria-hidden="true">
          {GHOST}
        </span>
        <span ref={value} className="display-value" aria-hidden="true" data-testid="display-value">
          <TypedText text={text} live={view.live} generation={flashes} />
        </span>
      </div>
    </div>
  )
}
