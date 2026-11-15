// localStorage access that never throws: private mode, disabled storage or
// corrupt data all fall back to the default value.

export function loadJSON<T>(key: string, fallback: T, isValid: (value: unknown) => value is T): T {
  try {
    const raw = localStorage.getItem(key)
    if (raw === null) return fallback
    const value: unknown = JSON.parse(raw)
    return isValid(value) ? value : fallback
  } catch {
    return fallback
  }
}

export function saveJSON(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Storage full or unavailable: the app keeps working without persistence.
  }
}
