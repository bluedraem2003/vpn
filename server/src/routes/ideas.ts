import { Hono } from 'hono'
import { safeJson } from '../lib/secrets.js'
import { db, uid } from '../db/index.js'
import { assertWorkspaceAccess, requireAuth } from '../middleware/auth.js'

export const ideaRoutes = new Hono()
ideaRoutes.use('*', requireAuth)

ideaRoutes.get('/', (c) => {
  const workspaceId = c.req.query('workspaceId') || c.get('workspaceId')
  assertWorkspaceAccess(c, workspaceId)
  const rows = db
    .prepare(`SELECT * FROM ideas WHERE workspace_id = ? ORDER BY created_at DESC`)
    .all(workspaceId)
  return c.json({ items: rows.map(mapIdea) })
})

ideaRoutes.post('/', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const workspaceId = body.workspaceId || c.get('workspaceId')
  assertWorkspaceAccess(c, workspaceId)
  if (!body.title?.trim()) return c.json({ error: 'عنوان ایده الزامی است' }, 400)
  const id = uid('idea')
  const now = new Date().toISOString()
  db.prepare(
    `INSERT INTO ideas (
      id, workspace_id, title, description, reference, platforms, content_type,
      priority, tags, notes, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    workspaceId,
    body.title.trim(),
    body.description || null,
    body.reference || null,
    JSON.stringify(body.platforms || ['instagram']),
    body.contentType || null,
    body.priority || 'medium',
    JSON.stringify(body.tags || []),
    body.notes || null,
    now,
  )
  return c.json({ item: mapIdea(db.prepare(`SELECT * FROM ideas WHERE id = ?`).get(id)) }, 201)
})

ideaRoutes.post('/:id/convert', async (c) => {
  const id = c.req.param('id')
  const idea = db.prepare(`SELECT * FROM ideas WHERE id = ?`).get(id) as Record<string, unknown> | undefined
  if (!idea) return c.json({ error: 'ایده پیدا نشد' }, 404)
  assertWorkspaceAccess(c, String(idea.workspace_id))
  if (idea.converted_content_id) {
    return c.json({ error: 'این ایده قبلاً به محتوا تبدیل شده', contentId: idea.converted_content_id }, 409)
  }

  const body = await c.req.json().catch(() => ({} as Record<string, unknown>))
  let projectId: string | null = body.projectId ? String(body.projectId) : null
  if (projectId) {
    const project = db
      .prepare(`SELECT id FROM projects WHERE id = ? AND workspace_id = ?`)
      .get(projectId, idea.workspace_id)
    if (!project) return c.json({ error: 'پیج نامعتبر است' }, 400)
  } else {
    const pages = db
      .prepare(`SELECT id FROM projects WHERE workspace_id = ? ORDER BY created_at DESC`)
      .all(idea.workspace_id) as Array<{ id: string }>
    if (pages.length === 1) projectId = pages[0]!.id
  }

  const now = new Date().toISOString()
  const contentId = uid('cnt')
  const status = 'planned'
  const caption = idea.description ? String(idea.description) : null
  db.prepare(
    `INSERT INTO contents (
      id, workspace_id, project_id, title, description, platforms, content_type, status,
      caption, hashtags, notes, ai_meta, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, '[]', ?, '{}', ?, ?)`,
  ).run(
    contentId,
    idea.workspace_id,
    projectId,
    idea.title,
    idea.description,
    idea.platforms,
    idea.content_type || 'reel',
    status,
    caption,
    idea.notes,
    now,
    now,
  )
  db.prepare(
    `INSERT INTO content_status_history (id, content_id, from_status, to_status, created_at)
     VALUES (?, ?, NULL, ?, ?)`,
  ).run(uid('csh'), contentId, status, now)
  db.prepare(`UPDATE ideas SET converted_content_id = ? WHERE id = ?`).run(contentId, id)

  return c.json({
    ok: true,
    contentId,
    idea: mapIdea(db.prepare(`SELECT * FROM ideas WHERE id = ?`).get(id)),
  })
})

ideaRoutes.delete('/:id', (c) => {
  const id = c.req.param('id')
  const idea = db.prepare(`SELECT * FROM ideas WHERE id = ?`).get(id) as Record<string, unknown> | undefined
  if (!idea) return c.json({ error: 'ایده پیدا نشد' }, 404)
  assertWorkspaceAccess(c, String(idea.workspace_id))
  db.prepare(`DELETE FROM ideas WHERE id = ?`).run(id)
  return c.json({ ok: true })
})

function mapIdea(row: unknown) {
  const r = row as Record<string, unknown>
  return {
    id: r.id,
    workspaceId: r.workspace_id,
    title: r.title,
    description: r.description,
    reference: r.reference,
    platforms: safeJson<string[]>(r.platforms, []),
    contentType: r.content_type,
    priority: r.priority,
    tags: safeJson<string[]>(r.tags, []),
    notes: r.notes,
    convertedContentId: r.converted_content_id,
    createdAt: r.created_at,
  }
}
