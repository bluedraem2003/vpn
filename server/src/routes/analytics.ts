import { Hono } from 'hono'
import { db } from '../db/index.js'
import { assertWorkspaceAccess, requireAuth } from '../middleware/auth.js'
import { hitRateLimit } from '../middleware/rateLimit.js'
import {
  analyzeInstagramPage,
  analyticsConnectors,
  fetchMetaInsights,
  fetchSupermetricsInsights,
} from '../lib/pageInsights.js'
import { enrichPage } from '../lib/pageEnrichment.js'
import { recordPageSnapshot } from '../lib/pageSnapshots.js'
import { normalizeHandle } from '../lib/instagramSearch.js'

export const analyticsRoutes = new Hono()
analyticsRoutes.use('*', requireAuth)

analyticsRoutes.get('/connectors', (c) => c.json({ items: analyticsConnectors() }))

analyticsRoutes.get('/page', async (c) => {
  if (hitRateLimit(`iginsights:${c.get('userId')}`, 20, 60_000)) {
    return c.json({ error: 'کمی صبر کن و دوباره تحلیل را بگیر', code: 'busy' }, 429)
  }
  const workspaceId = c.req.query('workspaceId') || c.get('workspaceId')
  assertWorkspaceAccess(c, workspaceId)
  const handle = normalizeHandle(c.req.query('handle') || '')
  if (!handle) return c.json({ error: 'آیدی پیج را بنویس', code: 'need_handle' }, 400)

  const analyzed = await analyzeInstagramPage(handle, { fresh: c.req.query('fresh') === '1' })
  if (!analyzed.ok) {
    const code = analyzed.error.code
    if (code === 'rate_limit') {
      return c.json({ error: 'اینستاگرام موقتاً محدود کرده؛ حدود یک دقیقه بعد دوباره تحلیل بگیر', code: 'ig_busy' }, 429)
    }
    if (code === 'unavailable') {
      return c.json({ error: 'الان اینستاگرام پاسخ نداد. چند ثانیه بعد دوباره تلاش کن', code: 'ig_unavailable' }, 503)
    }
    return c.json({ error: 'این پیج در اینستاگرام پیدا نشد یا خصوصی است', code: 'not_found' }, 404)
  }
  const page = analyzed.data

  const [supermetrics, meta, enrichment] = await Promise.all([
    fetchSupermetricsInsights(handle),
    fetchMetaInsights(),
    enrichPage(page),
  ])
  const growth = recordPageSnapshot(workspaceId, page)

  return c.json({
    page,
    growth,
    enrichment,
    connectors: analyticsConnectors({ hasWebsite: Boolean(page.website) }),
    supermetrics: supermetrics.ok ? supermetrics : { ok: false, error: supermetrics.error },
    meta: meta.ok ? meta : { ok: false, error: meta.error },
  })
})


analyticsRoutes.get('/', (c) => {
  const workspaceId = c.req.query('workspaceId') || c.get('workspaceId')
  assertWorkspaceAccess(c, workspaceId)

  const today = new Date().toISOString().slice(0, 10)
  const day30 = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)

  const byStatus = db
    .prepare(`SELECT status, COUNT(*) AS c FROM contents WHERE workspace_id = ? GROUP BY status`)
    .all(workspaceId) as { status: string; c: number }[]

  const byType = db
    .prepare(`SELECT content_type AS type, COUNT(*) AS c FROM contents WHERE workspace_id = ? GROUP BY content_type`)
    .all(workspaceId) as { type: string; c: number }[]

  const contents = db
    .prepare(`SELECT platforms, status, publish_date FROM contents WHERE workspace_id = ?`)
    .all(workspaceId) as Array<{ platforms: string; status: string; publish_date: string | null }>

  const platformCounts: Record<string, number> = {}
  for (const row of contents) {
    const platforms = JSON.parse(row.platforms || '[]') as string[]
    for (const p of platforms) platformCounts[p] = (platformCounts[p] || 0) + 1
  }

  const publishedLast30 = contents.filter(
    (x) => x.status === 'published' && x.publish_date && x.publish_date >= day30,
  ).length

  const scheduledUpcoming = contents.filter(
    (x) => x.publish_date && x.publish_date >= today && !['published', 'archived'].includes(x.status),
  ).length

  const overdue = contents.filter(
    (x) => x.publish_date && x.publish_date < today && !['published', 'archived'].includes(x.status),
  ).length

  const assetByType = db
    .prepare(`SELECT type, COUNT(*) AS c FROM assets WHERE workspace_id = ? GROUP BY type`)
    .all(workspaceId) as { type: string; c: number }[]

  const assetStorage = db
    .prepare(
      `SELECT COALESCE(SUM(file_size), 0) AS bytes, COUNT(*) AS files FROM assets WHERE workspace_id = ?`,
    )
    .get(workspaceId) as { bytes: number; files: number }

  const funnel = db
    .prepare(
      `SELECT to_status AS status, COUNT(*) AS c
       FROM content_status_history h
       JOIN contents c ON c.id = h.content_id
       WHERE c.workspace_id = ? AND h.created_at >= ?
       GROUP BY to_status`,
    )
    .all(workspaceId, day30) as { status: string; c: number }[]

  const recentPublished = db
    .prepare(
      `SELECT id, title, content_type, publish_date, platforms, updated_at
       FROM contents
       WHERE workspace_id = ? AND status = 'published'
       ORDER BY updated_at DESC LIMIT 8`,
    )
    .all(workspaceId)

  const missingAssets = db
    .prepare(
      `SELECT c.id, c.title, c.status
       FROM contents c
       LEFT JOIN content_assets ca ON ca.content_id = c.id
       WHERE c.workspace_id = ?
         AND c.status IN ('in_production', 'in_review', 'ready', 'scheduled')
         AND ca.id IS NULL
       ORDER BY c.updated_at DESC LIMIT 10`,
    )
    .all(workspaceId)

  const total = contents.length || 1
  const published = contents.filter((x) => x.status === 'published').length

  return c.json({
    summary: {
      totalContent: contents.length,
      published,
      publishRate: Math.round((published / total) * 100),
      publishedLast30,
      scheduledUpcoming,
      overdue,
      assets: assetStorage.files,
      assetBytes: assetStorage.bytes,
    },
    byStatus: Object.fromEntries(byStatus.map((x) => [x.status, x.c])),
    byType: Object.fromEntries(byType.map((x) => [x.type, x.c])),
    byPlatform: platformCounts,
    assetByType: Object.fromEntries(assetByType.map((x) => [x.type, x.c])),
    statusFunnel30d: Object.fromEntries(funnel.map((x) => [x.status, x.c])),
    recentPublished: recentPublished.map((r) => {
      const row = r as Record<string, unknown>
      return {
        id: row.id,
        title: row.title,
        contentType: row.content_type,
        publishDate: row.publish_date,
        platforms: JSON.parse(String(row.platforms || '[]')),
        updatedAt: row.updated_at,
      }
    }),
    missingAssets,
    aiReadyHints: [
      'Detect missing assets before publish',
      'Suggest schedule from overdue + capacity',
      'Caption assist using content.ai_meta',
    ],
  })
})
