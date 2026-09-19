import assert from 'node:assert/strict'
import { collabSnapshotFromPage, exportPayload } from '../../../src/lib/collabSnapshot.ts'
import type { PageAnalyticsResponse, PageInsights } from '../../../src/api/client.ts'

const emptyType = { count: 0, avgLikes: 0, avgComments: 0, avgViews: 0, avgEngagement: 0 }

const page: PageInsights = {
  handle: 'demo_page',
  name: 'Demo',
  biography: 'bio',
  verified: false,
  isProfessional: true,
  isBusiness: true,
  isPrivate: false,
  followers: 1200,
  following: 80,
  posts: 40,
  avgLikes: 90,
  avgComments: 4,
  avgViews: 800,
  engagementRate: 7.8,
  postCadenceDays: 3.2,
  mix: { reel: 8, carousel: 3, post: 1 },
  recentPosts: [],
  hints: [{ id: 'no_collab' }],
  fetchedAt: '2026-09-19T00:00:00.000Z',
  source: 'instagram_public',
  highlightCount: 2,
  hasClips: true,
  isJoinedRecently: false,
  hideLikeCounts: false,
  bioLinks: [],
  relatedProfiles: [{ username: 'other', name: 'Other' }],
  avgCaptionLength: 80,
  pinnedCount: 1,
  postingStdevDays: 1.1,
  followerFollowingRatio: 15,
  commentsToLikes: 0.04,
  reelPlayRate: 0.6,
  byType: { reel: emptyType, carousel: emptyType, post: emptyType },
  heatmapDays: [],
  heatmapHours: [],
  topHashtags: [{ key: 'brand', count: 4, avgEngagement: 6 }],
  collaborators: [{ key: 'partner', count: 2, avgEngagement: 5 }],
  locations: [],
  audioMix: { original: 2, licensed: 1 },
  health: { score: 74, parts: [] },
}

const snap = collabSnapshotFromPage(page)
assert.equal(snap.handle, 'demo_page')
assert.equal(snap.followers, 1200)
assert.equal(snap.healthScore, 74)
assert.deepEqual(snap.related, ['other'])
assert.deepEqual(snap.hintIds, ['no_collab'])

const report = {
  page,
  connectors: [],
  supermetrics: { ok: false },
  meta: { ok: false },
} as PageAnalyticsResponse
const payload = exportPayload(report)
assert.equal(payload.kind, 'page-analytics')
assert.equal(payload.page.handle, 'demo_page')
assert.equal(payload.page.engagementRate, 7.8)
console.log('collab snapshot ok')
