import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

// jsdom lacks these browser APIs used by Radix and the media-query hook.
if (!window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: query.includes('min-width'), // behave like a desktop viewport
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList
}

if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}

afterEach(() => {
  cleanup()
  localStorage.clear()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})
