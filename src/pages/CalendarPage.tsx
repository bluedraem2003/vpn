import { useEffect, useMemo, useState, type MouseEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, type ContentDto, type OccasionDto, type ProjectDto } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import {
  type ContentStatus,
  type ContentType,
} from '../domain/types'
import { toJalali } from '../lib/jalaali'
import { occasionLabel } from '../lib/occasionLabel'
import { occasionSpanDays } from '../lib/occasionSpan'
import { useI18n } from '../prefs/PrefsProvider'

type CalView = 'month' | 'week' | 'day' | 'list'

export function CalendarPage() {
  const { t, lang } = useI18n()
  const { workspaceId } = useAuth()
  const navigate = useNavigate()
  const [view, setView] = useState<CalView>('month')
  const [items, setItems] = useState<ContentDto[]>([])
  const [occasions, setOccasions] = useState<OccasionDto[]>([])
  const [projects, setProjects] = useState<ProjectDto[]>([])
  const [projectId, setProjectId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [cursor, setCursor] = useState(() => new Date())

  useEffect(() => {
    if (!workspaceId) return
    let cancelled = false
    ;(async () => {
      try {
        const year = cursor.getFullYear()
        const month = cursor.getMonth() + 1
        const [contentRes, occRes, projRes] = await Promise.all([
          api.listContent(workspaceId, projectId ? { projectId } : undefined),
          api.occasionsCalendar(workspaceId, { year, month, projectId: projectId || undefined }),
          api.listProjects(workspaceId),
        ])
        if (!cancelled) {
          setItems(contentRes.items || [])
          setOccasions(occRes.items || [])
          setProjects(projRes.items || [])
        }
      } catch (e) {
        if (!cancelled) setError((e as Error).message)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [workspaceId, cursor, projectId])

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
      for (const day of occasionSpanDays(o)) {
        const list = map.get(day) || []
        list.push(o)
        map.set(day, list)
      }
    }
    return map
  }, [occasions])

  const todayKey = formatDate(new Date())

  function openDay(date: string, occasionId?: string) {
    const qs = new URLSearchParams({ date })
    if (projectId) qs.set('projectId', projectId)
    if (occasionId) qs.set('occasionId', occasionId)
    navigate(`/content?${qs}`)
  }

  function openItem(id: string, e: MouseEvent) {
    e.stopPropagation()
    navigate(`/content?edit=${id}`)
  }

  function openOccasion(date: string, occasionId: string, e: MouseEvent) {
    e.stopPropagation()
    openDay(date, occasionId)
  }

  function shift(n: number) {
    if (view === 'week') setCursor(addDays(cursor, n * 7))
    else if (view === 'day') setCursor(addDays(cursor, n))
    else setCursor(addMonths(cursor, n))
  }

  return (
    <div className="ops-page">
      <header className="ops-page-head">
        <div>
          <p className="ops-kicker">{t('nav.calendar')}</p>
          <h1>{t('pages.calendarTitle')}</h1>
          <p>{t('pages.calendarSub')}</p>
        </div>
        <div className="chip-row">
          {(['month', 'week', 'day', 'list'] as CalView[]).map((v) => (
            <button
              key={v}
              type="button"
              className={`chip ${view === v ? 'active' : ''}`}
              onClick={() => setView(v)}
            >
              {t(`cal.${v}`)}
            </button>
          ))}
        </div>
      </header>

      {error && <div className="form-banner error">{error}</div>}
      {projects.length === 0 && (
        <div className="form-banner error">
          {t('dash.noPages')}{' '}
          <Link to="/projects">{t('dash.addPage')}</Link>
        </div>
      )}

      <div className="panel panel-pad">
        <div className="result-head" style={{ marginBottom: '1rem' }}>
          <h2 className="section-title" style={{ margin: 0 }}>
            {cursor.toLocaleDateString(lang === 'fa' ? 'fa-IR' : 'en-US', { month: 'long', year: 'numeric' })}
          </h2>
          <div className="form-actions">
            <select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
              <option value="">{t('cal.allPages')}</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => shift(-1)}>
              {t('cal.prev')}
            </button>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => setCursor(new Date())}>
              {t('cal.today')}
            </button>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => shift(1)}>
              {t('cal.next')}
            </button>
          </div>
        </div>

        {view === 'list' && (
          <ul className="ops-list">
            {dated.length === 0 && occasions.length === 0 && (
              <li className="section-sub">{t('cal.emptyRange')}</li>
            )}
            {dated.map((item) => (
              <li key={item.id}>
                <button type="button" className="btn btn-outline btn-sm" onClick={(e) => openItem(item.id, e)}>
                  {item.title}
                </button>
                <span>
                  {item.publishDate} {item.windowStart || item.publishTime || ''}
                  {item.windowEnd ? `–${item.windowEnd}` : ''} ·{' '}
                  {t(`type.${item.contentType as ContentType}`)} ·{' '}
                  {t(`status.${item.status as ContentStatus}`)}
                </span>
              </li>
            ))}
            {occasions.map((o) => (
              <li key={o.id}>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => o.dateInYear && openDay(o.dateInYear, o.id)}
                >
                  🎉 {occasionLabel(o, lang)}
                </button>
                <span>
                  {o.dateInYear}
                  {o.dateEndInYear ? ` – ${o.dateEndInYear}` : ''} ·{' '}
                  {t(`occ.${o.region === 'ir' ? 'ir' : o.region === 'custom' ? 'custom' : 'global'}`)}
                </span>
              </li>
            ))}
          </ul>
        )}

        {view === 'month' && (
          <div className="cal-scroll">
          <div className="cal-month">
            {(['dowSat', 'dowSun', 'dowMon', 'dowTue', 'dowWed', 'dowThu', 'dowFri'] as const).map((d) => (
              <div key={d} className="cal-dow">
                {t(`cal.${d}`)}
              </div>
            ))}
            {monthCells.map((cell, idx) => {
              const key = cell ? formatDate(cell) : `e-${idx}`
              const dayItems = cell ? dated.filter((i) => i.publishDate === key) : []
              const dayOcc = cell ? occByDate.get(key) || [] : []
              const j = cell ? toJalali(cell.getFullYear(), cell.getMonth() + 1, cell.getDate()) : null
              return (
                <button
                  key={key}
                  type="button"
                  className={`cal-cell ${cell ? 'interactive' : 'empty'} ${key === todayKey ? 'today' : ''}`}
                  disabled={!cell}
                  onClick={() => cell && openDay(key)}
                >
                  {cell && j && (
                    <div className="cal-daynum">
                      <span className="cal-daynum-fa">{j.jd}</span>
                      <span className="cal-daynum-g">{cell.getDate()}</span>
                    </div>
                  )}
                  {dayOcc.slice(0, 2).map((o) => (
                    <div
                      key={o.id}
                      className="cal-pill cal-pill-occasion"
                      title={o.nameEn || o.nameFa}
                      onClick={(e) => openOccasion(key, o.id, e)}
                    >
                      {occasionLabel(o, lang)}
                    </div>
                  ))}
                  {dayItems.slice(0, 3).map((i) => (
                    <div
                      key={i.id}
                      className="cal-pill"
                      title={i.title}
                      onClick={(e) => openItem(i.id, e)}
                    >
                      {i.title}
                    </div>
                  ))}
                  {dayItems.length > 3 && <div className="cal-more">{t('cal.more', { n: dayItems.length - 3 })}</div>}
                </button>
              )
            })}
          </div>
          </div>
        )}

        {(view === 'week' || view === 'day') && (
          <WeekDayView
            cursor={cursor}
            view={view}
            items={dated}
            occasions={occByDate}
            lang={lang}
            onDay={openDay}
            onItem={openItem}
          />
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
  lang,
  onDay,
  onItem,
}: {
  cursor: Date
  view: 'week' | 'day'
  items: ContentDto[]
  occasions: Map<string, OccasionDto[]>
  lang: 'fa' | 'en'
  onDay: (date: string, occasionId?: string) => void
  onItem: (id: string, e: MouseEvent) => void
}) {
  const { t } = useI18n()
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
          <button
            key={key}
            type="button"
            className="cal-daycol panel-pad interactive"
            onClick={() => onDay(key)}
          >
            <strong>{d.toLocaleDateString(lang === 'fa' ? 'fa-IR' : 'en-US', { weekday: 'short', day: 'numeric' })}</strong>
            {dayOcc.map((o) => (
              <div
                key={o.id}
                className="cal-pill cal-pill-occasion"
                onClick={(e) => {
                  e.stopPropagation()
                  onDay(key, o.id)
                }}
              >
                {occasionLabel(o, lang)}
              </div>
            ))}
            {dayItems.length === 0 && dayOcc.length === 0 && <p className="section-sub">{t('cal.emptyDay')}</p>}
            {dayItems.map((i) => (
              <div key={i.id} className="cal-pill" onClick={(e) => onItem(i.id, e)}>
                {i.windowStart || i.publishTime ? `${i.windowStart || i.publishTime} · ` : ''}
                {i.title}
              </div>
            ))}
          </button>
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

function addDays(d: Date, n: number) {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
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
