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

function hasIgSession(cookie: string) {
  return /(?:^|;\s*)sessionid=/.test(cookie)
}

export async function searchInstagramPages(query: string): Promise<IgPageHit[]> {
  const q = query.trim()
  if (q.length < 1) return []
  const key = q.toLowerCase()
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.items

  const handle = isLikelyIgHandle(q) ? normalizeHandle(q) : ''
  const cookie = instagramCookie()

  const [indexed, wiki, top] = await Promise.all([
    q.length >= 2 ? searchIndexedInstagramProfiles(q) : Promise.resolve([] as Array<{ username: string; name: string }>),
    q.length >= 2 ? searchWikidataUsernames(q) : Promise.resolve([] as Array<{ username: string; name: string }>),
    hasIgSession(cookie) ? searchInstagramApi(q, cookie) : Promise.resolve([] as IgPageHit[]),
  ])

  const candidates: Array<{ username: string; name: string; fromIndex: boolean }> = []
  const seen = new Set<string>()
  const add = (username: string, name?: string, fromIndex = false) => {
    const u = normalizeHandle(username)
    if (!isLikelyIgHandle(u)) return
    const k = u.toLowerCase()
    if (seen.has(k)) return
    seen.add(k)
    candidates.push({ username: u, name: (name || u).trim() || u, fromIndex })
  }

  if (handle) add(handle, handle, false)
  for (const row of top) add(row.username, row.name, true)
  for (const row of indexed) add(row.username, row.name, true)
  for (const row of wiki) add(row.username, row.name, false)

  const slice = candidates.slice(0, 6)
  const profiles = await Promise.all(slice.map((c) => lookupInstagramUser(c.username)))

  const merged = mergeHits([
    ...top,
    ...slice
      .map((c, i) => {
        const ig = profiles[i]?.[0]
        if (ig) return ig
        if (!c.fromIndex) return null
        return { username: c.username, name: c.name, source: 'instagram' as const }
      })
      .filter((x): x is IgPageHit => Boolean(x)),
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

async function searchInstagramApi(query: string, cookie: string): Promise<IgPageHit[]> {
  const url =
    `https://www.instagram.com/api/v1/web/search/topsearch/?context=blended&count=8&query=` +
    encodeURIComponent(query)
  const data = await fetchJson(url, { headers: igHeaders(cookie) }, 4000)
  return parseInstagramSearch(data)
}

async function gotClient() {
  const mod = await import('got-scraping')
  return mod.gotScraping
}

export type IgFetchError = {
  code: 'not_found' | 'rate_limit' | 'unavailable'
  status?: number
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
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
): Promise<{ status: number; data: unknown | null }> {
  try {
    const gotScraping = await gotClient()
    const cookie = instagramCookie()
    const res = await gotScraping({
      url,
      headers: {
        ...igHeaders(cookie),
        'x-ig-app-id': IG_APP,
        accept: 'application/json',
        referer: 'https://www.instagram.com/',
      },
      timeout: { request: ms },
      throwHttpErrors: false,
    })
    const status = res.statusCode
    if (status === 404) return { status, data: null }
    const body = String(res.body || '')
    if (status < 200 || status >= 300) return { status, data: null }
    try {
      return { status, data: JSON.parse(body) }
    } catch {
      return { status, data: null }
    }
  } catch {
    return { status: 0, data: null }
  }
}

async function fetchProfileFromHtml(username: string): Promise<Record<string, unknown> | null> {
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
    })
    if (res.statusCode < 200 || res.statusCode >= 300) return null
    const html = String(res.body || '')
    for (const m of html.matchAll(/<script type="application\/json"[^>]*>([\s\S]*?)<\/script>/gi)) {
      const raw = m[1] || ''
      if (raw.length < 40 || raw.length > 2_000_000) continue
      if (!raw.includes(username) && !raw.includes('edge_followed_by')) continue
      try {
        const user = userFromPayload(JSON.parse(raw))
        if (user?.username) return user
      } catch {
        /* next blob */
      }
    }
    return null
  } catch {
    return null
  }
}

export async function fetchInstagramWebProfile(username: string): Promise<{
  user: Record<string, unknown> | null
  error?: IgFetchError
}> {
  const handle = normalizeHandle(username)
  if (!handle) return { user: null, error: { code: 'not_found' } }

  const urls = [
    `https://i.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(handle)}`,
    `https://www.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(handle)}`,
    `https://www.instagram.com/${encodeURIComponent(handle)}/?__a=1&__d=dis`,
  ]

  let lastStatus = 0
  const tryUrl = async (url: string, ms = 5000) => {
    const { status, data } = await igGetJson(url, ms)
    lastStatus = status || lastStatus
    const user = userFromPayload(data)
    if (user?.username) return { user } as const
    if (status === 404) return { error: { code: 'not_found' as const, status } }
    return null
  }

  const first = await tryUrl(urls[0]!, 5000)
  if (first && 'user' in first) return first
  if (first && 'error' in first) return { user: null, error: first.error }

  if (lastStatus === 429) {
    await sleep(350)
    const retry = await tryUrl(urls[0]!, 5000)
    if (retry && 'user' in retry) return retry
    if (retry && 'error' in retry) return { user: null, error: retry.error }
  }

  for (const url of urls.slice(1)) {
    const hit = await tryUrl(url, 4500)
    if (hit && 'user' in hit) return hit
    if (hit && 'error' in hit) return { user: null, error: hit.error }
  }

  const htmlUser = await fetchProfileFromHtml(handle)
  if (htmlUser?.username) return { user: htmlUser }

  if (lastStatus === 429) return { user: null, error: { code: 'rate_limit', status: lastStatus } }
  if (lastStatus === 404) return { user: null, error: { code: 'not_found', status: lastStatus } }
  return { user: null, error: { code: 'unavailable', status: lastStatus || undefined } }
}

async function lookupInstagramUser(username: string): Promise<IgPageHit[]> {
  const { user } = await fetchInstagramWebProfile(username)
  if (!user?.username) return []
  const followers = (user.edge_followed_by as { count?: number } | undefined)?.count
  return [
    {
      username: String(user.username),
      name: String(user.full_name || user.username),
      biography: user.biography ? String(user.biography) : undefined,
      avatarUrl: user.profile_pic_url ? String(user.profile_pic_url) : undefined,
      verified: Boolean(user.is_verified),
      followers: typeof followers === 'number' ? followers : undefined,
      source: 'instagram',
    },
  ]
}

function parseInstagramSearch(data: unknown): IgPageHit[] {
  if (!data || typeof data !== 'object') return []
  const users = (data as { users?: unknown[] }).users || []
  const out: IgPageHit[] = []
  for (const row of users) {
    const rec = row as Record<string, unknown>
    const user = (rec.user as Record<string, unknown> | undefined) || rec
    const username = String(user.username || '').replace(/^@/, '')
    if (!username) continue
    out.push({
      username,
      name: String(user.full_name || username),
      biography: user.biography ? String(user.biography) : undefined,
      avatarUrl: user.profile_pic_url ? String(user.profile_pic_url) : undefined,
      verified: Boolean(user.is_verified),
      source: 'instagram',
    })
  }
  return out
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
