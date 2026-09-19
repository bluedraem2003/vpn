import { db } from '../db/index.js'
import { signInstagramMediaUrl } from './igMedia.js'
import type { PageInsights, PagePostInsight, RelatedProfile } from './pageInsights.js'

function resignPath(pathOrUrl?: string) {
  if (!pathOrUrl) return undefined
  try {
    const parsed = pathOrUrl.startsWith('/')
      ? new URL(pathOrUrl, 'http://postyar.local')
      : new URL(pathOrUrl)
    const raw = parsed.searchParams.get('url') || pathOrUrl
    return signInstagramMediaUrl(raw) || pathOrUrl
  } catch {
    return pathOrUrl
  }
}

function resignPost(post?: PagePostInsight) {
  if (!post) return post
  return { ...post, thumbUrl: resignPath(post.thumbUrl) }
}

export function resignPageReport(page: PageInsights): PageInsights {
  return {
    ...page,
    avatarUrl: resignPath(page.avatarUrl),
    relatedProfiles: (page.relatedProfiles || []).map((rel: RelatedProfile) => ({
      ...rel,
      avatarUrl: resignPath(rel.avatarUrl),
    })),
    recentPosts: (page.recentPosts || []).map((p) => resignPost(p)!),
    bestPost: resignPost(page.bestPost),
    weakestPost: resignPost(page.weakestPost),
  }
}

export function saveIgPageReport(page: PageInsights) {
  const handle = page.handle.toLowerCase()
  db.prepare(
    `INSERT INTO ig_page_reports (handle, fetched_at, payload)
     VALUES (?, ?, ?)
     ON CONFLICT(handle) DO UPDATE SET
       fetched_at = excluded.fetched_at,
       payload = excluded.payload`,
  ).run(handle, page.fetchedAt, JSON.stringify(page))
}

export function loadIgPageReport(handle: string): PageInsights | null {
  const row = db
    .prepare(`SELECT payload FROM ig_page_reports WHERE handle = ?`)
    .get(handle.trim().replace(/^@+/, '').toLowerCase()) as { payload: string } | undefined
  if (!row?.payload) return null
  try {
    const data = JSON.parse(row.payload) as PageInsights
    if (!data?.handle || !Array.isArray(data.recentPosts)) return null
    return resignPageReport(data)
  } catch {
    return null
  }
}
