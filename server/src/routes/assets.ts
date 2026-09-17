import { Hono } from 'hono'
import { db, uid } from '../db/index.js'
import { TelegramStorageProvider } from '../services/storage/telegram.js'
import { assertWorkspaceAccess, requireAuth } from '../middleware/auth.js'

export const assetRoutes = new Hono()
assetRoutes.use('*', requireAuth)

assetRoutes.get('/', (c) => {
  const workspaceId = c.req.query('workspaceId') || c.get('workspaceId')
  assertWorkspaceAccess(c, workspaceId)

  const type = c.req.query('type')
  const q = (c.req.query('q') || '').trim()
  const sort = c.req.query('sort') || 'newest'

  let sql = `SELECT a.*, ts.telegram_file_unique_id, ts.caption AS telegram_caption, ts.thumbnail_file_id
             FROM assets a
             LEFT JOIN telegram_sources ts ON ts.asset_id = a.id
             WHERE a.workspace_id = ?`
  const params: unknown[] = [workspaceId]

  if (type && type !== 'all') {
    sql += ` AND a.type = ?`
    params.push(type)
  }
  if (q) {
    sql += ` AND (a.filename LIKE ? OR ts.caption LIKE ? OR a.tags LIKE ?)`
    const like = `%${q}%`
    params.push(like, like, like)
  }

  switch (sort) {
    case 'oldest':
      sql += ` ORDER BY a.created_at ASC`
      break
    case 'largest':
      sql += ` ORDER BY COALESCE(a.file_size, 0) DESC`
      break
    case 'smallest':
      sql += ` ORDER BY COALESCE(a.file_size, 0) ASC`
      break
    case 'name':
      sql += ` ORDER BY a.filename COLLATE NOCASE ASC`
      break
    default:
      sql += ` ORDER BY a.created_at DESC`
  }

  const rows = db.prepare(sql).all(...params)
  return c.json({ items: rows.map(mapAsset) })
})

assetRoutes.get('/:id', (c) => {
  const row = db
    .prepare(
      `SELECT a.*, ts.telegram_file_id, ts.telegram_file_unique_id, ts.caption AS telegram_caption,
              ts.thumbnail_file_id, ts.telegram_chat_id, ts.telegram_message_id
       FROM assets a
       LEFT JOIN telegram_sources ts ON ts.asset_id = a.id
       WHERE a.id = ?`,
    )
    .get(c.req.param('id')) as Record<string, unknown> | undefined
  if (!row) return c.json({ error: 'فایل پیدا نشد' }, 404)
  assertWorkspaceAccess(c, String(row.workspace_id))
  return c.json({ item: mapAsset(row) })
})

assetRoutes.post('/:id/attach', async (c) => {
  const assetId = c.req.param('id')
  const body = await c.req.json()
  if (!body.contentId) return c.json({ error: 'contentId الزامی است' }, 400)

  const asset = db.prepare(`SELECT * FROM assets WHERE id = ?`).get(assetId) as Record<string, unknown> | undefined
  const content = db.prepare(`SELECT * FROM contents WHERE id = ?`).get(body.contentId) as
    | Record<string, unknown>
    | undefined
  if (!asset || !content) return c.json({ error: 'محتوا یا فایل نامعتبر است' }, 404)
  assertWorkspaceAccess(c, String(asset.workspace_id))
  assertWorkspaceAccess(c, String(content.workspace_id))
  if (asset.workspace_id !== content.workspace_id) {
    return c.json({ error: 'فایل و محتوا در یک ورک‌اسپیس نیستند' }, 403)
  }

  const id = uid('ca')
  try {
    db.prepare(
      `INSERT INTO content_assets (id, content_id, asset_id, role, sort_order) VALUES (?, ?, ?, ?, ?)`,
    ).run(id, body.contentId, assetId, body.role || 'other', body.sortOrder || 0)
  } catch {
    return c.json({ error: 'این فایل قبلاً به محتوا متصل شده' }, 409)
  }

  db.prepare(`UPDATE assets SET status = 'attached', updated_at = ? WHERE id = ?`).run(
    new Date().toISOString(),
    assetId,
  )

  return c.json({ ok: true, id })
})

assetRoutes.get('/:id/download', async (c) => {
  const row = db
    .prepare(
      `SELECT a.*, ts.telegram_file_id FROM assets a
       LEFT JOIN telegram_sources ts ON ts.asset_id = a.id
       WHERE a.id = ?`,
    )
    .get(c.req.param('id')) as Record<string, unknown> | undefined

  if (!row) return c.json({ error: 'فایل پیدا نشد' }, 404)
  assertWorkspaceAccess(c, String(row.workspace_id))
  if (!process.env.TELEGRAM_BOT_TOKEN || !row.telegram_file_id) {
    return c.json(
      {
        error:
          'دانلود در دسترس نیست. TELEGRAM_BOT_TOKEN تنظیم نشده یا منبع تلگرام وجود ندارد.',
      },
      503,
    )
  }

  console.log('[Telegram] Download requested', { assetId: row.id })
  const provider = new TelegramStorageProvider(process.env.TELEGRAM_BOT_TOKEN)
  try {
    const file = await provider.download(String(row.telegram_file_id))
    return new Response(file.stream as BodyInit, {
      headers: {
        'Content-Type': file.mimeType || 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(file.filename)}"`,
      },
    })
  } catch (err) {
    console.error('[Telegram] API error', (err as Error).message)
    return c.json({ error: 'دانلود از تلگرام ناموفق بود' }, 502)
  }
})

assetRoutes.delete('/:id', (c) => {
  const row = db.prepare(`SELECT * FROM assets WHERE id = ?`).get(c.req.param('id')) as
    | Record<string, unknown>
    | undefined
  if (!row) return c.json({ error: 'فایل پیدا نشد' }, 404)
  assertWorkspaceAccess(c, String(row.workspace_id))
  db.prepare(`DELETE FROM assets WHERE id = ?`).run(c.req.param('id'))
  return c.json({ ok: true })
})

function mapAsset(row: unknown) {
  const r = row as Record<string, unknown>
  return {
    id: r.id,
    workspaceId: r.workspace_id,
    type: r.type,
    status: r.status,
    virtualFolder: r.virtual_folder,
    filename: r.filename,
    mimeType: r.mime_type,
    fileSize: r.file_size,
    width: r.width,
    height: r.height,
    duration: r.duration,
    storageProvider: r.storage_provider,
    tags: JSON.parse(String(r.tags || '[]')),
    telegramFileUniqueId: r.telegram_file_unique_id,
    telegramCaption: r.telegram_caption,
    thumbnailFileId: r.thumbnail_file_id,
    telegramFileId: r.telegram_file_id,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}
