// Calculator input state. Pure functions only: no React, no network, and no
// arithmetic. Key presses build a list of tokens; "=" serializes the tokens to
// an expression string that the Go API evaluates.

export type BinaryOp = '+' | '−' | '×' | '÷' | '^'

export type Token =
  | {
      kind: 'num'
      /** Digits as typed ("12.5"), or the API's form of an inserted value ("1e+21"). Never signed. */
      text: string
      negative: boolean
      /** Set for values inserted from a result or history. They can't be edited digit by digit. */
      value?: number
    }
  | { kind: 'op'; op: BinaryOp }
  | { kind: 'neg' } // unary minus
  | { kind: 'sqrt' }
  | { kind: 'pct' }
  | { kind: 'lparen' }
  | { kind: 'rparen' }

export interface CalcState {
  tokens: Token[]
  /** Last successful result, shown until the next expression starts. */
  result: number | null
  /** Expression that produced `result` or `error`. */
  lastExpression: string | null
  error: string | null
  /** Short notice for input that was refused, e.g. pressing "=" on "2 +". */
  hint: string | null
  pending: boolean
}

export type Action =
  | { type: 'digit'; digit: string }
  | { type: 'decimal' }
  | { type: 'operator'; op: BinaryOp }
  | { type: 'sqrt' }
  | { type: 'percent' }
  | { type: 'lparen' }
  | { type: 'rparen' }
  | { type: 'negate' }
  | { type: 'backspace' }
  | { type: 'clear' }
  | { type: 'insert'; value: number }
  | { type: 'hint'; message: string }
  | { type: 'evaluate-start' }
  | { type: 'evaluate-success'; expression: string; result: number }
  | { type: 'evaluate-error'; expression: string; message: string }

/** Digits per number, matching the 10-digit display. */
export const MAX_DIGITS = 10
/** The API rejects longer expressions. */
export const MAX_EXPRESSION_LENGTH = 256

export const initialState: CalcState = {
  tokens: [],
  result: null,
  lastExpression: null,
  error: null,
  hint: null,
  pending: false,
}

// ---- reducer ----

/**
 * Applies one action. Returns the same object when the input is refused, so
 * callers can detect a rejected key press with `next === state`.
 */
export function reduce(state: CalcState, action: Action): CalcState {
  switch (action.type) {
    case 'clear':
      return initialState
    case 'hint':
      return { ...state, hint: action.message }
    case 'evaluate-start':
      return { ...state, pending: true, hint: null }
    case 'evaluate-success':
      return {
        ...initialState,
        result: action.result,
        lastExpression: action.expression,
      }
    case 'evaluate-error':
      return { ...initialState, error: action.message, lastExpression: action.expression }
  }

  if (state.pending) return state

  // A history value that can't be appended replaces the input and becomes the
  // current result, so the next operator continues from it.
  if (action.type === 'insert' && endsWithValue(state.tokens)) {
    return { ...initialState, result: action.value }
  }

  const next = edit(startingTokens(state, action), action)
  if (next === null || serialize(next).length > MAX_EXPRESSION_LENGTH) return state

  if (next.length === 0) {
    // Backspace emptied the input; a shown result or error is dismissed too.
    const blank = state.tokens.length === 0 && state.result === null && state.error === null
    return blank ? state : initialState
  }
  return { ...initialState, tokens: next }
}

/**
 * Tokens an action starts from. After a result, operators continue from it
 * while new values start a fresh expression. An error is simply cleared.
 */
function startingTokens(state: CalcState, action: Action): Token[] {
  if (state.tokens.length > 0) return state.tokens
  const continuesResult = action.type === 'operator' || action.type === 'percent' || action.type === 'negate'
  return state.result !== null && continuesResult ? [valueToken(state.result)] : []
}

function edit(tokens: Token[], action: Action): Token[] | null {
  const last = tokens.at(-1)
  const before = tokens.slice(0, -1)

  switch (action.type) {
    case 'digit': {
      if (last?.kind === 'num') {
        if (last.value !== undefined || digitCount(last.text) >= MAX_DIGITS) return null
        const text = last.text === '0' ? action.digit : last.text + action.digit
        return [...before, { ...last, text }]
      }
      return [...withImplicitMultiply(tokens), { kind: 'num', text: action.digit, negative: false }]
    }

    case 'decimal': {
      if (last?.kind === 'num') {
        if (last.value !== undefined || last.text.includes('.')) return null
        return [...before, { ...last, text: last.text + '.' }]
      }
      return [...withImplicitMultiply(tokens), { kind: 'num', text: '0.', negative: false }]
    }

    case 'operator': {
      if (endsWithValue(tokens)) return [...tokens, { kind: 'op', op: action.op }]
      if (last?.kind === 'op') return [...before, { kind: 'op', op: action.op }]
      if (action.op === '−' && (last === undefined || last.kind === 'lparen')) {
        return [...tokens, { kind: 'neg' }]
      }
      if (last === undefined) return [valueToken(0), { kind: 'op', op: action.op }]
      return null
    }

    case 'sqrt':
      return [...withImplicitMultiply(tokens), { kind: 'sqrt' }]

    case 'lparen':
      return [...withImplicitMultiply(tokens), { kind: 'lparen' }]

    case 'rparen':
      return openParens(tokens) > 0 && endsWithValue(tokens) ? [...tokens, { kind: 'rparen' }] : null

    case 'percent':
      return endsWithValue(tokens) ? [...tokens, { kind: 'pct' }] : null

    case 'negate':
      return last?.kind === 'num' ? [...before, { ...last, negative: !last.negative }] : null

    case 'backspace': {
      if (last === undefined) return []
      if (last.kind === 'num' && last.value === undefined && last.text.length > 1) {
        return [...before, { ...last, text: last.text.slice(0, -1) }]
      }
      return before
    }

    case 'insert':
      if (endsWithValue(tokens)) return null
      return [...tokens, valueToken(action.value)]

    default:
      return null
  }
}

/** Inserts "×" before a new value that follows a complete one: 2(3) → 2 × (3). */
function withImplicitMultiply(tokens: Token[]): Token[] {
  return endsWithValue(tokens) ? [...tokens, { kind: 'op', op: '×' }] : tokens
}

// ---- queries ----

export function endsWithValue(tokens: Token[]): boolean {
  const last = tokens.at(-1)
  return last?.kind === 'num' || last?.kind === 'rparen' || last?.kind === 'pct'
}

export function openParens(tokens: Token[]): number {
  let open = 0
  for (const t of tokens) {
    if (t.kind === 'lparen') open++
    if (t.kind === 'rparen') open--
  }
  return open
}

function digitCount(text: string): number {
  return text.replace('.', '').length
}

export function valueToken(value: number): Token {
  return {
    kind: 'num',
    // String() gives the shortest form that round-trips, e.g. 1e+21; the API parses it.
    text: String(Math.abs(value)),
    negative: value < 0,
    value,
  }
}

// ---- serialization ----

/**
 * Serializes tokens to the expression string. The same string is shown on the
 * display and sent to the API, which accepts × ÷ − √ directly.
 */
export function serialize(tokens: Token[]): string {
  return tokens
    .map((t) => {
      switch (t.kind) {
        case 'num':
          return t.negative ? `(−${t.text})` : t.text
        case 'op':
          return ` ${t.op} `
        case 'neg':
          return '−'
        case 'sqrt':
          return '√'
        case 'pct':
          return '%'
        case 'lparen':
          return '('
        case 'rparen':
          return ')'
      }
    })
    .join('')
}

export type Prepared = { ok: true; expression: string } | { ok: false; message: string }

/** Checks that the input can be sent and closes any open parentheses. */
export function prepare(state: CalcState): Prepared {
  if (state.pending) return { ok: false, message: 'Already calculating' }
  if (state.tokens.length === 0) return { ok: false, message: 'Enter a calculation' }
  if (!endsWithValue(state.tokens)) return { ok: false, message: 'Finish the expression first' }
  const expression = serialize(state.tokens) + ')'.repeat(openParens(state.tokens))
  if (expression.length > MAX_EXPRESSION_LENGTH) return { ok: false, message: 'Expression is too long' }
  return { ok: true, expression }
}

// ---- display ----

export interface DisplayModel {
  /** Text for the 7-segment line. */
  main: { kind: 'number'; value: number } | { kind: 'typed'; text: string } | { kind: 'error' }
  /** Small line above it. */
  expression: string
}

export function display(state: CalcState): DisplayModel {
  if (state.error !== null) {
    return { main: { kind: 'error' }, expression: state.lastExpression ?? '' }
  }
  if (state.tokens.length === 0) {
    return {
      main: { kind: 'number', value: state.result ?? 0 },
      expression: state.lastExpression ? `${state.lastExpression} =` : '',
    }
  }
  const lastNum = state.tokens.findLast((t) => t.kind === 'num')
  let main: DisplayModel['main'] = { kind: 'typed', text: '0' }
  if (lastNum?.kind === 'num') {
    main =
      lastNum.value !== undefined
        ? { kind: 'number', value: lastNum.value }
        : { kind: 'typed', text: (lastNum.negative ? '-' : '') + lastNum.text }
  }
  return { main, expression: serialize(state.tokens) }
}
