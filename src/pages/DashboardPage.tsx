import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { type ContentStatus } from '../domain/types'
import { formatJalaliDate, formatJalaliFromIso } from '../lib/jalaali'
import { useI18n } from '../prefs/PrefsProvider'

export function DashboardPage() {
  const { workspaceId } = useAuth()
  const { t, lang, d } = useI18n()
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
        <p className="section-sub">{t('common.dashLoading')}</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="panel panel-pad">
        <h2 className="section-title">{t('common.dashError')}</h2>
        <p className="section-sub">{error}</p>
        <Link className="btn btn-solid btn-sm" to="/studio">
          {t('common.goStudio')}
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
          <h1>{t('pages.dashboardTitle')}</h1>
          <p>
            {t('pages.dashboardToday', {
              date: lang === 'fa' ? formatJalaliDate(new Date()) : d(new Date().toISOString()),
            })}
          </p>
        </div>
        <div className="form-actions">
          <Link to="/projects" className="btn btn-outline btn-sm">
            {t('common.newPage')}
          </Link>
          <Link to="/studio" className="btn btn-outline btn-sm">
            {t('common.studio')}
          </Link>
          <Link to="/content" className="btn btn-solid btn-sm">
            {t('common.newContent')}
          </Link>
        </div>
      </header>

      {actionError && <div className="form-banner error">{actionError}</div>}
      {pageCount === 0 && (
        <div className="form-banner error">
          {t('dash.noPages')}{' '}
          <Link to="/projects">{t('dash.addPage')}</Link>
        </div>
      )}

      <div className="ops-stat-grid">
        {[
          [t('dash.pages'), pageCount],
          [t('dash.scheduled'), scheduledCount],
          [t('dash.inProduction'), progress.inProduction],
          [t('dash.published'), progress.published],
        ].map(([label, value]) => (
          <div key={String(label)} className="panel panel-pad ops-stat">
            <span>{label}</span>
            <strong>{value ?? 0}</strong>
          </div>
        ))}
      </div>

      <div className="ops-split">
        <section className="panel panel-pad">
          <h2 className="section-title">{t('dash.today')}</h2>
          <ItemList items={today} empty={t('dash.noToday')} onPublished={markPublished} />
        </section>
        <section className="panel panel-pad">
          <h2 className="section-title">{t('dash.upcoming')}</h2>
          <ItemList items={upcoming} empty={t('dash.noUpcoming')} onPublished={markPublished} />
        </section>
        <section className="panel panel-pad">
          <h2 className="section-title">{t('dash.overdue')}</h2>
          <ItemList items={overdue} empty={t('dash.noOverdue')} onPublished={markPublished} />
        </section>
        <section className="panel panel-pad">
          <h2 className="section-title">{t('dash.occasions')}</h2>
          {upcomingOccasions.length === 0 ? (
            <p className="section-sub">{t('dash.noOccasions')}</p>
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
            {t('dash.manageOccasions')}
          </Link>
        </section>
      </div>

      <section className="panel panel-pad" style={{ marginTop: '1rem' }}>
        <h2 className="section-title">{t('dash.recentFiles')}</h2>
        {recentAssets.length === 0 ? (
          <p className="section-sub">{t('dash.noFiles')}</p>
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
        <h2 className="section-title">{t('dash.statusProgress')}</h2>
        <div className="chip-row">
          {Object.entries(byStatus).map(([status, count]) => (
            <span className="tag" key={status}>
              {t(`status.${status as ContentStatus}`)}: {count}
            </span>
          ))}
          {Object.keys(byStatus).length === 0 && <p className="section-sub">{t('dash.noContent')}</p>}
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
  const { t, lang } = useI18n()
  if (!items.length) return <p className="section-sub">{empty}</p>
  return (
    <ul className="ops-list">
      {items.map((item) => (
        <li key={String(item.id)}>
          <Link to={`/content?edit=${String(item.id)}`}>
            <strong>{String(item.title)}</strong>
          </Link>
          <span>
            {t(`status.${item.status as ContentStatus}`)}
            {item.publish_date
              ? lang === 'fa'
                ? ` · ${String(item.publish_date)} (${formatJalaliFromIso(String(item.publish_date))})`
                : ` · ${String(item.publish_date)}`
              : ''}
            {item.publish_time ? ` · ${String(item.publish_time)}` : ''}
          </span>
          {onPublished && item.status !== 'published' && (
            <button type="button" className="btn btn-outline btn-sm" onClick={() => onPublished(String(item.id))}>
              {t('dash.markPublished')}
            </button>
          )}
        </li>
      ))}
    </ul>
  )
}
