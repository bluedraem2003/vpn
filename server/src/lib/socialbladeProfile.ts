import { gotScraping } from 'got-scraping'

export type SocialBladeStats = {
  username: string
  displayName: string
  avatar?: string
  website?: string
  followers: number
  following: number
  mediaCount: number
  engagementRate: number
  averageLikes: number
  averageComments: number
  igUserId?: string
}

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'

function num(v: unknown) {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string') {
    const n = Number(v.replace(/,/g, '').trim())
    if (Number.isFinite(n)) return n
  }
  return 0
}

/** Pull the hydrated Instagram user object out of SocialBlade's Next.js page. */
export function parseSocialBladeHtml(html: string): SocialBladeStats | null {
  const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i)
  if (!m?.[1]) return null
  let data: unknown
  try {
    data = JSON.parse(m[1])
  } catch {
    return null
  }
  const queries = (
    data as {
      props?: { pageProps?: { trpcState?: { json?: { queries?: unknown[] } } } }
    }
  )?.props?.pageProps?.trpcState?.json?.queries
  if (!Array.isArray(queries)) return null
  for (const q of queries) {
    const payload = (q as { state?: { data?: unknown } })?.state?.data
    if (!payload || typeof payload !== 'object') continue
    const rec = payload as Record<string, unknown>
    const username = String(rec.username || '').trim()
    if (!username) continue
    const stats = (rec.stats && typeof rec.stats === 'object' ? rec.stats : rec) as Record<string, unknown>
    const followers = num(stats.followers ?? rec.followers)
    const mediaCount = num(stats.mediaCount ?? rec.mediaCount)
    if (followers <= 0 && mediaCount <= 0) continue
    const website = rec.website ? String(rec.website) : ''
    return {
      username,
      displayName: String(rec.displayName || username),
      avatar: rec.avatar ? String(rec.avatar) : undefined,
      website: website || undefined,
      followers,
      following: num(stats.following ?? rec.following),
      mediaCount,
      engagementRate: num(stats.engagementRate ?? rec.engagementRate),
      averageLikes: num(stats.averageLikes ?? rec.averageLikes),
      averageComments: num(stats.averageComments ?? rec.averageComments),
      igUserId: rec.id ? String(rec.id) : undefined,
    }
  }
  return null
}

export function socialBladeUserAsGraph(stats: SocialBladeStats): Record<string, unknown> {
  return {
    username: stats.username,
    full_name: stats.displayName,
    biography: '',
    profile_pic_url: stats.avatar || '',
    is_verified: false,
    is_private: false,
    is_professional_account: true,
    external_url: stats.website || undefined,
    id: stats.igUserId,
    edge_followed_by: { count: stats.followers },
    edge_follow: { count: stats.following },
    edge_owner_to_timeline_media: { count: stats.mediaCount, edges: [] },
  }
}

const sbCache = new Map<string, { at: number; stats: SocialBladeStats | null }>()
const SB_CACHE_MS = 30 * 60_000
const sbInflight = new Map<string, Promise<SocialBladeStats | null>>()

export async function fetchSocialBladeProfile(username: string): Promise<SocialBladeStats | null> {
  const key = username.toLowerCase()
  const hit = sbCache.get(key)
  if (hit && Date.now() - hit.at < SB_CACHE_MS) return hit.stats
  const existing = sbInflight.get(key)
  if (existing) return existing

  const job = (async () => {
    try {
      const res = await gotScraping({
        url: `https://socialblade.com/instagram/user/${encodeURIComponent(username)}`,
        headers: { 'User-Agent': UA, accept: 'text/html' },
        timeout: { request: 12000 },
        throwHttpErrors: false,
        retry: { limit: 0 },
      })
      if (res.statusCode < 200 || res.statusCode >= 300) {
        sbCache.set(key, { at: Date.now(), stats: null })
        return null
      }
      const stats = parseSocialBladeHtml(String(res.body || ''))
      sbCache.set(key, { at: Date.now(), stats })
      if (stats) console.log('[instagram] socialblade fallback', stats.username, stats.followers)
      return stats
    } catch (err) {
      console.warn('[instagram] socialblade fallback failed', username, (err as Error).message)
      sbCache.set(key, { at: Date.now(), stats: null })
      return null
    }
  })()

  sbInflight.set(key, job)
  try {
    return await job
  } finally {
    sbInflight.delete(key)
  }
}
