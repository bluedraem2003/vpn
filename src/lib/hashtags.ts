export const IG_CAPTION_LIMIT = 2200
export const IG_HASHTAG_LIMIT = 30
export const IG_FIRST_COMMENT_LIMIT = 2200

export function parseHashtags(raw: string | string[] | null | undefined): string[] {
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

export function formatHashtags(tags: string[] | null | undefined): string {
  return parseHashtags(tags).join(' ')
}
