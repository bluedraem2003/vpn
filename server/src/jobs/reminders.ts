import { db } from '../db/index.js'
import { notifyAndLog } from '../services/telegram/notify.js'

const TYPE_LABELS: Record<string, string> = {
  reel: 'ریلز',
  story: 'استوری',
  post: 'پست',
  carousel: 'کاروسل',
  video: 'ویدیو',
  photo: 'عکس',
  short: 'شورت',
  other: 'سایر',
}

function iranNowParts() {
  // Asia/Tehran offset is +03:30 without DST since 2022
  const now = new Date()
  const tehran = new Date(now.getTime() + 3.5 * 60 * 60 * 1000)
  const iso = tehran.toISOString()
  return {
    date: iso.slice(0, 10),
    time: iso.slice(11, 16), // HH:mm
    stamp: now.toISOString(),
  }
}

function compareHm(a: string, b: string) {
  return a.localeCompare(b)
}

/** Contents whose schedule window ended today (or earlier) without being published. */
export async function runMissedScheduleReminders() {
  const { date: today, time: nowHm, stamp } = iranNowParts()

  const rows = db
    .prepare(
      `SELECT * FROM contents
       WHERE publish_date IS NOT NULL
         AND status NOT IN ('published', 'archived')
         AND reminded_at IS NULL
         AND (
           publish_date < ?
           OR (publish_date = ? AND COALESCE(window_end, publish_time) IS NOT NULL)
         )`,
    )
    .all(today, today) as Array<Record<string, unknown>>

  let sent = 0
  for (const row of rows) {
    const publishDate = String(row.publish_date)
    const windowEnd = String(row.window_end || row.publish_time || '23:59')
    const windowStart = String(row.window_start || row.publish_time || '00:00')

    const past =
      publishDate < today || (publishDate === today && compareHm(nowHm, windowEnd) > 0)
    if (!past) continue

    const type = String(row.content_type)
    const typeLabel = TYPE_LABELS[type] || type
    const title = String(row.title)
    const msg = [
      '⚠️ اوستا اینو نذاشتی!',
      '',
      `محتوا: ${title}`,
      `نوع: ${typeLabel}`,
      `برنامه: ${publishDate} از ${windowStart} تا ${windowEnd}`,
      `وضعیت فعلی: ${row.status}`,
      '',
      'اگر گذاشتی، توی اپ وضعیت را «منتشر شده» کن.',
    ].join('\n')

    const result = await notifyAndLog({
      workspaceId: String(row.workspace_id),
      kind: 'missed_schedule',
      contentId: String(row.id),
      message: msg,
    })

    if (result.ok) {
      db.prepare(`UPDATE contents SET reminded_at = ?, updated_at = ? WHERE id = ?`).run(
        stamp,
        stamp,
        row.id,
      )
      sent++
    }
  }

  return { checked: rows.length, sent }
}

export async function notifyContentPublished(row: Record<string, unknown>) {
  const type = String(row.content_type)
  if (!['story', 'reel', 'post', 'carousel', 'short'].includes(type)) {
    return { ok: false as const, skipped: true }
  }

  // Dedup: already notified for this content+kind
  const existing = db
    .prepare(
      `SELECT id FROM telegram_notifications
       WHERE content_id = ? AND kind = 'content_published' AND status = 'sent' LIMIT 1`,
    )
    .get(row.id)
  if (existing) return { ok: true as const, duplicate: true }

  const typeLabel = TYPE_LABELS[type] || type
  const project = row.project_id
    ? (db.prepare(`SELECT name FROM projects WHERE id = ?`).get(row.project_id) as
        | { name: string }
        | undefined)
    : undefined

  const msg = [
    '✅ کانتنت آپلود / منتشر شد',
    '',
    `عنوان: ${row.title}`,
    `نوع: ${typeLabel}`,
    project ? `پروژه/پیج: ${project.name}` : null,
    row.publish_date ? `تاریخ برنامه: ${row.publish_date}` : null,
    row.window_start || row.window_end
      ? `بازه: ${row.window_start || '—'} تا ${row.window_end || '—'}`
      : null,
    '',
    'از پست‌یار ✨',
  ]
    .filter(Boolean)
    .join('\n')

  return notifyAndLog({
    workspaceId: String(row.workspace_id),
    kind: 'content_published',
    contentId: String(row.id),
    message: msg,
  })
}

export async function notifyAssetIndexed(input: {
  workspaceId: string
  assetId: string
  filename: string
  type: string
  caption?: string | null
}) {
  const msg = [
    '📥 فایل جدید در کانال ایندکس شد',
    '',
    `فایل: ${input.filename}`,
    `نوع: ${input.type}`,
    input.caption ? `کپشن: ${input.caption}` : null,
    '',
    'اگر این استوری/ریلز منتشرشده است، در اپ محتوا را «منتشر شده» کنید.',
  ]
    .filter(Boolean)
    .join('\n')

  return notifyAndLog({
    workspaceId: input.workspaceId,
    kind: 'asset_indexed',
    assetId: input.assetId,
    message: msg,
  })
}
