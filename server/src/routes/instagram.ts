import { Hono } from 'hono'
import { db } from '../db/index.js'
import { requireAuth } from '../middleware/auth.js'
import { hitRateLimit } from '../middleware/rateLimit.js'
import { isLikelyIgHandle, normalizeHandle, searchInstagramPages, type IgPageHit } from '../lib/instagramSearch.js'

export const instagramRoutes = new Hono()
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

  const items = dedupe([...remote, ...workspaceHits, ...typed]).slice(0, 12)
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
