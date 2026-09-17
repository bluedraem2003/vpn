import { Hono } from 'hono'
import { db, uid } from '../db/index.js'

export const contentRoutes = new Hono()

contentRoutes.get('/', (c) => {
  const workspaceId = c.req.query('workspaceId')
  if (!workspaceId) return c.json({ error: 'workspaceId الزامی است' }, 400)

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

contentRoutes.post('/', async (c) => {
  const body = await c.req.json()
  const now = new Date().toISOString()
  const id = uid('cnt')

  if (!body.workspaceId || !body.title || !body.contentType) {
    return c.json({ error: 'workspaceId، title و contentType الزامی هستند' }, 400)
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
    body.workspaceId,
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
    `INSERT INTO content_status_history (id, content_id, from_status, to_status, created_at)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(uid('csh'), id, null, status, now)

  const row = db.prepare(`SELECT * FROM contents WHERE id = ?`).get(id)
  return c.json({ item: mapContent(row) }, 201)
})

contentRoutes.patch('/:id', async (c) => {
  const id = c.req.param('id')
  const existing = db.prepare(`SELECT * FROM contents WHERE id = ?`).get(id) as Record<string, unknown> | undefined
  if (!existing) return c.json({ error: 'محتوا پیدا نشد' }, 404)

  const body = await c.req.json()
  const now = new Date().toISOString()
  const nextStatus = body.status ?? existing.status

  if (body.status && body.status !== existing.status) {
    db.prepare(
      `INSERT INTO content_status_history (id, content_id, from_status, to_status, note, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(uid('csh'), id, existing.status, body.status, body.statusNote || null, now)
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
