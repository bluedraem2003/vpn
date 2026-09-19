import { Hono } from 'hono'
import { db } from '../db/index.js'
import { requireAuth } from '../middleware/auth.js'
import { hitRateLimit } from '../middleware/rateLimit.js'
import { isLikelyIgHandle, normalizeHandle, searchInstagramPages, type IgPageHit } from '../lib/instagramSearch.js'
import { isAllowedIgMediaHost, signInstagramMediaUrl, verifyInstagramMediaSig } from '../lib/igMedia.js'

export const instagramRoutes = new Hono()

instagramRoutes.get('/media', async (c) => {
  if (hitRateLimit(`igmedia:${c.req.header('x-forwarded-for') || c.req.header('cf-connecting-ip') || 'x'}`, 80, 60_000)) {
    return c.body(null, 429)
  }
  const url = c.req.query('url') || ''
  const exp = c.req.query('exp') || ''
  const sig = c.req.query('sig') || ''
  if (!verifyInstagramMediaSig(url, exp, sig)) return c.body(null, 403)
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return c.body(null, 400)
  }
  if (parsed.protocol !== 'https:' || !isAllowedIgMediaHost(parsed.hostname)) return c.body(null, 400)
  try {
    const { gotScraping } = await import('got-scraping')
    const res = await gotScraping({
      url: parsed.toString(),
      responseType: 'buffer',
      timeout: { request: 8000 },
      throwHttpErrors: false,
      headers: {
        referer: 'https://www.instagram.com/',
        accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
      },
    })
    if (res.statusCode < 200 || res.statusCode >= 300 || !res.body) return c.body(null, 502)
    const ct = String(res.headers['content-type'] || 'image/jpeg').split(';')[0] || 'image/jpeg'
    if (!ct.startsWith('image/')) return c.body(null, 502)
    return c.body(res.body as Buffer, 200, {
      'Content-Type': ct,
      'Cache-Control': 'public, max-age=3600',
    })
  } catch {
    return c.body(null, 502)
  }
})

instagramRoutes.use('*', requireAuth)

instagramRoutes.get('/search', async (c) => {
  if (hitRateLimit(`igsearch:${c.get('userId')}`, 40, 60_000)) {
    return c.json({ error: 'کمی صبر کن و دوباره جستجو کن' }, 429)
  }
  const q = (c.req.query('q') || '').trim()
  if (q.length < 1) return c.json({ items: [] })

  const workspaceId = c.get('workspaceId')
  const like = `%${q.replace(/%/g, '')}%`
  const local = db
    .prepare(
      `SELECT name, handle, client_name, niche FROM projects
       WHERE workspace_id = ?
         AND (name LIKE ? OR IFNULL(handle,'') LIKE ? OR IFNULL(client_name,'') LIKE ?)
       LIMIT 8`,
    )
    .all(workspaceId, like, like, like) as Array<{
    name: string
    handle: string | null
    client_name: string | null
    niche: string | null
  }>

  const workspaceHits: IgPageHit[] = local
    .map((row) => {
      const username = normalizeHandle(String(row.handle || row.client_name || ''))
      if (!username) return null
      return {
        username,
        name: row.name,
        biography: row.niche || undefined,
        source: 'workspace' as const,
      }
    })
    .filter((x): x is IgPageHit => Boolean(x))

  let remote: IgPageHit[] = []
  try {
    remote = await searchInstagramPages(q)
  } catch (err) {
    console.error('[Instagram] search', (err as Error).message)
  }

  const handle = isLikelyIgHandle(q) ? normalizeHandle(q) : ''
  const typed: IgPageHit[] = handle
    ? [{ username: handle, name: handle, source: 'typed' }]
    : []

  const items = dedupe([...remote, ...workspaceHits, ...typed]).slice(0, 12).map((item) => ({
    ...item,
    avatarUrl: item.avatarUrl ? signInstagramMediaUrl(item.avatarUrl) : undefined,
  }))
  return c.json({ items, q })
})

function dedupe(list: IgPageHit[]) {
  const seen = new Set<string>()
  const out: IgPageHit[] = []
  for (const item of list) {
    const key = item.username.toLowerCase()
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(item)
  }
  return out
}
