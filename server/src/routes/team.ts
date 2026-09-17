import { Hono } from 'hono'
import { db } from '../db/index.js'
import { requireAuth } from '../middleware/auth.js'

export const teamRoutes = new Hono()
teamRoutes.use('*', requireAuth)

teamRoutes.get('/', (c) => {
  const workspaceId = c.get('workspaceId')
  const rows = db
    .prepare(
      `SELECT u.id, u.email, u.name, m.role, u.created_at
       FROM memberships m
       JOIN users u ON u.id = m.user_id
       WHERE m.workspace_id = ?
       ORDER BY m.role ASC, u.name ASC`,
    )
    .all(workspaceId)
  return c.json({
    items: rows.map((r) => {
      const row = r as Record<string, unknown>
      return {
        id: row.id,
        email: row.email,
        name: row.name,
        role: row.role,
        createdAt: row.created_at,
      }
    }),
  })
})
