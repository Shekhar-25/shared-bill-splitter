/** Largest bill we accept: 1 trillion cents. Keeps every sum far below 2^53. */
export const MAX_TOTAL_CENTS = 1_000_000_000_000

/**
 * Splits `totalCents` between `memberCount` people using integer maths only.
 * Everyone gets the floor of the average; the leftover cents go one by one
 * to the first members. The result always adds up to `totalCents`.
 *
 * This file is also imported by the web app so the preview matches the API.
 */
export function splitCents(totalCents: number, memberCount: number): number[] {
  if (!Number.isSafeInteger(totalCents) || totalCents <= 0) {
    throw new RangeError('totalCents must be a positive whole number')
  }
  if (!Number.isSafeInteger(memberCount) || memberCount <= 0) {
    throw new RangeError('memberCount must be a positive whole number')
  }

  const baseCents = Math.floor(totalCents / memberCount)
  const extraCents = totalCents % memberCount
  return Array.from({ length: memberCount }, (_, index) =>
    index < extraCents ? baseCents + 1 : baseCents,
  )
}
