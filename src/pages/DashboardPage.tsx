import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import { CONTENT_STATUS_LABELS, type ContentStatus } from '../domain/types'

export function DashboardPage() {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [workspaceId, setWorkspaceId] = useState<string | null>(null)
  const [data, setData] = useState<Record<string, unknown> | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const ws = await api.workspaces()
        const id = ws.items[0]?.id
        if (!id) throw new Error('ورک‌اسپیس پیدا نشد — API را اجرا کنید')
        if (cancelled) return
        setWorkspaceId(id)
        const dash = await api.dashboard(id)
        if (!cancelled) setData(dash)
      } catch (e) {
        if (!cancelled) setError((e as Error).message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  if (loading) {
    return (
      <div className="panel panel-pad">
        <p className="section-sub">در حال بارگذاری داشبورد...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="panel panel-pad">
        <h2 className="section-title">داشبورد</h2>
        <p className="section-sub">{error}</p>
        <p className="section-sub">برای API: <code>npm run dev:api</code></p>
        <Link className="btn btn-solid btn-sm" to="/studio">
          فعلاً برو به استودیو
        </Link>
      </div>
    )
  }

  const byStatus = (data?.byStatus || {}) as Record<string, number>
  const progress = (data?.progress || {}) as Record<string, number>
  const today = (data?.today || []) as Array<Record<string, unknown>>
  const upcoming = (data?.upcoming || []) as Array<Record<string, unknown>>
  const overdue = (data?.overdue || []) as Array<Record<string, unknown>>
  const recentAssets = (data?.recentAssets || []) as Array<Record<string, unknown>>

  return (
    <div className="ops-page">
      <header className="ops-page-head">
        <div>
          <h1>داشبورد</h1>
          <p>وضعیت تولید محتوا و دارایی‌ها {workspaceId ? `· ${workspaceId.slice(0, 12)}…` : ''}</p>
        </div>
        <Link to="/content" className="btn btn-solid btn-sm">
          محتوای جدید
        </Link>
      </header>

      <div className="ops-stat-grid">
        {[
          ['در تولید', progress.inProduction],
          ['بازبینی', progress.inReview],
          ['آماده انتشار', progress.ready],
          ['منتشر شده', progress.published],
        ].map(([label, value]) => (
          <div key={String(label)} className="panel panel-pad ops-stat">
            <span>{label}</span>
            <strong>{value ?? 0}</strong>
          </div>
        ))}
      </div>

      <div className="ops-split">
        <section className="panel panel-pad">
          <h2 className="section-title">امروز</h2>
          <ItemList items={today} empty="محتوایی برای امروز نیست" />
        </section>
        <section className="panel panel-pad">
          <h2 className="section-title">پیش‌رو</h2>
          <ItemList items={upcoming} empty="مورد آینده‌ای نیست" />
        </section>
        <section className="panel panel-pad">
          <h2 className="section-title">عقب‌افتاده</h2>
          <ItemList items={overdue} empty="عقب‌افتاده‌ای نیست" />
        </section>
        <section className="panel panel-pad">
          <h2 className="section-title">آخرین فایل‌ها</h2>
          {recentAssets.length === 0 ? (
            <p className="section-sub">هنوز فایلی ایندکس نشده</p>
          ) : (
            <ul className="ops-list">
              {recentAssets.map((a) => (
                <li key={String(a.id)}>
                  <strong>{String(a.filename)}</strong>
                  <span>{String(a.type)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="panel panel-pad" style={{ marginTop: '1rem' }}>
        <h2 className="section-title">پیشرفت وضعیت‌ها</h2>
        <div className="chip-row">
          {Object.entries(byStatus).map(([status, count]) => (
            <span className="tag" key={status}>
              {CONTENT_STATUS_LABELS[status as ContentStatus] || status}: {count}
            </span>
          ))}
          {Object.keys(byStatus).length === 0 && <p className="section-sub">هنوز محتوایی ثبت نشده</p>}
        </div>
      </section>
    </div>
  )
}

function ItemList({
  items,
  empty,
}: {
  items: Array<Record<string, unknown>>
  empty: string
}) {
  if (!items.length) return <p className="section-sub">{empty}</p>
  return (
    <ul className="ops-list">
      {items.map((item) => (
        <li key={String(item.id)}>
          <strong>{String(item.title)}</strong>
          <span>
            {CONTENT_STATUS_LABELS[item.status as ContentStatus] || String(item.status)}
            {item.publish_date ? ` · ${String(item.publish_date)}` : ''}
          </span>
        </li>
      ))}
    </ul>
  )
}
