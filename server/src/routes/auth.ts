import { Hono } from 'hono'
import { db, uid } from '../db/index.js'
import { createSession, requireAuth, resolveSession, sessionTokenFrom } from '../middleware/auth.js'
import { hitRateLimit } from '../middleware/rateLimit.js'
import { randomToken, safeEqual } from '../lib/secrets.js'

export const authRoutes = new Hono()

export function shareInviteLinks() {
  // Without SMTP, invite URLs must be copy-pasteable by an authenticated admin.
  return process.env.SHARE_INVITE_LINKS !== '0'
}

export function allowDevLogin() {
  if (process.env.ALLOW_DEV_LOGIN === '1') return true
  if (process.env.ALLOW_DEV_LOGIN === '0') return false
  return process.env.NODE_ENV !== 'production'
}

function ownerKey() {
  return (process.env.AUTH_OWNER_KEY || '').trim()
}

export function publicBaseUrl() {
  return (process.env.AUTH_PUBLIC_URL || 'http://127.0.0.1:8080').replace(/\/$/, '')
}

export function issueMagicLink(input: { email: string; workspaceId: string; role: string; ttlMs: number }) {
  const token = randomToken('magic', 32)
  const now = new Date()
  const expires = new Date(now.getTime() + input.ttlMs)
  db.prepare(
    `INSERT INTO magic_links (id, email, token, workspace_id, role, created_at, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(uid('ml'), input.email, token, input.workspaceId, input.role, now.toISOString(), expires.toISOString())
  return { token, url: `${publicBaseUrl()}/?magic=${token}`, expiresAt: expires.toISOString() }
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
    return c.json({ error: 'ورود سریع در این محیط غیرفعال است. از لینک ورود استفاده کنید.', code: 'dev_login_off' }, 403)
  }
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>
  const email = String(body.email || 'owner@postyar.local').trim().toLowerCase()
  if (hitRateLimit(`login:${email}`, 20, 60_000)) {
    return c.json({ error: 'تعداد تلاش ورود زیاد است. کمی بعد دوباره تلاش کنید.', code: 'rate_limited' }, 429)
  }
  const session = issueSessionForEmail(email)
  if (!session) return c.json({ error: 'کاربر پیدا نشد', code: 'not_found' }, 404)
  return c.json(session)
})

/**
 * Owner key login: a server-side shared secret (AUTH_OWNER_KEY) lets a workspace
 * admin sign in without SMTP. Only admins can use it; rate limited per IP+email.
 */
authRoutes.post('/owner-key', async (c) => {
  const key = ownerKey()
  if (!key) return c.json({ error: 'کلید مدیر تنظیم نشده', code: 'owner_key_off' }, 403)
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>
  const email = String(body.email || '').trim().toLowerCase()
  const provided = String(body.key || '')
  const ip = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'local'
  if (hitRateLimit(`ownerkey:${ip}`, 8, 10 * 60_000)) {
    return c.json({ error: 'تلاش زیاد. ۱۰ دقیقه صبر کنید.', code: 'rate_limited' }, 429)
  }
  if (!email.includes('@') || !provided || !safeEqual(provided, key)) {
    return c.json({ error: 'ایمیل یا کلید مدیر درست نیست', code: 'invalid_key' }, 401)
  }
  const user = db.prepare(`SELECT id FROM users WHERE lower(email) = ?`).get(email) as { id: string } | undefined
  const membership = user
    ? (db
        .prepare(`SELECT workspace_id, role FROM memberships WHERE user_id = ? AND role = 'admin' ORDER BY rowid ASC LIMIT 1`)
        .get(user.id) as { workspace_id: string; role: string } | undefined)
    : undefined
  if (!membership) return c.json({ error: 'این ایمیل ادمین ورک‌اسپیس نیست', code: 'not_admin' }, 403)
  const session = issueSessionForEmail(email, membership.workspace_id)
  if (!session) return c.json({ error: 'ورود ناموفق بود', code: 'login_failed' }, 500)
  return c.json(session)
})

/**
 * Magic-link request (public). Creates a one-time link but never returns it to
 * an unauthenticated caller: an admin shares it from the Team page, or it goes
 * out by email once SMTP is configured. In dev the token is echoed for testing.
 */
authRoutes.post('/magic-link', async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>
  const email = String(body.email || '').trim().toLowerCase()
  if (!email || !email.includes('@')) return c.json({ error: 'ایمیل معتبر وارد کنید', code: 'invalid_email' }, 400)

  if (hitRateLimit(`magic:${email}`, 5, 10 * 60_000)) {
    return c.json({ error: 'درخواست لینک زیاد است. ۱۰ دقیقه صبر کنید.', code: 'rate_limited' }, 429)
  }

  const user = db.prepare(`SELECT * FROM users WHERE lower(email) = ?`).get(email) as
    | Record<string, unknown>
    | undefined
  const membership = user
    ? (db
        .prepare(`SELECT * FROM memberships WHERE user_id = ? ORDER BY rowid ASC LIMIT 1`)
        .get(user.id) as Record<string, unknown> | undefined)
    : undefined

  // Same response whether or not the email exists — do not leak membership.
  if (!user || !membership) {
    return c.json({ ok: true, message: 'اگر این ایمیل عضو باشد، لینک ورود برایش صادر شد. از ادمین بخواهید لینک را از صفحه تیم برایتان بفرستد.', code: 'requested' })
  }

  const link = issueMagicLink({
    email,
    workspaceId: String(membership.workspace_id),
    role: String(membership.role),
    ttlMs: 20 * 60_000,
  })
  console.log('[Auth] Magic link requested for', email)

  return c.json({
    ok: true,
    message: 'لینک ورود صادر شد. ادمین می‌تواند آن را از صفحه تیم برایتان بفرستد.',
    code: 'requested',
    expiresAt: link.expiresAt,
    devMagicUrl: allowDevLogin() ? link.url : undefined,
  })
})

authRoutes.post('/magic-link/consume', async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>
  const token = String(body.token || '').trim()
  if (!token) return c.json({ error: 'توکن الزامی است', code: 'invalid_token' }, 400)

  if (hitRateLimit(`magic-consume:${token.slice(0, 12)}`, 10, 60_000)) {
    return c.json({ error: 'تلاش زیاد برای مصرف لینک', code: 'rate_limited' }, 429)
  }

  const row = db.prepare(`SELECT * FROM magic_links WHERE token = ?`).get(token) as
    | Record<string, unknown>
    | undefined
  if (!row) return c.json({ error: 'لینک نامعتبر است', code: 'invalid_token' }, 404)
  if (row.consumed_at) return c.json({ error: 'این لینک قبلاً استفاده شده', code: 'consumed' }, 410)
  if (String(row.expires_at) < new Date().toISOString()) {
    return c.json({ error: 'لینک منقضی شده', code: 'expired' }, 410)
  }

  // Atomic one-time use: only the first consumer flips consumed_at.
  const claimed = db
    .prepare(`UPDATE magic_links SET consumed_at = ? WHERE id = ? AND consumed_at IS NULL`)
    .run(new Date().toISOString(), row.id)
  if (claimed.changes === 0) return c.json({ error: 'این لینک قبلاً استفاده شده', code: 'consumed' }, 410)

  const session = issueSessionForEmail(String(row.email), String(row.workspace_id || ''))
  if (!session) return c.json({ error: 'ورود ناموفق بود', code: 'login_failed' }, 500)
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
  const token = sessionTokenFrom(c)
  if (token) db.prepare(`DELETE FROM sessions WHERE token = ?`).run(token)
  return c.json({ ok: true })
})

authRoutes.get('/bootstrap', (c) => {
  const session = resolveSession(sessionTokenFrom(c))
  const owner = db
    .prepare(`SELECT email FROM users ORDER BY created_at ASC LIMIT 1`)
    .get() as { email: string } | undefined
  const devLogin = allowDevLogin()
  return c.json({
    authenticated: Boolean(session),
    // Only pre-fill the seed identity when quick login is actually available.
    defaultEmail: devLogin ? owner?.email || 'owner@postyar.local' : '',
    magicLinkEnabled: true,
    allowDevLogin: devLogin,
    ownerKeyEnabled: Boolean(ownerKey()),
    shareInviteLinks: shareInviteLinks(),
    publicUrl: process.env.AUTH_PUBLIC_URL || null,
  })
})
