import { Hono } from 'hono'
import { db, uid } from '../db/index.js'
import { createSession, requireAuth, resolveSession } from '../middleware/auth.js'
import { hitRateLimit } from '../middleware/rateLimit.js'

export const authRoutes = new Hono()

function shareInviteLinks() {
  // Without SMTP, invite/magic URLs must be copy-pasteable for small teams.
  if (process.env.SHARE_INVITE_LINKS === '0') return false
  if (process.env.SHARE_INVITE_LINKS === '1') return true
  // Default: share links (team of 2 without mailer)
  return true
}

function allowDevLogin() {
  if (process.env.ALLOW_DEV_LOGIN === '1') return true
  if (process.env.ALLOW_DEV_LOGIN === '0') return false
  return process.env.NODE_ENV !== 'production'
}

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

/** Local bootstrap only — disabled in production unless ALLOW_DEV_LOGIN=1. */
authRoutes.post('/login', async (c) => {
  if (!allowDevLogin()) {
    return c.json({ error: 'ورود سریع در این محیط غیرفعال است. از Magic Link استفاده کنید.' }, 403)
  }
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
 * Magic-link request:
 * - Creates a one-time link under AUTH_PUBLIC_URL
 * - Without SMTP, inviteUrl is returned so owner can share with teammate
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
  if (!user) return c.json({ error: 'این ایمیل در ورک‌اسپیس ثبت نشده — از صفحه تیم دعوت شوید' }, 404)

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

  const base = process.env.AUTH_PUBLIC_URL || 'http://127.0.0.1:8080'
  const magicUrl = `${base.replace(/\/$/, '')}/?magic=${token}`
  console.log('[Auth] Magic link for', email, magicUrl)

  return c.json({
    ok: true,
    message: shareInviteLinks()
      ? 'لینک ورود آماده است — برای هم‌تیمی بفرستید یا خودتان باز کنید.'
      : 'اگر ایمیل پیکربندی شده باشد لینک ارسال می‌شود.',
    expiresAt: expires.toISOString(),
    inviteUrl: shareInviteLinks() ? magicUrl : undefined,
    // Back-compat with older UI
    devMagicUrl: shareInviteLinks() ? magicUrl : undefined,
    magicToken: allowDevLogin() ? token : undefined,
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
    allowDevLogin: allowDevLogin(),
    shareInviteLinks: shareInviteLinks(),
    publicUrl: process.env.AUTH_PUBLIC_URL || null,
  })
})
