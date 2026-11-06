import { env } from 'cloudflare:workers'
import { describe, expect, it } from 'vitest'
import { splitCents } from '../src/split'
import { type Balance, type Bill, call, createBill, createHome, type Share } from './helpers'

function pay(billId: string, shareId: string, key?: string) {
  return call<Share & { error?: string }>('POST', `/api/bills/${billId}/shares/${shareId}/pay`, {
    headers: key ? { 'Idempotency-Key': key } : {},
  })
}

async function paidFirstShare(memberNames: string[], totalCents: number) {
  const { homeId, members } = await createHome(memberNames)
  const bill = await createBill(homeId, totalCents)
  const share = bill.body.shares[0]
  if (!share) throw new Error('no share')
  return { homeId, members, bill: bill.body, share }
}

describe('splitCents', () => {
  it('splits evenly, unevenly and for one member', () => {
    expect(splitCents(3000, 3)).toEqual([1000, 1000, 1000])
    expect(splitCents(1000, 3)).toEqual([334, 333, 333])
    expect(splitCents(4999, 1)).toEqual([4999])
  })

  it('gives zero cents to later members when the total is smaller than the headcount', () => {
    expect(splitCents(2, 5)).toEqual([1, 1, 0, 0, 0])
  })

  it('always sums to the total', () => {
    for (const total of [1, 7, 99, 100, 101, 100001, 9_999_999_999]) {
      for (const count of [1, 2, 3, 7, 13]) {
        expect(splitCents(total, count).reduce((a, b) => a + b, 0)).toBe(total)
      }
    }
  })

  it('rejects invalid input', () => {
    expect(() => splitCents(0, 3)).toThrow(RangeError)
    expect(() => splitCents(10.5, 3)).toThrow(RangeError)
    expect(() => splitCents(100, 0)).toThrow(RangeError)
  })
})

describe('homes and members: validation', () => {
  it.each([{}, { name: '' }, { name: '   ' }, { name: 42 }, { name: null }])(
    'rejects the home body %j with 422',
    async (body) => {
      const created = await call<{ error: string }>('POST', '/api/homes', { body })
      expect(created.status).toBe(422)
      expect(created.body.error).toEqual(expect.any(String))
    },
  )

  it('rejects a malformed JSON body with 400 and a JSON error', async () => {
    const response = await call('POST', '/api/homes', { body: undefined })
    expect(response.status).toBe(400)
    expect(response.body).toEqual({ error: expect.any(String) })
  })

  it('rejects a body that is not an object', async () => {
    const response = await call('POST', '/api/homes', { body: [1, 2] })
    expect(response.status).toBe(400)
  })

  it('trims names', async () => {
    const created = await call<{ name: string }>('POST', '/api/homes', {
      body: { name: '  Flat  ' },
    })
    expect(created.body.name).toBe('Flat')
  })

  it('rejects a blank member name', async () => {
    const { homeId } = await createHome([])
    const member = await call('POST', `/api/homes/${homeId}/members`, { body: { name: ' ' } })
    expect(member.status).toBe(422)
  })

  it('lists members in the order they were added', async () => {
    const { homeId } = await createHome(['Zed', 'Amy', 'Bob'])
    const home = await call<{ members: { name: string }[] }>('GET', `/api/homes/${homeId}`)
    expect(home.status).toBe(200)
    expect(home.body.members.map((member) => member.name)).toEqual(['Zed', 'Amy', 'Bob'])
  })

  it('returns 404 for an unknown home and an unknown route, both as JSON', async () => {
    const home = await call('GET', '/api/homes/nope')
    expect(home.status).toBe(404)
    expect(home.body).toEqual({ error: expect.any(String) })
    const route = await call('GET', '/api/nothing-here')
    expect(route.status).toBe(404)
    expect(route.body).toEqual({ error: expect.any(String) })
  })
})

describe('bills: validation and errors', () => {
  it('rejects a missing, blank or non-string title', async () => {
    const { homeId } = await createHome(['Asha'])
    for (const title of [undefined, '', '  ', 5]) {
      const bill = await call('POST', `/api/homes/${homeId}/bills`, {
        body: { title, totalCents: 100 },
      })
      expect(bill.status).toBe(422)
    }
  })

  it.each([Number.MAX_SAFE_INTEGER, 1e13, '10', true, [], {}])(
    'rejects the odd amount %j',
    async (totalCents) => {
      const { homeId } = await createHome(['Asha'])
      const bill = await call('POST', `/api/homes/${homeId}/bills`, {
        body: { title: 'Odd', totalCents },
      })
      expect(bill.status).toBe(422)
    },
  )

  it('checks the home before the body, so a missing home is 404', async () => {
    const bill = await call('POST', '/api/homes/nope/bills', { body: { totalCents: -1 } })
    expect(bill.status).toBe(404)
  })

  it('returns 422 with a JSON error for a home with no members', async () => {
    const { homeId } = await createHome([])
    const bill = await createBill(homeId, 1000)
    expect(bill.status).toBe(422)
    expect(bill.body).toEqual({ error: expect.any(String) })
  })

  it('stores nothing when the bill is rejected', async () => {
    const { homeId } = await createHome([])
    await createBill(homeId, 1000)
    const bills = await call<{ bills: Bill[] }>('GET', `/api/homes/${homeId}/bills`)
    expect(bills.body.bills).toEqual([])
  })

  it('lists bills newest first with their shares', async () => {
    const { homeId } = await createHome(['Asha', 'Ben'])
    const first = await createBill(homeId, 100)
    const second = await createBill(homeId, 200)
    const list = await call<{ bills: Bill[] }>('GET', `/api/homes/${homeId}/bills`)
    expect(list.body.bills.map((bill) => bill.id)).toEqual([second.body.id, first.body.id])
    expect(list.body.bills[0]?.shares.map((share) => share.amountCents)).toEqual([100, 100])
  })
})

describe('payments: edge cases', () => {
  it('rejects an empty Idempotency-Key and gives a JSON error', async () => {
    const { bill, share } = await paidFirstShare(['Asha', 'Ben'], 1000)
    const response = await call('POST', `/api/bills/${bill.id}/shares/${share.id}/pay`, {
      headers: { 'Idempotency-Key': '   ' },
    })
    expect(response.status).toBe(400)
    expect(response.body).toEqual({ error: expect.any(String) })
  })

  it('does not mark the share as paid when the key is missing', async () => {
    const { homeId, bill, share } = await paidFirstShare(['Asha', 'Ben'], 1000)
    await pay(bill.id, share.id)
    const list = await call<{ bills: Bill[] }>('GET', `/api/homes/${homeId}/bills`)
    expect(list.body.bills[0]?.shares[0]?.paidAt).toBeNull()
  })

  it('returns 404 when the share belongs to a different bill', async () => {
    const { homeId, share } = await paidFirstShare(['Asha', 'Ben'], 1000)
    const otherBill = await createBill(homeId, 400)
    const response = await pay(otherBill.body.id, share.id, crypto.randomUUID())
    expect(response.status).toBe(404)
  })

  it('returns the full original result on a repeated key', async () => {
    const { bill, share } = await paidFirstShare(['Asha', 'Ben'], 1000)
    const key = crypto.randomUUID()
    const first = await pay(bill.id, share.id, key)
    const second = await pay(bill.id, share.id, key)
    expect(second.status).toBe(200)
    expect(second.body).toEqual(first.body)
    expect(first.body).toEqual({
      id: share.id,
      memberId: share.memberId,
      amountCents: 500,
      paidAt: expect.any(String),
    })
  })

  it('keeps the original paidAt after a rejected second key', async () => {
    const { bill, share } = await paidFirstShare(['Asha', 'Ben'], 1000)
    const key = crypto.randomUUID()
    const first = await pay(bill.id, share.id, key)
    const conflict = await pay(bill.id, share.id, crypto.randomUUID())
    expect(conflict.status).toBe(409)
    expect(conflict.body).toEqual({ error: expect.any(String) })
    const retry = await pay(bill.id, share.id, key)
    expect(retry.body.paidAt).toBe(first.body.paidAt)
  })

  it('lets the same key pay two different shares independently', async () => {
    const { bill } = await paidFirstShare(['Asha', 'Ben'], 1000)
    const [a, b] = bill.shares
    if (!a || !b) throw new Error('missing shares')
    const key = crypto.randomUUID()
    expect((await pay(bill.id, a.id, key)).status).toBe(200)
    expect((await pay(bill.id, b.id, key)).status).toBe(200)
  })

  it('lets only one of many simultaneous different-key requests win', async () => {
    const { homeId, bill, share } = await paidFirstShare(['Asha', 'Ben'], 1000)
    const results = await Promise.all(
      Array.from({ length: 10 }, () => pay(bill.id, share.id, crypto.randomUUID())),
    )
    const statuses = results.map((result) => result.status)
    expect(statuses.filter((status) => status === 200)).toHaveLength(1)
    expect(statuses.filter((status) => status === 409)).toHaveLength(9)

    const winner = results.find((result) => result.status === 200)
    const stored = await env.DB.prepare('SELECT paid_at FROM shares WHERE id = ?')
      .bind(share.id)
      .first<{ paid_at: string }>()
    expect(stored?.paid_at).toBe(winner?.body.paidAt)

    const balances = await call<{ balances: Balance[] }>('GET', `/api/homes/${homeId}/balances`)
    expect(balances.body.balances.map((balance) => balance.outstandingCents)).toEqual([0, 500])
  })

  it('answers every simultaneous request with the same result when they share a key', async () => {
    const { bill, share } = await paidFirstShare(['Asha', 'Ben'], 1000)
    const key = crypto.randomUUID()
    const results = await Promise.all(Array.from({ length: 10 }, () => pay(bill.id, share.id, key)))
    expect(results.every((result) => result.status === 200)).toBe(true)
    expect(new Set(results.map((result) => result.body.paidAt)).size).toBe(1)
  })
})

describe('balances', () => {
  it('includes members with no bills at zero', async () => {
    const { homeId } = await createHome(['Asha', 'Ben'])
    const balances = await call<{ balances: Balance[] }>('GET', `/api/homes/${homeId}/balances`)
    expect(balances.body.balances.map((balance) => balance.outstandingCents)).toEqual([0, 0])
  })

  it('returns an empty list for a home with no members', async () => {
    const { homeId } = await createHome([])
    const balances = await call<{ balances: Balance[] }>('GET', `/api/homes/${homeId}/balances`)
    expect(balances.status).toBe(200)
    expect(balances.body.balances).toEqual([])
  })

  it('does not mix up two homes', async () => {
    const a = await createHome(['Asha'])
    const b = await createHome(['Ben'])
    await createBill(a.homeId, 700)
    const balances = await call<{ balances: Balance[] }>('GET', `/api/homes/${b.homeId}/balances`)
    expect(balances.body.balances.map((balance) => balance.outstandingCents)).toEqual([0])
  })

  it('only counts members that existed when each bill was made', async () => {
    const { homeId } = await createHome(['Asha'])
    await createBill(homeId, 900)
    await call('POST', `/api/homes/${homeId}/members`, { body: { name: 'Late' } })
    const balances = await call<{ balances: Balance[] }>('GET', `/api/homes/${homeId}/balances`)
    expect(balances.body.balances.map((balance) => balance.outstandingCents)).toEqual([900, 0])
  })
})

describe('database constraints', () => {
  it('rejects a non-positive bill total', async () => {
    const { homeId } = await createHome(['Asha'])
    await expect(
      env.DB.prepare('INSERT INTO bills (id, home_id, title, total_cents) VALUES (?, ?, ?, ?)')
        .bind('b1', homeId, 'Zero', 0)
        .run(),
    ).rejects.toThrow(/bills_total_positive|CHECK/)
  })

  it('rejects a member for a home that does not exist', async () => {
    await expect(
      env.DB.prepare('INSERT INTO members (id, home_id, name) VALUES (?, ?, ?)')
        .bind('m1', 'missing-home', 'Ghost')
        .run(),
    ).rejects.toThrow(/FOREIGN KEY/)
  })

  it('rejects a share that is half paid', async () => {
    const { bill, share } = await paidFirstShare(['Asha'], 100)
    await expect(
      env.DB.prepare('UPDATE shares SET paid_at = ? WHERE id = ?')
        .bind(new Date().toISOString(), share.id)
        .run(),
    ).rejects.toThrow(/shares_paid_state|CHECK/)
    expect(bill.shares).toHaveLength(1)
  })

  it('rejects two shares for the same member on one bill', async () => {
    const { bill, share } = await paidFirstShare(['Asha'], 100)
    await expect(
      env.DB.prepare(
        'INSERT INTO shares (id, bill_id, member_id, amount_cents) VALUES (?, ?, ?, ?)',
      )
        .bind('dup', bill.id, share.memberId, 1)
        .run(),
    ).rejects.toThrow(/UNIQUE/)
  })
})
