export type IgPageHit = {
  username: string
  name: string
  biography?: string
  avatarUrl?: string
  verified?: boolean
  source: 'instagram' | 'workspace' | 'typed' | 'wikidata'
}

const IG_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
const IG_APP = '936619743392459'
const WD_UA = { Accept: 'application/json', 'User-Agent': 'PostYar/1.0 (content studio)' }

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
  return /^[A-Za-z0-9._]{1,30}$/.test(h) && !h.startsWith('.') && !h.endsWith('.')
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
  const canIg = hasIgSession(cookie)

  const [ig, wiki, profile] = await Promise.all([
    canIg ? searchInstagramApi(q, cookie) : Promise.resolve([] as IgPageHit[]),
    q.length >= 2 ? searchWikidata(q) : Promise.resolve([] as IgPageHit[]),
    canIg && handle ? lookupInstagramUser(handle, cookie) : Promise.resolve([] as IgPageHit[]),
  ])

  const merged = mergeHits([
    ...(handle
      ? [
          {
            username: handle,
            name: profile[0]?.name || handle,
            biography: profile[0]?.biography,
            avatarUrl: profile[0]?.avatarUrl,
            verified: profile[0]?.verified,
            source: 'typed' as const,
          },
        ]
      : []),
    ...ig,
    ...profile,
    ...wiki,
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

function igHeaders(cookie: string): Record<string, string> {
  const headers: Record<string, string> = {
    'User-Agent': IG_UA,
    'X-IG-App-ID': IG_APP,
    Accept: 'application/json',
    Referer: 'https://www.instagram.com/',
    'X-Requested-With': 'XMLHttpRequest',
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

async function lookupInstagramUser(username: string, cookie: string): Promise<IgPageHit[]> {
  const data = await fetchJson(
    `https://www.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(username)}`,
    { headers: igHeaders(cookie) },
    4000,
  )
  const user = (data as { data?: { user?: Record<string, unknown> } } | null)?.data?.user
  if (!user?.username) return []
  return [
    {
      username: String(user.username),
      name: String(user.full_name || user.username),
      biography: user.biography ? String(user.biography) : undefined,
      avatarUrl: user.profile_pic_url ? String(user.profile_pic_url) : undefined,
      verified: Boolean(user.is_verified),
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

async function searchWikidata(query: string): Promise<IgPageHit[]> {
  const q = query.trim()
  if (q.length < 2) return []
  const lang = /[\u0600-\u06FF]/.test(q) ? 'fa' : 'en'
  const [byName, byIg] = await Promise.all([
    fetchJson(
      'https://www.wikidata.org/w/api.php?action=wbsearchentities&format=json&limit=6&language=' +
        `${lang}&uselang=${lang}&search=${encodeURIComponent(q)}`,
      { headers: WD_UA },
      3500,
    ),
    fetchJson(
      'https://www.wikidata.org/w/api.php?action=query&list=search&format=json&srlimit=6&srsearch=' +
        encodeURIComponent(`haswbstatement:P2003 ${q}`),
      { headers: WD_UA },
      3500,
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
  const slice = ids.slice(0, 6)
  if (!slice.length) return []

  const data = await fetchJson(
    'https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&props=labels|claims&languages=en|fa&ids=' +
      slice.join('|'),
    { headers: WD_UA },
    4000,
  )
  const entities = (data as { entities?: Record<string, Record<string, unknown>> } | null)?.entities || {}
  const out: IgPageHit[] = []
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
      source: 'wikidata',
    })
  }
  return out
}
