import { useEffect } from 'react'
import { KEYBOARD_MAP } from '@/components/calculator/keys'

/** Calls onKey with the calculator key id for each mapped key press. */
export function useKeyboard(onKey: (id: string) => void, enabled = true) {
  useEffect(() => {
    if (!enabled) return
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      if (e.target instanceof HTMLElement && e.target.closest('input, textarea, [contenteditable="true"]')) return
      const id = KEYBOARD_MAP[e.key]
      if (!id) return
      // Mouse clicks drop focus, so a focused button means the user tabbed
      // to it: Enter activates that button. Any other key clears the focus
      // ring so it doesn't linger on a button while typing.
      const active = document.activeElement
      if (active instanceof HTMLButtonElement) {
        if (e.key === 'Enter') return
        active.blur()
      }
      // Stops "/" from opening quick find and Backspace from navigating back.
      e.preventDefault()
      onKey(id)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onKey, enabled])
}
