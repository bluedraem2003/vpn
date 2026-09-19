import type { Context, Next } from 'hono'
import { db, uid } from '../db/index.js'
import { randomToken } from '../lib/secrets.js'

export type AuthVars = {
  userId: string
  workspaceId: string
  role: string
  email: string
  name: string
}

declare module 'hono' {
  interface ContextVariableMap extends AuthVars {}
}

export const ROLES = ['admin', 'manager', 'editor', 'designer', 'copywriter', 'viewer'] as const
export type Role = (typeof ROLES)[number]

/** Roles allowed to create / edit / delete workspace data. Viewers are read-only. */
export const WRITE_ROLES: Role[] = ['admin', 'manager', 'editor', 'designer', 'copywriter']

const SESSION_DAYS = 30

export function createSession(userId: string, workspaceId: string) {
  const now = new Date()
  const expires = new Date(now.getTime() + 1000 * 60 * 60 * 24 * SESSION_DAYS)
  const token = randomToken('tok', 32)
  const id = uid('sess')
  db.prepare(
    `INSERT INTO sessions (id, user_id, workspace_id, token, created_at, expires_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(id, userId, workspaceId, token, now.toISOString(), expires.toISOString())
  return { token, expiresAt: expires.toISOString() }
}

export function sessionTokenFrom(c: Context) {
  const header = c.req.header('Authorization') || ''
  if (header.startsWith('Bearer ')) return header.slice(7).trim()
  return c.req.header('X-Session-Token') || null
}

export function resolveSession(token: string | undefined | null) {
  if (!token) return null
  const row = db
    .prepare(
      `SELECT s.*, u.email, u.name, m.role
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       JOIN memberships m ON m.user_id = s.user_id AND m.workspace_id = s.workspace_id
       WHERE s.token = ?`,
    )
    .get(token) as Record<string, unknown> | undefined
  if (!row) return null
  if (String(row.expires_at) < new Date().toISOString()) {
    db.prepare(`DELETE FROM sessions WHERE id = ?`).run(row.id)
    return null
  }
  return {
    userId: String(row.user_id),
    workspaceId: String(row.workspace_id),
    role: String(row.role),
    email: String(row.email),
    name: String(row.name),
  }
}

/** Protect mutating / private routes. Public: health, telegram webhook. */
export async function requireAuth(c: Context, next: Next) {
  const session = resolveSession(sessionTokenFrom(c))
  if (!session) return c.json({ error: 'نشست نامعتبر است — دوباره وارد شوید', code: 'unauthorized' }, 401)
  c.set('userId', session.userId)
  c.set('workspaceId', session.workspaceId)
  c.set('role', session.role)
  c.set('email', session.email)
  c.set('name', session.name)
  await next()
}

/** Global guard: viewers may read everything but never write. */
export async function denyViewerWrites(c: Context, next: Next) {
  const method = c.req.method
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return next()
  const path = c.req.path
  if (path.startsWith('/api/auth/') || path === '/api/telegram/webhook') return next()
  const session = resolveSession(sessionTokenFrom(c))
  // Unauthenticated requests fall through to each route's own requireAuth.
  if (session && !WRITE_ROLES.includes(session.role as Role)) {
    // Viewers may still mark their own notifications read.
    if (path === '/api/notifications/read') return next()
    return c.json({ error: 'نقش شما فقط مشاهده است', code: 'forbidden' }, 403)
  }
  return next()
}

export function requireRole(...roles: Role[]) {
  return async (c: Context, next: Next) => {
    if (!roles.includes(c.get('role') as Role)) {
      return c.json({ error: 'دسترسی برای نقش شما مجاز نیست', code: 'forbidden' }, 403)
    }
    await next()
  }
}

export function assertWorkspaceAccess(c: Context, workspaceId: string) {
  if (c.get('workspaceId') !== workspaceId) {
    throw new Error('دسترسی به این ورک‌اسپیس مجاز نیست')
  }
}
