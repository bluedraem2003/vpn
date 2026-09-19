import { db, uid } from '../../db/index.js'

const apiBase = () => process.env.TELEGRAM_API_BASE || 'https://api.telegram.org'

export function notifyChatId() {
  return process.env.TELEGRAM_NOTIFY_CHAT_ID || process.env.TELEGRAM_CHAT_ID || ''
}

export async function sendTelegramMessage(text: string, chatId?: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const target = chatId || notifyChatId()
  if (!token || !target) {
    console.warn('[Telegram] notify skipped — token/chat missing')
    return { ok: false as const, error: 'not_configured' }
  }

  try {
    const res = await fetch(`${apiBase()}/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: target,
        text,
        disable_web_page_preview: true,
      }),
    })
    const data = (await res.json()) as { ok: boolean; description?: string }
    if (!data.ok) {
      console.error('[Telegram] sendMessage failed', data.description)
      return { ok: false as const, error: data.description || 'send_failed' }
    }
    return { ok: true as const }
  } catch (err) {
    console.error('[Telegram] sendMessage error', (err as Error).message)
    return { ok: false as const, error: (err as Error).message }
  }
}

export function logNotification(input: {
  workspaceId: string
  kind: string
  contentId?: string | null
  assetId?: string | null
  message: string
  status: 'sent' | 'failed' | 'skipped'
}) {
  const id = uid('tgn')
  db.prepare(
    `INSERT INTO telegram_notifications
      (id, workspace_id, content_id, asset_id, kind, message, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    input.workspaceId,
    input.contentId || null,
    input.assetId || null,
    input.kind,
    input.message,
    input.status,
    new Date().toISOString(),
  )
  return id
}

export async function notifyAndLog(input: {
  workspaceId: string
  kind: string
  contentId?: string | null
  assetId?: string | null
  message: string
}) {
  const result = await sendTelegramMessage(input.message)
  logNotification({
    ...input,
    status: result.ok ? 'sent' : 'failed',
  })
  return result
}
