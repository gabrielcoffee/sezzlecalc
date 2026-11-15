import { ApiError } from '@/lib/api'

/** The API's answer for an expression: a result or a definitive error. */
export type Answer = { ok: true; result: number } | { ok: false; error: ApiError }

/**
 * Errors that will be the same every time for the same expression (bad math,
 * bad input). Rate limits, network and server failures are not: they're
 * worth retrying, so they're never cached.
 */
export function isDefinitive(err: unknown): err is ApiError {
  return err instanceof ApiError && err.status >= 400 && err.status < 500 && err.status !== 429
}

/**
 * Answers by expression. The same expression always gives the same answer,
 * so a repeated one never needs the network. Least recently used entries are
 * dropped beyond `limit`.
 */
export class AnswerCache {
  private readonly entries = new Map<string, Answer>()
  private readonly limit: number

  constructor(limit = 200) {
    this.limit = limit
  }

  get(expression: string): Answer | undefined {
    const answer = this.entries.get(expression)
    if (answer) {
      // Move to the end: most recently used.
      this.entries.delete(expression)
      this.entries.set(expression, answer)
    }
    return answer
  }

  has(expression: string): boolean {
    return this.entries.has(expression)
  }

  set(expression: string, answer: Answer): void {
    this.entries.delete(expression)
    this.entries.set(expression, answer)
    if (this.entries.size > this.limit) {
      const oldest = this.entries.keys().next().value
      if (oldest !== undefined) this.entries.delete(oldest)
    }
  }

  get size(): number {
    return this.entries.size
  }
}
