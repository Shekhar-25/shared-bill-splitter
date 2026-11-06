import { Hono } from 'hono'
import { HttpError } from './errors'
import { bills } from './routes/bills'
import { homes } from './routes/homes'

const app = new Hono<{ Bindings: Env }>()

app.get('/api/health', (c) => c.json({ status: 'ok' }))
app.route('/', homes)
app.route('/', bills)

// Every error leaves the API as { "error": "message" }.
app.notFound((c) => c.json({ error: 'Route not found' }, 404))

app.onError((error, c) => {
  if (error instanceof HttpError) {
    return c.json({ error: error.message }, error.status)
  }
  console.error(error)
  return c.json({ error: 'Internal server error' }, 500)
})

export default app
