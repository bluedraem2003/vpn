import { fetchInstagramWebProfile, isInstagramCoolingDown, normalizeHandle, type IgFetchError } from './instagramSearch.js'
import { signInstagramMediaUrl } from './igMedia.js'
import { loadIgPageReport, saveIgPageReport, resignPageReport } from './igPageReports.js'

export type PagePostInsight = {
  shortcode: string
  url: string
  type: 'reel' | 'carousel' | 'post'
  caption: string
  likes: number
  comments: number
  views?: number
  takenAt: string
  thumbUrl?: string
  engagement: number
  hasAudio?: boolean
  originalAudio?: boolean
  songName?: string
  artistName?: string
  locationName?: string
  taggedUsers: string[]
  hashtags: string[]
  mentions: string[]
  captionLength: number
  commentsDisabled?: boolean
  isPinned?: boolean
}

export type TypeStats = {
  count: number
  avgLikes: number
  avgComments: number
  avgViews: number
  avgEngagement: number
}

export type CountStat = { key: string; count: number; avgEngagement: number }

export type HealthPart = { id: string; score: number; max: number }

export type InsightHint = { id: string; args?: Record<string, string | number> }

export type RelatedProfile = {
  username: string
  name: string
  verified?: boolean
  avatarUrl?: string
  followers?: number
}

export type PageInsights = {
  handle: string
  name: string
  biography: string
  avatarUrl?: string
  verified: boolean
  isProfessional: boolean
  isBusiness: boolean
  isPrivate: boolean
  category?: string
  followers: number
  following: number
  posts: number
  avgLikes: number
  avgComments: number
  avgViews: number
  engagementRate: number
  postCadenceDays: number | null
  mix: { reel: number; carousel: number; post: number }
  bestPost?: PagePostInsight
  weakestPost?: PagePostInsight
  recentPosts: PagePostInsight[]
  hints: InsightHint[]
  fetchedAt: string
  source: 'instagram_public'
  highlightCount: number
  hasClips: boolean
  isJoinedRecently: boolean
  hideLikeCounts: boolean
  contactMethod?: string
  website?: string
  bioLinks: Array<{ title?: string; url: string }>
  phone?: string
  email?: string
  telegram?: string
  igUserId?: string
  fbId?: string
  relatedProfiles: RelatedProfile[]
  avgCaptionLength: number
  pinnedCount: number
  lastPostedAt?: string
  postingStdevDays: number | null
  followerFollowingRatio: number
  commentsToLikes: number
  reelPlayRate: number | null
  byType: { reel: TypeStats; carousel: TypeStats; post: TypeStats }
  heatmapDays: CountStat[]
  heatmapHours: CountStat[]
  bestDay?: string
  bestHour?: string
  topHashtags: CountStat[]
  collaborators: CountStat[]
  locations: CountStat[]
  audioMix: { original: number; licensed: number }
  suggestedWindow?: string
  health: { score: number; parts: HealthPart[] }
}

const cache = new Map<string, { at: number; data: PageInsights }>()
const CACHE_MS = 10 * 60_000
const FRESH_MIN_MS = 90_000

function num(v: unknown) {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0
}

function mediaType(node: Record<string, unknown>): PagePostInsight['type'] {
  if (node.is_video || node.__typename === 'GraphVideo' || node.product_type === 'clips') return 'reel'
  if (node.__typename === 'GraphSidecar' || node.product_type === 'carousel_container') return 'carousel'
  return 'post'
}

export function toEnDigits(s: string) {
  const fa = '۰۱۲۳۴۵۶۷۸۹'
  const ar = '٠١٢٣٤٥٦٧٨٩'
  return s.replace(/[۰-۹]/g, (ch) => String(fa.indexOf(ch))).replace(/[٠-٩]/g, (ch) => String(ar.indexOf(ch)))
}

export function extractHashtags(text: string) {
  return [...text.matchAll(/#([\p{L}\p{N}_]+)/gu)].map((m) => m[1]!.toLowerCase())
}

export function extractMentions(text: string, self?: string) {
  const skip = (self || '').toLowerCase()
  const out: string[] = []
  for (const m of text.matchAll(/@([A-Za-z0-9._]+)/g)) {
    const u = m[1]!.toLowerCase()
    if (u && u !== skip) out.push(u)
  }
  return out
}

export function extractPhone(text: string) {
  const s = toEnDigits(text).replace(/[\s-]/g, '')
  const m = s.match(/(?:\+98|0098|98|0)?9\d{9}/)
  if (!m) return undefined
  let n = m[0]!.replace(/^(?:0098|98)/, '0')
  if (n.startsWith('+98')) n = '0' + n.slice(3)
  if (n.length === 10 && n.startsWith('9')) n = '0' + n
  return n
}

export function extractEmail(text: string) {
  const m = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)
  return m?.[0]?.toLowerCase()
}

export function extractTelegram(text: string) {
  const m = text.match(/(?:https?:\/\/)?t(?:elegram)?\.me\/([A-Za-z0-9_]{5,32})/i)
  return m?.[1]
}

function tehranParts(iso: string) {
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) return null
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Tehran',
    weekday: 'short',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(d)
  const weekday = parts.find((p) => p.type === 'weekday')?.value || ''
  const hour = Number(parts.find((p) => p.type === 'hour')?.value)
  return { weekday, hour: Number.isFinite(hour) ? hour : 0 }
}

function relatedFromUser(user: Record<string, unknown>): RelatedProfile[] {
  const edges =
    (user.edge_related_profiles as { edges?: Array<{ node?: Record<string, unknown> }> } | undefined)?.edges || []
  const out: RelatedProfile[] = []
  const seen = new Set<string>()
  for (const edge of edges) {
    const node = edge.node
    const username = String(node?.username || '')
    if (!username || seen.has(username.toLowerCase())) continue
    seen.add(username.toLowerCase())
    const followers = num((node?.edge_followed_by as { count?: number } | undefined)?.count)
    out.push({
      username,
      name: String(node?.full_name || username),
      verified: Boolean(node?.is_verified),
      avatarUrl: signInstagramMediaUrl(String(node?.profile_pic_url || '')),
      followers: followers || undefined,
    })
  }
  return out.slice(0, 8)
}

function stdev(nums: number[]) {
  if (nums.length < 2) return null
  const mean = avg(nums)
  const v = avg(nums.map((n) => (n - mean) ** 2))
  return Math.round(Math.sqrt(v) * 10) / 10
}

function taggedUsers(node: Record<string, unknown>) {
  const edges =
    (node.edge_media_to_tagged_user as { edges?: Array<{ node?: { user?: { username?: string } } }> } | undefined)
      ?.edges || []
  return edges.map((e) => String(e.node?.user?.username || '')).filter(Boolean)
}

function avg(nums: number[]) {
  if (!nums.length) return 0
  return nums.reduce((s, n) => s + n, 0) / nums.length
}

function typeStats(posts: PagePostInsight[]): TypeStats {
  if (!posts.length) return { count: 0, avgLikes: 0, avgComments: 0, avgViews: 0, avgEngagement: 0 }
  const views = posts.filter((p) => p.views != null).map((p) => p.views || 0)
  return {
    count: posts.length,
    avgLikes: Math.round(avg(posts.map((p) => p.likes))),
    avgComments: Math.round(avg(posts.map((p) => p.comments))),
    avgViews: views.length ? Math.round(avg(views)) : 0,
    avgEngagement: Math.round(avg(posts.map((p) => p.engagement)) * 100) / 100,
  }
}

function rollup(items: Array<{ key: string; engagement: number }>, limit = 8): CountStat[] {
  const map = new Map<string, { count: number; er: number }>()
  for (const it of items) {
    const k = it.key.trim()
    if (!k) continue
    const cur = map.get(k) || { count: 0, er: 0 }
    cur.count += 1
    cur.er += it.engagement
    map.set(k, cur)
  }
  return [...map.entries()]
    .map(([key, v]) => ({ key, count: v.count, avgEngagement: Math.round((v.er / v.count) * 100) / 100 }))
    .sort((a, b) => b.count - a.count || b.avgEngagement - a.avgEngagement)
    .slice(0, limit)
}

export type AnalyzePageResult =
  | { ok: true; data: PageInsights; cached?: boolean; staleReason?: IgFetchError['code'] }
  | { ok: false; error: IgFetchError }

const analyzeInflight = new Map<string, Promise<AnalyzePageResult>>()

function staleFromStores(
  handle: string,
  reason?: IgFetchError['code'],
): AnalyzePageResult | null {
  const mem = cache.get(handle.toLowerCase())
  if (mem) return { ok: true, data: resignPageReport(mem.data), cached: true, staleReason: reason }
  const stored = loadIgPageReport(handle)
  if (!stored) return null
  cache.set(handle.toLowerCase(), { at: Date.parse(stored.fetchedAt) || 0, data: stored })
  return { ok: true, data: stored, cached: true, staleReason: reason }
}

export async function analyzeInstagramPage(
  rawHandle: string,
  opts?: { fresh?: boolean; allowNetwork?: boolean },
): Promise<AnalyzePageResult> {
  const handle = normalizeHandle(rawHandle)
  if (!handle) return { ok: false, error: { code: 'not_found' } }
  const key = handle.toLowerCase()
  const existing = analyzeInflight.get(key)
  if (existing) return existing

  const job = analyzeInstagramPageUncached(handle, opts)
  analyzeInflight.set(key, job)
  try {
    return await job
  } finally {
    analyzeInflight.delete(key)
  }
}

async function analyzeInstagramPageUncached(
  handle: string,
  opts?: { fresh?: boolean; allowNetwork?: boolean },
): Promise<AnalyzePageResult> {
  const hit = cache.get(handle.toLowerCase())
  const allowNetwork = opts?.allowNetwork !== false
  if (!opts?.fresh && hit && Date.now() - hit.at < CACHE_MS) return { ok: true, data: hit.data }
  if (opts?.fresh && hit && Date.now() - hit.at < FRESH_MIN_MS) return { ok: true, data: hit.data }

  if (!allowNetwork || isInstagramCoolingDown()) {
    const stale = staleFromStores(handle, 'rate_limit')
    if (stale) return stale
    return { ok: false, error: { code: 'rate_limit' } }
  }

  const fetched = await fetchInstagramWebProfile(handle, {
    skipCache: Boolean(opts?.fresh) && allowNetwork && !isInstagramCoolingDown(),
  })
  const user = fetched.user
  if (!user) {
    const stale = staleFromStores(handle, fetched.error?.code)
    if (stale) {
      console.warn('[instagram] serving cached report', handle, stale.data.fetchedAt, fetched.error?.code)
      return stale
    }
    return { ok: false, error: fetched.error || { code: 'unavailable' } }
  }

  const followers = num((user.edge_followed_by as { count?: number } | undefined)?.count)
  const following = num((user.edge_follow as { count?: number } | undefined)?.count)
  const posts = num((user.edge_owner_to_timeline_media as { count?: number } | undefined)?.count)
  const edges =
    ((user.edge_owner_to_timeline_media as { edges?: Array<{ node?: Record<string, unknown> }> } | undefined)
      ?.edges || [])
      .map((e) => e.node)
      .filter((n): n is Record<string, unknown> => Boolean(n))

  const recentPosts: PagePostInsight[] = edges.map((node) => {
    const likes = num(
      (node.edge_liked_by as { count?: number } | undefined)?.count ||
        (node.edge_media_preview_like as { count?: number } | undefined)?.count,
    )
    const comments = num((node.edge_media_to_comment as { count?: number } | undefined)?.count)
    const views = node.video_view_count == null ? undefined : num(node.video_view_count)
    const caption = String(
      (node.edge_media_to_caption as { edges?: Array<{ node?: { text?: string } }> } | undefined)?.edges?.[0]?.node
        ?.text || '',
    )
    const shortcode = String(node.shortcode || '')
    const taken = num(node.taken_at_timestamp)
    const type = mediaType(node)
    const engagement = followers > 0 ? ((likes + comments) / followers) * 100 : 0
    const music = node.clips_music_attribution_info as
      | { artist_name?: string; song_name?: string; uses_original_audio?: boolean }
      | undefined
    const loc = node.location as { name?: string } | null
    const pinned = Array.isArray(node.pinned_for_users) && node.pinned_for_users.length > 0
    return {
      shortcode,
      url: shortcode
        ? `https://www.instagram.com/${type === 'reel' ? 'reel' : 'p'}/${shortcode}/`
        : `https://www.instagram.com/${handle}/`,
      type,
      caption,
      likes,
      comments,
      views,
      takenAt: taken ? new Date(taken * 1000).toISOString() : '',
      thumbUrl: signInstagramMediaUrl(String(node.thumbnail_src || node.display_url || '')),
      engagement: Math.round(engagement * 100) / 100,
      hasAudio: node.has_audio == null ? undefined : Boolean(node.has_audio),
      originalAudio: music?.uses_original_audio,
      songName: music?.song_name ? String(music.song_name) : undefined,
      artistName: music?.artist_name ? String(music.artist_name) : undefined,
      locationName: loc?.name ? String(loc.name) : undefined,
      taggedUsers: taggedUsers(node),
      hashtags: extractHashtags(caption),
      mentions: extractMentions(caption, handle),
      captionLength: caption.trim().length,
      commentsDisabled: Boolean(node.comments_disabled),
      isPinned: pinned,
    }
  })

  const avgLikes = recentPosts.length ? Math.round(avg(recentPosts.map((p) => p.likes))) : 0
  const avgComments = recentPosts.length ? Math.round(avg(recentPosts.map((p) => p.comments))) : 0
  const videoPosts = recentPosts.filter((p) => p.views != null)
  const avgViews = videoPosts.length ? Math.round(avg(videoPosts.map((p) => p.views || 0))) : 0
  const engagementRate =
    recentPosts.length ? Math.round(avg(recentPosts.map((p) => p.engagement)) * 100) / 100 : 0

  const times = recentPosts.map((p) => Date.parse(p.takenAt)).filter((t) => Number.isFinite(t)).sort((a, b) => b - a)
  let postCadenceDays: number | null = null
  if (times.length >= 2) {
    const gaps = []
    for (let i = 0; i < times.length - 1; i++) gaps.push((times[i]! - times[i + 1]!) / 86400000)
    postCadenceDays = Math.round((avg(gaps)) * 10) / 10
  }

  const mix = { reel: 0, carousel: 0, post: 0 }
  for (const p of recentPosts) mix[p.type] += 1

  const ranked = recentPosts.slice().sort((a, b) => b.engagement - a.engagement)
  const bestPost = ranked[0]
  const weakestPost = ranked.length > 1 ? ranked[ranked.length - 1] : undefined

  const byType = {
    reel: typeStats(recentPosts.filter((p) => p.type === 'reel')),
    carousel: typeStats(recentPosts.filter((p) => p.type === 'carousel')),
    post: typeStats(recentPosts.filter((p) => p.type === 'post')),
  }

  const dayRoll: Array<{ key: string; engagement: number }> = []
  const hourRoll: Array<{ key: string; engagement: number }> = []
  for (const p of recentPosts) {
    const tp = tehranParts(p.takenAt)
    if (!tp) continue
    dayRoll.push({ key: tp.weekday, engagement: p.engagement })
    hourRoll.push({ key: String(tp.hour), engagement: p.engagement })
  }
  const heatmapDays = rollup(dayRoll, 7)
  const heatmapHours = rollup(hourRoll, 24).sort((a, b) => Number(a.key) - Number(b.key))
  const bestDay = heatmapDays.slice().sort((a, b) => b.avgEngagement - a.avgEngagement)[0]?.key
  const bestHourStat = heatmapHours.slice().sort((a, b) => b.avgEngagement - a.avgEngagement || b.count - a.count)[0]
  const bestHour = bestHourStat ? `${bestHourStat.key}:00` : undefined
  const suggestedWindow = bestHourStat ? `${bestDay || 'peak'}@${bestHourStat.key}` : undefined

  const topHashtags = rollup(
    recentPosts.flatMap((p) => p.hashtags.map((tag) => ({ key: `#${tag}`, engagement: p.engagement }))),
    10,
  )
  const collaborators = rollup(
    recentPosts.flatMap((p) =>
      [...p.taggedUsers, ...p.mentions].map((u) => ({ key: `@${u.replace(/^@/, '')}`, engagement: p.engagement })),
    ),
    8,
  )
  const locations = rollup(
    recentPosts.filter((p) => p.locationName).map((p) => ({ key: p.locationName!, engagement: p.engagement })),
    6,
  )
  const audioMix = {
    original: recentPosts.filter((p) => p.originalAudio === true).length,
    licensed: recentPosts.filter((p) => p.originalAudio === false).length,
  }

  const website =
    (user.external_url && String(user.external_url)) ||
    (Array.isArray(user.bio_links)
      ? String((user.bio_links as Array<{ url?: string }>)[0]?.url || '')
      : '') ||
    undefined
  const bioLinks = (
    Array.isArray(user.bio_links) ? (user.bio_links as Array<{ title?: string; url?: string }>) : []
  )
    .filter((l) => l.url)
    .map((l) => ({ title: l.title ? String(l.title) : undefined, url: String(l.url) }))
  const biography = String(user.biography || '')
  const phone = extractPhone(biography)
  const email = extractEmail(biography)
  const telegram = extractTelegram(biography)
  const highlightCount = num(user.highlight_reel_count)
  const followerFollowingRatio = following > 0 ? Math.round((followers / following) * 10) / 10 : followers
  const commentsToLikes = avgLikes > 0 ? Math.round((avgComments / avgLikes) * 100) / 100 : 0
  const reelPlayRate = followers > 0 && avgViews > 0 ? Math.round((avgViews / followers) * 1000) / 10 : null
  const relatedProfiles = relatedFromUser(user)
  const avgCaptionLength = recentPosts.length ? Math.round(avg(recentPosts.map((p) => p.captionLength))) : 0
  const pinnedCount = recentPosts.filter((p) => p.isPinned).length
  const lastPostedAt = recentPosts
    .map((p) => p.takenAt)
    .filter(Boolean)
    .sort((a, b) => Date.parse(b) - Date.parse(a))[0]
  const gaps: number[] = []
  if (times.length >= 2) {
    for (let i = 0; i < times.length - 1; i++) gaps.push((times[i]! - times[i + 1]!) / 86400000)
  }
  const postingStdevDays = stdev(gaps)

  const healthParts: HealthPart[] = []
  let erScore = 8
  if (engagementRate >= 8) erScore = 25
  else if (engagementRate >= 4) erScore = 22
  else if (engagementRate >= 2) erScore = 16
  else if (engagementRate >= 1) erScore = 11
  healthParts.push({ id: 'engagement', score: erScore, max: 25 })

  let cadScore = 8
  if (postCadenceDays != null && postCadenceDays <= 2.5) cadScore = 20
  else if (postCadenceDays != null && postCadenceDays <= 4) cadScore = 16
  else if (postCadenceDays != null && postCadenceDays <= 7) cadScore = 11
  healthParts.push({ id: 'cadence', score: cadScore, max: 20 })

  const typesUsed = [mix.reel, mix.carousel, mix.post].filter((n) => n > 0).length
  const mixScore = typesUsed >= 2 ? 12 : mix.reel > 0 ? 9 : 6
  healthParts.push({ id: 'mix', score: mixScore, max: 12 })

  let bioScore = 4
  if (biography.trim().length > 20) bioScore += 4
  if (website) bioScore += 4
  if (phone || email || telegram || user.category_name) bioScore += 3
  healthParts.push({ id: 'profile', score: Math.min(bioScore, 15), max: 15 })

  const collabScore = collaborators.length >= 2 ? 10 : collaborators.length === 1 ? 7 : 4
  healthParts.push({ id: 'collab', score: collabScore, max: 10 })

  let playScore = 6
  if (reelPlayRate != null && reelPlayRate >= 80) playScore = 10
  else if (reelPlayRate != null && reelPlayRate >= 30) playScore = 8
  healthParts.push({ id: 'play', score: playScore, max: 10 })
  healthParts.push({ id: 'location', score: locations.length ? 8 : 4, max: 8 })
  const healthScore = healthParts.reduce((s, p) => s + p.score, 0)

  const hints: InsightHint[] = []
  if (engagementRate >= 5) hints.push({ id: 'er_high' })
  else if (engagementRate >= 2) hints.push({ id: 'er_mid' })
  else hints.push({ id: 'er_low' })
  if (byType.reel.count && byType.carousel.count && byType.reel.avgEngagement > byType.carousel.avgEngagement) {
    hints.push({ id: 'reel_better' })
  } else if (byType.carousel.count && byType.reel.count && byType.carousel.avgEngagement > byType.reel.avgEngagement) {
    hints.push({ id: 'carousel_better' })
  }
  if (postCadenceDays && postCadenceDays > 5) hints.push({ id: 'cadence_slow' })
  if (postCadenceDays && postCadenceDays <= 2) hints.push({ id: 'cadence_good' })
  if (commentsToLikes > 0.3) hints.push({ id: 'comments_strong' })
  if (bestDay && bestHour) hints.push({ id: 'best_time', args: { day: bestDay, hour: bestHour } })
  if (!website) hints.push({ id: 'no_website' })
  if (!phone && !email && !telegram && !/dm|دایرکت|واتساپ|telegram|تماس/i.test(biography)) {
    hints.push({ id: 'no_contact' })
  }
  if (collaborators.length === 0) hints.push({ id: 'no_collab' })
  if (locations.length === 0) hints.push({ id: 'no_location' })
  if (highlightCount === 0) hints.push({ id: 'no_highlights' })
  if (topHashtags.length && topHashtags[0] && topHashtags[0].count >= 3) {
    hints.push({ id: 'hashtag_repeat', args: { tag: topHashtags[0].key } })
  }
  if (user.is_private) hints.push({ id: 'private' })
  if (posts === 0) hints.push({ id: 'empty' })
  if (user.hide_like_and_view_counts) hints.push({ id: 'hide_likes' })
  if (user.is_joined_recently) hints.push({ id: 'new_account' })
  if (following > 0 && followers < following) hints.push({ id: 'low_ratio' })
  if (avgCaptionLength > 0 && avgCaptionLength < 40) hints.push({ id: 'short_captions' })
  if (relatedProfiles.length) hints.push({ id: 'related_pages', args: { n: relatedProfiles.length } })

  const data: PageInsights = {
    handle: String(user.username || handle),
    name: String(user.full_name || user.username || handle),
    biography,
    avatarUrl: signInstagramMediaUrl(String(user.profile_pic_url_hd || user.profile_pic_url || '')),
    verified: Boolean(user.is_verified),
    isProfessional: Boolean(user.is_professional_account),
    isBusiness: Boolean(user.is_business_account),
    isPrivate: Boolean(user.is_private),
    category: user.category_name
      ? String(user.category_name)
      : user.business_category_name
        ? String(user.business_category_name)
        : undefined,
    followers,
    following,
    posts,
    avgLikes,
    avgComments,
    avgViews,
    engagementRate,
    postCadenceDays,
    mix,
    bestPost,
    weakestPost,
    recentPosts,
    hints,
    fetchedAt: new Date().toISOString(),
    source: 'instagram_public',
    highlightCount,
    hasClips: Boolean(user.has_clips),
    isJoinedRecently: Boolean(user.is_joined_recently),
    hideLikeCounts: Boolean(user.hide_like_and_view_counts),
    contactMethod: user.business_contact_method ? String(user.business_contact_method) : undefined,
    website: website || undefined,
    bioLinks,
    phone,
    email,
    telegram,
    igUserId: user.id ? String(user.id) : undefined,
    fbId: user.fbid ? String(user.fbid) : undefined,
    relatedProfiles,
    avgCaptionLength,
    pinnedCount,
    lastPostedAt,
    postingStdevDays,
    followerFollowingRatio,
    commentsToLikes,
    reelPlayRate,
    byType,
    heatmapDays,
    heatmapHours,
    bestDay,
    bestHour,
    topHashtags,
    collaborators,
    locations,
    audioMix,
    suggestedWindow,
    health: { score: healthScore, parts: healthParts },
  }
  cache.set(handle.toLowerCase(), { at: Date.now(), data })
  try {
    saveIgPageReport(data)
  } catch (err) {
    console.error('[instagram] persist report', (err as Error).message)
  }
  return { ok: true, data }
}

export type ConnectorStatus = {
  id: 'instagram_public' | 'supermetrics' | 'meta' | 'website' | 'ads_library'
  name: string
  configured: boolean
  hint: string
}

export function analyticsConnectors(opts?: { hasWebsite?: boolean }): ConnectorStatus[] {
  const sm = Boolean((process.env.SUPERMETRICS_API_KEY || '').trim())
  const meta = Boolean((process.env.META_IG_ACCESS_TOKEN || '').trim() && (process.env.META_IG_USER_ID || '').trim())
  return [
    {
      id: 'instagram_public',
      name: 'اینستاگرام (پروفایل و پست‌های عمومی)',
      configured: true,
      hint: 'فالوور، لایک، کامنت، بازدید ریلز، لوکیشن، تگ‌ها، هشتگ و ریتم انتشار از خود اینستاگرام',
    },
    {
      id: 'website',
      name: 'وب‌سایت / لینک بایو',
      configured: Boolean(opts?.hasWebsite),
      hint: opts?.hasWebsite
        ? 'عنوان و توضیح صفحه فرود از لینک بایو خوانده می‌شود'
        : 'اگر لینک بایو باشد، عنوان سایت را هم به گزارش اضافه می‌کنیم',
    },
    {
      id: 'ads_library',
      name: 'کتابخانه تبلیغات Meta',
      configured: true,
      hint: 'جستجوی تبلیغات فعال برند — بدون لاگین اینستاگرام',
    },
    {
      id: 'supermetrics',
      name: 'Supermetrics',
      configured: sm,
      hint: sm
        ? 'کلید API تنظیم شده — Reach و Impressions از Instagram Insights می‌آید'
        : 'آزمایشی رایگان. در Hub اینستاگرام را با فیسبوک بیزنس وصل کن، بعد SUPERMETRICS_API_KEY',
    },
    {
      id: 'meta',
      name: 'Meta Instagram Insights',
      configured: meta,
      hint: meta
        ? 'توکن گراف تنظیم شده'
        : 'Reach و مخاطب فقط با Business/Creator و Facebook Login — نه با پسورد اینستاگرام',
    },
  ]
}

export async function fetchSupermetricsInsights(pageHandle?: string): Promise<{
  ok: boolean
  error?: string
  rows?: unknown[]
  fields?: string[]
}> {
  const apiKey = (process.env.SUPERMETRICS_API_KEY || '').trim()
  const account = (process.env.SUPERMETRICS_IG_ACCOUNT || pageHandle || '').trim()
  if (!apiKey) return { ok: false, error: 'not_configured' }
  if (!account) return { ok: false, error: 'not_configured' }
  const start = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
  try {
    const res = await fetch('https://api.supermetrics.com/enterprise/v2/query/data/json', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ds_id: 'IGI',
        ds_accounts: account,
        start_date: start,
        end_date: 'today',
        fields: 'Date,Followers,Impressions,Reach,ProfileViews',
        max_rows: 40,
      }),
    })
    const data = (await res.json().catch(() => ({}))) as {
      data?: unknown[]
      error?: { description?: string; message?: string }
      meta?: { fields?: string[] }
    }
    if (!res.ok) {
      return { ok: false, error: data.error?.description || data.error?.message || `Supermetrics ${res.status}` }
    }
    return { ok: true, rows: data.data || [], fields: data.meta?.fields }
  } catch (err) {
    return { ok: false, error: (err as Error).message }
  }
}

export async function fetchMetaInsights(): Promise<{ ok: boolean; error?: string; data?: unknown }> {
  const token = (process.env.META_IG_ACCESS_TOKEN || '').trim()
  const userId = (process.env.META_IG_USER_ID || '').trim()
  if (!token || !userId) return { ok: false, error: 'not_configured' }
  const url =
    `https://graph.facebook.com/v21.0/${encodeURIComponent(userId)}/insights` +
    `?metric=reach,follower_count,profile_views&period=day&access_token=${encodeURIComponent(token)}`
  try {
    const res = await fetch(url)
    const data = await res.json()
    if (!res.ok) return { ok: false, error: (data as { error?: { message?: string } }).error?.message || `Meta ${res.status}` }
    return { ok: true, data }
  } catch (err) {
    return { ok: false, error: (err as Error).message }
  }
}
