import 'dotenv/config'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serve } from '@hono/node-server'
import { db, migrate, seedIfEmpty } from './db/index.js'
import { contentRoutes } from './routes/content.js'
import { telegramRoutes } from './routes/telegram.js'
import { assetRoutes } from './routes/assets.js'
import { workspaceRoutes } from './routes/workspace.js'

migrate()
seedIfEmpty()

const app = new Hono()

app.use(
  '*',
  cors({
    origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-Telegram-Bot-Api-Secret-Token'],
  }),
)

app.get('/api/health', (c) =>
  c.json({
    ok: true,
    service: 'postyar-api',
    telegramConfigured: Boolean(process.env.TELEGRAM_BOT_TOKEN),
  }),
)

app.route('/api/workspaces', workspaceRoutes)
app.route('/api/content', contentRoutes)
app.route('/api/assets', assetRoutes)
app.route('/api/telegram', telegramRoutes)

app.onError((err, c) => {
  console.error('[API]', err.message)
  return c.json({ error: err.message || 'خطای سرور' }, 500)
})

const port = Number(process.env.PORT || 8787)

serve({ fetch: app.fetch, port }, () => {
  console.log(`[API] listening on http://127.0.0.1:${port}`)
})

export default app
