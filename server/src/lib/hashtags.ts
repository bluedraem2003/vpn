export function parseHashtags(raw: unknown): string[] {
  const parts = Array.isArray(raw) ? raw.map(String) : String(raw || '').split(/[\s,]+/)
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
