export { cn } from "cn"

/**
 * Drops focus after a mouse or touch click, so the clicked button doesn't
 * show a focus ring once the user starts typing. Keyboard activation
 * (detail === 0) keeps focus where keyboard users expect it.
 */
export function blurIfPointer(e: { detail: number; currentTarget: HTMLElement }) {
  if (e.detail > 0) e.currentTarget.blur()
}
