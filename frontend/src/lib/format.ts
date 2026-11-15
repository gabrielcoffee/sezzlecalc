/**
 * Cells on the 7-segment display. Digits and a leading minus each take a
 * cell, so a positive number can show 11 digits and a negative one 10.
 * The decimal point takes no cell, as on the font used for the display.
 */
export const DISPLAY_CELLS = 11

/**
 * Fits a number into the display. Long decimals are rounded; values too
 * large or too small for plain digits use exponent form, e.g. "1.2345E21".
 */
export function formatDisplay(value: number): string {
  if (!Number.isFinite(value)) return 'Err'
  if (value === 0) return '0'
  const sign = value < 0 ? '-' : ''
  const cellsLeft = DISPLAY_CELLS - sign.length
  const abs = Math.abs(value)
  return sign + (fixed(abs, cellsLeft) ?? exponent(abs, cellsLeft))
}

function fixed(abs: number, cellsLeft: number): string | null {
  const intDigits = abs < 1 ? 1 : Math.floor(Math.log10(abs)) + 1
  if (intDigits > cellsLeft) return null
  const text = trimZeros(abs.toFixed(cellsLeft - intDigits))
  // Rounding can add a digit (99999999999.6 → 100000000000) or erase a tiny value.
  if (cells(text) > cellsLeft || Number(text) === 0) return null
  return text
}

function exponent(abs: number, cellsLeft: number): string {
  for (let digits = cellsLeft - 1; digits >= 0; digits--) {
    const [mantissa, exp] = abs.toExponential(digits).split('e')
    const text = `${trimZeros(mantissa)}E${Number(exp)}`
    if (cells(text) <= cellsLeft) return text
  }
  return 'Err' // unreachable for finite float64 values
}

function trimZeros(text: string): string {
  return text.includes('.') ? text.replace(/\.?0+$/, '') : text
}

function cells(text: string): number {
  return text.replace('.', '').length
}

/** Full-precision form for the history list. */
export function formatFull(value: number): string {
  return String(value).replace('-', '−')
}
