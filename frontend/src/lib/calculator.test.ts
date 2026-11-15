import { describe, expect, it } from 'vitest'
import {
  display,
  initialState,
  MAX_CELLS,
  prepare,
  reduce,
  serialize,
  type Action,
  type CalcState,
} from './calculator'

// Builds state from a compact key string: digits, ". + - * / ^ ( ) % r(√) n(±) b(⌫) c(clear)".
function keys(input: string, start: CalcState = initialState): CalcState {
  let state = start
  for (const ch of input) state = reduce(state, toAction(ch))
  return state
}

function toAction(ch: string): Action {
  if (/\d/.test(ch)) return { type: 'digit', digit: ch }
  const map: Record<string, Action> = {
    '.': { type: 'decimal' },
    '+': { type: 'operator', op: '+' },
    '-': { type: 'operator', op: '−' },
    '*': { type: 'operator', op: '×' },
    '/': { type: 'operator', op: '÷' },
    '^': { type: 'operator', op: '^' },
    '(': { type: 'lparen' },
    ')': { type: 'rparen' },
    '%': { type: 'percent' },
    r: { type: 'sqrt' },
    n: { type: 'negate' },
    b: { type: 'backspace' },
    c: { type: 'clear' },
  }
  return map[ch]
}

const expr = (s: CalcState) => serialize(s.tokens)
const withResult = (result: number): CalcState => ({ ...initialState, result, lastExpression: 'x' })

describe('building expressions', () => {
  it.each([
    ['2+3*4', '2 + 3 × 4'],
    ['12.5', '12.5'],
    ['.5', '0.5'],
    ['007', '7'], // no leading zeros
    ['0.05', '0.05'],
    ['2+*3', '2 × 3'], // operator replaces operator
    ['-5', '−5'], // unary minus on empty input
    ['(-2)^2', '(−2) ^ 2'],
    ['+3', '0 + 3'], // other operators start from 0
    ['5n', '(−5)'],
    ['5nn', '5'],
    ['2*3n', '2 × (−3)'],
    ['r9', '√9'],
    ['2r9', '2 × √9'], // implicit × before √
    ['2(3)', '2 × (3)'], // implicit × before (
    ['(2)3', '(2) × 3'], // implicit × after )
    ['50%', '50%'],
    ['200*50%', '200 × 50%'],
    ['10%%', '10%%'],
    ['10%5', '10% × 5'],
    ['12b', '1'],
    ['12+b', '12'],
    ['2.b', '2'],
    ['5nb', ''],
  ])('%s → %s', (input, want) => {
    expect(expr(keys(input))).toBe(want)
  })

  it('caps a number at the 11 display cells', () => {
    const s = keys('1'.repeat(MAX_CELLS + 3))
    expect(expr(s)).toBe('1'.repeat(MAX_CELLS))
  })

  it('does not count the decimal point toward the cap', () => {
    expect(expr(keys('12345678901.1'))).toBe('12345678901.')
    expect(expr(keys('1234567890.1'))).toBe('1234567890.1')
  })

  it('counts the minus sign as a cell', () => {
    expect(display(keys('1n' + '2'.repeat(12))).main).toEqual({ kind: 'typed', text: '-1' + '2'.repeat(9) })
  })

  it('refuses ± when the number already fills every cell', () => {
    const full = keys('1'.repeat(MAX_CELLS))
    expect(reduce(full, toAction('n'))).toBe(full)
    expect(expr(keys('b' + 'n', full))).toBe('(−' + '1'.repeat(MAX_CELLS - 1) + ')')
  })
})

describe('rejected input returns the same state', () => {
  it.each([
    ['', ')'],
    ['', '%'],
    ['', 'n'],
    ['', 'b'],
    ['(', ')'], // empty parentheses
    ['2', ')'], // nothing to close
    ['2+', ')'],
    ['2+', '%'],
    ['2.', '.'],
    ['-', '-'],
    ['-', '+'],
    ['r', '*'],
    ['(', '*'],
    ['2+', 'n'],
    ['5%', 'n'],
  ])('after "%s", key "%s"', (before, key) => {
    const state = keys(before)
    expect(reduce(state, toAction(key))).toBe(state)
  })

  it('refuses input that would exceed the API length limit', () => {
    let state = initialState
    for (let i = 0; i < 300; i++) state = reduce(state, toAction('('))
    expect(expr(state).length).toBeLessThanOrEqual(256)
  })

  it('ignores keys while a request is pending', () => {
    const pending = reduce(keys('2+2'), { type: 'evaluate-start' })
    expect(reduce(pending, toAction('3'))).toBe(pending)
  })
})

describe('after a result', () => {
  it('continues with an operator', () => {
    expect(expr(keys('+2', withResult(14)))).toBe('14 + 2')
  })

  it('continues with percent and sign change', () => {
    expect(expr(keys('%', withResult(50)))).toBe('50%')
    expect(expr(keys('n', withResult(7)))).toBe('(−7)')
  })

  it('wraps negative results so they serialize safely', () => {
    expect(expr(keys('^2', withResult(-3)))).toBe('(−3) ^ 2')
  })

  it('keeps results in exponent form the API accepts', () => {
    expect(expr(keys('*2', withResult(1e21)))).toBe('1e+21 × 2')
  })

  it('starts fresh with a digit, ( or √', () => {
    expect(expr(keys('7', withResult(14)))).toBe('7')
    expect(expr(keys('(', withResult(14)))).toBe('(')
    expect(expr(keys('r', withResult(14)))).toBe('√')
  })

  it('does not allow editing the result digit by digit', () => {
    const s = keys('+', withResult(14))
    const back = keys('b', s)
    expect(expr(back)).toBe('14')
    expect(reduce(back, toAction('5'))).toBe(back)
    expect(reduce(back, toAction('.'))).toBe(back)
    expect(expr(keys('b', back))).toBe('')
  })

  it('backspace dismisses the result', () => {
    expect(keys('b', withResult(14))).toEqual(initialState)
  })
})

describe('errors', () => {
  const failed = reduce(keys('1/0'), { type: 'evaluate-error', expression: '1 ÷ 0', message: 'nope' })

  it('any new input clears the error', () => {
    expect(keys('5', failed)).toMatchObject({ error: null, tokens: [{ kind: 'num', text: '5' }] })
  })

  it('backspace clears the error', () => {
    expect(keys('b', failed)).toEqual(initialState)
  })

  it('clear resets everything', () => {
    expect(keys('c', failed)).toEqual(initialState)
  })
})

describe('inserting a history value', () => {
  it('appends where a value fits', () => {
    expect(expr(reduce(keys('2+'), { type: 'insert', value: 5 }))).toBe('2 + 5')
    expect(expr(reduce(initialState, { type: 'insert', value: -5 }))).toBe('(−5)')
  })

  it('becomes the current result after a complete value', () => {
    const s = reduce(keys('2+3'), { type: 'insert', value: 9 })
    expect(s).toEqual({ ...initialState, result: 9 })
  })
})

describe('prepare', () => {
  it('closes open parentheses', () => {
    expect(prepare(keys('(2+3*(4'))).toEqual({ ok: true, expression: '(2 + 3 × (4))', trivial: false })
  })

  it.each([
    ['2+', '2', true],
    ['2+3*', '2 + 3', false],
    ['2+(', '2', true],
    ['(2+', '(2)', true],
    ['2*r', '2', true],
    ['2*(-', '2', true],
  ])('drops the unfinished tail of "%s" → %s', (input, expression, trivial) => {
    expect(prepare(keys(input))).toEqual({ ok: true, expression, trivial })
  })

  it.each([
    ['5', true],
    ['5n', true], // (−5)
    ['-5', true],
    ['(5)', true],
    ['r9', false],
    ['5%', false],
    ['2^3', false],
  ])('"%s" trivial: %s', (input, trivial) => {
    expect(prepare(keys(input))).toMatchObject({ ok: true, trivial })
  })

  it.each([[''], ['r'], ['('], ['-']])('has nothing to send for "%s"', (input) => {
    expect(prepare(keys(input))).toEqual({ ok: false, reason: 'empty' })
  })

  it('refuses while pending', () => {
    expect(prepare(reduce(keys('2'), { type: 'evaluate-start' }))).toEqual({ ok: false, reason: 'pending' })
  })

  it('refuses when closing parentheses would exceed the length limit', () => {
    let state = initialState
    for (let i = 0; i < 128; i++) state = reduce(state, toAction('('))
    state = reduce(state, toAction('1'))
    expect(prepare(state)).toEqual({ ok: false, reason: 'too-long' })
  })
})

describe('evaluation lifecycle', () => {
  it('success shows the result and its expression', () => {
    const s = reduce(keys('2+2'), { type: 'evaluate-success', expression: '2 + 2', result: 4 })
    expect(s).toMatchObject({ result: 4, lastExpression: '2 + 2', tokens: [], pending: false })
  })
})

describe('display', () => {
  it('shows 0 on start', () => {
    expect(display(initialState)).toEqual({ main: { kind: 'number', value: 0 }, expression: '' })
  })

  it('shows the number being typed, with sign', () => {
    expect(display(keys('2+35n')).main).toEqual({ kind: 'typed', text: '-35' })
  })

  it('keeps showing the last number after an operator', () => {
    expect(display(keys('2+35*')).main).toEqual({ kind: 'typed', text: '35' })
  })

  it('shows 0 when no number was typed yet', () => {
    expect(display(keys('(')).main).toEqual({ kind: 'typed', text: '0' })
  })

  it('shows an inserted value as a number', () => {
    expect(display(reduce(keys('2+'), { type: 'insert', value: 0.5 })).main).toEqual({ kind: 'number', value: 0.5 })
  })

  it('shows a result with its expression', () => {
    expect(display({ ...initialState, result: 14, lastExpression: '2 + 3 × 4' })).toEqual({
      main: { kind: 'number', value: 14 },
      expression: '2 + 3 × 4 =',
    })
  })

  it('shows Err with the failed expression', () => {
    expect(display({ ...initialState, error: 'x', lastExpression: '1 ÷ 0' })).toEqual({
      main: { kind: 'error' },
      expression: '1 ÷ 0',
    })
  })
})
