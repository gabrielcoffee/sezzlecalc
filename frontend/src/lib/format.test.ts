import { describe, expect, it } from 'vitest'
import { DISPLAY_CELLS, formatDisplay, formatFull } from './format'

describe('formatDisplay', () => {
  it.each([
    [0, '0'],
    [-0, '0'],
    [14, '14'],
    [-5, '-5'],
    [0.5, '0.5'],
    [1 / 3, '0.3333333333'],
    [2 / 3, '0.6666666667'],
    [-1 / 3, '-0.333333333'], // the minus sign takes a cell
    [-9.876543201, '-9.876543201'],
    [99999999999, '99999999999'], // 11 digits fill the display
    [-9999999999, '-9999999999'],
    [-99999999999, '-1E11'],
    [99999999999.6, '1E11'], // rounding would need 12 digits
    [123456789012, '1.2345679E11'],
    [1e21, '1E21'],
    [-1.5e300, '-1.5E300'],
    [0.0000000001, '0.0000000001'],
    [1.5e-12, '1.5E-12'],
    [123.456789012, '123.45678901'],
    [Number.MAX_VALUE, '1.797693E308'],
    [Number.POSITIVE_INFINITY, 'Err'],
    [Number.NaN, 'Err'],
  ])('%s → %s', (value, want) => {
    expect(formatDisplay(value)).toBe(want)
  })

  it(`never uses more than ${DISPLAY_CELLS} cells, sign included`, () => {
    for (const v of [Math.PI * 1e15, -Math.E / 1e15, 98765.4321987, -123456789.987, -1e-300]) {
      const cells = formatDisplay(v).replace('.', '').length
      expect(cells, String(v)).toBeLessThanOrEqual(DISPLAY_CELLS)
    }
  })
})

describe('formatFull', () => {
  it('keeps full precision and uses a typographic minus', () => {
    expect(formatFull(-0.333333333333333)).toBe('−0.333333333333333')
    expect(formatFull(1e21)).toBe('1e+21')
  })
})
