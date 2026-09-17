import { useEffect, useMemo, useState } from 'react'
import { api, type ContentDto } from '../api/client'
import {
  CONTENT_STATUS_LABELS,
  CONTENT_TYPE_LABELS,
  type ContentStatus,
  type ContentType,
} from '../domain/types'

type CalView = 'month' | 'week' | 'day' | 'list'

export function CalendarPage() {
  const [view, setView] = useState<CalView>('month')
  const [items, setItems] = useState<ContentDto[]>([])
  const [error, setError] = useState<string | null>(null)
  const [cursor, setCursor] = useState(() => new Date())

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const ws = await api.workspaces()
        const id = ws.items[0]?.id
        if (!id) throw new Error('ورک‌اسپیس یافت نشد')
        const res = await api.listContent(id)
        if (!cancelled) setItems(res.items)
      } catch (e) {
        if (!cancelled) setError((e as Error).message)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const dated = useMemo(
    () => items.filter((i) => i.publishDate).sort((a, b) => String(a.publishDate).localeCompare(String(b.publishDate))),
    [items],
  )

  const monthCells = useMemo(() => buildMonthGrid(cursor), [cursor])

  return (
    <div className="ops-page">
      <header className="ops-page-head">
        <div>
          <h1>تقویم محتوا</h1>
          <p>هستهٔ زمان‌بندی انتشار — Month / Week / Day / List</p>
        </div>
        <div className="chip-row">
          {(['month', 'week', 'day', 'list'] as CalView[]).map((v) => (
            <button key={v} type="button" className={`chip ${view === v ? 'active' : ''}`} onClick={() => setView(v)}>
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
            {dated.length === 0 && <li className="section-sub">محتوای زمان‌بندی‌شده نیست</li>}
            {dated.map((item) => (
              <li key={item.id}>
                <strong>{item.title}</strong>
                <span>
                  {item.publishDate} {item.publishTime || ''} ·{' '}
                  {CONTENT_TYPE_LABELS[item.contentType as ContentType] || item.contentType} ·{' '}
                  {CONTENT_STATUS_LABELS[item.status as ContentStatus] || item.status}
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
            {monthCells.map((cell) => {
              const key = cell ? formatDate(cell) : ''
              const dayItems = cell ? dated.filter((i) => i.publishDate === key) : []
              return (
                <div key={key || Math.random()} className={`cal-cell ${cell ? '' : 'empty'}`}>
                  {cell && <div className="cal-daynum">{cell.getDate()}</div>}
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
          <WeekDayView cursor={cursor} view={view} items={dated} />
        )}
      </div>
    </div>
  )
}

function WeekDayView({
  cursor,
  view,
  items,
}: {
  cursor: Date
  view: 'week' | 'day'
  items: ContentDto[]
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
        return (
          <div key={key} className="cal-daycol panel-pad">
            <strong>{d.toLocaleDateString('fa-IR', { weekday: 'short', day: 'numeric' })}</strong>
            {dayItems.length === 0 && <p className="section-sub">خالی</p>}
            {dayItems.map((i) => (
              <div key={i.id} className="cal-pill">
                {i.publishTime ? `${i.publishTime} · ` : ''}
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
  return d.toISOString().slice(0, 10)
}

function addMonths(d: Date, n: number) {
  const x = new Date(d)
  x.setMonth(x.getMonth() + n)
  return x
}

function startOfWeek(d: Date) {
  const x = new Date(d)
  const day = (x.getDay() + 1) % 7 // Saturday-start-ish for FA feel
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
