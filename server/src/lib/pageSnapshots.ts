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

  if (!prev) return { samples, history }

  return {
    previousFetchedAt: prev.fetched_at,
    previousFollowers: prev.followers,
    followerDelta: page.followers - prev.followers,
    previousPosts: prev.posts,
    postsDelta: page.posts - prev.posts,
    previousEngagement: prev.engagement_rate,
    engagementDelta: Math.round((page.engagementRate - prev.engagement_rate) * 100) / 100,
    samples,
    history,
  }
}
