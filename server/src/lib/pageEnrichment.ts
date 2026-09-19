import { isIP } from 'node:net'
import type { PageInsights } from './pageInsights.js'

export type ResearchLink = {
  id: string
  label: string
  url: string
  hint: string
}

export type WebsiteMeta = {
  url: string
  title?: string
  description?: string
  sameAs: string[]
  address?: string
  telephone?: string
  email?: string
}

export type WikidataHit = {
  id: string
  label: string
  description?: string
  website?: string
  wikiFa?: string
  wikiEn?: string
}

export type WikipediaHit = {
  title: string
  extract: string
  url: string
  lang: 'fa' | 'en'
}

export type DomainMeta = {
  host: string
  createdAt?: string
  registrar?: string
}

export type PlaceMeta = {
  name: string
  displayName: string
  lat: string
  lon: string
}

export type PageEnrichment = {
  website?: WebsiteMeta
  wikidata?: WikidataHit
  wikipedia?: WikipediaHit
  domain?: DomainMeta
  place?: PlaceMeta
  researchLinks: ResearchLink[]
}

const siteCache = new Map<string, { at: number; data: WebsiteMeta | null }>()
const wdCache = new Map<string, { at: number; data: WikidataHit | null }>()
const wikiCache = new Map<string, { at: number; data: WikipediaHit | null }>()
const rdapCache = new Map<string, { at: number; data: DomainMeta | null }>()
const geoCache = new Map<string, { at: number; data: PlaceMeta | null }>()
const CACHE_MS = 6 * 60 * 60_000

function isPrivateHost(hostname: string) {
  const h = hostname.toLowerCase().replace(/\[|\]/g, '')
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local') || h === '0.0.0.0') return true
  if (!isIP(h)) return false
  if (h === '::1' || h.startsWith('127.') || h.startsWith('10.') || h.startsWith('192.168.') || h.startsWith('169.254.')) {
    return true
  }
  const m = h.match(/^172\.(\d+)\./)
  if (m) {
    const n = Number(m[1])
    if (n >= 16 && n <= 31) return true
  }
  return false
}

function safeHttpUrl(raw: string) {
  let parsed: URL
  try {
    parsed = new URL(raw)
  } catch {
    return null
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
  if (isPrivateHost(parsed.hostname)) return null
  return parsed.toString()
}

function decodeHtml(s: string) {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim()
}

function metaContent(html: string, key: string) {
  const re = new RegExp(
    `<meta[^>]+(?:property|name)=["']${key}["'][^>]+content=["']([^"']+)["']|<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${key}["']`,
    'i',
  )
  const m = html.match(re)
  return m ? decodeHtml(m[1] || m[2] || '') : ''
}

function collectSameAs(value: unknown, out: string[]) {
  if (!value) return
  if (typeof value === 'string') {
    const url = safeHttpUrl(value)
    if (url) out.push(url)
    return
  }
  if (Array.isArray(value)) {
    for (const item of value) collectSameAs(item, out)
  }
}

function parseJsonLd(html: string): Pick<WebsiteMeta, 'sameAs' | 'address' | 'telephone' | 'email'> {
  const sameAs: string[] = []
  let address = ''
  let telephone = ''
  let email = ''
  for (const m of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const json = JSON.parse(m[1] || '') as Record<string, unknown> | unknown[]
      const nodes = Array.isArray(json) ? json : json['@graph'] && Array.isArray(json['@graph']) ? json['@graph'] : [json]
      for (const node of nodes) {
        if (!node || typeof node !== 'object') continue
        const rec = node as Record<string, unknown>
        collectSameAs(rec.sameAs, sameAs)
        if (!telephone && typeof rec.telephone === 'string') telephone = rec.telephone
        if (!email && typeof rec.email === 'string') email = rec.email
        const addr = rec.address
        if (!address && typeof addr === 'string') address = addr
        if (!address && addr && typeof addr === 'object') {
          const a = addr as Record<string, unknown>
          address = [a.streetAddress, a.addressLocality, a.addressRegion, a.addressCountry]
            .filter((x) => typeof x === 'string')
            .join('، ')
        }
      }
    } catch {
      /* ignore broken json-ld */
    }
  }
  return {
    sameAs: [...new Set(sameAs)].slice(0, 8),
    address: address || undefined,
    telephone: telephone || undefined,
    email: email || undefined,
  }
}

async function fetchWebsiteMeta(raw: string): Promise<WebsiteMeta | null> {
  const url = safeHttpUrl(raw)
  if (!url) return null
  const cached = siteCache.get(url)
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.data
  try {
    const { gotScraping } = await import('got-scraping')
    const res = await gotScraping({
      url,
      timeout: { request: 6000 },
      throwHttpErrors: false,
      followRedirect: true,
      maxRedirects: 3,
      headers: { accept: 'text/html,application/xhtml+xml' },
    })
    if (res.statusCode < 200 || res.statusCode >= 400) {
      const data = { url, sameAs: [] as string[] }
      siteCache.set(url, { at: Date.now(), data })
      return data
    }
    const html = String(res.body || '').slice(0, 120_000)
    const title = metaContent(html, 'og:title') || html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] || ''
    const description = metaContent(html, 'og:description') || metaContent(html, 'description')
    const jsonLd = parseJsonLd(html)
    const data: WebsiteMeta = {
      url: res.url || url,
      title: decodeHtml(title).slice(0, 140) || undefined,
      description: description.slice(0, 220) || undefined,
      ...jsonLd,
    }
    siteCache.set(url, { at: Date.now(), data })
    return data
  } catch {
    const fallback = { url, sameAs: [] as string[] }
    siteCache.set(url, { at: Date.now(), data: fallback })
    return fallback
  }
}

async function fetchWikidata(handle: string): Promise<WikidataHit | null> {
  const key = handle.toLowerCase()
  const cached = wdCache.get(key)
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.data
  const safe = handle.replace(/"/g, '')
  const query = `SELECT ?item ?itemLabel ?itemDescription ?website ?wikiFa ?wikiEn WHERE {
    ?item wdt:P2003 "${safe}" .
    OPTIONAL { ?item wdt:P856 ?website }
    OPTIONAL { ?wikiFa schema:about ?item ; schema:isPartOf <https://fa.wikipedia.org/> . }
    OPTIONAL { ?wikiEn schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> . }
    SERVICE wikibase:label { bd:serviceParam wikibase:language "fa,en". }
  } LIMIT 1`
  try {
    const url = 'https://query.wikidata.org/sparql?format=json&query=' + encodeURIComponent(query)
    const res = await fetch(url, {
      headers: { Accept: 'application/sparql-json, application/json', 'User-Agent': 'PostYar/1.0 (content studio)' },
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) {
      wdCache.set(key, { at: Date.now(), data: null })
      return null
    }
    const json = (await res.json()) as {
      results?: { bindings?: Array<Record<string, { value?: string }>> }
    }
    const row = json.results?.bindings?.[0]
    if (!row?.item?.value) {
      wdCache.set(key, { at: Date.now(), data: null })
      return null
    }
    const id = String(row.item.value).split('/').pop() || ''
    const data: WikidataHit = {
      id,
      label: row.itemLabel?.value || handle,
      description: row.itemDescription?.value,
      website: row.website?.value,
      wikiFa: row.wikiFa?.value,
      wikiEn: row.wikiEn?.value,
    }
    wdCache.set(key, { at: Date.now(), data })
    return data
  } catch {
    wdCache.set(key, { at: Date.now(), data: null })
    return null
  }
}

async function fetchWikipedia(wikidata: WikidataHit | null, name: string): Promise<WikipediaHit | null> {
  const cacheKey = (wikidata?.id || name).toLowerCase()
  const cached = wikiCache.get(cacheKey)
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.data
  const targets: Array<{ lang: 'fa' | 'en'; url: string }> = []
  if (wikidata?.wikiFa) targets.push({ lang: 'fa', url: wikidata.wikiFa })
  if (wikidata?.wikiEn) targets.push({ lang: 'en', url: wikidata.wikiEn })
  if (!targets.length) {
    targets.push({
      lang: /[\u0600-\u06FF]/.test(name) ? 'fa' : 'en',
      url: `https://${/[\u0600-\u06FF]/.test(name) ? 'fa' : 'en'}.wikipedia.org/wiki/${encodeURIComponent(name)}`,
    })
  }
  for (const target of targets) {
    try {
      const title = decodeURIComponent(target.url.split('/wiki/')[1] || name).replace(/_/g, ' ')
      const api = `https://${target.lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`
      const res = await fetch(api, {
        headers: { 'User-Agent': 'PostYar/1.0 (content studio)' },
        signal: AbortSignal.timeout(4000),
      })
      if (!res.ok) continue
      const json = (await res.json()) as { title?: string; extract?: string; content_urls?: { desktop?: { page?: string } } }
      if (!json.extract) continue
      const data: WikipediaHit = {
        title: json.title || title,
        extract: json.extract.slice(0, 420),
        url: json.content_urls?.desktop?.page || target.url,
        lang: target.lang,
      }
      wikiCache.set(cacheKey, { at: Date.now(), data })
      return data
    } catch {
      /* next */
    }
  }
  wikiCache.set(cacheKey, { at: Date.now(), data: null })
  return null
}

async function fetchRdap(websiteUrl?: string): Promise<DomainMeta | null> {
  if (!websiteUrl) return null
  let host = ''
  try {
    host = new URL(websiteUrl).hostname.replace(/^www\./, '')
  } catch {
    return null
  }
  if (!host || isPrivateHost(host) || isIP(host)) return null
  const cached = rdapCache.get(host)
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.data
  try {
    const res = await fetch(`https://rdap.org/domain/${encodeURIComponent(host)}`, {
      headers: { Accept: 'application/rdap+json, application/json', 'User-Agent': 'PostYar/1.0 (content studio)' },
      signal: AbortSignal.timeout(4000),
    })
    if (!res.ok) {
      rdapCache.set(host, { at: Date.now(), data: { host } })
      return { host }
    }
    const json = (await res.json()) as {
      events?: Array<{ eventAction?: string; eventDate?: string }>
      entities?: Array<{ vcardArray?: unknown[]; roles?: string[] }>
    }
    const created = json.events?.find((e) => e.eventAction === 'registration')?.eventDate
    const registrar = json.entities?.find((e) => e.roles?.includes('registrar'))
    let registrarName = ''
    const vcard = registrar?.vcardArray
    if (Array.isArray(vcard)) {
      const card = vcard[1]
      if (Array.isArray(card)) {
        for (const row of card) {
          if (Array.isArray(row) && row[0] === 'fn') registrarName = String(row[3] || '')
        }
      }
    }
    const data: DomainMeta = { host, createdAt: created, registrar: registrarName || undefined }
    rdapCache.set(host, { at: Date.now(), data })
    return data
  } catch {
    const data = { host }
    rdapCache.set(host, { at: Date.now(), data })
    return data
  }
}

async function fetchPlace(name?: string): Promise<PlaceMeta | null> {
  const q = (name || '').trim()
  if (q.length < 2) return null
  const cached = geoCache.get(q.toLowerCase())
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.data
  try {
    const url =
      'https://nominatim.openstreetmap.org/search?format=json&limit=1&q=' + encodeURIComponent(q)
    const res = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': 'PostYar/1.0 (content studio)' },
      signal: AbortSignal.timeout(4000),
    })
    if (!res.ok) {
      geoCache.set(q.toLowerCase(), { at: Date.now(), data: null })
      return null
    }
    const rows = (await res.json()) as Array<{ display_name?: string; lat?: string; lon?: string }>
    const row = rows[0]
    if (!row?.lat || !row?.lon) {
      geoCache.set(q.toLowerCase(), { at: Date.now(), data: null })
      return null
    }
    const data: PlaceMeta = {
      name: q,
      displayName: row.display_name || q,
      lat: row.lat,
      lon: row.lon,
    }
    geoCache.set(q.toLowerCase(), { at: Date.now(), data })
    return data
  } catch {
    geoCache.set(q.toLowerCase(), { at: Date.now(), data: null })
    return null
  }
}

function pushLink(list: ResearchLink[], link: ResearchLink) {
  if (!link.url || list.some((x) => x.url === link.url)) return
  list.push(link)
}

export async function enrichPage(page: PageInsights): Promise<PageEnrichment> {
  const [website, wikidata, domain, place] = await Promise.all([
    page.website ? fetchWebsiteMeta(page.website) : Promise.resolve(undefined),
    fetchWikidata(page.handle),
    fetchRdap(page.website),
    fetchPlace(page.locations[0]?.key),
  ])
  const wikipedia = await fetchWikipedia(wikidata || null, page.name)

  const q = [page.name, page.handle].filter(Boolean).join(' ')
  const loc = page.locations[0]?.key
  const researchLinks: ResearchLink[] = []

  if (website?.url) {
    pushLink(researchLinks, {
      id: 'website',
      label: 'وب‌سایت بایو',
      url: website.url,
      hint: website.title || 'صفحه فرود پیج',
    })
  }
  pushLink(researchLinks, {
    id: 'ads_library',
    label: 'کتابخانه تبلیغات Meta',
    url:
      'https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=IR&search_type=keyword_unordered&q=' +
      encodeURIComponent(q),
    hint: 'تبلیغات فعال برند در Meta',
  })
  pushLink(researchLinks, {
    id: 'google',
    label: 'جستجوی گوگل برند',
    url: 'https://www.google.com/search?q=' + encodeURIComponent(`"${page.handle}" OR "${page.name}"`),
    hint: 'ذکر برند در وب و خبرها',
  })
  pushLink(researchLinks, {
    id: 'news',
    label: 'اخبار گوگل',
    url: 'https://news.google.com/search?q=' + encodeURIComponent(q) + '&hl=fa',
    hint: 'پوشش خبری اخیر',
  })
  pushLink(researchLinks, {
    id: 'youtube',
    label: 'یوتیوب',
    url: 'https://www.youtube.com/results?search_query=' + encodeURIComponent(q),
    hint: 'ویدیو و کانال مرتبط',
  })
  pushLink(researchLinks, {
    id: 'linkedin',
    label: 'لینکدین',
    url: 'https://www.linkedin.com/search/results/all/?keywords=' + encodeURIComponent(q),
    hint: 'حضور شرکتی/برند',
  })
  pushLink(researchLinks, {
    id: 'socialblade',
    label: 'SocialBlade',
    url: 'https://socialblade.com/instagram/user/' + encodeURIComponent(page.handle),
    hint: 'روند عمومی فالوور (منبع ثالث)',
  })
  if (website?.url) {
    try {
      const host = new URL(website.url).hostname.replace(/^www\./, '')
      pushLink(researchLinks, {
        id: 'similarweb',
        label: 'Similarweb',
        url: 'https://www.similarweb.com/website/' + encodeURIComponent(host) + '/',
        hint: 'ترافیک تخمینی سایت بایو',
      })
      pushLink(researchLinks, {
        id: 'wayback',
        label: 'بایگانی وب',
        url: 'https://web.archive.org/web/*/' + encodeURIComponent(website.url),
        hint: 'تاریخچه صفحه فرود',
      })
    } catch {
      /* ignore */
    }
  }
  if (loc) {
    const mapsUrl = place
      ? `https://www.openstreetmap.org/?mlat=${place.lat}&mlon=${place.lon}#map=16/${place.lat}/${place.lon}`
      : 'https://www.openstreetmap.org/search?query=' + encodeURIComponent(loc)
    pushLink(researchLinks, {
      id: 'maps',
      label: 'نقشه لوکیشن پرتکرار',
      url: mapsUrl,
      hint: place?.displayName || loc,
    })
  }
  if (wikidata?.id) {
    pushLink(researchLinks, {
      id: 'wikidata',
      label: 'ویکی‌داده',
      url: `https://www.wikidata.org/wiki/${wikidata.id}`,
      hint: wikidata.description || wikidata.label,
    })
  }
  if (wikipedia?.url) {
    pushLink(researchLinks, {
      id: 'wikipedia',
      label: 'ویکی‌پدیا',
      url: wikipedia.url,
      hint: wikipedia.title,
    })
  }
  if (page.telegram) {
    pushLink(researchLinks, {
      id: 'telegram',
      label: 'تلگرام بایو',
      url: `https://t.me/${page.telegram}`,
      hint: `@${page.telegram}`,
    })
  }
  if (page.phone) {
    pushLink(researchLinks, {
      id: 'phone',
      label: 'تماس بایو',
      url: 'tel:' + page.phone,
      hint: page.phone,
    })
  }
  if (page.email) {
    pushLink(researchLinks, {
      id: 'email',
      label: 'ایمیل بایو',
      url: 'mailto:' + page.email,
      hint: page.email,
    })
  }
  for (const same of website?.sameAs || []) {
    pushLink(researchLinks, {
      id: 'same_as',
      label: 'پروفایل مرتبط سایت',
      url: same,
      hint: same.replace(/^https?:\/\//, ''),
    })
  }

  return {
    website: website || undefined,
    wikidata: wikidata || undefined,
    wikipedia: wikipedia || undefined,
    domain: domain || undefined,
    place: place || undefined,
    researchLinks,
  }
}
