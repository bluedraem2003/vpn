import { Hono } from 'hono'
import { db } from '../db/index.js'
import { assertWorkspaceAccess, requireAuth } from '../middleware/auth.js'

export const notificationRoutes = new Hono()
notificationRoutes.use('*', requireAuth)

function mapRow(r: Record<string, unknown>) {
  let meta: Record<string, unknown> = {}
  try {
    meta = JSON.parse(String(r.meta || '{}'))
  } catch {
    meta = {}
  }
  return {
    id: r.id,
    projectId: r.project_id || null,
    handle: r.handle || null,
    kind: r.kind,
    title: r.title,
    body: r.body || null,
    url: r.url || null,
    meta,
    readAt: r.read_at || null,
    createdAt: r.created_at,
  }
}

notificationRoutes.get('/', (c) => {
  const workspaceId = c.req.query('workspaceId') || c.get('workspaceId')
  assertWorkspaceAccess(c, workspaceId)
  const unreadOnly = c.req.query('unread') === '1'
  const limit = Math.min(Math.max(Number(c.req.query('limit') || 50), 1), 200)
  const rows = db
    .prepare(
      `SELECT * FROM notifications
       WHERE workspace_id = ? ${unreadOnly ? 'AND read_at IS NULL' : ''}
       ORDER BY created_at DESC LIMIT ?`,
    )
    .all(workspaceId, limit) as Array<Record<string, unknown>>
  const unread = (
    db
      .prepare(`SELECT COUNT(*) AS c FROM notifications WHERE workspace_id = ? AND read_at IS NULL`)
      .get(workspaceId) as { c: number }
  ).c
  return c.json({ items: rows.map(mapRow), unreadCount: unread })
})

notificationRoutes.post('/read', async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { workspaceId?: string; ids?: string[]; all?: boolean }
  const workspaceId = body.workspaceId || c.get('workspaceId')
  assertWorkspaceAccess(c, workspaceId)
  const now = new Date().toISOString()
  if (body.all) {
    db.prepare(`UPDATE notifications SET read_at = ? WHERE workspace_id = ? AND read_at IS NULL`).run(now, workspaceId)
  } else if (Array.isArray(body.ids) && body.ids.length) {
    const stmt = db.prepare(`UPDATE notifications SET read_at = ? WHERE workspace_id = ? AND id = ? AND read_at IS NULL`)
    const tx = db.transaction(() => {
      for (const id of body.ids!.slice(0, 200)) stmt.run(now, workspaceId, String(id))
    })
    tx()
  }
  const unread = (
    db
      .prepare(`SELECT COUNT(*) AS c FROM notifications WHERE workspace_id = ? AND read_at IS NULL`)
      .get(workspaceId) as { c: number }
  ).c
  return c.json({ ok: true, unreadCount: unread })
})

notificationRoutes.delete('/:id', (c) => {
  const id = c.req.param('id')
  const row = db.prepare(`SELECT workspace_id FROM notifications WHERE id = ?`).get(id) as
    | { workspace_id: string }
    | undefined
  if (!row) return c.json({ error: 'not_found', code: 'not_found' }, 404)
  assertWorkspaceAccess(c, row.workspace_id)
  db.prepare(`DELETE FROM notifications WHERE id = ?`).run(id)
  return c.json({ ok: true })
})
