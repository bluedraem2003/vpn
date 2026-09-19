import { Hono } from 'hono'
import { db, uid } from '../db/index.js'
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

/** Invite / add member (admin/manager). Creates user if needed + membership. */
teamRoutes.post('/invite', async (c) => {
  const role = c.get('role')
  if (!['admin', 'manager'].includes(role)) {
    return c.json({ error: 'فقط ادمین/مدیر می‌تواند دعوت کند' }, 403)
  }

  const body = await c.req.json()
  const email = String(body.email || '')
    .trim()
    .toLowerCase()
  const name = String(body.name || email.split('@')[0] || 'عضو جدید').trim()
  const memberRole = String(body.role || 'viewer')
  const allowed = ['admin', 'manager', 'editor', 'designer', 'copywriter', 'viewer']
  if (!email.includes('@')) return c.json({ error: 'ایمیل نامعتبر' }, 400)
  if (!allowed.includes(memberRole)) return c.json({ error: 'نقش نامعتبر' }, 400)

  const workspaceId = c.get('workspaceId')
  const now = new Date().toISOString()

  let user = db.prepare(`SELECT * FROM users WHERE lower(email) = ?`).get(email) as
    | Record<string, unknown>
    | undefined
  if (!user) {
    const id = uid('user')
    db.prepare(`INSERT INTO users (id, email, name, created_at) VALUES (?, ?, ?, ?)`).run(
      id,
      email,
      name,
      now,
    )
    user = db.prepare(`SELECT * FROM users WHERE id = ?`).get(id) as Record<string, unknown>
  }

  const existing = db
    .prepare(`SELECT id FROM memberships WHERE workspace_id = ? AND user_id = ?`)
    .get(workspaceId, user.id)
  if (existing) return c.json({ error: 'این کاربر قبلاً عضو است' }, 409)

  db.prepare(
    `INSERT INTO memberships (id, workspace_id, user_id, role) VALUES (?, ?, ?, ?)`,
  ).run(uid('mem'), workspaceId, user.id, memberRole)

  // Issue magic link for invitee (dev-visible)
  const token = uid('magic')
  const expires = new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString()
  db.prepare(
    `INSERT INTO magic_links (id, email, token, workspace_id, role, created_at, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(uid('ml'), email, token, workspaceId, memberRole, now, expires)

  const publicUrl = (process.env.AUTH_PUBLIC_URL || 'http://127.0.0.1:8080').replace(/\/$/, '')
  const magicUrl = `${publicUrl}/?magic=${token}`
  console.log('[Auth] Invite magic link for', email, magicUrl)

  return c.json({
    ok: true,
    member: { id: user.id, email, name: user.name, role: memberRole },
    invite: {
      expiresAt: expires,
      inviteUrl: magicUrl,
      // Back-compat
      devMagicUrl: magicUrl,
    },
  })
})
