import { Hono } from 'hono'
import { db, uid } from '../db/index.js'
import { assertWorkspaceAccess, requireAuth } from '../middleware/auth.js'

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
  if (!body.name?.trim()) return c.json({ error: 'نام پروژه الزامی است' }, 400)
  const id = uid('prj')
  const now = new Date().toISOString()
  db.prepare(
    `INSERT INTO projects (id, workspace_id, name, client_name, description, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(id, workspaceId, body.name.trim(), body.clientName || null, body.description || null, now)
  const row = db.prepare(`SELECT * FROM projects WHERE id = ?`).get(id)
  return c.json({ item: mapProject(row) }, 201)
})

projectRoutes.patch('/:id', async (c) => {
  const id = c.req.param('id')
  const existing = db.prepare(`SELECT * FROM projects WHERE id = ?`).get(id) as Record<string, unknown> | undefined
  if (!existing) return c.json({ error: 'پروژه پیدا نشد' }, 404)
  assertWorkspaceAccess(c, String(existing.workspace_id))
  const body = await c.req.json()
  db.prepare(
    `UPDATE projects SET name = ?, client_name = ?, description = ? WHERE id = ?`,
  ).run(
    body.name ?? existing.name,
    body.clientName ?? existing.client_name,
    body.description ?? existing.description,
    id,
  )
  return c.json({ item: mapProject(db.prepare(`SELECT * FROM projects WHERE id = ?`).get(id)) })
})

projectRoutes.delete('/:id', (c) => {
  const id = c.req.param('id')
  const existing = db.prepare(`SELECT * FROM projects WHERE id = ?`).get(id) as Record<string, unknown> | undefined
  if (!existing) return c.json({ error: 'پروژه پیدا نشد' }, 404)
  assertWorkspaceAccess(c, String(existing.workspace_id))
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
    description: r.description,
    createdAt: r.created_at,
  }
}
