import { Hono } from 'hono'
import { safeJson } from '../lib/secrets.js'
import { db, uid } from '../db/index.js'
import { assertWorkspaceAccess, requireAuth } from '../middleware/auth.js'
import { resolveProjectId } from '../lib/refs.js'

export const campaignRoutes = new Hono()
campaignRoutes.use('*', requireAuth)

campaignRoutes.get('/', (c) => {
  const workspaceId = c.req.query('workspaceId') || c.get('workspaceId')
  assertWorkspaceAccess(c, workspaceId)
  const rows = db
    .prepare(`SELECT * FROM campaigns WHERE workspace_id = ? ORDER BY created_at DESC`)
    .all(workspaceId)
  return c.json({ items: rows.map(mapCampaign) })
})

campaignRoutes.post('/', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const workspaceId = body.workspaceId || c.get('workspaceId')
  assertWorkspaceAccess(c, workspaceId)
  if (!body.name?.trim()) return c.json({ error: 'نام کمپین الزامی است' }, 400)
  const project = resolveProjectId(workspaceId, body.projectId)
  if (project.error) return c.json({ error: project.error }, 400)
  const id = uid('cmp')
  const now = new Date().toISOString()
  try {
    db.prepare(
      `INSERT INTO campaigns (
      id, workspace_id, project_id, name, goal, status, platforms, start_date, end_date, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      workspaceId,
      project.id,
      body.name.trim(),
      body.goal || null,
      body.status || 'draft',
      JSON.stringify(body.platforms || ['instagram']),
      body.startDate || null,
      body.endDate || null,
      now,
    )
  } catch (err) {
    console.error('[Campaign] create failed', (err as Error).message)
    return c.json({ error: 'ذخیره کمپین ناموفق بود. پیج را دوباره انتخاب کنید.' }, 400)
  }
  return c.json({ item: mapCampaign(db.prepare(`SELECT * FROM campaigns WHERE id = ?`).get(id)) }, 201)
})

campaignRoutes.patch('/:id', async (c) => {
  const id = c.req.param('id')
  const existing = db.prepare(`SELECT * FROM campaigns WHERE id = ?`).get(id) as Record<string, unknown> | undefined
  if (!existing) return c.json({ error: 'کمپین پیدا نشد' }, 404)
  assertWorkspaceAccess(c, String(existing.workspace_id))
  const body = await c.req.json().catch(() => ({}))
  const project =
    body.projectId !== undefined
      ? resolveProjectId(String(existing.workspace_id), body.projectId)
      : { id: (existing.project_id as string | null) || null }
  if (project.error) return c.json({ error: project.error }, 400)
  db.prepare(
    `UPDATE campaigns SET name = ?, goal = ?, status = ?, platforms = ?, project_id = ?,
      start_date = ?, end_date = ? WHERE id = ?`,
  ).run(
    body.name ?? existing.name,
    body.goal ?? existing.goal,
    body.status ?? existing.status,
    JSON.stringify(body.platforms ?? safeJson<string[]>(existing.platforms, [])),
    project.id,
    body.startDate ?? existing.start_date,
    body.endDate ?? existing.end_date,
    id,
  )
  return c.json({ item: mapCampaign(db.prepare(`SELECT * FROM campaigns WHERE id = ?`).get(id)) })
})

campaignRoutes.delete('/:id', (c) => {
  const id = c.req.param('id')
  const existing = db.prepare(`SELECT * FROM campaigns WHERE id = ?`).get(id) as Record<string, unknown> | undefined
  if (!existing) return c.json({ error: 'کمپین پیدا نشد' }, 404)
  assertWorkspaceAccess(c, String(existing.workspace_id))
  db.prepare(`DELETE FROM campaigns WHERE id = ?`).run(id)
  return c.json({ ok: true })
})

function mapCampaign(row: unknown) {
  const r = row as Record<string, unknown>
  return {
    id: r.id,
    workspaceId: r.workspace_id,
    projectId: r.project_id,
    name: r.name,
    goal: r.goal,
    status: r.status,
    platforms: safeJson<string[]>(r.platforms, []),
    startDate: r.start_date,
    endDate: r.end_date,
    createdAt: r.created_at,
  }
}
