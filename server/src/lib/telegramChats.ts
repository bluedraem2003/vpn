import { db } from '../db/index.js'
import { notifyChatId } from '../services/telegram/notify.js'

const LEFT_STATUSES = new Set(['left', 'kicked'])
const INGEST_TYPES = new Set(['group', 'supergroup', 'channel'])
const STALE_MS = 6 * 60 * 60 * 1000

export type TelegramApiChat = {
  id?: unknown
  type?: unknown
  title?: unknown
  username?: unknown
  first_name?: unknown
  last_name?: unknown
}

export type TelegramChatRow = {
  chat_id: string
  title: string | null
  username: string | null
  type: string
  member_status: string | null
  ingesting: number
  last_seen_at: string | null
  last_file_at: string | null
  created_at: string
  updated_at: string
}

export type TelegramChatDto = {
  chatId: string
  title: string
  username: string | null
  type: string
  memberStatus: string | null
  connected: boolean
  ingesting: boolean
  fileCount: number
  lastFileAt: string | null
  lastSeenAt: string | null
  notifyChat: boolean
}

type TgOk<T> = { ok: true; result: T }
type TgErr = { ok: false; description?: string }

let botCache: { id: number; username: string; name: string; fetchedAt: number } | null = null

export function isConnectedStatus(status?: string | null) {
  if (!status) return true
  return !LEFT_STATUSES.has(status)
}

export function guessChatType(chatId: string) {
  if (chatId.startsWith('-100')) return 'supergroup'
  if (chatId.startsWith('-')) return 'group'
  return 'private'
}

export function telegramChatTitle(chat: TelegramApiChat): string | null {
  const title = String(chat.title || '').trim()
  if (title) return title
  const name = [chat.first_name, chat.last_name]
    .map((part) => String(part || '').trim())
    .filter(Boolean)
    .join(' ')
  if (name) return name
  const username = String(chat.username || '').trim()
  if (username) return `@${username.replace(/^@/, '')}`
  return null
}

export function canIngestFromChat(input: {
  chatId: string
  type: string
  memberStatus?: string | null
  allowedChatId?: string
}) {
  if (input.memberStatus && LEFT_STATUSES.has(input.memberStatus)) return false
  if (INGEST_TYPES.has(input.type)) return true
  const allowed = (input.allowedChatId ?? process.env.TELEGRAM_CHAT_ID ?? '').trim()
  return Boolean(allowed) && input.chatId === allowed
}

export function extractTelegramUpdate(update: Record<string, unknown>) {
  const membership = update.my_chat_member as Record<string, unknown> | undefined
  if (membership && membership.chat && typeof membership.chat === 'object') {
    const newMember = membership.new_chat_member as Record<string, unknown> | undefined
    return {
      kind: 'membership' as const,
      chat: membership.chat as TelegramApiChat,
      memberStatus: String(newMember?.status || '') || null,
      message: null as Record<string, unknown> | null,
    }
  }
  const message = (update.channel_post || update.message) as Record<string, unknown> | undefined
  if (message && message.chat && typeof message.chat === 'object') {
    return {
      kind: 'message' as const,
      chat: message.chat as TelegramApiChat,
      memberStatus: undefined as string | undefined,
      message,
    }
  }
  return null
}

export function getTelegramChat(chatId: string) {
  return db.prepare(`SELECT * FROM telegram_chats WHERE chat_id = ?`).get(chatId) as
    | TelegramChatRow
    | undefined
}

export function upsertTelegramChat(input: {
  chatId: string
  type?: string | null
  title?: string | null
  username?: string | null
  memberStatus?: string | null
  lastSeenAt?: string | null
  lastFileAt?: string | null
}) {
  const now = new Date().toISOString()
  const existing = getTelegramChat(input.chatId)
  const type = (input.type && String(input.type).trim()) || existing?.type || guessChatType(input.chatId)
  const title =
    input.title && String(input.title).trim() ? String(input.title).trim() : existing?.title || null
  const username =
    input.username && String(input.username).trim()
      ? String(input.username).trim().replace(/^@/, '')
      : existing?.username || null
  const memberStatus =
    input.memberStatus != null && String(input.memberStatus).trim()
      ? String(input.memberStatus).trim()
      : existing?.member_status || null
  const lastSeenAt = input.lastSeenAt || existing?.last_seen_at || now
  const lastFileAt = input.lastFileAt || existing?.last_file_at || null
  const ingesting = canIngestFromChat({
    chatId: input.chatId,
    type,
    memberStatus,
    allowedChatId: (process.env.TELEGRAM_CHAT_ID || '').trim(),
  })
    ? 1
    : 0

  if (!existing) {
    db.prepare(
      `INSERT INTO telegram_chats (
        chat_id, title, username, type, member_status, ingesting,
        last_seen_at, last_file_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      input.chatId,
      title,
      username,
      type,
      memberStatus,
      ingesting,
      lastSeenAt,
      lastFileAt,
      now,
      now,
    )
    return getTelegramChat(input.chatId)!
  }

  db.prepare(
    `UPDATE telegram_chats SET
      title = ?, username = ?, type = ?, member_status = ?, ingesting = ?,
      last_seen_at = ?, last_file_at = ?, updated_at = ?
     WHERE chat_id = ?`,
  ).run(title, username, type, memberStatus, ingesting, lastSeenAt, lastFileAt, now, input.chatId)
  return getTelegramChat(input.chatId)!
}

export function backfillTelegramChatsFromSources() {
  const rows = db
    .prepare(
      `SELECT telegram_chat_id AS id, COUNT(*) AS c, MAX(created_at) AS last
       FROM telegram_sources GROUP BY telegram_chat_id`,
    )
    .all() as Array<{ id: string; c: number; last: string | null }>
  for (const row of rows) {
    if (!row.id) continue
    const existing = getTelegramChat(row.id)
    if (!existing) {
      upsertTelegramChat({
        chatId: row.id,
        type: guessChatType(row.id),
        lastFileAt: row.last,
        lastSeenAt: row.last,
      })
    } else if (row.last && !existing.last_file_at) {
      upsertTelegramChat({ chatId: row.id, lastFileAt: row.last })
    }
  }
}

export function seedConfiguredChat() {
  const id = (process.env.TELEGRAM_CHAT_ID || '').trim()
  if (!id) return
  if (!getTelegramChat(id)) {
    upsertTelegramChat({ chatId: id, type: guessChatType(id) })
  }
}

export function listTelegramChats(): TelegramChatDto[] {
  const notifyId = notifyChatId().trim()
  const rows = db
    .prepare(
      `SELECT
         c.chat_id,
         c.title,
         c.username,
         c.type,
         c.member_status,
         c.ingesting,
         c.last_seen_at,
         c.last_file_at,
         COALESCE(s.file_count, 0) AS file_count,
         s.last_file_at AS source_last_file_at
       FROM telegram_chats c
       LEFT JOIN (
         SELECT telegram_chat_id, COUNT(*) AS file_count, MAX(created_at) AS last_file_at
         FROM telegram_sources
         GROUP BY telegram_chat_id
       ) s ON s.telegram_chat_id = c.chat_id
       ORDER BY
         CASE WHEN c.member_status IN ('left', 'kicked') THEN 1 ELSE 0 END ASC,
         COALESCE(s.last_file_at, c.last_file_at, c.last_seen_at, c.updated_at) DESC`,
    )
    .all() as Array<{
    chat_id: string
    title: string | null
    username: string | null
    type: string
    member_status: string | null
    ingesting: number
    last_seen_at: string | null
    last_file_at: string | null
    file_count: number
    source_last_file_at: string | null
  }>

  return rows.map((row) => {
    const connected = isConnectedStatus(row.member_status)
    const ingesting = canIngestFromChat({
      chatId: row.chat_id,
      type: row.type,
      memberStatus: row.member_status,
      allowedChatId: (process.env.TELEGRAM_CHAT_ID || '').trim(),
    })
    const username = row.username ? row.username.replace(/^@/, '') : null
    return {
      chatId: row.chat_id,
      title: row.title || (username ? `@${username}` : row.chat_id),
      username,
      type: row.type,
      memberStatus: row.member_status,
      connected,
      ingesting,
      fileCount: Number(row.file_count || 0),
      lastFileAt: row.source_last_file_at || row.last_file_at,
      lastSeenAt: row.last_seen_at,
      notifyChat: Boolean(notifyId) && row.chat_id === notifyId,
    }
  })
}

async function telegramMethod<T>(
  method: string,
  body?: Record<string, unknown>,
): Promise<TgOk<T> | TgErr> {
  const token = (process.env.TELEGRAM_BOT_TOKEN || '').trim()
  if (!token) return { ok: false, description: 'not_configured' }
  const base = (process.env.TELEGRAM_API_BASE || 'https://api.telegram.org').replace(/\/$/, '')
  try {
    const res = await fetch(`${base}/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {}),
      signal: AbortSignal.timeout(8000),
    })
    return (await res.json()) as TgOk<T> | TgErr
  } catch (err) {
    return { ok: false, description: (err as Error).message }
  }
}

export async function refreshTelegramChat(chatId: string) {
  const data = await telegramMethod<TelegramApiChat>('getChat', { chat_id: chatId })
  if (data.ok) {
    upsertTelegramChat({
      chatId: String(data.result.id ?? chatId),
      type: String(data.result.type || guessChatType(chatId)),
      title: telegramChatTitle(data.result),
      username: data.result.username ? String(data.result.username) : undefined,
      lastSeenAt: new Date().toISOString(),
    })
    const me = await getBotIdentity()
    if (me?.id) {
      const member = await telegramMethod<{ status?: string }>('getChatMember', {
        chat_id: chatId,
        user_id: me.id,
      })
      if (member.ok && member.result.status) {
        upsertTelegramChat({ chatId, memberStatus: String(member.result.status) })
      }
    }
    return
  }
  const desc = (data.description || '').toLowerCase()
  if (/not a member|kicked|chat not found|bot is not a|bot was blocked/.test(desc)) {
    const existing = getTelegramChat(chatId)
    upsertTelegramChat({
      chatId,
      type: existing?.type || guessChatType(chatId),
      memberStatus: 'left',
    })
  }
}

function needsMetaRefresh(row: { title: string | null; updated_at: string }) {
  if (!row.title) return true
  const stamp = Date.parse(row.updated_at)
  if (!Number.isFinite(stamp)) return true
  return Date.now() - stamp > STALE_MS
}

export async function ensureTelegramChatsFresh() {
  backfillTelegramChatsFromSources()
  seedConfiguredChat()
  const rows = db
    .prepare(`SELECT chat_id, title, updated_at FROM telegram_chats`)
    .all() as Array<{ chat_id: string; title: string | null; updated_at: string }>
  const due = rows.filter(needsMetaRefresh).slice(0, 8)
  if (due.length) {
    await Promise.all(due.map((row) => refreshTelegramChat(row.chat_id)))
  }
}

export async function getBotIdentity() {
  if (botCache && Date.now() - botCache.fetchedAt < 10 * 60 * 1000) return botCache
  const data = await telegramMethod<{ id: number; username?: string; first_name?: string }>('getMe')
  if (!data.ok) return botCache
  botCache = {
    id: data.result.id,
    username: data.result.username || '',
    name: data.result.first_name || '',
    fetchedAt: Date.now(),
  }
  return botCache
}
