import type { Context } from 'hono'
import { HttpError } from './errors'
import { MAX_TOTAL_CENTS } from './split'

const MAX_TEXT_LENGTH = 120
const MAX_IDEMPOTENCY_KEY_LENGTH = 255

/** Reads the JSON body and makes sure it is an object. Anything else is a 400. */
export async function readJsonObject(c: Context): Promise<Record<string, unknown>> {
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    throw new HttpError(400, 'Request body must be valid JSON')
  }
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new HttpError(400, 'Request body must be a JSON object')
  }
  return Object.fromEntries(Object.entries(body))
}

/** A required, non-blank text field. Returns the trimmed value. */
export function requireText(body: Record<string, unknown>, field: string): string {
  const value = body[field]
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new HttpError(422, `${field} is required and must be a non-empty string`)
  }
  const trimmed = value.trim()
  if (trimmed.length > MAX_TEXT_LENGTH) {
    throw new HttpError(422, `${field} must be at most ${MAX_TEXT_LENGTH} characters`)
  }
  return trimmed
}

/** A positive whole number of cents. Strings, decimals, zero and negatives are rejected. */
export function requireTotalCents(body: Record<string, unknown>): number {
  const value = body.totalCents
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) {
    throw new HttpError(422, 'totalCents must be a positive whole number of cents')
  }
  if (value > MAX_TOTAL_CENTS) {
    throw new HttpError(422, `totalCents must be at most ${MAX_TOTAL_CENTS}`)
  }
  return value
}

export function requireIdempotencyKey(c: Context): string {
  const key = c.req.header('Idempotency-Key')?.trim()
  if (!key) {
    throw new HttpError(400, 'Idempotency-Key header is required')
  }
  if (key.length > MAX_IDEMPOTENCY_KEY_LENGTH) {
    throw new HttpError(
      400,
      `Idempotency-Key must be at most ${MAX_IDEMPOTENCY_KEY_LENGTH} characters`,
    )
  }
  return key
}
