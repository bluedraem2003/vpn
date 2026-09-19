import { Hono } from 'hono'
import { db, uid } from '../db/index.js'
import { notifyAssetIndexed } from '../jobs/reminders.js'
import { requireAuth } from '../middleware/auth.js'
import { safeEqual } from '../lib/secrets.js'

export const telegramRoutes = new Hono()

telegramRoutes.get('/status', requireAuth, (c) => {
  const configured = Boolean(process.env.TELEGRAM_BOT_TOKEN)
  const chatId = process.env.TELEGRAM_CHAT_ID || null
  const count = (
    db.prepare(`SELECT COUNT(*) AS c FROM telegram_sources`).get() as { c: number }
  ).c
  return c.json({
    configured,
    chatIdConfigured: Boolean(chatId),
    webhookSecretConfigured: Boolean(process.env.TELEGRAM_WEBHOOK_SECRET),
    indexedFiles: count,
    limits: {
      botApiMaxDownloadMb: 20,
      historicalSync: 'limited — Bot API cannot fully crawl private channel history',
    },
  })
})

telegramRoutes.post('/webhook', async (c) => {
  console.log('[Telegram] Webhook received')

  // Refuse to index anything unless the webhook is authenticated.
  const secret = (process.env.TELEGRAM_WEBHOOK_SECRET || '').trim()
  if (!secret) {
    console.warn('[Telegram] webhook rejected — TELEGRAM_WEBHOOK_SECRET not set')
    return c.json({ error: 'webhook secret not configured' }, 503)
  }
  const header = c.req.header('X-Telegram-Bot-Api-Secret-Token') || ''
  if (!safeEqual(header, secret)) {
    return c.json({ error: 'unauthorized' }, 401)
  }

  const allowedChat = (process.env.TELEGRAM_CHAT_ID || '').trim()
  if (!allowedChat) {
    console.warn('[Telegram] webhook rejected — TELEGRAM_CHAT_ID not set')
    return c.json({ error: 'chat allowlist not configured' }, 503)
  }
  const update = (await c.req.json().catch(() => ({}))) as Record<string, unknown>
  const message = update.channel_post || update.message
  if (!message) return c.json({ ok: true, ignored: true })

  const chatId = String(message.chat?.id ?? '')
  if (chatId !== allowedChat) {
    console.log('[Telegram] Unauthorized chat', chatId)
    return c.json({ error: 'chat not allowed' }, 403)
  }

  const file = extractTelegramFile(message)
  if (!file) {
    return c.json({ ok: true, ignored: true, reason: 'no file' })
  }

  console.log('[Telegram] File detected', {
    type: file.type,
    uniqueId: file.fileUniqueId,
  })

  const existing = db
    .prepare(`SELECT id, asset_id FROM telegram_sources WHERE telegram_file_unique_id = ?`)
    .get(file.fileUniqueId) as { id: string; asset_id: string } | undefined

  if (existing) {
    console.log('[Telegram] Duplicate ignored', file.fileUniqueId)
    return c.json({ ok: true, duplicate: true, assetId: existing.asset_id })
  }

  const workspace =
    (db.prepare(`SELECT id FROM workspaces ORDER BY created_at ASC LIMIT 1`).get() as
      | { id: string }
      | undefined)
  if (!workspace) return c.json({ error: 'no workspace' }, 500)

  const now = new Date().toISOString()
  const assetId = uid('asset')
  const sourceId = uid('tgs')

  const insertAll = db.transaction(() => {
  db.prepare(
    `INSERT INTO assets (
      id, workspace_id, type, status, virtual_folder, filename, mime_type, file_size,
      width, height, duration, storage_provider, tags, created_at, updated_at
    ) VALUES (?, ?, ?, 'raw', 'raw', ?, ?, ?, ?, ?, ?, 'telegram', '[]', ?, ?)`,
  ).run(
    assetId,
    workspace.id,
    file.type,
    file.filename,
    file.mimeType || null,
    file.fileSize || null,
    file.width || null,
    file.height || null,
    file.duration || null,
    now,
    now,
  )

  db.prepare(
    `INSERT INTO telegram_sources (
      id, asset_id, telegram_file_id, telegram_file_unique_id, telegram_message_id,
      telegram_chat_id, filename, mime_type, file_size, width, height, duration,
      caption, thumbnail_file_id, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    sourceId,
    assetId,
    file.fileId,
    file.fileUniqueId,
    message.message_id,
    chatId,
    file.filename,
    file.mimeType || null,
    file.fileSize || null,
    file.width || null,
    file.height || null,
    file.duration || null,
    message.caption || null,
    file.thumbFileId || null,
    now,
    now,
  )
  })
  insertAll()

  console.log('[Telegram] Asset indexed', assetId)

  // Notify ops chat that new media landed (story/reel uploads to channel)
  void notifyAssetIndexed({
    workspaceId: workspace.id,
    assetId,
    filename: file.filename,
    type: file.type,
    caption: message.caption || null,
  }).catch((err) => console.error('[Telegram] notify asset', (err as Error).message))

  return c.json({ ok: true, assetId })
})

function extractTelegramFile(message: Record<string, unknown>) {
  if (message.photo && Array.isArray(message.photo)) {
    const photos = message.photo as Array<Record<string, unknown>>
    const best = photos[photos.length - 1]
    return {
      type: 'image' as const,
      fileId: String(best.file_id),
      fileUniqueId: String(best.file_unique_id),
      fileSize: Number(best.file_size || 0) || undefined,
      width: Number(best.width || 0) || undefined,
      height: Number(best.height || 0) || undefined,
      filename: `photo_${best.file_unique_id}.jpg`,
      mimeType: 'image/jpeg',
      thumbFileId: undefined as string | undefined,
      duration: undefined as number | undefined,
    }
  }

  const doc = message.document as Record<string, unknown> | undefined
  if (doc) {
    const name = String(doc.file_name || `document_${doc.file_unique_id}`)
    const mime = String(doc.mime_type || '')
    let type: 'document' | 'pdf' | 'archive' | 'image' | 'video' | 'audio' | 'other' = 'document'
    if (mime.includes('pdf') || name.endsWith('.pdf')) type = 'pdf'
    else if (/zip|rar|7z|tar|gz/i.test(name) || mime.includes('zip')) type = 'archive'
    else if (mime.startsWith('image/')) type = 'image'
    else if (mime.startsWith('video/')) type = 'video'
    else if (mime.startsWith('audio/')) type = 'audio'
    const thumb = doc.thumb as Record<string, unknown> | undefined
    return {
      type,
      fileId: String(doc.file_id),
      fileUniqueId: String(doc.file_unique_id),
      fileSize: Number(doc.file_size || 0) || undefined,
      width: thumb ? Number(thumb.width || 0) || undefined : undefined,
      height: thumb ? Number(thumb.height || 0) || undefined : undefined,
      filename: name,
      mimeType: mime || undefined,
      thumbFileId: thumb ? String(thumb.file_id) : undefined,
      duration: undefined,
    }
  }

  const video = message.video as Record<string, unknown> | undefined
  if (video) {
    const thumb = video.thumb as Record<string, unknown> | undefined
    return {
      type: 'video' as const,
      fileId: String(video.file_id),
      fileUniqueId: String(video.file_unique_id),
      fileSize: Number(video.file_size || 0) || undefined,
      width: Number(video.width || 0) || undefined,
      height: Number(video.height || 0) || undefined,
      duration: Number(video.duration || 0) || undefined,
      filename: String(video.file_name || `video_${video.file_unique_id}.mp4`),
      mimeType: String(video.mime_type || 'video/mp4'),
      thumbFileId: thumb ? String(thumb.file_id) : undefined,
    }
  }

  const audio = (message.audio || message.voice) as Record<string, unknown> | undefined
  if (audio) {
    return {
      type: 'audio' as const,
      fileId: String(audio.file_id),
      fileUniqueId: String(audio.file_unique_id),
      fileSize: Number(audio.file_size || 0) || undefined,
      width: undefined,
      height: undefined,
      duration: Number(audio.duration || 0) || undefined,
      filename: String(audio.file_name || `audio_${audio.file_unique_id}.mp3`),
      mimeType: String(audio.mime_type || 'audio/mpeg'),
      thumbFileId: undefined,
    }
  }

  return null
}
