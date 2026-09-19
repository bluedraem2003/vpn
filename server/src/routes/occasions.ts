import { Hono } from 'hono'
import { db, uid } from '../db/index.js'
import { assertWorkspaceAccess, requireAuth } from '../middleware/auth.js'
import { occasionDateInYear, pad2 } from '../lib/jalaali.js'

export const occasionRoutes = new Hono()
occasionRoutes.use('*', requireAuth)

occasionRoutes.get('/', (c) => {
  const workspaceId = c.req.query('workspaceId') || c.get('workspaceId')
  assertWorkspaceAccess(c, workspaceId)

  const region = c.req.query('region') // ir | global | custom | all
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
    rows = listVisibleOccasions(String(workspaceId), region)
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
    const owner = db.prepare(`SELECT workspace_id FROM projects WHERE id = ?`).get(projectId) as
      | { workspace_id: string }
      | undefined
    if (!owner) return c.json({ error: 'پیج پیدا نشد', code: 'not_found' }, 404)
    assertWorkspaceAccess(c, owner.workspace_id)
    rows = db
      .prepare(
        `SELECT o.* FROM occasions o
         JOIN project_occasions po ON po.occasion_id = o.id
         WHERE po.project_id = ?`,
      )
      .all(projectId)
  } else {
    rows = listVisibleOccasions(String(workspaceId), undefined)
  }

  const items = rows
    .map((row) => mapOccasion(row, year))
    .filter((o) => o.dateInYear)
    .filter((o) => {
      if (!month) return true
      return rangeOverlapsMonth(o.dateInYear, o.dateEndInYear, year, Number(month))
    })
    .sort((a, b) => String(a.dateInYear).localeCompare(String(b.dateInYear)))

  return c.json({ items, year })
})

occasionRoutes.post('/project-link', async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>
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

occasionRoutes.post('/', async (c) => {
  const body = await c.req.json().catch(() => ({} as Record<string, unknown>))
  const workspaceId = String(body.workspaceId || c.get('workspaceId') || '')
  assertWorkspaceAccess(c, workspaceId)
  const nameFa = String(body.nameFa || body.name || '').trim()
  if (!nameFa) return c.json({ error: 'نام مناسبت الزامی است' }, 400)
  const calendar = body.calendar === 'jalali' ? 'jalali' : 'gregorian'
  const month = Number(body.month)
  const day = Number(body.day)
  if (!Number.isFinite(month) || month < 1 || month > 12 || !Number.isFinite(day) || day < 1 || day > 31) {
    return c.json({ error: 'ماه و روز معتبر نیست' }, 400)
  }
  const id = uid('occ')
  const now = new Date().toISOString()
  db.prepare(
    `INSERT INTO occasions (id, slug, name_fa, name_en, region, calendar, month, day, kind, created_at, workspace_id)
     VALUES (?, ?, ?, ?, 'custom', ?, ?, ?, 'custom', ?, ?)`,
  ).run(id, `custom_${id}`, nameFa, body.nameEn || null, calendar, month, day, now, workspaceId)

  const projectId = body.projectId ? String(body.projectId) : ''
  if (projectId) {
    const project = db.prepare(`SELECT * FROM projects WHERE id = ?`).get(projectId) as
      | Record<string, unknown>
      | undefined
    if (project) {
      assertWorkspaceAccess(c, String(project.workspace_id))
      db.prepare(`INSERT OR IGNORE INTO project_occasions (id, project_id, occasion_id) VALUES (?, ?, ?)`).run(
        uid('poc'),
        projectId,
        id,
      )
    }
  }

  const year = Number(body.year || new Date().getFullYear())
  const row = db.prepare(`SELECT * FROM occasions WHERE id = ?`).get(id)
  return c.json({ item: mapOccasion(row, year) }, 201)
})

occasionRoutes.delete('/:id', (c) => {
  const id = c.req.param('id')
  const existing = db.prepare(`SELECT * FROM occasions WHERE id = ?`).get(id) as Record<string, unknown> | undefined
  if (!existing) return c.json({ error: 'مناسبت پیدا نشد' }, 404)
  if (!existing.workspace_id) return c.json({ error: 'مناسبت‌های پیش‌فرض قابل حذف نیستند' }, 403)
  assertWorkspaceAccess(c, String(existing.workspace_id))
  db.prepare(`UPDATE contents SET occasion_id = NULL WHERE occasion_id = ?`).run(id)
  db.prepare(`DELETE FROM project_occasions WHERE occasion_id = ?`).run(id)
  db.prepare(`DELETE FROM occasions WHERE id = ?`).run(id)
  return c.json({ ok: true })
})

function listVisibleOccasions(workspaceId: string, region?: string | undefined) {
  if (region && region !== 'all') {
    return db
      .prepare(
        `SELECT * FROM occasions
         WHERE region = ? AND (workspace_id IS NULL OR workspace_id = ?)
         ORDER BY month ASC, day ASC, name_fa ASC`,
      )
      .all(region, workspaceId)
  }
  return db
    .prepare(
      `SELECT * FROM occasions
       WHERE workspace_id IS NULL OR workspace_id = ?
       ORDER BY region ASC, month ASC, day ASC`,
    )
    .all(workspaceId)
}

function rangeOverlapsMonth(start: string | null, end: string | null, year: number, month: number) {
  if (!start) return false
  const monthStart = `${year}-${pad2(month)}-01`
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const monthEnd = `${year}-${pad2(month)}-${pad2(last)}`
  const finish = end && end >= start ? end : start
  return start <= monthEnd && finish >= monthStart
}

export function mapOccasion(row: unknown, year: number) {
  const r = row as Record<string, unknown>
  const calendar = String(r.calendar) as 'jalali' | 'gregorian'
  const month = Number(r.month)
  const day = Number(r.day)
  const endMonth = r.end_month != null ? Number(r.end_month) : null
  const endDay = r.end_day != null ? Number(r.end_day) : null
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
    hintFa: r.hint_fa ? String(r.hint_fa) : null,
    hintEn: r.hint_en ? String(r.hint_en) : null,
    angle: r.angle ? String(r.angle) : null,
    priority: Number(r.priority || 0),
    endMonth,
    endDay,
    workspaceId: r.workspace_id || null,
    custom: Boolean(r.workspace_id),
    dateInYear: occasionDateInYear(calendar, month, day, year),
    dateEndInYear:
      endMonth && endDay ? occasionDateInYear(calendar, endMonth, endDay, year) : null,
    createdAt: r.created_at,
  }
}
