import { Hono } from 'hono'
import { db, uid } from '../db/index.js'
import { requireAuth, requireRole, ROLES, type Role } from '../middleware/auth.js'
import { hitRateLimit } from '../middleware/rateLimit.js'
import { issueMagicLink, shareInviteLinks } from './auth.js'

export const teamRoutes = new Hono()
teamRoutes.use('*', requireAuth)

teamRoutes.get('/', (c) => {
  const workspaceId = c.get('workspaceId')
  const rows = db
    .prepare(
      `SELECT u.id, u.email, u.name, m.role, u.created_at,
              (SELECT MAX(s.created_at) FROM sessions s WHERE s.user_id = u.id AND s.workspace_id = m.workspace_id) AS last_login
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
        lastLoginAt: row.last_login || null,
      }
    }),
  })
})

function grantableRoles(actorRole: string): Role[] {
  // Managers cannot mint admins.
  return actorRole === 'admin' ? [...ROLES] : ROLES.filter((r) => r !== 'admin')
}

/** Invite / add member (admin/manager). Creates user if needed + membership. */
teamRoutes.post('/invite', requireRole('admin', 'manager'), async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>
  const email = String(body.email || '')
    .trim()
    .toLowerCase()
  const name = String(body.name || email.split('@')[0] || 'عضو جدید').trim()
  const memberRole = String(body.role || 'viewer') as Role
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return c.json({ error: 'ایمیل نامعتبر', code: 'invalid_email' }, 400)
  if (!grantableRoles(c.get('role')).includes(memberRole)) {
    return c.json({ error: 'نقش نامعتبر یا خارج از اختیار شما', code: 'invalid_role' }, 400)
  }

  const workspaceId = c.get('workspaceId')
  const now = new Date().toISOString()

  let user = db.prepare(`SELECT * FROM users WHERE lower(email) = ?`).get(email) as
    | Record<string, unknown>
    | undefined
  if (!user) {
    const id = uid('user')
    db.prepare(`INSERT INTO users (id, email, name, created_at) VALUES (?, ?, ?, ?)`).run(id, email, name, now)
    user = db.prepare(`SELECT * FROM users WHERE id = ?`).get(id) as Record<string, unknown>
  }

  const existing = db
    .prepare(`SELECT id FROM memberships WHERE workspace_id = ? AND user_id = ?`)
    .get(workspaceId, user.id)
  if (existing) return c.json({ error: 'این کاربر قبلاً عضو است', code: 'duplicate' }, 409)

  db.prepare(`INSERT INTO memberships (id, workspace_id, user_id, role) VALUES (?, ?, ?, ?)`).run(
    uid('mem'),
    workspaceId,
    user.id,
    memberRole,
  )

  const link = issueMagicLink({ email, workspaceId, role: memberRole, ttlMs: 24 * 60 * 60_000 })
  console.log('[Auth] Invite issued for', email, 'by', c.get('email'))

  return c.json({
    ok: true,
    member: { id: user.id, email, name: user.name, role: memberRole },
    invite: {
      expiresAt: link.expiresAt,
      inviteUrl: shareInviteLinks() ? link.url : undefined,
    },
  })
})

/** Admin/manager mints a fresh one-time login link for an existing member (no SMTP needed). */
teamRoutes.post('/:userId/login-link', requireRole('admin', 'manager'), (c) => {
  const userId = c.req.param('userId')
  const workspaceId = c.get('workspaceId')
  if (hitRateLimit(`loginlink:${c.get('userId')}`, 10, 10 * 60_000)) {
    return c.json({ error: 'تعداد لینک زیاد است. کمی بعد.', code: 'rate_limited' }, 429)
  }
  const row = db
    .prepare(
      `SELECT u.email, m.role FROM memberships m JOIN users u ON u.id = m.user_id
       WHERE m.workspace_id = ? AND m.user_id = ?`,
    )
    .get(workspaceId, userId) as { email: string; role: string } | undefined
  if (!row) return c.json({ error: 'عضو پیدا نشد', code: 'not_found' }, 404)
  if (row.role === 'admin' && c.get('role') !== 'admin') {
    return c.json({ error: 'فقط ادمین می‌تواند برای ادمین لینک بسازد', code: 'forbidden' }, 403)
  }
  const link = issueMagicLink({ email: row.email, workspaceId, role: row.role, ttlMs: 24 * 60 * 60_000 })
  console.log('[Auth] Login link minted for', row.email, 'by', c.get('email'))
  return c.json({ ok: true, expiresAt: link.expiresAt, inviteUrl: shareInviteLinks() ? link.url : undefined })
})

/** Change a member's role (admin only). Cannot demote the last admin. */
teamRoutes.patch('/:userId', requireRole('admin'), async (c) => {
  const userId = c.req.param('userId')
  const workspaceId = c.get('workspaceId')
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>
  const role = String(body.role || '') as Role
  if (!ROLES.includes(role)) return c.json({ error: 'نقش نامعتبر', code: 'invalid_role' }, 400)
  const current = db
    .prepare(`SELECT role FROM memberships WHERE workspace_id = ? AND user_id = ?`)
    .get(workspaceId, userId) as { role: string } | undefined
  if (!current) return c.json({ error: 'عضو پیدا نشد', code: 'not_found' }, 404)
  if (current.role === 'admin' && role !== 'admin') {
    const admins = (
      db.prepare(`SELECT COUNT(*) AS c FROM memberships WHERE workspace_id = ? AND role = 'admin'`).get(workspaceId) as {
        c: number
      }
    ).c
    if (admins <= 1) return c.json({ error: 'آخرین ادمین را نمی‌توان تنزل داد', code: 'last_admin' }, 409)
  }
  db.prepare(`UPDATE memberships SET role = ? WHERE workspace_id = ? AND user_id = ?`).run(role, workspaceId, userId)
  return c.json({ ok: true, role })
})

/** Remove a member (admin only). Revokes their sessions in this workspace. */
teamRoutes.delete('/:userId', requireRole('admin'), (c) => {
  const userId = c.req.param('userId')
  const workspaceId = c.get('workspaceId')
  if (userId === c.get('userId')) return c.json({ error: 'خودتان را نمی‌توانید حذف کنید', code: 'self' }, 400)
  const tx = db.transaction(() => {
    db.prepare(`DELETE FROM sessions WHERE user_id = ? AND workspace_id = ?`).run(userId, workspaceId)
    db.prepare(`DELETE FROM memberships WHERE workspace_id = ? AND user_id = ?`).run(workspaceId, userId)
  })
  tx()
  return c.json({ ok: true })
})
