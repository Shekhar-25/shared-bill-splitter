import { MAX_TOTAL_CENTS } from '../../../api/src/split'

/**
 * Turns what the user typed ("12", "12.5", "$1,200.05") into whole cents.
 * Works on the digits of the string, never on floating-point numbers.
 * Returns an error message instead of a value when the input is not usable.
 */
export function parseAmountToCents(input: string): { cents: number } | { error: string } {
  const cleaned = input.trim().replace(/^\$/, '').replace(/,/g, '')
  if (cleaned === '') return { error: 'Enter an amount.' }
  if (cleaned.startsWith('-')) return { error: 'The amount must be greater than zero.' }

  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(cleaned)
  if (!match) return { error: 'Use numbers only, with at most 2 decimals (e.g. 48.50).' }

  const dollars = match[1] ?? '0'
  const fraction = (match[2] ?? '').padEnd(2, '0')
  const cents = Number(dollars) * 100 + Number(fraction)

  if (cents <= 0) return { error: 'The amount must be greater than zero.' }
  if (!Number.isSafeInteger(cents) || cents > MAX_TOTAL_CENTS) {
    return { error: 'That amount is too large.' }
  }
  return { cents }
}

/** Formats integer cents as dollars, e.g. 123456 -> "$1,234.56". */
export function formatCents(cents: number): string {
  const sign = cents < 0 ? '-' : ''
  const absolute = Math.abs(cents)
  const dollars = Math.floor(absolute / 100).toLocaleString('en-US')
  const remainder = String(absolute % 100).padStart(2, '0')
  return `${sign}$${dollars}.${remainder}`
}
