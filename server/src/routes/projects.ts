import { Hono } from 'hono'
import { db, uid } from '../db/index.js'
import { assertWorkspaceAccess, requireAuth } from '../middleware/auth.js'
import { parseHashtags } from '../lib/hashtags.js'

export const projectRoutes = new Hono()
projectRoutes.use('*', requireAuth)

projectRoutes.get('/', (c) => {
  const workspaceId = c.req.query('workspaceId') || c.get('workspaceId')
  assertWorkspaceAccess(c, workspaceId)
  const rows = db
    .prepare(`SELECT * FROM projects WHERE workspace_id = ? ORDER BY created_at DESC`)
    .all(workspaceId)
  return c.json({ items: rows.map(mapProject) })
})

projectRoutes.post('/', async (c) => {
  const body = await c.req.json()
  const workspaceId = body.workspaceId || c.get('workspaceId')
  assertWorkspaceAccess(c, workspaceId)
  if (!body.name?.trim()) return c.json({ error: 'نام پیج الزامی است' }, 400)
  const id = uid('prj')
  const now = new Date().toISOString()
  db.prepare(
    `INSERT INTO projects (
      id, workspace_id, name, client_name, description, niche, audience, voice, handle,
      notes, window_start, window_end, hashtags, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    workspaceId,
    body.name.trim(),
    body.clientName || body.handle || null,
    body.description || body.notes || null,
    body.niche || null,
    body.audience || null,
    body.voice || null,
    body.handle || body.clientName || null,
    body.notes || null,
    body.windowStart || null,
    body.windowEnd || null,
    JSON.stringify(parseHashtags(body.hashtags)),
    now,
  )
  const row = db.prepare(`SELECT * FROM projects WHERE id = ?`).get(id)
  return c.json({ item: mapProject(row) }, 201)
})

projectRoutes.patch('/:id', async (c) => {
  const id = c.req.param('id')
  const existing = db.prepare(`SELECT * FROM projects WHERE id = ?`).get(id) as Record<string, unknown> | undefined
  if (!existing) return c.json({ error: 'پیج پیدا نشد' }, 404)
  assertWorkspaceAccess(c, String(existing.workspace_id))
  const body = await c.req.json()
  db.prepare(
    `UPDATE projects SET name = ?, client_name = ?, description = ?, niche = ?, audience = ?, voice = ?, handle = ?,
      notes = ?, window_start = ?, window_end = ?, hashtags = ?
     WHERE id = ?`,
  ).run(
    body.name ?? existing.name,
    body.clientName ?? body.handle ?? existing.client_name,
    body.description ?? existing.description,
    body.niche ?? existing.niche,
    body.audience ?? existing.audience,
    body.voice ?? existing.voice,
    body.handle ?? body.clientName ?? existing.handle,
    body.notes ?? existing.notes,
    body.windowStart ?? existing.window_start,
    body.windowEnd ?? existing.window_end,
    JSON.stringify(body.hashtags !== undefined ? parseHashtags(body.hashtags) : parseHashtags(existing.hashtags)),
    id,
  )
  return c.json({ item: mapProject(db.prepare(`SELECT * FROM projects WHERE id = ?`).get(id)) })
})

projectRoutes.delete('/:id', (c) => {
  const id = c.req.param('id')
  const existing = db.prepare(`SELECT * FROM projects WHERE id = ?`).get(id) as Record<string, unknown> | undefined
  if (!existing) return c.json({ error: 'پیج پیدا نشد' }, 404)
  assertWorkspaceAccess(c, String(existing.workspace_id))
  // Clear content refs first so FK never blocks deletes
  db.prepare(`UPDATE contents SET project_id = NULL WHERE project_id = ?`).run(id)
  db.prepare(`UPDATE campaigns SET project_id = NULL WHERE project_id = ?`).run(id)
  db.prepare(`DELETE FROM project_occasions WHERE project_id = ?`).run(id)
  db.prepare(`DELETE FROM projects WHERE id = ?`).run(id)
  return c.json({ ok: true })
})

function mapProject(row: unknown) {
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
    hashtags: parseHashtags(r.hashtags),
    createdAt: r.created_at,
  }
}
