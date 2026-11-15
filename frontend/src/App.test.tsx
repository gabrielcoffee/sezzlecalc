import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import App from './App'
import { HISTORY_KEY } from './hooks/use-history'
import { SOUND_KEY } from './hooks/use-sound'
import type { SoundEngine, SoundName } from './lib/sound'

/** Mocks fetch with the real API's evaluate contract for a few expressions. */
function mockApi(results: Record<string, number | { status: number; code: string }>) {
  const fetchMock = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
    const { expression } = JSON.parse(String(init?.body))
    const r = results[expression]
    if (r === undefined) throw new Error(`unexpected expression ${expression}`)
    if (typeof r === 'number') {
      return new Response(JSON.stringify({ expression, result: r }), { status: 200 })
    }
    return new Response(JSON.stringify({ error: { code: r.code, message: 'x' } }), { status: r.status })
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function setup() {
  const played: SoundName[] = []
  const engine: SoundEngine = { play: (name) => played.push(name) }
  const user = userEvent.setup()
  render(<App soundEngine={engine} />)
  const press = async (...names: string[]) => {
    for (const name of names) await user.click(screen.getByRole('button', { name }))
  }
  const value = () => screen.getByTestId('display-value').textContent
  return { user, press, value, played }
}

describe('App', () => {
  it('sends the expression to the API and shows the result', async () => {
    const fetchMock = mockApi({ '2 + 3 × 4': 14 })
    const { press, value, played } = setup()

    await press('2', 'plus', '3', 'times', '4')
    expect(screen.getByText('2 + 3 × 4')).toBeInTheDocument()
    expect(value()).toBe('4')

    await press('equals')
    await waitFor(() => expect(value()).toBe('14'))
    expect(screen.getByText('2 + 3 × 4 =')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(played).toEqual(['digit', 'operator', 'digit', 'operator', 'digit', 'equals'])
  })

  it('shows Err and a toast when the API refuses', async () => {
    mockApi({ '1 ÷ 0': { status: 422, code: 'division_by_zero' } })
    const { press, value, played } = setup()

    await press('1', 'divide', '0', 'equals')
    await waitFor(() => expect(value()).toBe('Err'))
    expect(await screen.findByText("Can't divide by zero")).toBeInTheDocument()
    expect(played.at(-1)).toBe('error')

    await press('clear')
    expect(value()).toBe('0')
  })

  it('ignores a trailing operator on equals', async () => {
    const fetchMock = mockApi({ '2 + 3': 5 })
    const { press, value } = setup()

    await press('2', 'plus', '3', 'times', 'equals')
    await waitFor(() => expect(value()).toBe('5'))
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(screen.getByText('2 + 3 =')).toBeInTheDocument()
  })

  it('does nothing on equals with nothing to calculate', async () => {
    const fetchMock = mockApi({})
    const { press, played } = setup()
    await press('square root', 'equals')
    expect(fetchMock).not.toHaveBeenCalled()
    expect(played.at(-1)).toBe('reject')
  })

  it('plays the reject sound for refused keys', async () => {
    const { press, played } = setup()
    await press('close parenthesis')
    expect(played).toEqual(['reject'])
  })

  it('accepts keyboard input', async () => {
    mockApi({ '(2 + 3) × 4': 20 })
    const { user, value } = setup()

    await user.keyboard('(2+3)*4{Enter}')
    await waitFor(() => expect(value()).toBe('20'))
    await user.keyboard('{Escape}')
    expect(value()).toBe('0')
  })

  it('keeps a history that survives a reload and can be reused and cleared', async () => {
    mockApi({ '6 × 7': 42, '42 + 1': 43 })
    const first = setup()
    await first.press('6', 'times', '7', 'equals')
    await waitFor(() => expect(first.value()).toBe('42'))
    expect(JSON.parse(localStorage.getItem(HISTORY_KEY)!)).toMatchObject([{ expression: '6 × 7', result: 42 }])

    // Reload: a fresh render reads history back from storage.
    document.body.innerHTML = ''
    const { user, press, value } = setup()
    await press('Open history')
    const sheet = await screen.findByRole('dialog')
    await user.click(within(sheet).getByRole('button', { name: '6 × 7 equals 42' }))

    // The value goes into the calculator; continuing from it works.
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(value()).toBe('42')
    await press('plus', '1', 'equals')
    await waitFor(() => expect(value()).toBe('43'))

    await press('Open history')
    await user.click(await screen.findByRole('button', { name: 'Clear history' }))
    expect(within(screen.getByRole('dialog')).getByText('NO CALCULATIONS YET')).toBeInTheDocument()
  })

  it('mutes sounds and remembers the setting', async () => {
    const { press, played } = setup()
    await press('Mute sound')
    expect(screen.getByRole('button', { name: 'Turn sound on' })).toHaveAttribute('aria-pressed', 'false')
    expect(JSON.parse(localStorage.getItem(SOUND_KEY)!)).toBe(false)

    const before = played.length
    await press('7')
    expect(played.length).toBe(before)

    await press('Turn sound on')
    expect(played.at(-1)).toBe('toggle')
  })

  it('C cancels a request in flight', async () => {
    let resolve: (r: Response) => void = () => {}
    vi.stubGlobal(
      'fetch',
      vi.fn((_: RequestInfo | URL, init?: RequestInit) => {
        return new Promise<Response>((res, rej) => {
          resolve = res
          init?.signal?.addEventListener('abort', () => rej(new DOMException('aborted', 'AbortError')))
        })
      }),
    )
    const { press, value } = setup()
    await press('9', 'equals')
    await press('clear')
    await act(async () => resolve(new Response(JSON.stringify({ result: 9 }))))
    expect(value()).toBe('0')
  })
})
