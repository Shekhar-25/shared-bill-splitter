// One Idempotency-Key per share payment attempt. The same key is handed out again until the
// attempt is settled, so retrying the same logical payment can never pay twice.
const pendingKeys = new Map<string, string>()

/** The key for paying this share. Creates one the first time, then keeps returning it. */
export function paymentKeyFor(shareId: string): string {
  const existing = pendingKeys.get(shareId)
  if (existing) return existing
  const created = crypto.randomUUID()
  pendingKeys.set(shareId, created)
  return created
}

/** Call once the server gave a final answer (paid, or definitively refused). */
export function settlePayment(shareId: string): void {
  pendingKeys.delete(shareId)
}
