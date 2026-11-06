import { Hono } from 'hono'
import { HttpError } from '../errors'
import { splitCents } from '../split'
import {
  readJsonObject,
  requireIdempotencyKey,
  requireText,
  requireTotalCents,
} from '../validation'
import { findHome } from './homes'

type ShareRow = {
  id: string
  bill_id: string
  member_id: string
  amount_cents: number
  paid_at: string | null
  payment_key: string | null
}
type BillRow = {
  id: string
  home_id: string
  title: string
  total_cents: number
  created_at: string
}

export const bills = new Hono<{ Bindings: Env }>()

function toShare(row: ShareRow) {
  return {
    id: row.id,
    memberId: row.member_id,
    amountCents: row.amount_cents,
    paidAt: row.paid_at,
  }
}

function toBill(row: BillRow, shareRows: ShareRow[]) {
  return {
    id: row.id,
    homeId: row.home_id,
    title: row.title,
    totalCents: row.total_cents,
    createdAt: row.created_at,
    shares: shareRows.map(toShare),
  }
}

bills.post('/api/homes/:homeId/bills', async (c) => {
  const db = c.env.DB
  const home = await findHome(db, c.req.param('homeId'))
  const body = await readJsonObject(c)
  const title = requireText(body, 'title')
  const totalCents = requireTotalCents(body)

  // Members come back in the order they were added: this order decides who gets extra cents.
  const { results: members } = await db
    .prepare('SELECT id FROM members WHERE home_id = ? ORDER BY seq')
    .bind(home.id)
    .all<{ id: string }>()
  if (members.length === 0) {
    throw new HttpError(422, 'Cannot create a bill for a home with no members')
  }

  const amounts = splitCents(totalCents, members.length)
  const billId = crypto.randomUUID()
  const shares = members.map((member, index) => ({
    id: crypto.randomUUID(),
    memberId: member.id,
    amountCents: amounts[index] ?? 0,
    paidAt: null,
  }))

  // One batch = one transaction: the bill and all its shares are saved together or not at all.
  await db.batch([
    db
      .prepare('INSERT INTO bills (id, home_id, title, total_cents) VALUES (?, ?, ?, ?)')
      .bind(billId, home.id, title, totalCents),
    ...shares.map((share) =>
      db
        .prepare('INSERT INTO shares (id, bill_id, member_id, amount_cents) VALUES (?, ?, ?, ?)')
        .bind(share.id, billId, share.memberId, share.amountCents),
    ),
  ])

  return c.json({ id: billId, homeId: home.id, title, totalCents, shares }, 201)
})

bills.get('/api/homes/:homeId/bills', async (c) => {
  const db = c.env.DB
  const home = await findHome(db, c.req.param('homeId'))

  const { results: billRows } = await db
    .prepare(
      `SELECT id, home_id, title, total_cents, created_at
         FROM bills WHERE home_id = ? ORDER BY created_at DESC, rowid DESC`,
    )
    .bind(home.id)
    .all<BillRow>()
  const { results: shareRows } = await db
    .prepare(
      `SELECT s.id, s.bill_id, s.member_id, s.amount_cents, s.paid_at, s.payment_key
         FROM shares s
         JOIN members m ON m.id = s.member_id
         JOIN bills b ON b.id = s.bill_id
        WHERE b.home_id = ?
        ORDER BY m.seq`,
    )
    .bind(home.id)
    .all<ShareRow>()

  return c.json({
    bills: billRows.map((bill) =>
      toBill(
        bill,
        shareRows.filter((share) => share.bill_id === bill.id),
      ),
    ),
  })
})

bills.get('/api/bills/:billId', async (c) => {
  const db = c.env.DB
  const bill = await db
    .prepare('SELECT id, home_id, title, total_cents, created_at FROM bills WHERE id = ?')
    .bind(c.req.param('billId'))
    .first<BillRow>()
  if (!bill) throw new HttpError(404, 'Bill not found')

  const { results: shareRows } = await db
    .prepare(
      `SELECT s.id, s.bill_id, s.member_id, s.amount_cents, s.paid_at, s.payment_key
         FROM shares s JOIN members m ON m.id = s.member_id
        WHERE s.bill_id = ? ORDER BY m.seq`,
    )
    .bind(bill.id)
    .all<ShareRow>()

  return c.json(toBill(bill, shareRows))
})

bills.post('/api/bills/:billId/shares/:shareId/pay', async (c) => {
  const db = c.env.DB
  const billId = c.req.param('billId')
  const shareId = c.req.param('shareId')
  const key = requireIdempotencyKey(c)

  const bill = await db.prepare('SELECT id FROM bills WHERE id = ?').bind(billId).first()
  if (!bill) throw new HttpError(404, 'Bill not found')

  const existing = await db
    .prepare('SELECT id FROM shares WHERE id = ? AND bill_id = ?')
    .bind(shareId, billId)
    .first()
  if (!existing) throw new HttpError(404, 'Share not found')

  // The whole "is it still unpaid?" check and the write happen in ONE statement.
  // SQLite runs write statements one at a time, so of two simultaneous requests
  // only one can match `paid_at IS NULL`; the other changes 0 rows.
  await db
    .prepare(
      `UPDATE shares SET paid_at = ?, payment_key = ?
        WHERE id = ? AND bill_id = ? AND paid_at IS NULL`,
    )
    .bind(new Date().toISOString(), key, shareId, billId)
    .run()

  // Whether we won the race or not, read the stored result and decide from it.
  const share = await db
    .prepare(
      `SELECT id, bill_id, member_id, amount_cents, paid_at, payment_key
         FROM shares WHERE id = ? AND bill_id = ?`,
    )
    .bind(shareId, billId)
    .first<ShareRow>()
  if (!share) throw new HttpError(404, 'Share not found')

  if (share.payment_key !== key) {
    throw new HttpError(409, 'Share was already paid with a different Idempotency-Key')
  }
  return c.json(toShare(share), 200)
})
