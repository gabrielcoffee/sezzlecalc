import type { Action } from '@/lib/calculator'
import type { SoundName } from '@/lib/sound'

export type KeyVariant = 'orange' | 'gray' | 'cream'

export interface KeyDef {
  id: string
  label: string
  /** Spoken name for screen readers. */
  aria: string
  variant: KeyVariant
  sound: SoundName
  action: Action | 'evaluate'
}

const digit = (d: string): KeyDef => ({
  id: d,
  label: d,
  aria: d,
  variant: 'gray',
  sound: 'digit',
  action: { type: 'digit', digit: d },
})

/** Keypad rows, top to bottom, 4 keys each. */
export const KEY_ROWS: KeyDef[][] = [
  [
    { id: 'clear', label: 'C', aria: 'clear', variant: 'orange', sound: 'clear', action: { type: 'clear' } },
    { id: 'lparen', label: '(', aria: 'open parenthesis', variant: 'orange', sound: 'function', action: { type: 'lparen' } },
    { id: 'rparen', label: ')', aria: 'close parenthesis', variant: 'orange', sound: 'function', action: { type: 'rparen' } },
    { id: 'negate', label: '±', aria: 'change sign', variant: 'orange', sound: 'function', action: { type: 'negate' } },
  ],
  [
    { id: 'sqrt', label: '√', aria: 'square root', variant: 'orange', sound: 'function', action: { type: 'sqrt' } },
    { id: 'power', label: 'xʸ', aria: 'power', variant: 'orange', sound: 'operator', action: { type: 'operator', op: '^' } },
    { id: 'percent', label: '%', aria: 'percent', variant: 'orange', sound: 'function', action: { type: 'percent' } },
    { id: 'backspace', label: '⌫', aria: 'backspace', variant: 'orange', sound: 'backspace', action: { type: 'backspace' } },
  ],
  [
    digit('7'),
    digit('8'),
    digit('9'),
    { id: 'subtract', label: '−', aria: 'minus', variant: 'cream', sound: 'operator', action: { type: 'operator', op: '−' } },
  ],
  [
    digit('4'),
    digit('5'),
    digit('6'),
    { id: 'divide', label: '÷', aria: 'divide', variant: 'cream', sound: 'operator', action: { type: 'operator', op: '÷' } },
  ],
  [
    digit('1'),
    digit('2'),
    digit('3'),
    { id: 'multiply', label: '×', aria: 'times', variant: 'cream', sound: 'operator', action: { type: 'operator', op: '×' } },
  ],
  [
    digit('0'),
    { id: 'decimal', label: '.', aria: 'decimal point', variant: 'gray', sound: 'digit', action: { type: 'decimal' } },
    { id: 'equals', label: '=', aria: 'equals', variant: 'cream', sound: 'equals', action: 'evaluate' },
    { id: 'add', label: '+', aria: 'plus', variant: 'cream', sound: 'operator', action: { type: 'operator', op: '+' } },
  ],
]

export const KEYS_BY_ID: Record<string, KeyDef> = Object.fromEntries(
  KEY_ROWS.flat().map((k) => [k.id, k]),
)

/** Physical keyboard → key id. */
export const KEYBOARD_MAP: Record<string, string> = {
  ...Object.fromEntries('0123456789'.split('').map((d) => [d, d])),
  '.': 'decimal',
  ',': 'decimal',
  '+': 'add',
  '-': 'subtract',
  '*': 'multiply',
  x: 'multiply',
  '/': 'divide',
  '^': 'power',
  '%': 'percent',
  '(': 'lparen',
  ')': 'rparen',
  r: 'sqrt',
  n: 'negate',
  Enter: 'equals',
  '=': 'equals',
  Backspace: 'backspace',
  Escape: 'clear',
  Delete: 'clear',
}
