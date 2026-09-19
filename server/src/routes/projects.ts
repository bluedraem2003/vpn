import { Hono } from 'hono'
import { db, uid } from '../db/index.js'
import { assertWorkspaceAccess, requireAuth } from '../middleware/auth.js'
import { hitRateLimit } from '../middleware/rateLimit.js'
import { parseHashtags } from '../lib/hashtags.js'
import { normalizeHandle } from '../lib/instagramSearch.js'
import { mapProjectSync, projectHandle, syncProject } from '../lib/pageSync.js'

export const projectRoutes = new Hono()
projectRoutes.use('*', requireAuth)

function cleanHandle(raw: unknown) {
  const h = normalizeHandle(String(raw || ''))
  return h ? h.toLowerCase() : null
}

function findProject(id: string) {
  return db.prepare(`SELECT * FROM projects WHERE id = ?`).get(id) as Record<string, unknown> | undefined
}

function duplicateHandle(workspaceId: string, handle: string | null, exceptId?: string) {
  if (!handle) return false
  const row = db
    .prepare(
      `SELECT id FROM projects
       WHERE workspace_id = ? AND lower(COALESCE(handle, client_name, '')) = ? ${exceptId ? 'AND id <> ?' : ''}
       LIMIT 1`,
    )
    .get(...(exceptId ? [workspaceId, handle, exceptId] : [workspaceId, handle]))
  return Boolean(row)
}

projectRoutes.get('/', (c) => {
  const workspaceId = c.req.query('workspaceId') || c.get('workspaceId')
  assertWorkspaceAccess(c, workspaceId)
  const rows = db
    .prepare(`SELECT * FROM projects WHERE workspace_id = ? ORDER BY created_at DESC`)
    .all(workspaceId)
  return c.json({ items: rows.map(mapProject) })
})

projectRoutes.get('/:id', (c) => {
  const existing = findProject(c.req.param('id'))
  if (!existing) return c.json({ error: 'پیج پیدا نشد', code: 'not_found' }, 404)
  assertWorkspaceAccess(c, String(existing.workspace_id))
  return c.json({ item: mapProject(existing) })
})

projectRoutes.post('/', async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>
  const workspaceId = String(body.workspaceId || c.get('workspaceId'))
  assertWorkspaceAccess(c, workspaceId)
  const handle = cleanHandle(body.handle || body.clientName)
  const name = String(body.name || '').trim() || handle || ''
  if (!name) return c.json({ error: 'نام پیج الزامی است', code: 'need_name' }, 400)
  if (duplicateHandle(workspaceId, handle)) {
    return c.json({ error: 'این پیج قبلاً به ورک‌اسپیس وصل شده', code: 'duplicate' }, 409)
  }
  const id = uid('prj')
  const now = new Date().toISOString()
  db.prepare(
    `INSERT INTO projects (
      id, workspace_id, name, client_name, description, niche, audience, voice, handle,
      notes, window_start, window_end, hashtags, created_at, ig_sync_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    workspaceId,
    name,
    handle,
    (body.description as string) || (body.notes as string) || null,
    (body.niche as string) || null,
    (body.audience as string) || null,
    (body.voice as string) || null,
    handle,
    (body.notes as string) || null,
    (body.windowStart as string) || null,
    (body.windowEnd as string) || null,
    JSON.stringify(parseHashtags(body.hashtags as string[] | string | undefined)),
    now,
    handle ? 'pending' : null,
  )

  // Connect for real: one live fetch, no retries. Failure still saves the page.
  let sync: Awaited<ReturnType<typeof syncProject>> | null = null
  const created = findProject(id)!
  if (handle) sync = await syncProject(created, { reason: 'connect' })
  return c.json({ item: mapProject(findProject(id)), sync: summarizeSync(sync) }, 201)
})

projectRoutes.post('/:id/sync', async (c) => {
  const existing = findProject(c.req.param('id'))
  if (!existing) return c.json({ error: 'پیج پیدا نشد', code: 'not_found' }, 404)
  assertWorkspaceAccess(c, String(existing.workspace_id))
  if (!projectHandle(existing)) return c.json({ error: 'این پیج آیدی اینستاگرام ندارد', code: 'no_handle' }, 400)
  if (hitRateLimit(`pagesync:${c.get('userId')}`, 6, 60_000)) {
    return c.json({ error: 'کمی صبر کن و دوباره همگام‌سازی کن', code: 'busy' }, 429)
  }
  const sync = await syncProject(existing, { reason: 'manual' })
  const item = mapProject(findProject(String(existing.id)))
  if (!sync.ok) {
    if (sync.retryInSec) c.header('Retry-After', String(sync.retryInSec))
    const code = sync.code === 'rate_limit' ? 'ig_busy' : sync.code
    return c.json({
      item,
      sync: summarizeSync(sync),
      code,
      error: syncMessage(sync.code),
    })
  }
  return c.json({ item, sync: summarizeSync(sync) })
})

projectRoutes.patch('/:id', async (c) => {
  const id = c.req.param('id')
  const existing = findProject(id)
  if (!existing) return c.json({ error: 'پیج پیدا نشد', code: 'not_found' }, 404)
  assertWorkspaceAccess(c, String(existing.workspace_id))
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>
  const nextHandle =
    body.handle !== undefined || body.clientName !== undefined
      ? cleanHandle(body.handle ?? body.clientName)
      : cleanHandle(existing.handle ?? existing.client_name)
  if (duplicateHandle(String(existing.workspace_id), nextHandle, id)) {
    return c.json({ error: 'این پیج قبلاً به ورک‌اسپیس وصل شده', code: 'duplicate' }, 409)
  }
  const handleChanged = nextHandle !== cleanHandle(existing.handle ?? existing.client_name)
  db.prepare(
    `UPDATE projects SET name = ?, client_name = ?, description = ?, niche = ?, audience = ?, voice = ?, handle = ?,
      notes = ?, window_start = ?, window_end = ?, hashtags = ?
      ${handleChanged ? ', ig_state = NULL, ig_last_synced_at = NULL, ig_connected_at = NULL, ig_sync_status = ?, ig_sync_error = NULL' : ''}
     WHERE id = ?`,
  ).run(
    ...[
      (body.name as string) ?? existing.name,
      nextHandle,
      (body.description as string) ?? existing.description,
      (body.niche as string) ?? existing.niche,
      (body.audience as string) ?? existing.audience,
      (body.voice as string) ?? existing.voice,
      nextHandle,
      (body.notes as string) ?? existing.notes,
      (body.windowStart as string) ?? existing.window_start,
      (body.windowEnd as string) ?? existing.window_end,
      JSON.stringify(
        body.hashtags !== undefined
          ? parseHashtags(body.hashtags as string[] | string)
          : parseHashtags(existing.hashtags as string),
      ),
      ...(handleChanged ? [nextHandle ? 'pending' : null] : []),
      id,
    ],
  )
  let sync: Awaited<ReturnType<typeof syncProject>> | null = null
  if (handleChanged && nextHandle) sync = await syncProject(findProject(id)!, { reason: 'connect' })
  return c.json({ item: mapProject(findProject(id)), sync: summarizeSync(sync) })
})

projectRoutes.delete('/:id', (c) => {
  const id = c.req.param('id')
  const existing = findProject(id)
  if (!existing) return c.json({ error: 'پیج پیدا نشد', code: 'not_found' }, 404)
  assertWorkspaceAccess(c, String(existing.workspace_id))
  const tx = db.transaction(() => {
    db.prepare(`UPDATE contents SET project_id = NULL WHERE project_id = ?`).run(id)
    db.prepare(`UPDATE campaigns SET project_id = NULL WHERE project_id = ?`).run(id)
    db.prepare(`DELETE FROM project_occasions WHERE project_id = ?`).run(id)
    db.prepare(`DELETE FROM notifications WHERE project_id = ?`).run(id)
    db.prepare(`DELETE FROM projects WHERE id = ?`).run(id)
  })
  tx()
  return c.json({ ok: true })
})

function syncMessage(code: string) {
  if (code === 'rate_limit') return 'اینستاگرام موقتاً محدود کرده؛ چند دقیقه بعد دوباره همگام‌سازی کن.'
  if (code === 'not_found') return 'این آیدی در اینستاگرام پیدا نشد یا خصوصی است.'
  if (code === 'no_handle') return 'این پیج آیدی اینستاگرام ندارد.'
  return 'اینستاگرام الان در دسترس نبود. همگام‌سازی بعدی خودکار است.'
}

function summarizeSync(sync: Awaited<ReturnType<typeof syncProject>> | null) {
  if (!sync) return null
  if (!sync.ok) return { ok: false, status: sync.status, code: sync.code, retryInSec: sync.retryInSec }
  return {
    ok: true,
    status: sync.status,
    cached: sync.cached,
    events: sync.events.map((e) => ({ kind: e.kind, meta: e.meta, url: e.url })),
  }
}

export function mapProject(row: unknown) {
  const r = row as Record<string, unknown>
  return {
    id: r.id,
    workspaceId: r.workspace_id,
    name: r.name,
    clientName: r.client_name,
    handle: r.handle || r.client_name || null,
    description: r.description,
    niche: r.niche || null,
    audience: r.audience || null,
    voice: r.voice || null,
    notes: r.notes || null,
    windowStart: r.window_start || null,
    windowEnd: r.window_end || null,
    hashtags: parseHashtags(r.hashtags as string),
    createdAt: r.created_at,
    ...mapProjectSync(r),
  }
}
