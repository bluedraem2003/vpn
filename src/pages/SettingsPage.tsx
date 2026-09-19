import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, type AnalyticsConnector } from '../api/client'
import { useAuth } from '../auth/AuthContext'

export function SettingsPage() {
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
          <h1>تنظیمات</h1>
          <p>نشست، جستجو و وضعیت اتصال‌ها</p>
        </div>
        <button type="button" className="btn btn-outline btn-sm" onClick={() => void logout()}>
          خروج
        </button>
      </header>

      <div className="ops-split">
        <section className="panel panel-pad">
          <h2 className="section-title">نشست فعلی</h2>
          <ul className="ops-list">
            <li>
              <strong>نام</strong>
              <span>{session?.user.name}</span>
            </li>
            <li>
              <strong>ایمیل</strong>
              <span>{session?.user.email}</span>
            </li>
            <li>
              <strong>نقش</strong>
              <span>{session?.role}</span>
            </li>
            <li>
              <strong>Workspace</strong>
              <span>{workspaceId}</span>
            </li>
          </ul>
        </section>

        <section className="panel panel-pad">
          <h2 className="section-title">تلگرام</h2>
          {tg ? (
            <ul className="ops-list">
              <li>
                <strong>Bot</strong>
                <span>{tg.configured ? 'فعال' : 'غیرفعال'}</span>
              </li>
              <li>
                <strong>Chat ID</strong>
                <span>{tg.chatIdConfigured ? 'تنظیم شده' : 'نیست'}</span>
              </li>
              <li>
                <strong>ایندکس</strong>
                <span>{String(tg.indexedFiles)}</span>
              </li>
            </ul>
          ) : (
            <p className="section-sub">در حال دریافت وضعیت...</p>
          )}
        </section>
      </div>

      <section className="panel panel-pad" style={{ marginTop: '1rem' }}>
        <h2 className="section-title">اتصال تحلیل پیج</h2>
        <p className="section-sub">
          آمار عمومی اینستاگرام بدون پسورد داخل{' '}
          <Link to="/analytics">آنالیتیکس</Link> می‌آید. Reach و Impressions با Supermetrics یا Meta.
        </p>
        <ul className="ops-list" style={{ marginTop: '0.75rem' }}>
          {(connectors.length
            ? connectors
            : [
                {
                  id: 'instagram_public' as const,
                  name: 'اینستاگرام عمومی',
                  configured: true,
                  hint: '',
                },
              ]
          ).map((c) => (
            <li key={c.id}>
              <strong>{c.name}</strong>
              <span>{c.configured ? 'وصل' : 'آماده اتصال'}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="panel panel-pad" style={{ marginTop: '1rem' }}>
        <h2 className="section-title">جستجوی سراسری</h2>
        <div className="ops-filters" style={{ gridTemplateColumns: '1fr auto' }}>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="عنوان محتوا، کپشن، نام فایل، پروژه..."
          />
          <button type="button" className="btn btn-solid btn-sm" onClick={() => void runSearch()}>
            جستجو
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
