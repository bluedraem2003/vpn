import { Hono } from 'hono'
import { db } from '../db/index.js'
import { requireAuth } from '../middleware/auth.js'

export const workspaceRoutes = new Hono()
workspaceRoutes.use('*', requireAuth)

workspaceRoutes.get('/', (c) => {
  const userId = c.get('userId')
  const rows = db
    .prepare(
      `SELECT w.*, m.role
       FROM workspaces w
       JOIN memberships m ON m.workspace_id = w.id
       WHERE m.user_id = ?
       ORDER BY w.created_at ASC`,
    )
    .all(userId)

  return c.json({
    items: rows.map((r) => {
      const row = r as Record<string, unknown>
      return {
        id: row.id,
        name: row.name,
        slug: row.slug,
        createdAt: row.created_at,
        role: row.role,
      }
    }),
  })
})

workspaceRoutes.get('/:id/dashboard', (c) => {
  const workspaceId = c.req.param('id')
  if (c.get('workspaceId') !== workspaceId) {
    return c.json({ error: 'دسترسی به این ورک‌اسپیس مجاز نیست' }, 403)
  }
  const today = new Date().toISOString().slice(0, 10)

  const counts = db
    .prepare(
      `SELECT status, COUNT(*) AS c FROM contents WHERE workspace_id = ? GROUP BY status`,
    )
    .all(workspaceId) as { status: string; c: number }[]

  const byStatus = Object.fromEntries(counts.map((x) => [x.status, x.c]))

  const todayItems = db
    .prepare(
      `SELECT id, title, status, content_type, platforms, publish_date, publish_time
       FROM contents WHERE workspace_id = ? AND publish_date = ? ORDER BY publish_time ASC`,
    )
    .all(workspaceId, today)

  const upcoming = db
    .prepare(
      `SELECT id, title, status, content_type, platforms, publish_date, publish_time
       FROM contents
       WHERE workspace_id = ? AND publish_date IS NOT NULL AND publish_date > ?
       ORDER BY publish_date ASC, publish_time ASC LIMIT 10`,
    )
    .all(workspaceId, today)

  const overdue = db
    .prepare(
      `SELECT id, title, status, content_type, platforms, publish_date, publish_time
       FROM contents
       WHERE workspace_id = ?
         AND publish_date IS NOT NULL AND publish_date < ?
         AND status NOT IN ('published', 'archived')
       ORDER BY publish_date ASC LIMIT 10`,
    )
    .all(workspaceId, today)

  const recentAssets = db
    .prepare(
      `SELECT id, filename, type, status, file_size, created_at
       FROM assets WHERE workspace_id = ? ORDER BY created_at DESC LIMIT 8`,
    )
    .all(workspaceId)

  return c.json({
    byStatus,
    today: todayItems,
    upcoming,
    overdue,
    recentAssets,
    progress: {
      inProduction: byStatus.in_production || 0,
      inReview: byStatus.in_review || 0,
      ready: byStatus.ready || 0,
      published: byStatus.published || 0,
    },
  })
})
