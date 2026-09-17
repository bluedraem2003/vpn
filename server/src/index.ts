import 'dotenv/config'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serve } from '@hono/node-server'
import { migrate, seedIfEmpty } from './db/index.js'
import { contentRoutes } from './routes/content.js'
import { telegramRoutes } from './routes/telegram.js'
import { assetRoutes } from './routes/assets.js'
import { workspaceRoutes } from './routes/workspace.js'
import { authRoutes } from './routes/auth.js'
import { projectRoutes } from './routes/projects.js'
import { campaignRoutes } from './routes/campaigns.js'
import { ideaRoutes } from './routes/ideas.js'
import { searchRoutes } from './routes/search.js'
import { teamRoutes } from './routes/team.js'
import { analyticsRoutes } from './routes/analytics.js'

migrate()
seedIfEmpty()

const app = new Hono()

app.use(
  '*',
  cors({
    origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
    allowHeaders: [
      'Content-Type',
      'Authorization',
      'X-Session-Token',
      'X-Telegram-Bot-Api-Secret-Token',
    ],
  }),
)

app.get('/api/health', (c) =>
  c.json({
    ok: true,
    service: 'postyar-api',
    telegramConfigured: Boolean(process.env.TELEGRAM_BOT_TOKEN),
  }),
)

app.route('/api/auth', authRoutes)
app.route('/api/workspaces', workspaceRoutes)
app.route('/api/content', contentRoutes)
app.route('/api/assets', assetRoutes)
app.route('/api/telegram', telegramRoutes)
app.route('/api/projects', projectRoutes)
app.route('/api/campaigns', campaignRoutes)
app.route('/api/ideas', ideaRoutes)
app.route('/api/search', searchRoutes)
app.route('/api/team', teamRoutes)
app.route('/api/analytics', analyticsRoutes)

app.onError((err, c) => {
  console.error('[API]', err.message)
  const status = err.message.includes('مجاز نیست') ? 403 : 500
  return c.json({ error: err.message || 'خطای سرور' }, status)
})

const port = Number(process.env.PORT || 8787)

serve({ fetch: app.fetch, port }, () => {
  console.log(`[API] listening on http://127.0.0.1:${port}`)
})

export default app
