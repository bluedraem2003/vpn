import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { CONTENT_STATUS_LABELS, type ContentStatus } from '../domain/types'
import { formatJalaliDate, formatJalaliFromIso } from '../lib/jalaali'

export function DashboardPage() {
  const { workspaceId } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<Record<string, unknown> | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  async function reload() {
    if (!workspaceId) return
    const dash = await api.dashboard(workspaceId)
    setData(dash)
  }

  useEffect(() => {
    if (!workspaceId) return
    let cancelled = false
    ;(async () => {
      try {
        const dash = await api.dashboard(workspaceId)
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
  }, [workspaceId])

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
  const upcomingOccasions = (data?.upcomingOccasions || []) as Array<Record<string, unknown>>
  const pageCount = Number(data?.pageCount || 0)
  const scheduledCount = Number(data?.scheduledCount || 0)

  async function markPublished(id: string) {
    setActionError(null)
    try {
      await api.updateContent(id, { status: 'published' })
      await reload()
    } catch (e) {
      setActionError((e as Error).message)
    }
  }

  return (
    <div className="ops-page">
      <header className="ops-page-head">
        <div>
          <h1>داشبورد</h1>
          <p>امروز {formatJalaliDate(new Date())} — وضعیت پیج‌ها و انتشار</p>
        </div>
        <div className="form-actions">
          <Link to="/projects" className="btn btn-outline btn-sm">
            پیج جدید
          </Link>
          <Link to="/studio" className="btn btn-outline btn-sm">
            استودیو
          </Link>
          <Link to="/content" className="btn btn-solid btn-sm">
            محتوای جدید
          </Link>
        </div>
      </header>

      {actionError && <div className="form-banner error">{actionError}</div>}
      {pageCount === 0 && (
        <div className="form-banner error">
          هنوز پیجی ثبت نشده.{' '}
          <Link to="/projects">پیج اینستاگرام را اضافه کن</Link>
        </div>
      )}

      <div className="ops-stat-grid">
        {[
          ['پیج‌ها', pageCount],
          ['زمان‌بندی‌شده', scheduledCount],
          ['در تولید', progress.inProduction],
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
          <ItemList
            items={today}
            empty="محتوایی برای امروز نیست"
            onPublished={markPublished}
          />
        </section>
        <section className="panel panel-pad">
          <h2 className="section-title">پیش‌رو</h2>
          <ItemList items={upcoming} empty="مورد آینده‌ای نیست" onPublished={markPublished} />
        </section>
        <section className="panel panel-pad">
          <h2 className="section-title">عقب‌افتاده</h2>
          <ItemList items={overdue} empty="عقب‌افتاده‌ای نیست" onPublished={markPublished} />
        </section>
        <section className="panel panel-pad">
          <h2 className="section-title">مناسبت‌های نزدیک</h2>
          {upcomingOccasions.length === 0 ? (
            <p className="section-sub">موردی نیست — از صفحه مناسبت‌ها وصل کن</p>
          ) : (
            <ul className="ops-list">
              {upcomingOccasions.map((o) => (
                <li key={String(o.id)}>
                  <Link to={`/content?date=${String(o.dateInYear)}&occasionId=${String(o.id)}`}>
                    <strong>{String(o.nameFa)}</strong>
                  </Link>
                  <span>
                    {String(o.dateInYear)}
                    {o.dateInYear ? ` · ${formatJalaliFromIso(String(o.dateInYear))}` : ''}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <Link to="/occasions" className="btn btn-outline btn-sm" style={{ marginTop: '0.65rem' }}>
            مدیریت مناسبت‌ها
          </Link>
        </section>
      </div>

      <section className="panel panel-pad" style={{ marginTop: '1rem' }}>
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
  onPublished,
}: {
  items: Array<Record<string, unknown>>
  empty: string
  onPublished?: (id: string) => void
}) {
  if (!items.length) return <p className="section-sub">{empty}</p>
  return (
    <ul className="ops-list">
      {items.map((item) => (
        <li key={String(item.id)}>
          <Link to={`/content?edit=${String(item.id)}`}>
            <strong>{String(item.title)}</strong>
          </Link>
          <span>
            {CONTENT_STATUS_LABELS[item.status as ContentStatus] || String(item.status)}
            {item.publish_date
              ? ` · ${String(item.publish_date)} (${formatJalaliFromIso(String(item.publish_date))})`
              : ''}
            {item.publish_time ? ` · ${String(item.publish_time)}` : ''}
          </span>
          {onPublished && item.status !== 'published' && (
            <button type="button" className="btn btn-outline btn-sm" onClick={() => onPublished(String(item.id))}>
              منتشر شد
            </button>
          )}
        </li>
      ))}
    </ul>
  )
}
