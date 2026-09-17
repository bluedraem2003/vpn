import { Hono } from 'hono'
import { db, uid } from '../db/index.js'
import { createSession, requireAuth, resolveSession } from '../middleware/auth.js'
import { hitRateLimit } from '../middleware/rateLimit.js'

export const authRoutes = new Hono()

function issueSessionForEmail(email: string, preferredWorkspaceId?: string | null) {
  const user = db.prepare(`SELECT * FROM users WHERE lower(email) = ?`).get(email) as
    | Record<string, unknown>
    | undefined
  if (!user) return null

  let membership = preferredWorkspaceId
    ? (db
        .prepare(`SELECT * FROM memberships WHERE user_id = ? AND workspace_id = ?`)
        .get(user.id, preferredWorkspaceId) as Record<string, unknown> | undefined)
    : undefined

  if (!membership) {
    membership = db
      .prepare(`SELECT * FROM memberships WHERE user_id = ? ORDER BY rowid ASC LIMIT 1`)
      .get(user.id) as Record<string, unknown> | undefined
  }
  if (!membership) return null

  const session = createSession(String(user.id), String(membership.workspace_id))
  return {
    token: session.token,
    expiresAt: session.expiresAt,
    user: { id: user.id, email: user.email, name: user.name },
    workspaceId: String(membership.workspace_id),
    role: String(membership.role),
  }
}

/** Kept for local bootstrap / smoke tests. Prefer magic-link in UI. */
authRoutes.post('/login', async (c) => {
  const body = await c.req.json().catch(() => ({} as Record<string, unknown>))
  const email = String(body.email || 'owner@postyar.local').trim().toLowerCase()
  if (hitRateLimit(`login:${email}`, 20, 60_000)) {
    return c.json({ error: 'تعداد تلاش ورود زیاد است. کمی بعد دوباره تلاش کنید.' }, 429)
  }
  const session = issueSessionForEmail(email)
  if (!session) return c.json({ error: 'کاربر پیدا نشد' }, 404)
  return c.json(session)
})

/**
 * Magic-link request (free-tier):
 * - No paid email provider required.
 * - In development, returns `devMagicUrl` and logs the link.
 * - In production set AUTH_PUBLIC_URL; deliver via your mailer later.
 */
authRoutes.post('/magic-link', async (c) => {
  const body = await c.req.json().catch(() => ({} as Record<string, unknown>))
  const email = String(body.email || '').trim().toLowerCase()
  if (!email || !email.includes('@')) return c.json({ error: 'ایمیل معتبر وارد کنید' }, 400)

  if (hitRateLimit(`magic:${email}`, 5, 10 * 60_000)) {
    return c.json({ error: 'درخواست لینک زیاد است. ۱۰ دقیقه صبر کنید.' }, 429)
  }

  const user = db.prepare(`SELECT * FROM users WHERE lower(email) = ?`).get(email) as
    | Record<string, unknown>
    | undefined
  if (!user) return c.json({ error: 'این ایمیل در ورک‌اسپیس ثبت نشده' }, 404)

  const membership = db
    .prepare(`SELECT * FROM memberships WHERE user_id = ? ORDER BY rowid ASC LIMIT 1`)
    .get(user.id) as Record<string, unknown> | undefined
  if (!membership) return c.json({ error: 'عضویت یافت نشد' }, 404)

  const token = uid('magic')
  const now = new Date()
  const expires = new Date(now.getTime() + 1000 * 60 * 20)
  db.prepare(
    `INSERT INTO magic_links (id, email, token, workspace_id, role, created_at, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    uid('ml'),
    email,
    token,
    membership.workspace_id,
    membership.role,
    now.toISOString(),
    expires.toISOString(),
  )

  const publicUrl = process.env.AUTH_PUBLIC_URL || 'http://127.0.0.1:5173'
  const magicUrl = `${publicUrl}/?magic=${token}`
  console.log('[Auth] Magic link for', email, magicUrl)

  return c.json({
    ok: true,
    message: 'لینک ورود ساخته شد. در حالت توسعه لینک در پاسخ و لاگ سرور است.',
    expiresAt: expires.toISOString(),
    // Free-tier / local: expose link so UI can complete without SMTP
    devMagicUrl: process.env.NODE_ENV === 'production' && process.env.HIDE_DEV_MAGIC !== '0' ? undefined : magicUrl,
    magicToken: process.env.NODE_ENV === 'production' ? undefined : token,
  })
})

authRoutes.post('/magic-link/consume', async (c) => {
  const body = await c.req.json().catch(() => ({} as Record<string, unknown>))
  const token = String(body.token || '').trim()
  if (!token) return c.json({ error: 'توکن الزامی است' }, 400)

  if (hitRateLimit(`magic-consume:${token.slice(0, 12)}`, 10, 60_000)) {
    return c.json({ error: 'تلاش زیاد برای مصرف لینک' }, 429)
  }

  const row = db.prepare(`SELECT * FROM magic_links WHERE token = ?`).get(token) as
    | Record<string, unknown>
    | undefined
  if (!row) return c.json({ error: 'لینک نامعتبر است' }, 404)
  if (row.consumed_at) return c.json({ error: 'این لینک قبلاً استفاده شده' }, 410)
  if (String(row.expires_at) < new Date().toISOString()) {
    return c.json({ error: 'لینک منقضی شده' }, 410)
  }

  db.prepare(`UPDATE magic_links SET consumed_at = ? WHERE id = ?`).run(new Date().toISOString(), row.id)
  const session = issueSessionForEmail(String(row.email), String(row.workspace_id || ''))
  if (!session) return c.json({ error: 'ورود ناموفق بود' }, 500)
  return c.json(session)
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
    magicLinkEnabled: true,
  })
})
