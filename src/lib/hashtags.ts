export const IG_CAPTION_LIMIT = 2200
export const IG_HASHTAG_LIMIT = 30
export const IG_FIRST_COMMENT_LIMIT = 2200

export function parseHashtags(raw: string | string[] | null | undefined): string[] {
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
    const tag = part.replace(/^#+/, '').replace(/[",[\]]/g, '').trim()
    if (!tag) continue
    const key = tag.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(`#${tag}`)
  }
  return out
}

export function formatHashtags(tags: string[] | null | undefined): string {
  return parseHashtags(tags).join(' ')
}
