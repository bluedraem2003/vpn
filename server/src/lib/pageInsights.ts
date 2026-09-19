import { fetchInstagramWebProfile, normalizeHandle } from './instagramSearch.js'
import { signInstagramMediaUrl } from './igMedia.js'

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
  recentPosts: PagePostInsight[]
  hints: string[]
  fetchedAt: string
  source: 'instagram_public'
}

const cache = new Map<string, { at: number; data: PageInsights }>()
const CACHE_MS = 10 * 60_000

function num(v: unknown) {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0
}

function mediaType(node: Record<string, unknown>): PagePostInsight['type'] {
  if (node.is_video || node.__typename === 'GraphVideo' || node.product_type === 'clips') return 'reel'
  if (node.__typename === 'GraphSidecar') return 'carousel'
  return 'post'
}

export async function analyzeInstagramPage(
  rawHandle: string,
  opts?: { fresh?: boolean },
): Promise<PageInsights | null> {
  const handle = normalizeHandle(rawHandle)
  if (!handle) return null
  const hit = cache.get(handle.toLowerCase())
  if (!opts?.fresh && hit && Date.now() - hit.at < CACHE_MS) return hit.data

  const user = await fetchInstagramWebProfile(handle)
  if (!user) return null

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
    const engagement = followers > 0 ? ((likes + comments) / followers) * 100 : 0
    return {
      shortcode,
      url: shortcode
        ? `https://www.instagram.com/${mediaType(node) === 'reel' ? 'reel' : 'p'}/${shortcode}/`
        : `https://www.instagram.com/${handle}/`,
      type: mediaType(node),
      caption,
      likes,
      comments,
      views,
      takenAt: taken ? new Date(taken * 1000).toISOString() : '',
      thumbUrl: signInstagramMediaUrl(
        String(node.thumbnail_src || node.display_url || ''),
      ),
      engagement: Math.round(engagement * 100) / 100,
    }
  })

  const avg = (pick: (p: PagePostInsight) => number) =>
    recentPosts.length ? Math.round(recentPosts.reduce((s, p) => s + pick(p), 0) / recentPosts.length) : 0
  const videoPosts = recentPosts.filter((p) => p.views != null)
  const avgViews = videoPosts.length
    ? Math.round(videoPosts.reduce((s, p) => s + (p.views || 0), 0) / videoPosts.length)
    : 0
  const avgLikes = avg((p) => p.likes)
  const avgComments = avg((p) => p.comments)
  const engagementRate = followers > 0 ? Math.round(((avgLikes + avgComments) / followers) * 10000) / 100 : 0

  const times = recentPosts.map((p) => Date.parse(p.takenAt)).filter((t) => Number.isFinite(t)).sort((a, b) => b - a)
  let postCadenceDays: number | null = null
  if (times.length >= 2) {
    const gaps = []
    for (let i = 0; i < times.length - 1; i++) gaps.push((times[i]! - times[i + 1]!) / 86400000)
    postCadenceDays = Math.round((gaps.reduce((s, g) => s + g, 0) / gaps.length) * 10) / 10
  }

  const mix = { reel: 0, carousel: 0, post: 0 }
  for (const p of recentPosts) mix[p.type] += 1

  const bestPost = recentPosts.slice().sort((a, b) => b.engagement - a.engagement)[0]
  const hints: string[] = []
  if (engagementRate >= 5) hints.push('نرخ تعامل بالاست — همین ریتم کپشن و استایل را نگه دار')
  else if (engagementRate >= 2) hints.push('تعامل متوسط است — ریلز با هوک اول ۳ ثانیه را بیشتر کن')
  else hints.push('تعامل پایین است — کال‌تو‌اکشن در کپشن و استوری پرسش‌محور اضافه کن')
  if (mix.reel >= mix.carousel + mix.post) hints.push('ریلز سهم بیشتری دارد — برای این پیج خوب است')
  if (postCadenceDays && postCadenceDays > 5) hints.push('فاصله انتشار زیاد است — هفته‌ای ۲–۳ پست هدف بگیر')
  if (postCadenceDays && postCadenceDays <= 2) hints.push('ریتم انتشار خوب است')
  if (avgComments > 0 && avgComments / Math.max(avgLikes, 1) > 0.3) hints.push('نسبت کامنت به لایک قوی است — جامعه فعال است')
  if (user.is_private) hints.push('پیج خصوصی است — آمار پست‌ها محدود است')
  if (posts === 0) hints.push('هنوز پستی روی پیج نیست')

  const data: PageInsights = {
    handle: String(user.username || handle),
    name: String(user.full_name || user.username || handle),
    biography: String(user.biography || ''),
    avatarUrl: signInstagramMediaUrl(String(user.profile_pic_url || '')),
    verified: Boolean(user.is_verified),
    isProfessional: Boolean(user.is_professional_account),
    isBusiness: Boolean(user.is_business_account),
    isPrivate: Boolean(user.is_private),
    category: user.category_name ? String(user.category_name) : user.business_category_name ? String(user.business_category_name) : undefined,
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
    recentPosts,
    hints,
    fetchedAt: new Date().toISOString(),
    source: 'instagram_public',
  }
  cache.set(handle.toLowerCase(), { at: Date.now(), data })
  return data
}

export type ConnectorStatus = {
  id: 'instagram_public' | 'supermetrics' | 'meta'
  name: string
  configured: boolean
  hint: string
}

export function analyticsConnectors(): ConnectorStatus[] {
  const sm = Boolean((process.env.SUPERMETRICS_API_KEY || '').trim())
  const meta = Boolean((process.env.META_IG_ACCESS_TOKEN || '').trim() && (process.env.META_IG_USER_ID || '').trim())
  return [
    {
      id: 'instagram_public',
      name: 'اینستاگرام (پروفایل و پست‌های عمومی)',
      configured: true,
      hint: 'فالوور، لایک، کامنت، بازدید ریلز و نرخ تعامل از خود اینستاگرام',
    },
    {
      id: 'supermetrics',
      name: 'Supermetrics',
      configured: sm,
      hint: sm
        ? 'کلید API تنظیم شده — Reach و Impressions از Instagram Insights می‌آید'
        : 'یک ماه/۱۴ روز رایگان. در Hub اینستاگرام را با فیسبوک بیزنس وصل کن، بعد SUPERMETRICS_API_KEY را در سرور بگذار',
    },
    {
      id: 'meta',
      name: 'Meta Instagram Insights',
      configured: meta,
      hint: meta
        ? 'توکن گراف تنظیم شده'
        : 'برای Reach و مخاطب، پیج باید Business/Creator باشد و با Facebook Login وصل شود — نه با پسورد اینستاگرام',
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
  if (!apiKey) return { ok: false, error: 'SUPERMETRICS_API_KEY تنظیم نشده' }
  if (!account) return { ok: false, error: 'SUPERMETRICS_IG_ACCOUNT تنظیم نشده' }
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
  if (!token || !userId) return { ok: false, error: 'توکن Meta تنظیم نشده' }
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
