import { Hono } from 'hono'
import { HttpError } from '../errors'
import { readJsonObject, requireText } from '../validation'

type HomeRow = { id: string; name: string; created_at: string }
type MemberRow = { id: string; home_id: string; name: string }
type BalanceRow = { id: string; name: string; outstanding_cents: number }

export const homes = new Hono<{ Bindings: Env }>()

export async function findHome(db: D1Database, homeId: string): Promise<HomeRow> {
  const home = await db
    .prepare('SELECT id, name, created_at FROM homes WHERE id = ?')
    .bind(homeId)
    .first<HomeRow>()
  if (!home) throw new HttpError(404, 'Home not found')
  return home
}

homes.post('/api/homes', async (c) => {
  const body = await readJsonObject(c)
  const name = requireText(body, 'name')
  const id = crypto.randomUUID()

  await c.env.DB.prepare('INSERT INTO homes (id, name) VALUES (?, ?)').bind(id, name).run()
  return c.json({ id, name }, 201)
})

homes.get('/api/homes', async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT id, name, created_at FROM homes ORDER BY created_at DESC, rowid DESC',
  ).all<HomeRow>()
  return c.json({
    homes: results.map((home) => ({ id: home.id, name: home.name, createdAt: home.created_at })),
  })
})

homes.get('/api/homes/:homeId', async (c) => {
  const home = await findHome(c.env.DB, c.req.param('homeId'))
  const { results } = await c.env.DB.prepare(
    'SELECT id, home_id, name FROM members WHERE home_id = ? ORDER BY seq',
  )
    .bind(home.id)
    .all<MemberRow>()

  return c.json({
    id: home.id,
    name: home.name,
    createdAt: home.created_at,
    members: results.map((member) => ({
      id: member.id,
      homeId: member.home_id,
      name: member.name,
    })),
  })
})

homes.post('/api/homes/:homeId/members', async (c) => {
  const home = await findHome(c.env.DB, c.req.param('homeId'))
  const body = await readJsonObject(c)
  const name = requireText(body, 'name')
  const id = crypto.randomUUID()

  await c.env.DB.prepare('INSERT INTO members (id, home_id, name) VALUES (?, ?, ?)')
    .bind(id, home.id, name)
    .run()
  return c.json({ id, homeId: home.id, name }, 201)
})

homes.get('/api/homes/:homeId/balances', async (c) => {
  const home = await findHome(c.env.DB, c.req.param('homeId'))
  const { results } = await c.env.DB.prepare(
    `SELECT m.id, m.name,
            COALESCE(SUM(CASE WHEN s.paid_at IS NULL THEN s.amount_cents END), 0) AS outstanding_cents
       FROM members m
       LEFT JOIN shares s ON s.member_id = m.id
      WHERE m.home_id = ?
      GROUP BY m.id
      ORDER BY m.seq`,
  )
    .bind(home.id)
    .all<BalanceRow>()

  return c.json({
    balances: results.map((row) => ({
      memberId: row.id,
      name: row.name,
      outstandingCents: row.outstanding_cents,
    })),
  })
})
