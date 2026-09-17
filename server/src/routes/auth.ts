import { Hono } from 'hono'
import { db } from '../db/index.js'
import { createSession, requireAuth, resolveSession } from '../middleware/auth.js'

export const authRoutes = new Hono()

/** Dev/bootstrap login — uses seeded owner. Replace with magic-link later. */
authRoutes.post('/login', async (c) => {
  const body = await c.req.json().catch(() => ({} as Record<string, unknown>))
  const email = String(body.email || 'owner@postyar.local').trim().toLowerCase()

  const user = db.prepare(`SELECT * FROM users WHERE lower(email) = ?`).get(email) as
    | Record<string, unknown>
    | undefined
  if (!user) return c.json({ error: 'کاربر پیدا نشد' }, 404)

  const membership = db
    .prepare(`SELECT * FROM memberships WHERE user_id = ? ORDER BY rowid ASC LIMIT 1`)
    .get(user.id) as Record<string, unknown> | undefined
  if (!membership) return c.json({ error: 'عضویت ورک‌اسپیس یافت نشد' }, 404)

  const session = createSession(String(user.id), String(membership.workspace_id))
  return c.json({
    token: session.token,
    expiresAt: session.expiresAt,
    user: { id: user.id, email: user.email, name: user.name },
    workspaceId: membership.workspace_id,
    role: membership.role,
  })
})

authRoutes.get('/me', requireAuth, (c) => {
  return c.json({
    user: {
      id: c.get('userId'),
      email: c.get('email'),
      name: c.get('name'),
    },
    workspaceId: c.get('workspaceId'),
    role: c.get('role'),
  })
})

authRoutes.post('/logout', requireAuth, (c) => {
  const header = c.req.header('Authorization') || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''
  if (token) db.prepare(`DELETE FROM sessions WHERE token = ?`).run(token)
  return c.json({ ok: true })
})

authRoutes.get('/bootstrap', (c) => {
  const header = c.req.header('Authorization') || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  const session = resolveSession(token)
  const owner = db
    .prepare(`SELECT email FROM users ORDER BY created_at ASC LIMIT 1`)
    .get() as { email: string } | undefined
  return c.json({
    authenticated: Boolean(session),
    defaultEmail: owner?.email || 'owner@postyar.local',
  })
})
