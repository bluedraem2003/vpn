import type { Context, Next } from 'hono'
import { db, uid } from '../db/index.js'

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

export function createSession(userId: string, workspaceId: string) {
  const now = new Date()
  const expires = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 14)
  const token = uid('tok')
  const id = uid('sess')
  db.prepare(
    `INSERT INTO sessions (id, user_id, workspace_id, token, created_at, expires_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(id, userId, workspaceId, token, now.toISOString(), expires.toISOString())
  return { token, expiresAt: expires.toISOString() }
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
  const header = c.req.header('Authorization') || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : c.req.header('X-Session-Token')
  const session = resolveSession(token)
  if (!session) return c.json({ error: 'نشست نامعتبر است — دوباره وارد شوید' }, 401)
  c.set('userId', session.userId)
  c.set('workspaceId', session.workspaceId)
  c.set('role', session.role)
  c.set('email', session.email)
  c.set('name', session.name)
  await next()
}

export function assertWorkspaceAccess(c: Context, workspaceId: string) {
  if (c.get('workspaceId') !== workspaceId) {
    throw new Error('دسترسی به این ورک‌اسپیس مجاز نیست')
  }
}
