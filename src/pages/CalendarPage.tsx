import { useEffect, useMemo, useState } from 'react'
import { api, type ContentDto, type OccasionDto } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import {
  CONTENT_STATUS_LABELS,
  CONTENT_TYPE_LABELS,
  type ContentStatus,
  type ContentType,
} from '../domain/types'

type CalView = 'month' | 'week' | 'day' | 'list'

export function CalendarPage() {
  const { workspaceId } = useAuth()
  const [view, setView] = useState<CalView>('month')
  const [items, setItems] = useState<ContentDto[]>([])
  const [occasions, setOccasions] = useState<OccasionDto[]>([])
  const [error, setError] = useState<string | null>(null)
  const [cursor, setCursor] = useState(() => new Date())

  useEffect(() => {
    if (!workspaceId) return
    let cancelled = false
    ;(async () => {
      try {
        const year = cursor.getFullYear()
        const month = cursor.getMonth() + 1
        const [contentRes, occRes] = await Promise.all([
          api.listContent(workspaceId),
          api.occasionsCalendar(workspaceId, { year, month }),
        ])
        if (!cancelled) {
          setItems(contentRes.items)
          setOccasions(occRes.items)
        }
      } catch (e) {
        if (!cancelled) setError((e as Error).message)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [workspaceId, cursor])

  const dated = useMemo(
    () =>
      items
        .filter((i) => i.publishDate)
        .sort((a, b) => String(a.publishDate).localeCompare(String(b.publishDate))),
    [items],
  )

  const monthCells = useMemo(() => buildMonthGrid(cursor), [cursor])
  const occByDate = useMemo(() => {
    const map = new Map<string, OccasionDto[]>()
    for (const o of occasions) {
      if (!o.dateInYear) continue
      const list = map.get(o.dateInYear) || []
      list.push(o)
      map.set(o.dateInYear, list)
    }
    return map
  }, [occasions])

  return (
    <div className="ops-page">
      <header className="ops-page-head">
        <div>
          <h1>تقویم محتوا</h1>
          <p>زمان‌بندی انتشار + مناسبت‌های ایرانی و جهانی</p>
        </div>
        <div className="chip-row">
          {(['month', 'week', 'day', 'list'] as CalView[]).map((v) => (
            <button
              key={v}
              type="button"
              className={`chip ${view === v ? 'active' : ''}`}
              onClick={() => setView(v)}
            >
              {v === 'month' ? 'ماه' : v === 'week' ? 'هفته' : v === 'day' ? 'روز' : 'لیست'}
            </button>
          ))}
        </div>
      </header>

      {error && (
        <div className="panel panel-pad" style={{ marginBottom: '1rem' }}>
          <p className="section-sub">{error}</p>
        </div>
      )}

      <div className="panel panel-pad">
        <div className="result-head" style={{ marginBottom: '1rem' }}>
          <h2 className="section-title" style={{ margin: 0 }}>
            {cursor.toLocaleDateString('fa-IR', { month: 'long', year: 'numeric' })}
          </h2>
          <div className="form-actions">
            <button type="button" className="btn btn-outline btn-sm" onClick={() => setCursor(addMonths(cursor, -1))}>
              قبلی
            </button>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => setCursor(new Date())}>
              امروز
            </button>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => setCursor(addMonths(cursor, 1))}>
              بعدی
            </button>
          </div>
        </div>

        {view === 'list' && (
          <ul className="ops-list">
            {dated.length === 0 && occasions.length === 0 && (
              <li className="section-sub">محتوا یا مناسبتی در این بازه نیست</li>
            )}
            {dated.map((item) => (
              <li key={item.id}>
                <strong>{item.title}</strong>
                <span>
                  {item.publishDate} {item.windowStart || item.publishTime || ''}
                  {item.windowEnd ? `–${item.windowEnd}` : ''} ·{' '}
                  {CONTENT_TYPE_LABELS[item.contentType as ContentType] || item.contentType} ·{' '}
                  {CONTENT_STATUS_LABELS[item.status as ContentStatus] || item.status}
                </span>
              </li>
            ))}
            {occasions.map((o) => (
              <li key={o.id}>
                <strong>🎉 {o.nameFa}</strong>
                <span>
                  {o.dateInYear} · {o.region === 'ir' ? 'ایرانی' : 'جهانی'}
                </span>
              </li>
            ))}
          </ul>
        )}

        {view === 'month' && (
          <div className="cal-month">
            {['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'].map((d) => (
              <div key={d} className="cal-dow">
                {d}
              </div>
            ))}
            {monthCells.map((cell, idx) => {
              const key = cell ? formatDate(cell) : `e-${idx}`
              const dayItems = cell ? dated.filter((i) => i.publishDate === key) : []
              const dayOcc = cell ? occByDate.get(key) || [] : []
              return (
                <div key={key} className={`cal-cell ${cell ? '' : 'empty'}`}>
                  {cell && <div className="cal-daynum">{cell.getDate()}</div>}
                  {dayOcc.slice(0, 2).map((o) => (
                    <div key={o.id} className="cal-pill cal-pill-occasion" title={o.nameEn || o.nameFa}>
                      {o.nameFa}
                    </div>
                  ))}
                  {dayItems.slice(0, 3).map((i) => (
                    <div key={i.id} className="cal-pill" title={i.title}>
                      {i.title}
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        )}

        {(view === 'week' || view === 'day') && (
          <WeekDayView cursor={cursor} view={view} items={dated} occasions={occByDate} />
        )}
      </div>
    </div>
  )
}

function WeekDayView({
  cursor,
  view,
  items,
  occasions,
}: {
  cursor: Date
  view: 'week' | 'day'
  items: ContentDto[]
  occasions: Map<string, OccasionDto[]>
}) {
  const days =
    view === 'day'
      ? [cursor]
      : Array.from({ length: 7 }, (_, i) => {
          const start = startOfWeek(cursor)
          const d = new Date(start)
          d.setDate(start.getDate() + i)
          return d
        })

  return (
    <div className={`cal-${view}`}>
      {days.map((d) => {
        const key = formatDate(d)
        const dayItems = items.filter((i) => i.publishDate === key)
        const dayOcc = occasions.get(key) || []
        return (
          <div key={key} className="cal-daycol panel-pad">
            <strong>{d.toLocaleDateString('fa-IR', { weekday: 'short', day: 'numeric' })}</strong>
            {dayOcc.map((o) => (
              <div key={o.id} className="cal-pill cal-pill-occasion">
                {o.nameFa}
              </div>
            ))}
            {dayItems.length === 0 && dayOcc.length === 0 && <p className="section-sub">خالی</p>}
            {dayItems.map((i) => (
              <div key={i.id} className="cal-pill">
                {i.windowStart || i.publishTime ? `${i.windowStart || i.publishTime} · ` : ''}
                {i.title}
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}

function formatDate(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function addMonths(d: Date, n: number) {
  const x = new Date(d)
  x.setMonth(x.getMonth() + n)
  return x
}

function startOfWeek(d: Date) {
  const x = new Date(d)
  const day = (x.getDay() + 1) % 7
  x.setDate(x.getDate() - day)
  x.setHours(0, 0, 0, 0)
  return x
}

function buildMonthGrid(cursor: Date) {
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1)
  const start = startOfWeek(first)
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    if (d.getMonth() !== cursor.getMonth()) return null
    return d
  })
}
