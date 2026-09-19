import { Hono } from 'hono'
import { db, uid } from '../db/index.js'
import { TelegramStorageProvider } from '../services/storage/telegram.js'
import { assertWorkspaceAccess, requireAuth } from '../middleware/auth.js'
import { hitRateLimit } from '../middleware/rateLimit.js'

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
  if (hitRateLimit(`download:${c.get('userId')}`, 30, 60_000)) {
    return c.json({ error: 'محدودیت دانلود — کمی صبر کنید' }, 429)
  }
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
    const contentType = resolveContentType(
      String(row.mime_type || ''),
      file.mimeType,
      String(row.type),
      String(row.filename || file.filename),
    )
    return new Response(file.stream as BodyInit, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${encodeURIComponent(String(row.filename || file.filename))}"`,
      },
    })
  } catch (err) {
    console.error('[Telegram] API error', (err as Error).message)
    return c.json({ error: 'دانلود از تلگرام ناموفق بود' }, 502)
  }
})

assetRoutes.get('/:id/preview', async (c) => {
  const row = db
    .prepare(
      `SELECT a.*, ts.telegram_file_id, ts.thumbnail_file_id FROM assets a
       LEFT JOIN telegram_sources ts ON ts.asset_id = a.id
       WHERE a.id = ?`,
    )
    .get(c.req.param('id')) as Record<string, unknown> | undefined

  if (!row) return c.json({ error: 'فایل پیدا نشد' }, 404)
  assertWorkspaceAccess(c, String(row.workspace_id))

  const type = String(row.type)
  const mime = String(row.mime_type || '')

  // Metadata-only preview when Telegram isn't configured (local/demo assets)
  if (!process.env.TELEGRAM_BOT_TOKEN || !row.telegram_file_id) {
    if (type === 'image') {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360">
        <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop stop-color="#0F2F2C"/><stop offset="1" stop-color="#1B6B63"/>
        </linearGradient></defs>
        <rect width="100%" height="100%" fill="url(#g)"/>
        <text x="50%" y="48%" fill="#F4EDE4" font-size="22" text-anchor="middle" font-family="sans-serif">${escapeXml(String(row.filename))}</text>
        <text x="50%" y="58%" fill="#E07A5F" font-size="14" text-anchor="middle" font-family="sans-serif">preview placeholder</text>
      </svg>`
      return new Response(svg, { headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'no-store' } })
    }
    return c.json({
      previewable: false,
      type,
      mimeType: mime || null,
      filename: row.filename,
      message: 'برای پخش واقعی فایل، TELEGRAM_BOT_TOKEN را تنظیم کنید.',
    })
  }

  const provider = new TelegramStorageProvider(process.env.TELEGRAM_BOT_TOKEN)
  const fileId =
    (type === 'video' || type === 'document') && row.thumbnail_file_id
      ? String(row.thumbnail_file_id)
      : String(row.telegram_file_id)

  try {
    // For video/audio prefer full file when possible; thumb for heavy docs
    const targetId =
      type === 'image' || type === 'audio' || type === 'video' ? String(row.telegram_file_id) : fileId
    const file = await provider.getPreview(targetId)
    if (!file) return c.json({ error: 'پیش‌نمایش در دسترس نیست' }, 502)
    const contentType = resolveContentType(
      mime,
      file.mimeType,
      type,
      String(row.filename || file.filename),
    )
    return new Response(file.stream as BodyInit, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `inline; filename="${encodeURIComponent(String(row.filename || file.filename))}"`,
        'Cache-Control': 'private, max-age=60',
      },
    })
  } catch (err) {
    console.error('[Telegram] Preview error', (err as Error).message)
    return c.json({ error: 'پیش‌نمایش ناموفق بود' }, 502)
  }
})

assetRoutes.patch('/:id', async (c) => {
  const id = c.req.param('id')
  const row = db.prepare(`SELECT * FROM assets WHERE id = ?`).get(id) as Record<string, unknown> | undefined
  if (!row) return c.json({ error: 'فایل پیدا نشد' }, 404)
  assertWorkspaceAccess(c, String(row.workspace_id))
  const body = await c.req.json()
  const tags = body.tags ? JSON.stringify(body.tags) : row.tags
  const status = body.status ?? row.status
  const virtualFolder = body.virtualFolder ?? row.virtual_folder
  db.prepare(
    `UPDATE assets SET tags = ?, status = ?, virtual_folder = ?, updated_at = ? WHERE id = ?`,
  ).run(tags, status, virtualFolder, new Date().toISOString(), id)
  const updated = db
    .prepare(
      `SELECT a.*, ts.telegram_file_unique_id, ts.caption AS telegram_caption, ts.thumbnail_file_id
       FROM assets a LEFT JOIN telegram_sources ts ON ts.asset_id = a.id WHERE a.id = ?`,
    )
    .get(id)
  return c.json({ item: mapAsset(updated) })
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

function escapeXml(s: string) {
  return s.replace(/[<>&'"]/g, (ch) =>
    ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[ch] || ch,
  )
}

function isUsableMime(value: string | undefined | null) {
  if (!value) return false
  const lower = value.toLowerCase()
  return !lower.includes('octet-stream') && !lower.includes('application/json')
}

/** Prefer DB/Telegram MIME, but never serve octet-stream when we can guess (Safari needs real image MIME). */
function resolveContentType(
  storedMime: string,
  telegramMime: string | undefined,
  type: string,
  filename: string,
) {
  if (isUsableMime(storedMime)) return storedMime.split(';')[0]!.trim()
  if (isUsableMime(telegramMime)) return telegramMime!.split(';')[0]!.trim()
  return guessMime(type, filename)
}

function guessMime(type: string, filename: string) {
  const lower = filename.toLowerCase()
  if (lower.endsWith('.png')) return 'image/png'
  if (lower.endsWith('.webp')) return 'image/webp'
  if (lower.endsWith('.gif')) return 'image/gif'
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg'
  if (lower.endsWith('.mp4')) return 'video/mp4'
  if (lower.endsWith('.mp3')) return 'audio/mpeg'
  if (lower.endsWith('.pdf')) return 'application/pdf'
  if (type === 'image') return 'image/jpeg'
  if (type === 'video') return 'video/mp4'
  if (type === 'audio') return 'audio/mpeg'
  if (type === 'pdf') return 'application/pdf'
  return 'application/octet-stream'
}

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
