import { db, uid } from '../db/index.js'
import type { PageInsights } from './pageInsights.js'

export type SnapshotPoint = {
  fetchedAt: string
  followers: number
  posts: number
  engagementRate: number
}

export type PageGrowth = {
  previousFetchedAt?: string
  previousFollowers?: number
  followerDelta?: number
  previousPosts?: number
  postsDelta?: number
  previousEngagement?: number
  engagementDelta?: number
  samples: number
  history: SnapshotPoint[]
}

function snapshotHistory(workspaceId: string, handle: string) {
  const samples = (
    db
      .prepare(`SELECT COUNT(*) AS c FROM page_insight_snapshots WHERE workspace_id = ? AND handle = ?`)
      .get(workspaceId, handle) as { c: number }
  ).c

  const history = (
    db
      .prepare(
        `SELECT fetched_at, followers, posts, engagement_rate
         FROM page_insight_snapshots
         WHERE workspace_id = ? AND handle = ?
         ORDER BY fetched_at ASC LIMIT 14`,
      )
      .all(workspaceId, handle) as Array<{
      fetched_at: string
      followers: number
      posts: number
      engagement_rate: number
    }>
  ).map((row) => ({
    fetchedAt: row.fetched_at,
    followers: row.followers,
    posts: row.posts,
    engagementRate: row.engagement_rate,
  }))

  return { samples, history }
}

export function readPageGrowth(workspaceId: string, page: PageInsights): PageGrowth {
  const handle = page.handle.toLowerCase()
  const { samples, history } = snapshotHistory(workspaceId, handle)
  const prev = [...history].reverse().find((h) => h.fetchedAt !== page.fetchedAt)
  if (!prev) return { samples, history }
  return {
    previousFetchedAt: prev.fetchedAt,
    previousFollowers: prev.followers,
    followerDelta: page.followers - prev.followers,
    previousPosts: prev.posts,
    postsDelta: page.posts - prev.posts,
    previousEngagement: prev.engagementRate,
    engagementDelta: Math.round((page.engagementRate - prev.engagementRate) * 100) / 100,
    samples,
    history,
  }
}

export function recordPageSnapshot(workspaceId: string, page: PageInsights): PageGrowth {
  const handle = page.handle.toLowerCase()
  const prev = db
    .prepare(
      `SELECT fetched_at, followers, posts, engagement_rate
       FROM page_insight_snapshots
       WHERE workspace_id = ? AND handle = ?
       ORDER BY fetched_at DESC LIMIT 1`,
    )
    .get(workspaceId, handle) as
    | { fetched_at: string; followers: number; posts: number; engagement_rate: number }
    | undefined

  const now = page.fetchedAt
  const shouldInsert =
    !prev ||
    prev.followers !== page.followers ||
    prev.posts !== page.posts ||
    Date.parse(now) - Date.parse(prev.fetched_at) > 3 * 60 * 60 * 1000

  if (shouldInsert) {
    db.prepare(
      `INSERT INTO page_insight_snapshots
        (id, workspace_id, handle, fetched_at, followers, following, posts, engagement_rate, avg_likes, avg_comments, avg_views)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      uid('pgs'),
      workspaceId,
      handle,
      now,
      page.followers,
      page.following,
      page.posts,
      page.engagementRate,
      page.avgLikes,
      page.avgComments,
      page.avgViews,
    )
  }

  return readPageGrowth(workspaceId, page)
}
