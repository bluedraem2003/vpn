import { randomBytes, timingSafeEqual } from 'node:crypto'
import { db } from '../db/index.js'

/** Cryptographically random, URL-safe token (default 192 bits). */
export function randomToken(prefix?: string, bytes = 24) {
  const raw = randomBytes(bytes).toString('base64url')
  return prefix ? `${prefix}_${raw}` : raw
}

let cachedInstanceSecret: string | null = null

/**
 * Per-install secret used for HMAC signing when no env secret is provided.
 * Generated once with crypto randomness and persisted in app_settings, so
 * signatures survive restarts but are never a well-known default.
 */
export function instanceSecret() {
  if (cachedInstanceSecret) return cachedInstanceSecret
  const row = db.prepare(`SELECT value FROM app_settings WHERE key = 'instance_secret'`).get() as
    | { value: string }
    | undefined
  if (row?.value) {
    cachedInstanceSecret = row.value
    return row.value
  }
  const secret = randomBytes(32).toString('base64url')
  db.prepare(`INSERT OR IGNORE INTO app_settings (key, value) VALUES ('instance_secret', ?)`).run(secret)
  const saved = db.prepare(`SELECT value FROM app_settings WHERE key = 'instance_secret'`).get() as { value: string }
  cachedInstanceSecret = saved.value
  return saved.value
}

export function safeEqual(a: string, b: string) {
  const ba = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ba.length !== bb.length) return false
  return timingSafeEqual(ba, bb)
}

/** JSON.parse that never throws — corrupt stored JSON becomes the fallback. */
export function safeJson<T>(raw: unknown, fallback: T): T {
  if (typeof raw !== 'string' || !raw) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}
