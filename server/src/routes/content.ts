import { Hono } from 'hono'
import { db, uid } from '../db/index.js'
import { assertWorkspaceAccess, requireAuth } from '../middleware/auth.js'
import { notifyContentPublished } from '../jobs/reminders.js'
import { hitRateLimit } from '../middleware/rateLimit.js'
import { runMissedScheduleReminders } from '../jobs/reminders.js'
import { resolveCampaignId, resolveProjectId } from '../lib/refs.js'
import { parseHashtags } from '../lib/hashtags.js'

export const contentRoutes = new Hono()
contentRoutes.use('*', requireAuth)

/** Manual / cron trigger for missed-schedule reminders */
contentRoutes.post('/jobs/remind-missed', async (c) => {
  const role = c.get('role')
  if (!['admin', 'manager'].includes(role)) {
    return c.json({ error: 'فقط ادمین/مدیر' }, 403)
  }
  if (hitRateLimit(`remind:${c.get('userId')}`, 10, 60_000)) {
    return c.json({ error: 'محدودیت درخواست' }, 429)
  }
  const result = await runMissedScheduleReminders()
  return c.json({ ok: true, ...result })
})

contentRoutes.get('/', (c) => {
  const workspaceId = c.req.query('workspaceId') || c.get('workspaceId')
  assertWorkspaceAccess(c, workspaceId)

  const status = c.req.query('status')
  const projectId = c.req.query('projectId')
  const campaignId = c.req.query('campaignId')
  const contentType = c.req.query('type')
  const q = (c.req.query('q') || '').trim()
  const from = c.req.query('from')
  const to = c.req.query('to')
  const clauses = ['workspace_id = ?']
  const params: string[] = [workspaceId]
  if (status) {
    clauses.push('status = ?')
    params.push(status)
  }
  if (projectId) {
    clauses.push('project_id = ?')
    params.push(projectId)
  }
  if (campaignId) {
    clauses.push('campaign_id = ?')
    params.push(campaignId)
  }
  if (contentType) {
    clauses.push('content_type = ?')
    params.push(contentType)
  }
  if (from) {
    clauses.push('publish_date >= ?')
    params.push(from)
  }
  if (to) {
    clauses.push('publish_date <= ?')
    params.push(to)
  }
  if (q) {
    clauses.push('(title LIKE ? OR IFNULL(caption, \'\') LIKE ? OR IFNULL(notes, \'\') LIKE ?)')
    const like = `%${q}%`
    params.push(like, like, like)
  }
  const rows = db
    .prepare(`SELECT * FROM contents WHERE ${clauses.join(' AND ')} ORDER BY updated_at DESC`)
    .all(...params)

  return c.json({ items: rows.map(mapContent) })
})

contentRoutes.get('/:id/assets', (c) => {
  const id = c.req.param('id')
  const content = db.prepare(`SELECT * FROM contents WHERE id = ?`).get(id) as Record<string, unknown> | undefined
  if (!content) return c.json({ error: 'محتوا پیدا نشد' }, 404)
  assertWorkspaceAccess(c, String(content.workspace_id))

  const rows = db
    .prepare(
      `SELECT a.*, ca.role AS attach_role, ca.sort_order, ca.id AS link_id
       FROM content_assets ca
       JOIN assets a ON a.id = ca.asset_id
       WHERE ca.content_id = ?
       ORDER BY ca.sort_order ASC, a.created_at DESC`,
    )
    .all(id)

  return c.json({
    items: rows.map((row) => {
      const r = row as Record<string, unknown>
      return {
        linkId: r.link_id,
        role: r.attach_role,
        sortOrder: r.sort_order,
        id: r.id,
        filename: r.filename,
        type: r.type,
        status: r.status,
        fileSize: r.file_size,
        width: r.width,
        height: r.height,
      }
    }),
  })
})

contentRoutes.post('/', async (c) => {
  const body = await c.req.json()
  const now = new Date().toISOString()
  const id = uid('cnt')
  const workspaceId = body.workspaceId || c.get('workspaceId')
  assertWorkspaceAccess(c, workspaceId)

  if (!body.title || !body.contentType) {
    return c.json({ error: 'title و contentType الزامی هستند' }, 400)
  }

  const project = resolveProjectId(workspaceId, body.projectId)
  if (project.error) return c.json({ error: project.error }, 400)
  const projectId = project.id

  const campaign = resolveCampaignId(workspaceId, body.campaignId)
  if (campaign.error) return c.json({ error: campaign.error }, 400)
  const campaignId = campaign.id

  // occasion_id is soft reference (no FK) — ignore unknown ids
  const occasionId =
    body.occasionId &&
    db.prepare(`SELECT id FROM occasions WHERE id = ?`).get(body.occasionId)
      ? body.occasionId
      : null

  const status = body.status || (body.publishDate ? 'scheduled' : 'planned')
  try {
    db.prepare(
      `INSERT INTO contents (
      id, workspace_id, project_id, campaign_id, assignee_id, title, description,
      platforms, content_type, status, publish_date, publish_time, caption, hashtags,
      notes, ai_meta, window_start, window_end, occasion_id, reminded_at, first_comment, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      workspaceId,
      projectId,
      campaignId,
      body.assigneeId || null,
      body.title,
      body.description || null,
      JSON.stringify(body.platforms || ['instagram']),
      body.contentType,
      status,
      body.publishDate || null,
      body.publishTime || body.windowStart || null,
      body.caption || null,
      JSON.stringify(parseHashtags(body.hashtags)),
      body.notes || null,
      JSON.stringify(body.aiMeta || {}),
      body.windowStart || null,
      body.windowEnd || null,
      occasionId,
      null,
      body.firstComment || null,
      now,
      now,
    )
  } catch (err) {
    console.error('[Content] create failed', (err as Error).message)
    return c.json({ error: 'ذخیره محتوا ناموفق بود. پیج/کمپین را دوباره انتخاب کنید.' }, 400)
  }

  db.prepare(
    `INSERT INTO content_status_history (id, content_id, from_status, to_status, changed_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(uid('csh'), id, null, status, c.get('userId'), now)

  const row = db.prepare(`SELECT * FROM contents WHERE id = ?`).get(id)
  return c.json({ item: mapContent(row) }, 201)
})

contentRoutes.patch('/:id', async (c) => {
  const id = c.req.param('id')
  const existing = db.prepare(`SELECT * FROM contents WHERE id = ?`).get(id) as Record<string, unknown> | undefined
  if (!existing) return c.json({ error: 'محتوا پیدا نشد' }, 404)
  assertWorkspaceAccess(c, String(existing.workspace_id))

  const body = await c.req.json()
  const now = new Date().toISOString()
  const nextStatus = body.status ?? existing.status

  const project =
    body.projectId !== undefined
      ? resolveProjectId(String(existing.workspace_id), body.projectId)
      : { id: (existing.project_id as string | null) || null }
  if (project.error) return c.json({ error: project.error }, 400)

  const campaign =
    body.campaignId !== undefined
      ? resolveCampaignId(String(existing.workspace_id), body.campaignId)
      : { id: (existing.campaign_id as string | null) || null }
  if (campaign.error) return c.json({ error: campaign.error }, 400)

  if (body.status && body.status !== existing.status) {
    db.prepare(
      `INSERT INTO content_status_history (id, content_id, from_status, to_status, changed_by, note, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(uid('csh'), id, existing.status, body.status, c.get('userId'), body.statusNote || null, now)
  }

  try {
    db.prepare(
      `UPDATE contents SET
      title = ?, description = ?, platforms = ?, content_type = ?, status = ?,
      publish_date = ?, publish_time = ?, caption = ?, hashtags = ?, notes = ?,
      project_id = ?, campaign_id = ?, window_start = ?, window_end = ?, occasion_id = ?,
      first_comment = ?, updated_at = ?
     WHERE id = ?`,
    ).run(
      body.title ?? existing.title,
      body.description ?? existing.description,
      JSON.stringify(body.platforms ?? JSON.parse(String(existing.platforms || '[]'))),
      body.contentType ?? existing.content_type,
      nextStatus,
      body.publishDate !== undefined ? body.publishDate || null : existing.publish_date,
      body.publishTime !== undefined ? body.publishTime || null : existing.publish_time,
      body.caption !== undefined ? body.caption || null : existing.caption,
      JSON.stringify(body.hashtags !== undefined ? parseHashtags(body.hashtags) : parseHashtags(existing.hashtags)),
      body.notes !== undefined ? body.notes || null : existing.notes,
      project.id,
      campaign.id,
      body.windowStart !== undefined ? body.windowStart || null : existing.window_start,
      body.windowEnd !== undefined ? body.windowEnd || null : existing.window_end,
      body.occasionId !== undefined ? body.occasionId || null : existing.occasion_id,
      body.firstComment !== undefined ? body.firstComment || null : existing.first_comment,
      now,
      id,
    )
  } catch (err) {
    console.error('[Content] update failed', (err as Error).message)
    return c.json({ error: 'به‌روزرسانی محتوا ناموفق بود. پیج/کمپین را دوباره انتخاب کنید.' }, 400)
  }

  const row = db.prepare(`SELECT * FROM contents WHERE id = ?`).get(id) as Record<string, unknown>

  // When marked published → notify Telegram group/bot
  if (body.status === 'published' && existing.status !== 'published') {
    void notifyContentPublished(row).catch((err) =>
      console.error('[Notify] published', (err as Error).message),
    )
  }

  return c.json({ item: mapContent(row) })
})

contentRoutes.delete('/:id', (c) => {
  const id = c.req.param('id')
  const existing = db.prepare(`SELECT * FROM contents WHERE id = ?`).get(id) as Record<string, unknown> | undefined
  if (!existing) return c.json({ error: 'محتوا پیدا نشد' }, 404)
  assertWorkspaceAccess(c, String(existing.workspace_id))
  db.prepare(`DELETE FROM contents WHERE id = ?`).run(id)
  return c.json({ ok: true })
})

contentRoutes.post('/:id/duplicate', async (c) => {
  const id = c.req.param('id')
  const existing = db.prepare(`SELECT * FROM contents WHERE id = ?`).get(id) as Record<string, unknown> | undefined
  if (!existing) return c.json({ error: 'محتوا پیدا نشد' }, 404)
  assertWorkspaceAccess(c, String(existing.workspace_id))

  const body = await c.req.json().catch(() => ({} as Record<string, unknown>))
  const now = new Date().toISOString()
  const newId = uid('cnt')
  const publishDate = body.publishDate ? String(body.publishDate) : existing.publish_date
  const status = publishDate ? 'scheduled' : 'planned'

  db.prepare(
    `INSERT INTO contents (
      id, workspace_id, project_id, campaign_id, assignee_id, title, description,
      platforms, content_type, status, publish_date, publish_time, caption, hashtags,
      notes, ai_meta, window_start, window_end, occasion_id, reminded_at, first_comment, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    newId,
    existing.workspace_id,
    existing.project_id,
    existing.campaign_id,
    existing.assignee_id,
    body.title ? String(body.title) : `${existing.title} (کپی)`,
    existing.description,
    existing.platforms,
    existing.content_type,
    status,
    publishDate || null,
    existing.publish_time,
    existing.caption,
    existing.hashtags,
    existing.notes,
    existing.ai_meta,
    existing.window_start,
    existing.window_end,
    existing.occasion_id,
    null,
    existing.first_comment,
    now,
    now,
  )

  const links = db
    .prepare(`SELECT asset_id, role, sort_order FROM content_assets WHERE content_id = ?`)
    .all(id) as Array<{ asset_id: string; role: string; sort_order: number }>
  const insertLink = db.prepare(
    `INSERT INTO content_assets (id, content_id, asset_id, role, sort_order) VALUES (?, ?, ?, ?, ?)`,
  )
  for (const link of links) {
    insertLink.run(uid('ca'), newId, link.asset_id, link.role || 'other', link.sort_order || 0)
  }

  db.prepare(
    `INSERT INTO content_status_history (id, content_id, from_status, to_status, changed_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(uid('csh'), newId, null, status, c.get('userId'), now)

  const row = db.prepare(`SELECT * FROM contents WHERE id = ?`).get(newId)
  return c.json({ item: mapContent(row) }, 201)
})

contentRoutes.delete('/:id/assets/:linkId', (c) => {
  const contentId = c.req.param('id')
  const linkId = c.req.param('linkId')
  const content = db.prepare(`SELECT * FROM contents WHERE id = ?`).get(contentId) as Record<string, unknown> | undefined
  if (!content) return c.json({ error: 'محتوا پیدا نشد' }, 404)
  assertWorkspaceAccess(c, String(content.workspace_id))
  const link = db
    .prepare(`SELECT * FROM content_assets WHERE id = ? AND content_id = ?`)
    .get(linkId, contentId) as Record<string, unknown> | undefined
  if (!link) return c.json({ error: 'فایل متصل پیدا نشد' }, 404)
  db.prepare(`DELETE FROM content_assets WHERE id = ?`).run(linkId)
  return c.json({ ok: true })
})

function mapContent(row: unknown) {
  const r = row as Record<string, unknown>
  return {
    id: r.id,
    workspaceId: r.workspace_id,
    projectId: r.project_id,
    campaignId: r.campaign_id,
    assigneeId: r.assignee_id,
    title: r.title,
    description: r.description,
    platforms: JSON.parse(String(r.platforms || '[]')),
    contentType: r.content_type,
    status: r.status,
    publishDate: r.publish_date,
    publishTime: r.publish_time,
    windowStart: r.window_start,
    windowEnd: r.window_end,
    occasionId: r.occasion_id,
    remindedAt: r.reminded_at,
    caption: r.caption,
    firstComment: r.first_comment,
    hashtags: parseHashtags(r.hashtags),
    notes: r.notes,
    aiMeta: JSON.parse(String(r.ai_meta || '{}')),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}
