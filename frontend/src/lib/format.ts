/** Digit cells on the 7-segment display. A leading minus has its own extra cell. */
export const DISPLAY_DIGITS = 10

/**
 * Fits a number into the display: at most DISPLAY_DIGITS digits plus an
 * optional leading "-". Long decimals are rounded; values too large or too
 * small for plain digits use exponent form, e.g. "1.2345E21".
 * The decimal point takes no cell, as on the font used for the display.
 */
export function formatDisplay(value: number): string {
  if (!Number.isFinite(value)) return 'Err'
  if (value === 0) return '0'
  const sign = value < 0 ? '-' : ''
  const abs = Math.abs(value)
  return sign + (fixed(abs) ?? exponent(abs))
}

function fixed(abs: number): string | null {
  const intDigits = abs < 1 ? 1 : Math.floor(Math.log10(abs)) + 1
  if (intDigits > DISPLAY_DIGITS) return null
  const text = trimZeros(abs.toFixed(DISPLAY_DIGITS - intDigits))
  // Rounding can add a digit (9999999999.6 → 10000000000) or erase a tiny value.
  if (cells(text) > DISPLAY_DIGITS || Number(text) === 0) return null
  return text
}

function exponent(abs: number): string {
  for (let digits = DISPLAY_DIGITS - 1; digits >= 0; digits--) {
    const [mantissa, exp] = abs.toExponential(digits).split('e')
    const text = `${trimZeros(mantissa)}E${Number(exp)}`
    if (cells(text) <= DISPLAY_DIGITS) return text
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
