import { describe, expect, it, vi } from 'vitest'
import { ApiError, evaluateExpression } from './api'

function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } })
}

async function failure(promise: Promise<unknown>): Promise<ApiError> {
  const err = await promise.catch((e: unknown) => e)
  expect(err).toBeInstanceOf(ApiError)
  return err as ApiError
}

describe('evaluateExpression', () => {
  it('posts the expression and returns the result', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(200, { expression: '2 + 3 × 4', result: 14 }))
    await expect(evaluateExpression('2 + 3 × 4', { fetchImpl })).resolves.toBe(14)
    expect(fetchImpl).toHaveBeenCalledWith(
      '/api/v1/evaluate',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expression: '2 + 3 × 4' }),
      }),
    )
  })

  it.each([
    ['division_by_zero', "Can't divide by zero"],
    ['negative_sqrt', "Can't take the square root of a negative number"],
    ['not_real', 'The result is not a real number'],
    ['overflow', 'The number is too large'],
    ['invalid_expression', 'Invalid expression'],
  ])('maps %s to a friendly message', async (code, message) => {
    const fetchImpl = async () => jsonResponse(422, { error: { code, message: 'raw' } })
    const err = await failure(evaluateExpression('x', { fetchImpl }))
    expect(err).toMatchObject({ status: 422, code, message })
  })

  it('falls back to the server message for unknown codes', async () => {
    const fetchImpl = async () => jsonResponse(400, { error: { code: 'something_new', message: 'server says no' } })
    expect((await failure(evaluateExpression('x', { fetchImpl }))).message).toBe('server says no')
  })

  it('reports rate limiting with Retry-After', async () => {
    const fetchImpl = async () =>
      jsonResponse(429, { error: { code: 'rate_limited', message: 'x' } }, { 'Retry-After': '3' })
    const err = await failure(evaluateExpression('x', { fetchImpl }))
    expect(err).toMatchObject({ status: 429, code: 'rate_limited', message: 'Too many requests, try again in 3s' })
  })

  it('handles a non-JSON error page', async () => {
    const fetchImpl = async () => new Response('<html>Bad Gateway</html>', { status: 502 })
    expect(await failure(evaluateExpression('x', { fetchImpl }))).toMatchObject({
      code: 'http_error',
      message: 'Server error (502)',
    })
  })

  it.each([
    ['missing result', { expression: 'x' }],
    ['string result', { result: '14' }],
    ['not JSON', null],
  ])('rejects a malformed success response: %s', async (_, body) => {
    const fetchImpl = async () =>
      body === null ? new Response('ok', { status: 200 }) : jsonResponse(200, body)
    expect((await failure(evaluateExpression('x', { fetchImpl }))).code).toBe('bad_response')
  })

  it('reports network failures', async () => {
    const fetchImpl = async () => {
      throw new TypeError('Failed to fetch')
    }
    expect(await failure(evaluateExpression('x', { fetchImpl }))).toMatchObject({
      code: 'network',
      message: "Can't reach the server",
    })
  })

  it('times out slow responses', async () => {
    const fetchImpl = (_: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((_, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
      })
    const err = await failure(evaluateExpression('x', { fetchImpl, timeoutMs: 10 }))
    expect(err.code).toBe('timeout')
  })

  it('rethrows the abort when the caller cancels', async () => {
    const controller = new AbortController()
    const fetchImpl = (_: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((_, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
      })
    const promise = evaluateExpression('x', { fetchImpl, signal: controller.signal })
    controller.abort()
    const err = await promise.catch((e: unknown) => e)
    expect(err).toBeInstanceOf(DOMException)
  })
})
