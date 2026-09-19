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
