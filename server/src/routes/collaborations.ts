import { Hono } from 'hono'
import { db, uid } from '../db/index.js'
import { assertWorkspaceAccess, requireAuth } from '../middleware/auth.js'
import { normalizeHandle } from '../lib/instagramSearch.js'

export const collaborationRoutes = new Hono()
collaborationRoutes.use('*', requireAuth)

const SNAPSHOT_MAX = 400_000

function cleanHandle(raw: unknown) {
  const h = normalizeHandle(String(raw || ''))
  return h ? h.toLowerCase() : ''
}

function parseSnapshot(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, unknown>
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw) as unknown
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as Record<string, unknown>
    } catch {
      /* ignore */
    }
  }
  return {}
}

function mapCollab(row: Record<string, unknown>) {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    handle: row.handle,
    name: row.name,
    notes: (row.notes as string | null) || '',
    snapshot: parseSnapshot(row.snapshot),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

collaborationRoutes.get('/', (c) => {
  const workspaceId = c.req.query('workspaceId') || c.get('workspaceId')
  assertWorkspaceAccess(c, workspaceId)
  const rows = db
    .prepare(`SELECT * FROM collaborations WHERE workspace_id = ? ORDER BY updated_at DESC`)
    .all(workspaceId) as Array<Record<string, unknown>>
  return c.json({ items: rows.map(mapCollab) })
})

collaborationRoutes.post('/', async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>
  const workspaceId = String(body.workspaceId || c.get('workspaceId'))
  assertWorkspaceAccess(c, workspaceId)
  const handle = cleanHandle(body.handle)
  if (!handle) return c.json({ error: 'آیدی پیج را بنویس', code: 'need_handle' }, 400)

  const snapshot = parseSnapshot(body.snapshot)
  snapshot.handle = handle
  const encoded = JSON.stringify(snapshot)
  if (encoded.length > SNAPSHOT_MAX) {
    return c.json({ error: 'گزارش برای ذخیره خیلی بزرگ است', code: 'too_large' }, 400)
  }

  const name =
    String(body.name || snapshot.name || '').trim() || handle
  const notes = body.notes !== undefined ? String(body.notes || '').trim() : undefined
  const now = new Date().toISOString()
  const existing = db
    .prepare(`SELECT * FROM collaborations WHERE workspace_id = ? AND handle = ?`)
    .get(workspaceId, handle) as Record<string, unknown> | undefined

  if (existing) {
    db.prepare(
      `UPDATE collaborations SET name = ?, notes = ?, snapshot = ?, updated_at = ? WHERE id = ?`,
    ).run(name, notes !== undefined ? notes : existing.notes, encoded, now, existing.id)
    return c.json({ item: mapCollab(db.prepare(`SELECT * FROM collaborations WHERE id = ?`).get(existing.id) as Record<string, unknown>), created: false })
  }

  const id = uid('col')
  db.prepare(
    `INSERT INTO collaborations (id, workspace_id, handle, name, notes, snapshot, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, workspaceId, handle, name, notes || null, encoded, now, now)
  return c.json({ item: mapCollab(db.prepare(`SELECT * FROM collaborations WHERE id = ?`).get(id) as Record<string, unknown>), created: true }, 201)
})

collaborationRoutes.patch('/:id', async (c) => {
  const existing = db.prepare(`SELECT * FROM collaborations WHERE id = ?`).get(c.req.param('id')) as
    | Record<string, unknown>
    | undefined
  if (!existing) return c.json({ error: 'پیج کولب پیدا نشد', code: 'not_found' }, 404)
  assertWorkspaceAccess(c, String(existing.workspace_id))
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>
  const notes = body.notes !== undefined ? String(body.notes || '').trim() : String(existing.notes || '')
  const name = body.name !== undefined ? String(body.name || '').trim() || String(existing.name) : String(existing.name)
  db.prepare(`UPDATE collaborations SET name = ?, notes = ?, updated_at = ? WHERE id = ?`).run(
    name,
    notes || null,
    new Date().toISOString(),
    existing.id,
  )
  return c.json({
    item: mapCollab(db.prepare(`SELECT * FROM collaborations WHERE id = ?`).get(existing.id) as Record<string, unknown>),
  })
})

collaborationRoutes.delete('/:id', (c) => {
  const existing = db.prepare(`SELECT * FROM collaborations WHERE id = ?`).get(c.req.param('id')) as
    | Record<string, unknown>
    | undefined
  if (!existing) return c.json({ error: 'پیج کولب پیدا نشد', code: 'not_found' }, 404)
  assertWorkspaceAccess(c, String(existing.workspace_id))
  db.prepare(`DELETE FROM collaborations WHERE id = ?`).run(existing.id)
  return c.json({ ok: true })
})
