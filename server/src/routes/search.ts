import { Hono } from 'hono'
import { db } from '../db/index.js'
import { assertWorkspaceAccess, requireAuth } from '../middleware/auth.js'

export const searchRoutes = new Hono()
searchRoutes.use('*', requireAuth)

searchRoutes.get('/', (c) => {
  const workspaceId = c.req.query('workspaceId') || c.get('workspaceId')
  assertWorkspaceAccess(c, workspaceId)
  const q = (c.req.query('q') || '').trim()
  if (!q) return c.json({ contents: [], assets: [], projects: [], campaigns: [], ideas: [] })
  const like = `%${q}%`

  const contents = db
    .prepare(
      `SELECT id, title, status, content_type, caption FROM contents
       WHERE workspace_id = ? AND (title LIKE ? OR IFNULL(caption,'') LIKE ? OR IFNULL(notes,'') LIKE ?)
       LIMIT 20`,
    )
    .all(workspaceId, like, like, like)

  const assets = db
    .prepare(
      `SELECT a.id, a.filename, a.type, ts.caption AS telegram_caption
       FROM assets a
       LEFT JOIN telegram_sources ts ON ts.asset_id = a.id
       WHERE a.workspace_id = ? AND (a.filename LIKE ? OR IFNULL(ts.caption,'') LIKE ? OR a.tags LIKE ?)
       LIMIT 20`,
    )
    .all(workspaceId, like, like, like)

  const projects = db
    .prepare(
      `SELECT id, name, client_name FROM projects
       WHERE workspace_id = ? AND (name LIKE ? OR IFNULL(client_name,'') LIKE ?) LIMIT 20`,
    )
    .all(workspaceId, like, like)

  const campaigns = db
    .prepare(`SELECT id, name, status FROM campaigns WHERE workspace_id = ? AND name LIKE ? LIMIT 20`)
    .all(workspaceId, like)

  const ideas = db
    .prepare(
      `SELECT id, title, priority FROM ideas
       WHERE workspace_id = ? AND (title LIKE ? OR IFNULL(description,'') LIKE ?) LIMIT 20`,
    )
    .all(workspaceId, like, like)

  return c.json({ contents, assets, projects, campaigns, ideas })
})
