// Client for the Go calculator API. The UI only needs /api/v1/evaluate; the
// per-operation routes exist for other API consumers.

export class ApiError extends Error {
  readonly status: number
  readonly code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

const FRIENDLY: Record<string, string> = {
  division_by_zero: "Can't divide by zero",
  negative_sqrt: "Can't take the square root of a negative number",
  not_real: 'The result is not a real number',
  overflow: 'The number is too large',
  invalid_expression: 'Invalid expression',
}

export interface EvaluateOptions {
  /** Aborting it rejects with the abort reason; callers can ignore that case. */
  signal?: AbortSignal
  timeoutMs?: number
  fetchImpl?: typeof fetch
}

export async function evaluateExpression(
  expression: string,
  { signal, timeoutMs = 8000, fetchImpl = fetch }: EvaluateOptions = {},
): Promise<number> {
  const controller = new AbortController()
  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, timeoutMs)
  const onAbort = () => controller.abort()
  signal?.addEventListener('abort', onAbort)

  let response: Response
  try {
    response = await fetchImpl('/api/v1/evaluate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expression }),
      signal: controller.signal,
    })
  } catch (err) {
    if (signal?.aborted) throw err
    if (timedOut) throw new ApiError(0, 'timeout', 'The server took too long to respond')
    throw new ApiError(0, 'network', "Can't reach the server")
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', onAbort)
  }

  const body = await response.json().catch(() => null)

  if (!response.ok) {
    if (response.status === 429) {
      const wait = response.headers.get('Retry-After') ?? '1'
      throw new ApiError(429, 'rate_limited', `Too many requests, try again in ${wait}s`)
    }
    const code = body?.error?.code
    const message = body?.error?.message
    if (typeof code === 'string') {
      throw new ApiError(response.status, code, FRIENDLY[code] ?? message ?? `Request failed (${response.status})`)
    }
    throw new ApiError(response.status, 'http_error', `Server error (${response.status})`)
  }

  if (typeof body?.result !== 'number' || !Number.isFinite(body.result)) {
    throw new ApiError(response.status, 'bad_response', 'Unexpected response from the server')
  }
  return body.result
}
