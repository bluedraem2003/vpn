import { useState } from 'react'
import { Link } from 'react-router-dom'
import { BarChart3, RefreshCw, Radio } from 'lucide-react'
import { api, type ProjectDto, type ProjectSyncSummary } from '../api/client'
import { useI18n } from '../prefs/PrefsProvider'

export function SyncStatusChip({ project }: { project: ProjectDto }) {
  const { t } = useI18n()
  const status = project.igSyncStatus
  if (!project.handle) return null
  const label =
    status === 'live'
      ? t('pagesLive.statusLive')
      : status === 'cooldown'
        ? t('pagesLive.statusCooldown')
        : status === 'error'
          ? project.igSyncError === 'not_found'
            ? t('pagesLive.statusNotFound')
            : t('pagesLive.statusError')
          : t('pagesLive.statusPending')
  return (
    <span className={`sync-chip sync-${status || 'pending'}`} title={project.igSyncError || undefined}>
      <Radio size={12} aria-hidden />
      {label}
    </span>
  )
}

export function relativeTime(iso: string | null | undefined, lang: 'fa' | 'en') {
  if (!iso) return ''
  const diff = Date.now() - Date.parse(iso)
  if (!Number.isFinite(diff)) return ''
  const rtf = new Intl.RelativeTimeFormat(lang === 'fa' ? 'fa-IR' : 'en-US', { numeric: 'auto' })
  const min = Math.round(diff / 60_000)
  if (Math.abs(min) < 60) return rtf.format(-min, 'minute')
  const hours = Math.round(min / 60)
  if (Math.abs(hours) < 48) return rtf.format(-hours, 'hour')
  return rtf.format(-Math.round(hours / 24), 'day')
}

export function ConnectedPageCard({
  project,
  onChange,
  compact = false,
}: {
  project: ProjectDto
  onChange?: (next: ProjectDto, sync: ProjectSyncSummary | null) => void
  compact?: boolean
}) {
  const { t, n, lang } = useI18n()
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const live = project.live
  const handle = project.handle || ''

  async function sync() {
    setBusy(true)
    setMsg(null)
    try {
      const res = await api.syncProject(project.id)
      onChange?.(res.item, res.sync)
      if (res.sync?.ok) {
        setMsg(res.sync.cached ? t('pagesLive.syncCached') : t('pagesLive.syncDone', { n: res.sync.events.length }))
      }
    } catch (e) {
      const err = e as Error & { code?: string }
      setMsg(
        err.code === 'ig_busy'
          ? t('pagesLive.syncBusy')
          : err.code === 'not_found'
            ? t('pagesLive.statusNotFound')
            : err.code === 'busy'
              ? t('analytics.errBusy')
              : err.message,
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <article className={`panel panel-pad connected-card ${compact ? 'compact' : ''}`}>
      <header className="connected-head">
        <div className="connected-id">
          <strong>{live?.name || project.name}</strong>
          {handle ? <span dir="ltr">@{handle}</span> : <span>{t('pagesLive.noHandle')}</span>}
        </div>
        <SyncStatusChip project={project} />
      </header>
      {live ? (
        <dl className="connected-stats">
          <div>
            <dt>{t('analytics.followers')}</dt>
            <dd>{n(live.followers)}</dd>
          </div>
          <div>
            <dt>{t('analytics.posts')}</dt>
            <dd>{n(live.posts)}</dd>
          </div>
          <div>
            <dt>{t('analytics.engagement')}</dt>
            <dd>{t('analytics.pct', { n: n(live.engagementRate, 2) })}</dd>
          </div>
          {!compact && (
            <div>
              <dt>{t('analytics.lastPost')}</dt>
              <dd>{live.lastPostAt ? relativeTime(live.lastPostAt, lang) : '—'}</dd>
            </div>
          )}
        </dl>
      ) : (
        <p className="section-sub connected-empty">
          {project.igSyncStatus === 'cooldown'
            ? t('pagesLive.liveCooldownHint')
            : project.igSyncStatus === 'error'
              ? project.igSyncError === 'not_found'
                ? t('pagesLive.liveNotFoundHint')
                : t('pagesLive.liveErrorHint')
              : t('pagesLive.livePendingHint')}
        </p>
      )}
      <footer className="connected-foot">
        <span className="section-sub">
          {project.igLastSyncedAt
            ? t('pagesLive.syncedAgo', { when: relativeTime(project.igLastSyncedAt, lang) })
            : t('pagesLive.neverSynced')}
        </span>
        <div className="form-actions" style={{ margin: 0 }}>
          {handle && (
            <button type="button" className="btn btn-outline btn-sm" disabled={busy} onClick={() => void sync()}>
              <RefreshCw size={13} className={busy ? 'spin' : undefined} aria-hidden />
              {busy ? t('pagesLive.syncing') : t('pagesLive.syncNow')}
            </button>
          )}
          {handle && (
            <Link className="btn btn-outline btn-sm" to={`/analytics?handle=${encodeURIComponent(handle)}`}>
              <BarChart3 size={13} aria-hidden />
              {t('nav.analytics')}
            </Link>
          )}
        </div>
      </footer>
      {msg && (
        <p className="section-sub" role="status">
          {msg}
        </p>
      )}
    </article>
  )
}
