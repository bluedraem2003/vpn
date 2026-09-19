import type { PageAnalyticsResponse, PageInsights } from '../api/client'

export type CollabSnapshot = {
  handle: string
  name: string
  biography: string
  avatarUrl?: string
  verified: boolean
  isProfessional: boolean
  isBusiness: boolean
  isPrivate: boolean
  category?: string
  website?: string
  followers: number
  following: number
  posts: number
  engagementRate: number
  avgLikes: number
  avgComments: number
  avgViews: number
  followerFollowingRatio: number
  commentsToLikes: number
  reelPlayRate: number | null
  postCadenceDays: number | null
  mix: { reel: number; carousel: number; post: number }
  healthScore: number
  bestDay?: string
  bestHour?: string
  lastPostedAt?: string
  topHashtags: Array<{ key: string; count: number; avgEngagement: number }>
  collaborators: Array<{ key: string; count: number; avgEngagement: number }>
  related: string[]
  hintIds: string[]
  fetchedAt: string
}

export function collabSnapshotFromPage(page: PageInsights): CollabSnapshot {
  return {
    handle: page.handle,
    name: page.name,
    biography: (page.biography || '').slice(0, 500),
    avatarUrl: page.avatarUrl,
    verified: page.verified,
    isProfessional: page.isProfessional,
    isBusiness: page.isBusiness,
    isPrivate: page.isPrivate,
    category: page.category,
    website: page.website,
    followers: page.followers,
    following: page.following,
    posts: page.posts,
    engagementRate: page.engagementRate,
    avgLikes: page.avgLikes,
    avgComments: page.avgComments,
    avgViews: page.avgViews,
    followerFollowingRatio: page.followerFollowingRatio,
    commentsToLikes: page.commentsToLikes,
    reelPlayRate: page.reelPlayRate,
    postCadenceDays: page.postCadenceDays,
    mix: page.mix,
    healthScore: page.health?.score ?? 0,
    bestDay: page.bestDay,
    bestHour: page.bestHour,
    lastPostedAt: page.lastPostedAt,
    topHashtags: (page.topHashtags || []).slice(0, 8),
    collaborators: (page.collaborators || []).slice(0, 8),
    related: (page.relatedProfiles || []).slice(0, 8).map((r) => r.username),
    hintIds: (page.hints || []).slice(0, 6).map((h) => h.id),
    fetchedAt: page.fetchedAt,
  }
}

export function exportPayload(report: PageAnalyticsResponse) {
  const page = report.page
  return {
    app: 'postyar',
    kind: 'page-analytics',
    exportedAt: new Date().toISOString(),
    page: {
      handle: page.handle,
      name: page.name,
      biography: page.biography,
      verified: page.verified,
      isProfessional: page.isProfessional,
      isBusiness: page.isBusiness,
      isPrivate: page.isPrivate,
      category: page.category,
      website: page.website,
      phone: page.phone,
      email: page.email,
      telegram: page.telegram,
      followers: page.followers,
      following: page.following,
      posts: page.posts,
      engagementRate: page.engagementRate,
      avgLikes: page.avgLikes,
      avgComments: page.avgComments,
      avgViews: page.avgViews,
      followerFollowingRatio: page.followerFollowingRatio,
      commentsToLikes: page.commentsToLikes,
      reelPlayRate: page.reelPlayRate,
      postCadenceDays: page.postCadenceDays,
      postingStdevDays: page.postingStdevDays,
      avgCaptionLength: page.avgCaptionLength,
      mix: page.mix,
      byType: page.byType,
      health: page.health,
      bestDay: page.bestDay,
      bestHour: page.bestHour,
      lastPostedAt: page.lastPostedAt,
      topHashtags: page.topHashtags,
      collaborators: page.collaborators,
      locations: page.locations,
      audioMix: page.audioMix,
      related: (page.relatedProfiles || []).map((r) => ({
        username: r.username,
        name: r.name,
        followers: r.followers,
        verified: r.verified,
      })),
      hints: page.hints,
      recentPosts: (page.recentPosts || []).map((p) => ({
        shortcode: p.shortcode,
        url: p.url,
        type: p.type,
        caption: (p.caption || '').slice(0, 280),
        likes: p.likes,
        comments: p.comments,
        views: p.views,
        takenAt: p.takenAt,
        engagement: p.engagement,
        hashtags: p.hashtags,
        taggedUsers: p.taggedUsers,
        locationName: p.locationName,
      })),
      fetchedAt: page.fetchedAt,
      source: page.source,
    },
    growth: report.growth || null,
    enrichment: report.enrichment
      ? {
          website: report.enrichment.website,
          wikidata: report.enrichment.wikidata,
          wikipedia: report.enrichment.wikipedia
            ? { title: report.enrichment.wikipedia.title, url: report.enrichment.wikipedia.url, lang: report.enrichment.wikipedia.lang }
            : undefined,
          domain: report.enrichment.domain,
          place: report.enrichment.place,
        }
      : null,
  }
}
