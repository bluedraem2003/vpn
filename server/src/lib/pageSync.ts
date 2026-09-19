import { db, uid } from '../db/index.js'
import { analyzeInstagramPage, type PageInsights, type PagePostInsight } from './pageInsights.js'
import { recordPageSnapshot } from './pageSnapshots.js'
import { isInstagramCoolingDown, instagramCooldownRemainingMs, normalizeHandle } from './instagramSearch.js'
import { notifyAndLog } from '../services/telegram/notify.js'

export type IgSyncStatus = 'live' | 'cooldown' | 'error' | 'pending'

export type PageState = {
  followers: number
  following: number
  posts: number
  name: string
  biography: string
  isPrivate: boolean
  website?: string
  shortcodes: string[]
  lastPostAt?: string
  engagementRate: number
  avgLikes: number
  fetchedAt: string
}

export type NotificationKind =
  | 'page_connected'
  | 'new_post'
  | 'followers_up'
  | 'followers_down'
  | 'bio_changed'
  | 'name_changed'
  | 'website_changed'
  | 'privacy_changed'
  | 'post_removed'
  | 'sync_error'

export type PageEvent = {
  kind: NotificationKind
  meta: Record<string, string | number | boolean>
  url?: string
}

export type SyncResult =
  | { ok: true; status: 'live'; cached: boolean; events: PageEvent[]; page: PageInsights }
  | { ok: false; status: 'cooldown' | 'error'; code: string; retryInSec?: number }

type ProjectRow = Record<string, unknown>

/** Minimum gap between two automatic syncs of the same page. */
export function pageSyncIntervalMs() {
  const raw = Number(process.env.IG_SYNC_INTERVAL_MS)
  return Number.isFinite(raw) && raw >= 5 * 60_000 ? raw : 30 * 60_000
}

export function projectHandle(row: ProjectRow) {
  return normalizeHandle(String(row.handle || row.client_name || ''))
}

function stateFromPage(page: PageInsights): PageState {
  return {
    followers: page.followers,
    following: page.following,
    posts: page.posts,
    name: page.name,
    biography: page.biography,
    isPrivate: page.isPrivate,
    website: page.website,
    shortcodes: page.recentPosts.map((p) => p.shortcode).filter(Boolean),
    lastPostAt: page.lastPostedAt,
    engagementRate: page.engagementRate,
    avgLikes: page.avgLikes,
    fetchedAt: page.fetchedAt,
  }
}

export function parseState(raw: unknown): PageState | null {
  if (typeof raw !== 'string' || !raw) return null
  try {
    const s = JSON.parse(raw) as PageState
    if (typeof s.followers !== 'number' || !Array.isArray(s.shortcodes)) return null
    return s
  } catch {
    return null
  }
}

const FOLLOWER_STEP = 0.01 // notify when followers move at least 1% (min 5)

function diffStates(prev: PageState, next: PageState, page: PageInsights): PageEvent[] {
  const events: PageEvent[] = []
  const prevCodes = new Set(prev.shortcodes)
  const newPosts: PagePostInsight[] = page.recentPosts.filter((p) => p.shortcode && !prevCodes.has(p.shortcode))
  // Only count as new when Instagram's post counter also moved, or post is newer than last known post
  const lastKnown = prev.lastPostAt ? Date.parse(prev.lastPostAt) : 0
  for (const post of newPosts) {
    const taken = Date.parse(post.takenAt)
    if (Number.isFinite(taken) && lastKnown && taken <= lastKnown && next.posts <= prev.posts) continue
    events.push({
      kind: 'new_post',
      url: post.url,
      meta: {
        shortcode: post.shortcode,
        type: post.type,
        likes: post.likes,
        comments: post.comments,
        caption: post.caption.slice(0, 140),
        thumbUrl: post.thumbUrl || '',
        takenAt: post.takenAt,
      },
    })
  }

  const delta = next.followers - prev.followers
  const threshold = Math.max(5, Math.round(prev.followers * FOLLOWER_STEP))
  if (Math.abs(delta) >= threshold) {
    events.push({
      kind: delta > 0 ? 'followers_up' : 'followers_down',
      meta: { from: prev.followers, to: next.followers, delta },
    })
  }

  if (next.posts < prev.posts && newPosts.length === 0) {
    events.push({ kind: 'post_removed', meta: { from: prev.posts, to: next.posts } })
  }
  if (prev.name && next.name && prev.name !== next.name) {
    events.push({ kind: 'name_changed', meta: { from: prev.name, to: next.name } })
  }
  if (prev.biography !== next.biography) {
    events.push({ kind: 'bio_changed', meta: { from: prev.biography.slice(0, 200), to: next.biography.slice(0, 200) } })
  }
  if ((prev.website || '') !== (next.website || '')) {
    events.push({ kind: 'website_changed', meta: { from: prev.website || '', to: next.website || '' } })
  }
  if (prev.isPrivate !== next.isPrivate) {
    events.push({ kind: 'privacy_changed', meta: { isPrivate: next.isPrivate } })
  }
  return events
}

function titleFor(event: PageEvent, handle: string) {
  const m = event.meta
  switch (event.kind) {
    case 'page_connected':
      return `پیج @${handle} وصل شد`
    case 'new_post':
      return `پست جدید روی @${handle}`
    case 'followers_up':
      return `@${handle}: ${Number(m.delta).toLocaleString('fa-IR')} فالوور جدید`
    case 'followers_down':
      return `@${handle}: ${Math.abs(Number(m.delta)).toLocaleString('fa-IR')} فالوور کم شد`
    case 'bio_changed':
      return `بایوی @${handle} تغییر کرد`
    case 'name_changed':
      return `نام @${handle} تغییر کرد`
    case 'website_changed':
      return `لینک بایوی @${handle} تغییر کرد`
    case 'privacy_changed':
      return m.isPrivate ? `@${handle} خصوصی شد` : `@${handle} عمومی شد`
    case 'post_removed':
      return `یک پست از @${handle} حذف شد`
    case 'sync_error':
      return `همگام‌سازی @${handle} ناموفق بود`
  }
}

function bodyFor(event: PageEvent) {
  const m = event.meta
  switch (event.kind) {
    case 'new_post':
      return String(m.caption || '')
    case 'followers_up':
    case 'followers_down':
      return `${Number(m.from).toLocaleString('fa-IR')} → ${Number(m.to).toLocaleString('fa-IR')}`
    case 'name_changed':
    case 'website_changed':
      return `${m.from || '—'} → ${m.to || '—'}`
    case 'bio_changed':
      return String(m.to || '')
    case 'page_connected':
      return `${Number(m.followers).toLocaleString('fa-IR')} فالوور · ${Number(m.posts).toLocaleString('fa-IR')} پست`
    default:
      return ''
  }
}

export function insertNotification(input: {
  workspaceId: string
  projectId?: string | null
  handle?: string
  event: PageEvent
}) {
  const handle = input.handle || ''
  const id = uid('ntf')
  db.prepare(
    `INSERT INTO notifications (id, workspace_id, project_id, handle, kind, title, body, url, meta, read_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)`,
  ).run(
    id,
    input.workspaceId,
    input.projectId || null,
    handle || null,
    input.event.kind,
    titleFor(input.event, handle),
    bodyFor(input.event) || null,
    input.event.url || null,
    JSON.stringify(input.event.meta || {}),
    new Date().toISOString(),
  )
  return id
}

async function pushTelegram(workspaceId: string, handle: string, events: PageEvent[]) {
  const lines = events.map((e) => {
    const body = bodyFor(e)
    return `• ${titleFor(e, handle)}${body ? ` — ${body.replace(/\s+/g, ' ').slice(0, 120)}` : ''}${e.url ? `\n  ${e.url}` : ''}`
  })
  const msg = [`📡 تغییرات پیج @${handle}`, '', ...lines, '', 'از پست‌یار'].join('\n')
  await notifyAndLog({ workspaceId, kind: 'page_event', message: msg })
}

function persistProjectState(
  projectId: string,
  patch: {
    status: IgSyncStatus
    error?: string | null
    state?: PageState
    synced?: boolean
    connected?: boolean
  },
) {
  const now = new Date().toISOString()
  const sets: string[] = ['ig_sync_status = ?', 'ig_last_attempt_at = ?', 'ig_sync_error = ?']
  const params: unknown[] = [patch.status, now, patch.error ?? null]
  if (patch.state) {
    sets.push('ig_state = ?')
    params.push(JSON.stringify(patch.state))
  }
  if (patch.synced) {
    sets.push('ig_last_synced_at = ?')
    params.push(now)
  }
  if (patch.connected) {
    sets.push('ig_connected_at = COALESCE(ig_connected_at, ?)')
    params.push(now)
  }
  params.push(projectId)
  db.prepare(`UPDATE projects SET ${sets.join(', ')} WHERE id = ?`).run(...params)
}

const syncInflight = new Map<string, Promise<SyncResult>>()

/**
 * One-shot sync of a connected page. Never retries: on 429/401 it records a
 * cooldown and returns. Diffs against the last stored state and emits
 * in-app + Telegram notifications for real changes.
 */
export async function syncProject(row: ProjectRow, opts?: { reason?: 'connect' | 'manual' | 'schedule' }): Promise<SyncResult> {
  const projectId = String(row.id)
  const existing = syncInflight.get(projectId)
  if (existing) return existing
  const job = syncProjectUncached(row, opts)
  syncInflight.set(projectId, job)
  try {
    return await job
  } finally {
    syncInflight.delete(projectId)
  }
}

async function syncProjectUncached(row: ProjectRow, opts?: { reason?: 'connect' | 'manual' | 'schedule' }): Promise<SyncResult> {
  const projectId = String(row.id)
  const workspaceId = String(row.workspace_id)
  const handle = projectHandle(row)
  if (!handle) {
    persistProjectState(projectId, { status: 'error', error: 'no_handle' })
    return { ok: false, status: 'error', code: 'no_handle' }
  }

  if (isInstagramCoolingDown()) {
    persistProjectState(projectId, { status: 'cooldown', error: 'rate_limit' })
    return {
      ok: false,
      status: 'cooldown',
      code: 'rate_limit',
      retryInSec: Math.ceil(instagramCooldownRemainingMs() / 1000),
    }
  }

  const result = await analyzeInstagramPage(handle, { fresh: true })
  if (!result.ok) {
    const code = result.error.code
    const status: IgSyncStatus = code === 'rate_limit' ? 'cooldown' : 'error'
    persistProjectState(projectId, { status, error: code })
    if (opts?.reason !== 'schedule' || code !== 'rate_limit') {
      // Surface hard failures (not routine cooldowns) once per attempt
      if (code !== 'rate_limit') {
        insertNotification({ workspaceId, projectId, handle, event: { kind: 'sync_error', meta: { code } } })
      }
    }
    return {
      ok: false,
      status,
      code,
      retryInSec: code === 'rate_limit' ? Math.ceil(instagramCooldownRemainingMs() / 1000) : undefined,
    }
  }

  const page = result.data
  const next = stateFromPage(page)
  const prev = parseState(row.ig_state)
  const events: PageEvent[] = []

  if (result.cached) {
    // Stale report (Instagram is throttling). Keep the page marked live from the
    // last good fetch but do not diff — nothing new was observed.
    persistProjectState(projectId, { status: 'cooldown', error: 'rate_limit', connected: true })
    return { ok: true, status: 'live', cached: true, events, page }
  }

  if (!prev) {
    events.push({ kind: 'page_connected', meta: { followers: page.followers, posts: page.posts } })
  } else {
    events.push(...diffStates(prev, next, page))
  }

  const tx = db.transaction(() => {
    persistProjectState(projectId, { status: 'live', error: null, state: next, synced: true, connected: true })
    for (const event of events) insertNotification({ workspaceId, projectId, handle, event })
  })
  tx()
  recordPageSnapshot(workspaceId, page)

  const pushable = events.filter((e) => e.kind !== 'page_connected')
  if (pushable.length) {
    void pushTelegram(workspaceId, handle, pushable).catch(() => null)
  }

  return { ok: true, status: 'live', cached: false, events, page }
}

/**
 * Scheduler tick: sync at most ONE due page per tick, so Instagram sees a
 * slow trickle rather than a burst. Skips entirely while cooling down.
 */
export async function syncDueConnectedPages(): Promise<{ synced: number; skipped: string }> {
  if (isInstagramCoolingDown()) return { synced: 0, skipped: 'cooldown' }
  const cutoff = new Date(Date.now() - pageSyncIntervalMs()).toISOString()
  const attemptCutoff = new Date(Date.now() - 5 * 60_000).toISOString()
  const row = db
    .prepare(
      `SELECT * FROM projects
       WHERE COALESCE(handle, client_name, '') <> ''
         AND (ig_last_synced_at IS NULL OR ig_last_synced_at < ?)
         AND (ig_last_attempt_at IS NULL OR ig_last_attempt_at < ?)
       ORDER BY ig_last_synced_at ASC NULLS FIRST, created_at ASC
       LIMIT 1`,
    )
    .get(cutoff, attemptCutoff) as ProjectRow | undefined
  if (!row) return { synced: 0, skipped: 'none_due' }
  const res = await syncProject(row, { reason: 'schedule' })
  return { synced: res.ok && !res.cached ? 1 : 0, skipped: res.ok ? '' : res.code }
}

export function mapProjectSync(r: ProjectRow) {
  const state = parseState(r.ig_state)
  return {
    igConnectedAt: (r.ig_connected_at as string | null) || null,
    igLastSyncedAt: (r.ig_last_synced_at as string | null) || null,
    igLastAttemptAt: (r.ig_last_attempt_at as string | null) || null,
    igSyncStatus: ((r.ig_sync_status as IgSyncStatus | null) || (projectHandle(r) ? 'pending' : null)) as
      | IgSyncStatus
      | null,
    igSyncError: (r.ig_sync_error as string | null) || null,
    live: state
      ? {
          followers: state.followers,
          following: state.following,
          posts: state.posts,
          name: state.name,
          biography: state.biography,
          isPrivate: state.isPrivate,
          website: state.website || null,
          lastPostAt: state.lastPostAt || null,
          engagementRate: state.engagementRate,
          avgLikes: state.avgLikes,
          fetchedAt: state.fetchedAt,
        }
      : null,
  }
}
