import { Hono } from 'hono'
import { db, uid } from '../db/index.js'
import { assertWorkspaceAccess, requireAuth } from '../middleware/auth.js'

export const contentRoutes = new Hono()
contentRoutes.use('*', requireAuth)

contentRoutes.get('/', (c) => {
  const workspaceId = c.req.query('workspaceId') || c.get('workspaceId')
  assertWorkspaceAccess(c, workspaceId)

  const status = c.req.query('status')
  const rows = status
    ? db
        .prepare(
          `SELECT * FROM contents WHERE workspace_id = ? AND status = ? ORDER BY updated_at DESC`,
        )
        .all(workspaceId, status)
    : db
        .prepare(`SELECT * FROM contents WHERE workspace_id = ? ORDER BY updated_at DESC`)
        .all(workspaceId)

  return c.json({ items: rows.map(mapContent) })
})

contentRoutes.get('/:id/assets', (c) => {
  const id = c.req.param('id')
  const content = db.prepare(`SELECT * FROM contents WHERE id = ?`).get(id) as Record<string, unknown> | undefined
  if (!content) return c.json({ error: 'محتوا پیدا نشد' }, 404)
  assertWorkspaceAccess(c, String(content.workspace_id))

  const rows = db
    .prepare(
      `SELECT a.*, ca.role AS attach_role, ca.sort_order, ca.id AS link_id
       FROM content_assets ca
       JOIN assets a ON a.id = ca.asset_id
       WHERE ca.content_id = ?
       ORDER BY ca.sort_order ASC, a.created_at DESC`,
    )
    .all(id)

  return c.json({
    items: rows.map((row) => {
      const r = row as Record<string, unknown>
      return {
        linkId: r.link_id,
        role: r.attach_role,
        sortOrder: r.sort_order,
        id: r.id,
        filename: r.filename,
        type: r.type,
        status: r.status,
        fileSize: r.file_size,
        width: r.width,
        height: r.height,
      }
    }),
  })
})

contentRoutes.post('/', async (c) => {
  const body = await c.req.json()
  const now = new Date().toISOString()
  const id = uid('cnt')
  const workspaceId = body.workspaceId || c.get('workspaceId')
  assertWorkspaceAccess(c, workspaceId)

  if (!body.title || !body.contentType) {
    return c.json({ error: 'title و contentType الزامی هستند' }, 400)
  }

  const status = body.status || 'planned'
  db.prepare(
    `INSERT INTO contents (
      id, workspace_id, project_id, campaign_id, assignee_id, title, description,
      platforms, content_type, status, publish_date, publish_time, caption, hashtags,
      notes, ai_meta, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    workspaceId,
    body.projectId || null,
    body.campaignId || null,
    body.assigneeId || null,
    body.title,
    body.description || null,
    JSON.stringify(body.platforms || ['instagram']),
    body.contentType,
    status,
    body.publishDate || null,
    body.publishTime || null,
    body.caption || null,
    JSON.stringify(body.hashtags || []),
    body.notes || null,
    JSON.stringify(body.aiMeta || {}),
    now,
    now,
  )

  db.prepare(
    `INSERT INTO content_status_history (id, content_id, from_status, to_status, changed_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(uid('csh'), id, null, status, c.get('userId'), now)

  const row = db.prepare(`SELECT * FROM contents WHERE id = ?`).get(id)
  return c.json({ item: mapContent(row) }, 201)
})

contentRoutes.patch('/:id', async (c) => {
  const id = c.req.param('id')
  const existing = db.prepare(`SELECT * FROM contents WHERE id = ?`).get(id) as Record<string, unknown> | undefined
  if (!existing) return c.json({ error: 'محتوا پیدا نشد' }, 404)
  assertWorkspaceAccess(c, String(existing.workspace_id))

  const body = await c.req.json()
  const now = new Date().toISOString()
  const nextStatus = body.status ?? existing.status

  if (body.status && body.status !== existing.status) {
    db.prepare(
      `INSERT INTO content_status_history (id, content_id, from_status, to_status, changed_by, note, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(uid('csh'), id, existing.status, body.status, c.get('userId'), body.statusNote || null, now)
  }

  db.prepare(
    `UPDATE contents SET
      title = ?, description = ?, platforms = ?, content_type = ?, status = ?,
      publish_date = ?, publish_time = ?, caption = ?, hashtags = ?, notes = ?,
      project_id = ?, campaign_id = ?, updated_at = ?
     WHERE id = ?`,
  ).run(
    body.title ?? existing.title,
    body.description ?? existing.description,
    JSON.stringify(body.platforms ?? JSON.parse(String(existing.platforms || '[]'))),
    body.contentType ?? existing.content_type,
    nextStatus,
    body.publishDate ?? existing.publish_date,
    body.publishTime ?? existing.publish_time,
    body.caption ?? existing.caption,
    JSON.stringify(body.hashtags ?? JSON.parse(String(existing.hashtags || '[]'))),
    body.notes ?? existing.notes,
    body.projectId ?? existing.project_id,
    body.campaignId ?? existing.campaign_id,
    now,
    id,
  )

  const row = db.prepare(`SELECT * FROM contents WHERE id = ?`).get(id)
  return c.json({ item: mapContent(row) })
})

contentRoutes.delete('/:id', (c) => {
  const id = c.req.param('id')
  const existing = db.prepare(`SELECT * FROM contents WHERE id = ?`).get(id) as Record<string, unknown> | undefined
  if (!existing) return c.json({ error: 'محتوا پیدا نشد' }, 404)
  assertWorkspaceAccess(c, String(existing.workspace_id))
  db.prepare(`DELETE FROM contents WHERE id = ?`).run(id)
  return c.json({ ok: true })
})

function mapContent(row: unknown) {
  const r = row as Record<string, unknown>
  return {
    id: r.id,
    workspaceId: r.workspace_id,
    projectId: r.project_id,
    campaignId: r.campaign_id,
    assigneeId: r.assignee_id,
    title: r.title,
    description: r.description,
    platforms: JSON.parse(String(r.platforms || '[]')),
    contentType: r.content_type,
    status: r.status,
    publishDate: r.publish_date,
    publishTime: r.publish_time,
    caption: r.caption,
    hashtags: JSON.parse(String(r.hashtags || '[]')),
    notes: r.notes,
    aiMeta: JSON.parse(String(r.ai_meta || '{}')),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}
