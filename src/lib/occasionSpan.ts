import type { OccasionDto } from '../api/client'

type SpanOccasion = Pick<OccasionDto, 'dateInYear' | 'dateEndInYear'>
type DatedOccasion = SpanOccasion & Pick<OccasionDto, 'id' | 'priority'>

/** Inclusive gregorian YYYY-MM-DD days covered by an occasion (caps at 14). */
export function occasionSpanDays(o: SpanOccasion): string[] {
  if (!o.dateInYear) return []
  const start = o.dateInYear
  const end = o.dateEndInYear && o.dateEndInYear > start ? o.dateEndInYear : start
  const days: string[] = []
  const cur = new Date(`${start}T12:00:00`)
  const last = new Date(`${end}T12:00:00`)
  if (Number.isNaN(cur.getTime()) || Number.isNaN(last.getTime())) return [start]
  for (let i = 0; i < 14 && cur <= last; i++) {
    const y = cur.getFullYear()
    const m = String(cur.getMonth() + 1).padStart(2, '0')
    const d = String(cur.getDate()).padStart(2, '0')
    days.push(`${y}-${m}-${d}`)
    cur.setDate(cur.getDate() + 1)
  }
  return days
}

export function occasionHint(o: Pick<OccasionDto, 'hintFa' | 'hintEn'>, lang: 'fa' | 'en') {
  return lang === 'en' ? o.hintEn || o.hintFa || '' : o.hintFa || o.hintEn || ''
}

/** Prefer the occasion that starts on `date`; otherwise the highest-priority span that covers it. */
export function pickOccasionForDate<T extends DatedOccasion>(occasions: T[], date: string): T | undefined {
  if (!date) return undefined
  const covering = occasions.filter((o) => occasionSpanDays(o).includes(date))
  if (covering.length === 0) return undefined
  const exact = covering.filter((o) => o.dateInYear === date)
  const pool = exact.length ? exact : covering
  return [...pool].sort((a, b) => (b.priority || 0) - (a.priority || 0))[0]
}

/** Keep a mid-range date (e.g. Space Week on 7 Oct) instead of jumping back to the start. */
export function publishDateForOccasion(o: SpanOccasion | undefined, current: string) {
  if (!o) return current
  const days = occasionSpanDays(o)
  if (current && days.includes(current)) return current
  return o.dateInYear || current
}
