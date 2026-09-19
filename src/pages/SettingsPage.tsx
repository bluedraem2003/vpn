import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, type AnalyticsConnector } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { AppearanceControls } from '../components/AppearanceControls'
import { useI18n } from '../prefs/PrefsProvider'

export function SettingsPage() {
  const { t } = useI18n()
  const { session, logout, workspaceId } = useAuth()
  const [q, setQ] = useState('')
  const [results, setResults] = useState<Record<string, unknown[]> | null>(null)
  const [tg, setTg] = useState<Record<string, unknown> | null>(null)
  const [connectors, setConnectors] = useState<AnalyticsConnector[]>([])

  useEffect(() => {
    api.telegramStatus().then((s) => setTg(s as unknown as Record<string, unknown>)).catch(() => null)
    api.analyticsConnectors().then((res) => setConnectors(res.items || [])).catch(() => setConnectors([]))
  }, [])

  async function runSearch() {
    if (!workspaceId || !q.trim()) return
    setResults(await api.search(workspaceId, q.trim()))
  }

  return (
    <div className="ops-page">
      <header className="ops-page-head">
        <div>
          <h1>{t('pages.settingsTitle')}</h1>
          <p>{t('pages.settingsSub')}</p>
        </div>
        <button type="button" className="btn btn-outline btn-sm" onClick={() => void logout()}>
          {t('common.logout')}
        </button>
      </header>

      <section className="panel panel-pad" style={{ marginBottom: '1rem' }}>
        <h2 className="section-title">{t('settings.appearance')}</h2>
        <p className="section-sub">{t('settings.appearanceHint')}</p>
        <AppearanceControls />
      </section>

      <div className="ops-split">
        <section className="panel panel-pad">
          <h2 className="section-title">{t('settings.session')}</h2>
          <ul className="ops-list">
            <li>
              <strong>{t('settings.name')}</strong>
              <span>{session?.user.name}</span>
            </li>
            <li>
              <strong>{t('settings.email')}</strong>
              <span>{session?.user.email}</span>
            </li>
            <li>
              <strong>{t('settings.role')}</strong>
              <span>{session?.role}</span>
            </li>
            <li>
              <strong>{t('settings.workspace')}</strong>
              <span>{workspaceId}</span>
            </li>
          </ul>
        </section>

        <section className="panel panel-pad">
          <h2 className="section-title">{t('settings.telegram')}</h2>
          {tg ? (
            <ul className="ops-list">
              <li>
                <strong>{t('settings.bot')}</strong>
                <span>{tg.configured ? t('settings.on') : t('settings.off')}</span>
              </li>
              <li>
                <strong>{t('settings.chatId')}</strong>
                <span>{tg.chatIdConfigured ? t('settings.set') : t('settings.unset')}</span>
              </li>
              <li>
                <strong>{t('settings.index')}</strong>
                <span>{String(tg.indexedFiles)}</span>
              </li>
            </ul>
          ) : (
            <p className="section-sub">{t('settings.tgLoading')}</p>
          )}
        </section>
      </div>

      <section className="panel panel-pad" style={{ marginTop: '1rem' }}>
        <h2 className="section-title">{t('settings.connectors')}</h2>
        <p className="section-sub">
          {t('settings.connectorsHint')}{' '}
          <Link to="/analytics">{t('nav.analytics')}</Link>
        </p>
        <ul className="ops-list" style={{ marginTop: '0.75rem' }}>
          {(connectors.length
            ? connectors
            : [
                {
                  id: 'instagram_public' as const,
                  name: t('connectors.instagram_public.name'),
                  configured: true,
                  hint: '',
                },
              ]
          ).map((c) => (
            <li key={c.id}>
              <strong>{t(`connectors.${c.id}.name`)}</strong>
              <span>{c.configured ? t('common.connected') : t('common.ready')}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="panel panel-pad" style={{ marginTop: '1rem' }}>
        <h2 className="section-title">{t('settings.searchTitle')}</h2>
        <div className="ops-filters" style={{ gridTemplateColumns: '1fr auto' }}>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('settings.searchPh')}
          />
          <button type="button" className="btn btn-solid btn-sm" onClick={() => void runSearch()}>
            {t('common.search')}
          </button>
        </div>
        {results && (
          <div className="ops-split" style={{ marginTop: '1rem' }}>
            {Object.entries(results).map(([key, list]) => (
              <div key={key}>
                <h3 className="section-title" style={{ fontSize: '1rem' }}>
                  {key} ({list.length})
                </h3>
                <ul className="ops-list">
                  {list.slice(0, 5).map((item, idx) => {
                    const row = item as Record<string, unknown>
                    return (
                      <li key={String(row.id || idx)}>
                        <strong>{String(row.title || row.name || row.filename || row.id)}</strong>
                        <span>{String(row.status || row.type || row.priority || '')}</span>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
