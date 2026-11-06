export type Home = { id: string; name: string; createdAt: string }
export type Member = { id: string; homeId: string; name: string }
export type HomeDetail = Home & { members: Member[] }
export type Share = { id: string; memberId: string; amountCents: number; paidAt: string | null }
export type Bill = {
  id: string
  homeId: string
  title: string
  totalCents: number
  createdAt: string
  shares: Share[]
}
export type Balance = { memberId: string; name: string; outstandingCents: number }

const REQUEST_TIMEOUT_MS = 15_000
const PAY_MAX_ATTEMPTS = 3

/** Thrown for every failed request. `status` is null when no response arrived at all. */
export class ApiError extends Error {
  readonly status: number | null

  constructor(message: string, status: number | null) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }

  /** Network failures, timeouts and 5xx answers may succeed if tried again. */
  get isRetryable(): boolean {
    return this.status === null || this.status >= 500
  }
}

// ---------- low-level request ----------

type RequestOptions = { body?: unknown; headers?: Record<string, string>; signal?: AbortSignal }

async function request(method: 'GET' | 'POST', path: string, options: RequestOptions = {}) {
  const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout

  let response: Response
  try {
    response = await fetch(path, {
      method,
      signal,
      headers: {
        ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...options.headers,
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    })
  } catch (error) {
    if (options.signal?.aborted) throw error // the caller cancelled: not a failure to show
    if (timeout.aborted) throw new ApiError('The server took too long to respond.', null)
    throw new ApiError('Could not reach the server. Check your connection.', null)
  }

  const payload = await readJson(response)
  if (!response.ok) {
    throw new ApiError(errorMessage(payload, response.status), response.status)
  }
  return payload
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    return null
  }
}

function errorMessage(payload: unknown, status: number): string {
  if (isRecord(payload) && typeof payload.error === 'string') return payload.error
  if (status >= 500) return 'The server ran into a problem. Please try again.'
  return `Request failed (${status}).`
}

// ---------- response parsing (we do not trust the shape of the network) ----------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function unexpected(): never {
  throw new ApiError('The server sent a response we did not understand.', null)
}

function text(record: Record<string, unknown>, key: string): string {
  const value = record[key]
  return typeof value === 'string' ? value : unexpected()
}

function integer(record: Record<string, unknown>, key: string): number {
  const value = record[key]
  return typeof value === 'number' && Number.isInteger(value) ? value : unexpected()
}

function list(record: Record<string, unknown>, key: string): unknown[] {
  const value = record[key]
  return Array.isArray(value) ? value : unexpected()
}

function object(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : unexpected()
}

function parseHome(value: unknown): Home {
  const record = object(value)
  return {
    id: text(record, 'id'),
    name: text(record, 'name'),
    createdAt: text(record, 'createdAt'),
  }
}

function parseMember(value: unknown): Member {
  const record = object(value)
  return { id: text(record, 'id'), homeId: text(record, 'homeId'), name: text(record, 'name') }
}

function parseShare(value: unknown): Share {
  const record = object(value)
  const paidAt = record.paidAt
  if (paidAt !== null && typeof paidAt !== 'string') unexpected()
  return {
    id: text(record, 'id'),
    memberId: text(record, 'memberId'),
    amountCents: integer(record, 'amountCents'),
    paidAt,
  }
}

function parseBill(value: unknown): Bill {
  const record = object(value)
  return {
    id: text(record, 'id'),
    homeId: text(record, 'homeId'),
    title: text(record, 'title'),
    totalCents: integer(record, 'totalCents'),
    createdAt: text(record, 'createdAt'),
    shares: list(record, 'shares').map(parseShare),
  }
}

function parseBalance(value: unknown): Balance {
  const record = object(value)
  return {
    memberId: text(record, 'memberId'),
    name: text(record, 'name'),
    outstandingCents: integer(record, 'outstandingCents'),
  }
}

// ---------- endpoints ----------

export async function listHomes(signal?: AbortSignal): Promise<Home[]> {
  const payload = object(await request('GET', '/api/homes', { signal }))
  return list(payload, 'homes').map(parseHome)
}

export async function createHome(name: string): Promise<{ id: string; name: string }> {
  const record = object(await request('POST', '/api/homes', { body: { name } }))
  return { id: text(record, 'id'), name: text(record, 'name') }
}

export async function getHome(homeId: string, signal?: AbortSignal): Promise<HomeDetail> {
  const record = object(
    await request('GET', `/api/homes/${encodeURIComponent(homeId)}`, { signal }),
  )
  return { ...parseHome(record), members: list(record, 'members').map(parseMember) }
}

export async function addMember(homeId: string, name: string): Promise<Member> {
  const payload = await request('POST', `/api/homes/${encodeURIComponent(homeId)}/members`, {
    body: { name },
  })
  return parseMember(payload)
}

export async function listBills(homeId: string, signal?: AbortSignal): Promise<Bill[]> {
  const payload = object(
    await request('GET', `/api/homes/${encodeURIComponent(homeId)}/bills`, { signal }),
  )
  return list(payload, 'bills').map(parseBill)
}

export async function getBill(billId: string, signal?: AbortSignal): Promise<Bill> {
  return parseBill(await request('GET', `/api/bills/${encodeURIComponent(billId)}`, { signal }))
}

export async function createBill(
  homeId: string,
  title: string,
  totalCents: number,
): Promise<{ id: string }> {
  const payload = await request('POST', `/api/homes/${encodeURIComponent(homeId)}/bills`, {
    body: { title, totalCents },
  })
  return { id: text(object(payload), 'id') }
}

export async function listBalances(homeId: string, signal?: AbortSignal): Promise<Balance[]> {
  const payload = object(
    await request('GET', `/api/homes/${encodeURIComponent(homeId)}/balances`, { signal }),
  )
  return list(payload, 'balances').map(parseBalance)
}

/**
 * Pays one share. Network errors, timeouts and 5xx answers are retried with the SAME
 * Idempotency-Key, so a retry can never charge twice: if the first attempt did reach the
 * server, the retry just receives the original result.
 */
export async function payShare(billId: string, shareId: string, key: string): Promise<Share> {
  const path = `/api/bills/${encodeURIComponent(billId)}/shares/${encodeURIComponent(shareId)}/pay`
  for (let attempt = 1; ; attempt++) {
    try {
      return parseShare(await request('POST', path, { headers: { 'Idempotency-Key': key } }))
    } catch (error) {
      const canRetry = error instanceof ApiError && error.isRetryable && attempt < PAY_MAX_ATTEMPTS
      if (!canRetry) throw error
      await new Promise((resolve) => setTimeout(resolve, 400 * attempt))
    }
  }
}
