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

  // Same-origin / tunnel / reverse-proxy: reflect allowed request Origin when listed or when unset in prod with publicUrl match
  return (origin) => {
    if (!origin) return publicUrl || 'http://127.0.0.1:8080'
    if (allow.has(origin)) return origin
    // Allow any https origin that matches AUTH_PUBLIC_URL host (tunnels)
    if (publicUrl && origin === publicUrl) return origin
    if (!isProd) return origin
    return null
  }
}

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
    telegramConfigured: Boolean(process.env.TELEGRAM_BOT_TOKEN),
    mode: isProd ? 'production' : 'development',
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
  const status = err.message.includes('مجاز نیست') ? 403 : 500
  return c.json({ error: err.message || 'خطای سرور' }, status)
})

const port = Number(process.env.PORT || 8787)
const hostname = process.env.HOST || '0.0.0.0'

serve({ fetch: app.fetch, port, hostname }, () => {
  console.log(`[PostYar] listening on http://${hostname}:${port}`)
})

export default app
