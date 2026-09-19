export function parseHashtags(raw: unknown): string[] {
  let value: unknown = raw
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (trimmed.startsWith('[')) {
      try {
        value = JSON.parse(trimmed)
      } catch {
        value = trimmed
      }
    } else {
      value = trimmed
    }
  }
  const parts = Array.isArray(value) ? value.map(String) : String(value || '').split(/[\s,]+/)
  const seen = new Set<string>()
  const out: string[] = []
  for (const part of parts) {
    const tag = part.replace(/^#+/, '').trim()
    if (!tag) continue
    const key = tag.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(`#${tag.replace(/^#/, '')}`)
  }
  return out
}
