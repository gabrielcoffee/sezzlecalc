import { describe, expect, it } from 'vitest'
import { formatDisplay, formatFull } from './format'

describe('formatDisplay', () => {
  it.each([
    [0, '0'],
    [-0, '0'],
    [14, '14'],
    [-5, '-5'],
    [0.5, '0.5'],
    [1 / 3, '0.333333333'],
    [2 / 3, '0.666666667'],
    [-9.876543201, '-9.876543201'],
    [1234567890, '1234567890'],
    [9999999999, '9999999999'],
    [9999999999.6, '1E10'], // rounding would need 11 digits
    [12345678901, '1.234568E10'],
    [1e21, '1E21'],
    [-1.5e300, '-1.5E300'],
    [0.000000001, '0.000000001'],
    [1.5e-12, '1.5E-12'],
    [123.456789012, '123.456789'],
    [Number.MAX_VALUE, '1.79769E308'],
    [Number.POSITIVE_INFINITY, 'Err'],
    [Number.NaN, 'Err'],
  ])('%s → %s', (value, want) => {
    expect(formatDisplay(value)).toBe(want)
  })

  it('never uses more than 10 digit cells', () => {
    for (const v of [Math.PI * 1e15, Math.E / 1e15, 98765.4321987, -123456789.987]) {
      const cells = formatDisplay(v).replace(/[-.]/g, '').length
      expect(cells, String(v)).toBeLessThanOrEqual(10)
    }
  })
})

describe('formatFull', () => {
  it('keeps full precision and uses a typographic minus', () => {
    expect(formatFull(-0.333333333333333)).toBe('−0.333333333333333')
    expect(formatFull(1e21)).toBe('1e+21')
  })
})
