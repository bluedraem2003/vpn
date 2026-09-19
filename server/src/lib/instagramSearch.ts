import {
  attachTimelineEdges,
  feedItemsToGraphEdges,
  hasFollowerCount,
  hasTimelineEdges,
  mergeProfileWithFeed,
  userFromFeedPayload,
} from './instagramFeed.js'
import { fetchSocialBladeProfile, socialBladeUserAsGraph } from './socialbladeProfile.js'

export type IgPageHit = {
  username: string
  name: string
  biography?: string
  avatarUrl?: string
  verified?: boolean
  followers?: number
  source: 'instagram' | 'workspace' | 'typed' | 'wikidata'
}

const IG_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
const IG_APP = '936619743392459'
const IG_APP_ANDROID = '567067343352427'
const IG_ANDROID_UA =
  'Instagram 192.168.0.2.75 Android (33/13; 420dpi; 1080x2400; Google; Pixel 7; panther; panther; en_US; 458229258)'
const WD_UA = { Accept: 'application/json', 'User-Agent': 'PostYar/1.0 (content studio)' }

const PATH_SKIP = new Set([
  'p',
  'reel',
  'reels',
  'stories',
  'accounts',
  'explore',
  'legal',
  'about',
  'developer',
  'directory',
  'web',
  'api',
  'static',
  'lite',
  'tv',
  'direct',
  'privacy',
  'emails',
  'popular',
  'tags',
  'locations',
  'nametag',
  'ads',
  'session',
  'graphql',
  'blog',
  'about',
])

const cache = new Map<string, { at: number; items: IgPageHit[] }>()
const CACHE_MS = 90_000

export function normalizeHandle(raw: string) {
  let s = raw.trim()
  if (!s) return ''
  const fromUrl = s.match(/(?:https?:\/\/)?(?:www\.)?instagram\.com\/([A-Za-z0-9._]+)/i)
  if (fromUrl) s = fromUrl[1]!
  s = s.replace(/^@+/, '').replace(/\/+$/, '')
  const slash = s.indexOf('/')
  if (slash >= 0) s = s.slice(0, slash)
  const q = s.indexOf('?')
  if (q >= 0) s = s.slice(0, q)
  return s
}

export function isLikelyIgHandle(raw: string) {
  const h = normalizeHandle(raw)
  return /^[A-Za-z0-9._]{1,30}$/.test(h) && !h.startsWith('.') && !h.endsWith('.') && !PATH_SKIP.has(h.toLowerCase())
}

export async function searchInstagramPages(query: string): Promise<IgPageHit[]> {
  const q = query.trim()
  if (q.length < 1) return []
  const key = q.toLowerCase()
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.items

  const handle = isLikelyIgHandle(q) ? normalizeHandle(q) : ''
  const typed: IgPageHit[] = handle ? [{ username: handle, name: handle, source: 'typed' }] : []

  // Typeahead must not hit Instagram — web_profile_info / topsearch 429 the analyze path.
  const [indexed, wiki] = await Promise.all([
    q.length >= 2 ? searchIndexedInstagramProfiles(q) : Promise.resolve([] as Array<{ username: string; name: string }>),
    q.length >= 2 ? searchWikidataUsernames(q) : Promise.resolve([] as Array<{ username: string; name: string }>),
  ])

  const merged = mergeHits([
    ...typed,
    ...indexed.map((row) => ({ username: row.username, name: row.name, source: 'instagram' as const })),
    ...wiki.map((row) => ({ username: row.username, name: row.name, source: 'wikidata' as const })),
  ])

  cache.set(key, { at: Date.now(), items: merged })
  return merged
}

function mergeHits(list: IgPageHit[]) {
  const rank: Record<IgPageHit['source'], number> = {
    instagram: 0,
    wikidata: 1,
    workspace: 2,
    typed: 3,
  }
  const byUser = new Map<string, IgPageHit>()
  for (const item of list) {
    const key = item.username.toLowerCase()
    if (!key) continue
    const prev = byUser.get(key)
    if (!prev || rank[item.source] < rank[prev.source]) {
      byUser.set(key, {
        ...prev,
        ...item,
        name: item.name || prev?.name || item.username,
        biography: item.biography || prev?.biography,
        avatarUrl: item.avatarUrl || prev?.avatarUrl,
        verified: item.verified || prev?.verified,
        followers: item.followers || prev?.followers,
      })
    }
  }
  return [...byUser.values()].slice(0, 12)
}

async function fetchJson(url: string, init: RequestInit = {}, ms = 3500): Promise<unknown | null> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), ms)
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal, redirect: 'follow' })
    if (!res.ok) return null
    const ct = res.headers.get('content-type') || ''
    if (!ct.includes('json') && !ct.includes('javascript')) return null
    return await res.json()
  } catch {
    return null
  } finally {
    clearTimeout(t)
  }
}

function instagramCookie() {
  return (process.env.INSTAGRAM_SESSION_COOKIE || '').trim()
}

function igHeaders(cookie = ''): Record<string, string> {
  const headers: Record<string, string> = {
    'User-Agent': IG_UA,
    'X-IG-App-ID': IG_APP,
    Accept: 'application/json',
    Referer: 'https://www.instagram.com/',
  }
  if (cookie) {
    headers.Cookie = cookie
    const csrf = cookie.match(/csrftoken=([^;]+)/)?.[1]
    if (csrf) headers['X-CSRFToken'] = csrf
  }
  return headers
}

async function gotClient() {
  const mod = await import('got-scraping')
  return mod.gotScraping
}

export type IgFetchError = {
  code: 'not_found' | 'rate_limit' | 'unavailable'
  status?: number
}

export type IgProfileExtras = {
  averageLikes?: number
  averageComments?: number
  engagementRate?: number
  via?: 'socialblade'
}

const profileCache = new Map<string, { at: number; user: Record<string, unknown> }>()
const PROFILE_CACHE_MS = 15 * 60_000
const profileInflight = new Map<
  string,
  Promise<{ user: Record<string, unknown> | null; error?: IgFetchError; extras?: IgProfileExtras }>
>()

let igCooldownUntil = 0
const IG_COOLDOWN_MS = 70_000

export function isInstagramCoolingDown() {
  return Date.now() < igCooldownUntil
}

export function instagramCooldownRemainingMs() {
  return Math.max(0, igCooldownUntil - Date.now())
}

export function markInstagramRateLimit(retryAfterMs?: number) {
  const wait =
    retryAfterMs && retryAfterMs > 0 ? Math.min(Math.max(retryAfterMs, 15_000), 5 * 60_000) : IG_COOLDOWN_MS
  igCooldownUntil = Math.max(igCooldownUntil, Date.now() + wait)
}

export function igProbePolicy(status: number): 'ok' | 'rate_limit' | 'not_found' | 'fallback' {
  if (status >= 200 && status < 300) return 'ok'
  // 401 is Instagram's "please wait" / login-wall — do not follow up with another URL.
  if (status === 429 || status === 401) return 'rate_limit'
  if (status === 404) return 'not_found'
  return 'fallback'
}

export function igPayloadSaysWait(data: unknown) {
  if (!data || typeof data !== 'object') return false
  const msg = String((data as { message?: string }).message || '')
  return /please wait a few minutes/i.test(msg)
}

export function igPayloadSaysLogin(data: unknown) {
  if (!data || typeof data !== 'object') return false
  const rec = data as { message?: string; error_title?: string }
  const msg = String(rec.message || '')
  const title = String(rec.error_title || '')
  return /login_required/i.test(msg) || /logged out/i.test(title)
}

/** True when the first Instagram probe must not try HTML or any other URL. */
export function igShouldStopFollowup(status: number, data?: unknown) {
  return igProbePolicy(status) === 'rate_limit' || igPayloadSaysWait(data) || igPayloadSaysLogin(data)
}

/** Business/professional accounts 400 on web_profile_info; feed-by-username still works. */
export function shouldTryFeedFallback(
  status: number,
  data: unknown,
  user: Record<string, unknown> | null,
) {
  if (igShouldStopFollowup(status, data)) return false
  if (igProbePolicy(status) === 'not_found') return false
  return !hasTimelineEdges(user)
}

function retryAfterMs(headers: Record<string, unknown> | undefined) {
  const raw = headers?.['retry-after']
  const value = Array.isArray(raw) ? raw[0] : raw
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n * 1000 : undefined
}

function userFromPayload(data: unknown): Record<string, unknown> | null {
  if (!data || typeof data !== 'object') return null
  const rec = data as Record<string, unknown>
  const nested = (rec.data as { user?: Record<string, unknown> } | undefined)?.user
  if (nested?.username) return nested
  const graphql = (rec.graphql as { user?: Record<string, unknown> } | undefined)?.user
  if (graphql?.username) return graphql
  if (typeof rec.username === 'string' && rec.edge_followed_by) return rec
  return findUserObject(rec, 0)
}

function findUserObject(value: unknown, depth: number): Record<string, unknown> | null {
  if (depth > 8 || !value || typeof value !== 'object') return null
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findUserObject(item, depth + 1)
      if (found) return found
    }
    return null
  }
  const rec = value as Record<string, unknown>
  if (
    typeof rec.username === 'string' &&
    rec.edge_followed_by &&
    (rec.edge_owner_to_timeline_media || rec.biography != null)
  ) {
    return rec
  }
  for (const child of Object.values(rec)) {
    const found = findUserObject(child, depth + 1)
    if (found) return found
  }
  return null
}

async function igGetJson(
  url: string,
  ms = 5000,
  mode: 'app' | 'web' = 'web',
): Promise<{ status: number; data: unknown | null; retryAfterMs?: number }> {
  try {
    const gotScraping = await gotClient()
    const cookie = instagramCookie()
    const headers: Record<string, string> =
      mode === 'app'
        ? {
            'User-Agent': IG_ANDROID_UA,
            'X-IG-App-ID': IG_APP_ANDROID,
            'x-ig-app-id': IG_APP_ANDROID,
            accept: 'application/json',
          }
        : {
            ...igHeaders(cookie),
            'x-ig-app-id': IG_APP,
            accept: 'application/json',
            referer: 'https://www.instagram.com/',
          }
    if (cookie && mode === 'app') {
      headers.Cookie = cookie
      const csrf = cookie.match(/csrftoken=([^;]+)/)?.[1]
      if (csrf) headers['X-CSRFToken'] = csrf
    }
    const res = await gotScraping({
      url,
      headers,
      timeout: { request: ms },
      throwHttpErrors: false,
      retry: { limit: 0 },
    })
    const status = res.statusCode
    const wait = retryAfterMs(res.headers as Record<string, unknown>)
    const body = String(res.body || '')
    let data: unknown = null
    try {
      data = JSON.parse(body)
    } catch {
      data = null
    }
    return { status, data, retryAfterMs: wait }
  } catch {
    return { status: 0, data: null }
  }
}

async function fetchProfileFromHtml(
  username: string,
): Promise<{ user: Record<string, unknown> | null; status: number; retryAfterMs?: number }> {
  try {
    const gotScraping = await gotClient()
    const cookie = instagramCookie()
    const headers: Record<string, string> = {
      'User-Agent': IG_UA,
      accept: 'text/html,application/xhtml+xml',
      referer: 'https://www.instagram.com/',
    }
    if (cookie) headers.Cookie = cookie
    const res = await gotScraping({
      url: `https://www.instagram.com/${encodeURIComponent(username)}/`,
      headers,
      timeout: { request: 5500 },
      throwHttpErrors: false,
      retry: { limit: 0 },
    })
    const wait = retryAfterMs(res.headers as Record<string, unknown>)
    if (res.statusCode < 200 || res.statusCode >= 300) {
      return { user: null, status: res.statusCode, retryAfterMs: wait }
    }
    const html = String(res.body || '')
    for (const m of html.matchAll(/<script type="application\/json"[^>]*>([\s\S]*?)<\/script>/gi)) {
      const raw = m[1] || ''
      if (raw.length < 40 || raw.length > 2_000_000) continue
      if (!raw.includes(username) && !raw.includes('edge_followed_by')) continue
      try {
        const user = userFromPayload(JSON.parse(raw))
        if (user?.username) return { user, status: res.statusCode }
      } catch {
        /* next blob */
      }
    }
    return { user: null, status: res.statusCode }
  } catch {
    return { user: null, status: 0 }
  }
}

function cachedProfile(handle: string) {
  return profileCache.get(handle.toLowerCase()) || null
}

async function fetchInstagramWebProfileUncached(handle: string): Promise<{
  user: Record<string, unknown> | null
  error?: IgFetchError
  extras?: IgProfileExtras
}> {
  let user: Record<string, unknown> | null = null
  let feedEdges: Array<{ node: Record<string, unknown> }> = []

  if (!isInstagramCoolingDown()) {
    const appUrl = `https://www.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(handle)}`
    const first = await igGetJson(appUrl, 5500, 'web')
    user = userFromPayload(first.data)
    if (user?.username && hasTimelineEdges(user)) {
      profileCache.set(handle.toLowerCase(), { at: Date.now(), user })
      return { user }
    }

    if (igShouldStopFollowup(first.status, first.data)) {
      markInstagramRateLimit(first.retryAfterMs)
      console.warn('[instagram] stopping after error — no HTML retry', handle, first.status)
    } else if (shouldTryFeedFallback(first.status, first.data, user)) {
      // Business/pro accounts 400 on web_profile_info; the public feed still has posts.
      const feedUrl =
        `https://www.instagram.com/api/v1/feed/user/${encodeURIComponent(handle)}/username/?count=12`
      const feed = await igGetJson(feedUrl, 8000, 'web')
      if (igShouldStopFollowup(feed.status, feed.data)) {
        markInstagramRateLimit(feed.retryAfterMs)
        console.warn('[instagram] stopping after feed error', handle, feed.status)
      } else {
        feedEdges = feedItemsToGraphEdges(feed.data)
        const fromFeed = userFromFeedPayload(feed.data, handle)
        if (feedEdges.length) {
          user = user ? attachTimelineEdges(user, feedEdges) : fromFeed
          console.log('[instagram] feed-by-username', handle, feedEdges.length)
        } else if (!user && fromFeed?.username) {
          user = fromFeed
        }
      }
    } else if (instagramCookie() && igProbePolicy(first.status) !== 'not_found') {
      // HTML only helps when we have a session; datacenter IPs get a login wall.
      const html = await fetchProfileFromHtml(handle)
      if (html.user?.username) {
        profileCache.set(handle.toLowerCase(), { at: Date.now(), user: html.user })
        return { user: html.user }
      }
      if (igShouldStopFollowup(html.status)) {
        markInstagramRateLimit(html.retryAfterMs)
      }
    }
  }

  if (user && hasTimelineEdges(user) && hasFollowerCount(user)) {
    profileCache.set(handle.toLowerCase(), { at: Date.now(), user })
    return { user }
  }

  const stale = cachedProfile(handle)
  if (!user && stale?.user) {
    if (feedEdges.length && !hasTimelineEdges(stale.user)) {
      const merged = attachTimelineEdges(stale.user, feedEdges)
      profileCache.set(handle.toLowerCase(), { at: Date.now(), user: merged })
      return { user: merged }
    }
    return { user: stale.user }
  }

  const sb = await fetchSocialBladeProfile(handle)
  if (sb) {
    const graph = socialBladeUserAsGraph(sb)
    const merged = mergeProfileWithFeed(graph, user, feedEdges)
    profileCache.set(handle.toLowerCase(), { at: Date.now(), user: merged })
    return {
      user: merged,
      extras: {
        averageLikes: Math.round(sb.averageLikes),
        averageComments: Math.round(sb.averageComments),
        engagementRate: sb.engagementRate,
        via: 'socialblade',
      },
    }
  }

  if (user) {
    if (feedEdges.length && !hasTimelineEdges(user)) user = attachTimelineEdges(user, feedEdges)
    profileCache.set(handle.toLowerCase(), { at: Date.now(), user })
    return { user }
  }

  if (isInstagramCoolingDown()) return { user: null, error: { code: 'rate_limit' } }
  return { user: null, error: { code: 'unavailable' } }
}

export async function fetchInstagramWebProfile(
  username: string,
  opts?: { skipCache?: boolean },
): Promise<{
  user: Record<string, unknown> | null
  error?: IgFetchError
  extras?: IgProfileExtras
}> {
  const handle = normalizeHandle(username)
  if (!handle) return { user: null, error: { code: 'not_found' } }
  const key = handle.toLowerCase()

  if (!opts?.skipCache) {
    const hit = profileCache.get(key)
    if (hit && Date.now() - hit.at < PROFILE_CACHE_MS) return { user: hit.user }
  }

  const existing = profileInflight.get(key)
  if (existing) return existing

  const job = fetchInstagramWebProfileUncached(handle)
  profileInflight.set(key, job)
  try {
    return await job
  } finally {
    profileInflight.delete(key)
  }
}

function decodeHtml(s: string) {
  return s
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/&bull;/gi, '•')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/\s+/g, ' ')
    .trim()
}

function extractIndexedIgProfiles(html: string): Array<{ username: string; name: string }> {
  const out: Array<{ username: string; name: string }> = []
  const seen = new Set<string>()
  const add = (username: string, name?: string) => {
    const u = normalizeHandle(username)
    if (!isLikelyIgHandle(u)) return
    const key = u.toLowerCase()
    if (seen.has(key)) return
    seen.add(key)
    out.push({ username: u, name: decodeHtml(name || '') || u })
  }

  const titleRe =
    /([^<>]{0,80}?)\(@([A-Za-z0-9._]+)\)\s*(?:•|&bull;|&middot;|·)?\s*Instagram/gi
  for (const m of html.matchAll(titleRe)) {
    add(m[2]!, m[1])
  }

  for (const m of html.matchAll(/\/RU=(https?[^/"']+)/g)) {
    try {
      const url = decodeURIComponent(m[1]!.replace(/\\u002F/gi, '/'))
      const um = url.match(/instagram\.com\/([A-Za-z0-9._]+)/i)
      if (um) add(um[1]!)
    } catch {
      /* ignore */
    }
  }

  for (const m of html.matchAll(/instagram\.com\/([A-Za-z0-9._]+)/gi)) {
    add(m[1]!)
  }

  return out
}

async function searchIndexedInstagramProfiles(query: string): Promise<Array<{ username: string; name: string }>> {
  const q = query.replace(/site:instagram\.com/gi, '').trim()
  if (q.length < 2) return []
  try {
    const gotScraping = await gotClient()
    const url = 'https://search.yahoo.com/search?p=' + encodeURIComponent(`site:instagram.com ${q}`)
    const res = await gotScraping({ url, timeout: { request: 8000 }, throwHttpErrors: false })
    if (res.statusCode < 200 || res.statusCode >= 300) return []
    return extractIndexedIgProfiles(String(res.body || '')).slice(0, 8)
  } catch (err) {
    console.error('[Instagram] web index', (err as Error).message)
    return []
  }
}

async function searchWikidataUsernames(query: string): Promise<Array<{ username: string; name: string }>> {
  const q = query.trim()
  if (q.length < 2) return []
  const lang = /[\u0600-\u06FF]/.test(q) ? 'fa' : 'en'
  const [byName, byIg] = await Promise.all([
    fetchJson(
      'https://www.wikidata.org/w/api.php?action=wbsearchentities&format=json&limit=5&language=' +
        `${lang}&uselang=${lang}&search=${encodeURIComponent(q)}`,
      { headers: WD_UA },
      3000,
    ),
    fetchJson(
      'https://www.wikidata.org/w/api.php?action=query&list=search&format=json&srlimit=5&srsearch=' +
        encodeURIComponent(`haswbstatement:P2003 ${q}`),
      { headers: WD_UA },
      3000,
    ),
  ])

  const ids: string[] = []
  const seen = new Set<string>()
  for (const row of (byName as { search?: Array<{ id: string }> } | null)?.search || []) {
    if (row.id && !seen.has(row.id)) {
      seen.add(row.id)
      ids.push(row.id)
    }
  }
  for (const row of (byIg as { query?: { search?: Array<{ title: string }> } } | null)?.query?.search || []) {
    if (row.title && !seen.has(row.title)) {
      seen.add(row.title)
      ids.push(row.title)
    }
  }
  const slice = ids.slice(0, 5)
  if (!slice.length) return []

  const data = await fetchJson(
    'https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&props=labels|claims&languages=en|fa&ids=' +
      slice.join('|'),
    { headers: WD_UA },
    3500,
  )
  const entities = (data as { entities?: Record<string, Record<string, unknown>> } | null)?.entities || {}
  const out: Array<{ username: string; name: string }> = []
  for (const id of slice) {
    const entity = entities[id]
    if (!entity) continue
    const claims = entity.claims as
      | Record<string, Array<{ mainsnak?: { datavalue?: { value?: string } } }>>
      | undefined
    const username = claims?.P2003?.[0]?.mainsnak?.datavalue?.value
    if (!username) continue
    const labels = entity.labels as Record<string, { value?: string }> | undefined
    out.push({
      username,
      name: labels?.fa?.value || labels?.en?.value || username,
    })
  }
  return out
}
