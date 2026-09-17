import { db } from '../db/index.js'

/** Simple DB-backed rate limit: max `limit` hits per `windowMs` for a key. */
export function hitRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now()
  const row = db.prepare(`SELECT count, window_start FROM rate_limits WHERE key = ?`).get(key) as
    | { count: number; window_start: string }
    | undefined

  if (!row) {
    db.prepare(`INSERT INTO rate_limits (key, count, window_start) VALUES (?, 1, ?)`).run(
      key,
      new Date(now).toISOString(),
    )
    return false
  }

  const start = new Date(row.window_start).getTime()
  if (now - start > windowMs) {
    db.prepare(`UPDATE rate_limits SET count = 1, window_start = ? WHERE key = ?`).run(
      new Date(now).toISOString(),
      key,
    )
    return false
  }

  if (row.count >= limit) return true
  db.prepare(`UPDATE rate_limits SET count = count + 1 WHERE key = ?`).run(key)
  return false
}
