import 'dotenv/config'
import { existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
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
import { occasionRoutes } from './routes/occasions.js'
import { instagramRoutes } from './routes/instagram.js'
import { notificationRoutes } from './routes/notifications.js'
import { collaborationRoutes } from './routes/collaborations.js'
import { runMissedScheduleReminders } from './jobs/reminders.js'
import { pageSyncIntervalMs, syncDueConnectedPages } from './lib/pageSync.js'
import { denyViewerWrites } from './middleware/auth.js'

migrate()
seedIfEmpty()

const app = new Hono()
const isProd = process.env.NODE_ENV === 'production'
const publicUrl = (process.env.AUTH_PUBLIC_URL || '').replace(/\/$/, '')

function corsOrigins(): string[] | ((origin: string) => string | null | undefined) {
  const raw = process.env.CORS_ORIGINS || ''
  const listed = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  const defaults = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:8080',
    'http://127.0.0.1:8080',
  ]
  if (publicUrl) defaults.push(publicUrl)
  const allow = new Set([...defaults, ...listed])

  return (origin) => {
    if (!origin) return publicUrl || 'http://127.0.0.1:8080'
    if (allow.has(origin)) return origin
    if (publicUrl && origin === publicUrl) return origin
    try {
      const host = new URL(origin).hostname
      if (host.endsWith('.trycloudflare.com')) return origin
      if (host === '127.0.0.1' || host === 'localhost') return origin
    } catch {
      /* ignore */
    }
    if (!isProd) return origin
    return null
  }
}

app.use('/api/*', async (c, next) => {
  await next()
  c.header('Cache-Control', 'no-store, no-cache, must-revalidate')
  c.header('Pragma', 'no-cache')
})

app.use(
  '*',
  cors({
    origin: corsOrigins(),
    allowHeaders: [
      'Content-Type',
      'Authorization',
      'X-Session-Token',
      'X-Telegram-Bot-Api-Secret-Token',
    ],
    credentials: true,
  }),
)

app.get('/api/health', (c) =>
  c.json({
    ok: true,
    service: 'postyar-api',
    version: '1.0.0',
    mode: isProd ? 'production' : 'development',
  }),
)

app.use('/api/*', denyViewerWrites)

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
app.route('/api/occasions', occasionRoutes)
app.route('/api/instagram', instagramRoutes)
app.route('/api/notifications', notificationRoutes)
app.route('/api/collaborations', collaborationRoutes)

const __dirname = dirname(fileURLToPath(import.meta.url))
const distCandidates = [
  process.env.STATIC_DIR,
  join(process.cwd(), 'dist'),
  join(__dirname, '../../dist'),
].filter(Boolean) as string[]

const staticRoot = distCandidates.find((dir) => existsSync(join(dir, 'index.html')))

if (staticRoot) {
  app.use(
    '/*',
    serveStatic({
      root: staticRoot,
    }),
  )
  app.notFound(async (c) => {
    if (c.req.path.startsWith('/api')) return c.json({ error: 'یافت نشد' }, 404)
    const { readFile } = await import('node:fs/promises')
    const html = await readFile(join(staticRoot, 'index.html'), 'utf8')
    return c.html(html)
  })
  console.log(`[Web] serving static from ${staticRoot}`)
} else {
  app.notFound((c) => c.json({ error: 'یافت نشد' }, 404))
  if (isProd) console.warn('[Web] dist/ not found — API only. Run npm run build first.')
}

app.onError((err, c) => {
  console.error('[API]', err.message)
  const forbidden = err.message.includes('مجاز نیست')
  const status = forbidden ? 403 : 500
  return c.json({ error: err.message || 'خطای سرور', code: forbidden ? 'forbidden' : 'server_error' }, status)
})

const port = Number(process.env.PORT || 8787)
const hostname = process.env.HOST || '0.0.0.0'

serve({ fetch: app.fetch, port, hostname }, () => {
  console.log(`[PostYar] listening on http://${hostname}:${port}`)

  // In-process scheduler: check missed story/reel windows every minute
  const tickMs = Number(process.env.REMINDER_INTERVAL_MS || 60_000)
  setInterval(() => {
    void runMissedScheduleReminders()
      .then((r) => {
        if (r.sent > 0) console.log('[Reminders] sent', r.sent)
      })
      .catch((err) => console.error('[Reminders]', (err as Error).message))
  }, tickMs)
  console.log(`[Reminders] interval ${tickMs}ms`)

  // Live page sync: one connected page per tick, never while Instagram is cooling down.
  const syncTickMs = Math.max(60_000, Number(process.env.IG_SYNC_TICK_MS || 5 * 60_000))
  if (process.env.IG_SYNC_DISABLED !== '1') {
    setInterval(() => {
      void syncDueConnectedPages()
        .then((r) => {
          if (r.synced > 0) console.log('[PageSync] synced', r.synced)
        })
        .catch((err) => console.error('[PageSync]', (err as Error).message))
    }, syncTickMs)
    console.log(`[PageSync] tick ${syncTickMs}ms · per-page interval ${pageSyncIntervalMs()}ms`)
  }
})

export default app
