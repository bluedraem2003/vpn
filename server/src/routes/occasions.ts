import { Hono } from 'hono'
import { db, uid } from '../db/index.js'
import { assertWorkspaceAccess, requireAuth } from '../middleware/auth.js'
import { occasionDateInYear } from '../lib/jalaali.js'

export const occasionRoutes = new Hono()
occasionRoutes.use('*', requireAuth)

occasionRoutes.get('/', (c) => {
  const workspaceId = c.req.query('workspaceId') || c.get('workspaceId')
  assertWorkspaceAccess(c, workspaceId)

  const region = c.req.query('region') // ir | global | all
  const projectId = c.req.query('projectId')
  const year = Number(c.req.query('year') || new Date().getFullYear())

  let rows: unknown[]
  if (projectId) {
    const project = db.prepare(`SELECT * FROM projects WHERE id = ?`).get(projectId) as
      | Record<string, unknown>
      | undefined
    if (!project) return c.json({ error: 'پروژه پیدا نشد' }, 404)
    assertWorkspaceAccess(c, String(project.workspace_id))
    rows = db
      .prepare(
        `SELECT o.* FROM occasions o
         JOIN project_occasions po ON po.occasion_id = o.id
         WHERE po.project_id = ?
         ORDER BY o.region ASC, o.month ASC, o.day ASC`,
      )
      .all(projectId)
  } else {
    rows =
      region && region !== 'all'
        ? db
            .prepare(
              `SELECT * FROM occasions WHERE region = ? ORDER BY month ASC, day ASC, name_fa ASC`,
            )
            .all(region)
        : db.prepare(`SELECT * FROM occasions ORDER BY region ASC, month ASC, day ASC`).all()
  }

  const items = rows.map((row) => mapOccasion(row, year))
  return c.json({ items, year })
})

occasionRoutes.get('/calendar', (c) => {
  const workspaceId = c.req.query('workspaceId') || c.get('workspaceId')
  assertWorkspaceAccess(c, workspaceId)
  const year = Number(c.req.query('year') || new Date().getFullYear())
  const projectId = c.req.query('projectId')
  const month = c.req.query('month') // 1-12 optional filter on gregorian month of resolved date

  let rows: unknown[]
  if (projectId) {
    rows = db
      .prepare(
        `SELECT o.* FROM occasions o
         JOIN project_occasions po ON po.occasion_id = o.id
         WHERE po.project_id = ?`,
      )
      .all(projectId)
  } else {
    rows = db.prepare(`SELECT * FROM occasions`).all()
  }

  const items = rows
    .map((row) => mapOccasion(row, year))
    .filter((o) => o.dateInYear)
    .filter((o) => {
      if (!month) return true
      return o.dateInYear!.slice(5, 7) === String(month).padStart(2, '0')
    })
    .sort((a, b) => String(a.dateInYear).localeCompare(String(b.dateInYear)))

  return c.json({ items, year })
})

occasionRoutes.post('/project-link', async (c) => {
  const body = await c.req.json()
  const projectId = String(body.projectId || '')
  const occasionId = String(body.occasionId || '')
  if (!projectId || !occasionId) return c.json({ error: 'projectId و occasionId الزامی است' }, 400)

  const project = db.prepare(`SELECT * FROM projects WHERE id = ?`).get(projectId) as
    | Record<string, unknown>
    | undefined
  if (!project) return c.json({ error: 'پروژه پیدا نشد' }, 404)
  assertWorkspaceAccess(c, String(project.workspace_id))

  const occasion = db.prepare(`SELECT id FROM occasions WHERE id = ?`).get(occasionId)
  if (!occasion) return c.json({ error: 'مناسبت پیدا نشد' }, 404)

  try {
    db.prepare(
      `INSERT INTO project_occasions (id, project_id, occasion_id) VALUES (?, ?, ?)`,
    ).run(uid('poc'), projectId, occasionId)
  } catch {
    return c.json({ error: 'قبلاً به این پروژه وصل شده' }, 409)
  }
  return c.json({ ok: true })
})

occasionRoutes.delete('/project-link', async (c) => {
  const body = await c.req.json().catch(() => ({} as Record<string, unknown>))
  const projectId = String(body.projectId || c.req.query('projectId') || '')
  const occasionId = String(body.occasionId || c.req.query('occasionId') || '')
  if (!projectId || !occasionId) return c.json({ error: 'projectId و occasionId الزامی است' }, 400)

  const project = db.prepare(`SELECT * FROM projects WHERE id = ?`).get(projectId) as
    | Record<string, unknown>
    | undefined
  if (!project) return c.json({ error: 'پروژه پیدا نشد' }, 404)
  assertWorkspaceAccess(c, String(project.workspace_id))

  db.prepare(`DELETE FROM project_occasions WHERE project_id = ? AND occasion_id = ?`).run(
    projectId,
    occasionId,
  )
  return c.json({ ok: true })
})

function mapOccasion(row: unknown, year: number) {
  const r = row as Record<string, unknown>
  const calendar = String(r.calendar) as 'jalali' | 'gregorian'
  const month = Number(r.month)
  const day = Number(r.day)
  return {
    id: r.id,
    slug: r.slug,
    nameFa: r.name_fa,
    nameEn: r.name_en,
    region: r.region,
    calendar,
    month,
    day,
    kind: r.kind,
    dateInYear: occasionDateInYear(calendar, month, day, year),
    createdAt: r.created_at,
  }
}
