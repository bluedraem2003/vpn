import { useEffect, useMemo, useState } from 'react'
import {
  BadgeCheck,
  Clapperboard,
  ExternalLink,
  Eye,
  Heart,
  Images,
  MessageCircle,
  PlugZap,
  RefreshCw,
  Users,
} from 'lucide-react'
import {
  api,
  type AnalyticsConnector,
  type PageAnalyticsResponse,
  type PageInsights,
  type PagePostInsight,
  type ProjectDto,
} from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { InstagramPageSearch } from '../components/InstagramPageSearch'
import { normalizeHandle } from '../lib/handle'
import {
  CONTENT_STATUS_LABELS,
  CONTENT_TYPE_LABELS,
  PLATFORM_LABELS,
  type ContentStatus,
  type ContentType,
  type Platform,
} from '../domain/types'

const SAMPLE_HANDLE = 'rasta_mini.vogue'

type AnalyticsData = {
  summary: {
    totalContent: number
    published: number
    publishRate: number
    publishedLast30: number
    scheduledUpcoming: number
    overdue: number
    assets: number
    assetBytes: number
  }
  byStatus: Record<string, number>
  byType: Record<string, number>
  byPlatform: Record<string, number>
  assetByType: Record<string, number>
  statusFunnel30d: Record<string, number>
  recentPublished: Array<{
    id: string
    title: string
    contentType: string
    publishDate?: string
    platforms: string[]
  }>
  missingAssets: Array<{ id: string; title: string; status: string }>
  aiReadyHints: string[]
}

function faNum(n: number, digits = 0) {
  return new Intl.NumberFormat('fa-IR', {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(n)
}

function faDate(iso?: string) {
  if (!iso) return ''
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) return ''
  return d.toLocaleDateString('fa-IR')
}

const POST_TYPE: Record<PagePostInsight['type'], string> = {
  reel: 'ریلز',
  carousel: 'آلبوم',
  post: 'پست',
}

export function AnalyticsPage() {
  const { workspaceId } = useAuth()
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState(SAMPLE_HANDLE)
  const [handle, setHandle] = useState(SAMPLE_HANDLE)
  const [fresh, setFresh] = useState(false)
  const [requestId, setRequestId] = useState(0)
  const [pageBusy, setPageBusy] = useState(false)
  const [pageError, setPageError] = useState<string | null>(null)
  const [report, setReport] = useState<PageAnalyticsResponse | null>(null)
  const [pages, setPages] = useState<ProjectDto[]>([])

  useEffect(() => {
    if (!workspaceId) return
    api
      .analytics(workspaceId)
      .then((res) => setData(res as AnalyticsData))
      .catch((e) => setError((e as Error).message))
    api
      .listProjects(workspaceId)
      .then((res) => setPages(res.items || []))
      .catch(() => setPages([]))
  }, [workspaceId])

  useEffect(() => {
    if (!workspaceId || !handle) return
    let cancelled = false
    setPageBusy(true)
    setPageError(null)
    api
      .pageAnalytics(workspaceId, handle, fresh)
      .then((res) => {
        if (!cancelled) setReport(res)
      })
      .catch((e) => {
        if (!cancelled) {
          setReport(null)
          setPageError((e as Error).message)
        }
      })
      .finally(() => {
        if (!cancelled) setPageBusy(false)
      })
    return () => {
      cancelled = true
    }
  }, [workspaceId, handle, fresh, requestId])

  const savedHandles = useMemo(() => {
    const seen = new Set<string>()
    const out: Array<{ handle: string; name: string }> = []
    for (const p of pages) {
      const h = normalizeHandle(p.handle || p.clientName || '')
      if (!h) continue
      const key = h.toLowerCase()
      if (seen.has(key) || key === SAMPLE_HANDLE) continue
      seen.add(key)
      out.push({ handle: h, name: p.name || h })
    }
    return out
  }, [pages])

  function runAnalysis(next?: string, forceFresh = true) {
    const h = normalizeHandle(next || draft)
    if (!h) {
      setPageError('آیدی پیج را بنویس یا از لیست انتخاب کن')
      return
    }
    setDraft(h)
    setHandle(h)
    setFresh(forceFresh)
    setRequestId((n) => n + 1)
  }

  const page = report?.page
  const connectors = report?.connectors

  return (
    <div className="ops-page">
      <header className="ops-page-head">
        <div>
          <h1>آنالیتیکس پیج</h1>
          <p>تحلیل زنده از اینستاگرام داخل پست‌یار — بدون پسورد. برای Reach و Impressions، Supermetrics یا Meta را وصل کن.</p>
        </div>
        {page ? (
          <a
            className="btn btn-outline btn-sm"
            href={`https://www.instagram.com/${page.handle}/`}
            target="_blank"
            rel="noreferrer"
          >
            <ExternalLink size={14} />
            باز کردن پیج
          </a>
        ) : null}
      </header>

      <section className="panel panel-pad ig-insight-panel">
        <div className="ig-insight-toolbar">
          <InstagramPageSearch
            id="analytics-ig-search"
            value={draft}
            label="پیج اینستاگرام برای تحلیل"
            hint="آیدی را جستجو کن یا پیج ذخیره‌شده را انتخاب کن. رمز اینستاگرام لازم نیست و ذخیره نمی‌شود."
            placeholder="مثلاً rasta_mini.vogue"
            onChange={setDraft}
            onPick={(hit) => runAnalysis(hit.username, true)}
          />
          <button
            type="button"
            className="btn btn-solid"
            disabled={pageBusy}
            onClick={() => runAnalysis(draft, true)}
          >
            <RefreshCw size={16} className={pageBusy ? 'spin' : undefined} />
            {pageBusy ? 'در حال تحلیل...' : 'تحلیل بگیر'}
          </button>
        </div>

        <div className="ig-chip-row" role="list">
          <button
            type="button"
            className={`ig-chip ${handle.toLowerCase() === SAMPLE_HANDLE ? 'active' : ''}`}
            onClick={() => runAnalysis(SAMPLE_HANDLE, false)}
          >
            نمونه · @{SAMPLE_HANDLE}
          </button>
          {savedHandles.map((p) => (
            <button
              key={p.handle}
              type="button"
              className={`ig-chip ${handle.toLowerCase() === p.handle.toLowerCase() ? 'active' : ''}`}
              onClick={() => runAnalysis(p.handle, false)}
            >
              {p.name} · @{p.handle}
            </button>
          ))}
        </div>

        {pageError && <p className="field-hint warn">{pageError}</p>}
      </section>

      <ConnectorCards items={connectors} supermetrics={report?.supermetrics} meta={report?.meta} />

      {pageBusy && !page && (
        <section className="panel panel-pad">
          <p className="section-sub">در حال گرفتن آمار پیج از اینستاگرام...</p>
        </section>
      )}

      {page && <PageReport page={page} />}

      {report?.supermetrics?.ok && (report.supermetrics.rows?.length || 0) > 0 && (
        <SupermetricsTable rows={report.supermetrics.rows || []} fields={report.supermetrics.fields} />
      )}

      <WorkspaceAnalytics data={data} error={error} />
    </div>
  )
}

function ConnectorCards({
  items,
  supermetrics,
  meta,
}: {
  items?: AnalyticsConnector[]
  supermetrics?: PageAnalyticsResponse['supermetrics']
  meta?: PageAnalyticsResponse['meta']
}) {
  const fallback: AnalyticsConnector[] = items?.length
    ? items
    : [
        {
          id: 'instagram_public',
          name: 'اینستاگرام (پروفایل و پست‌های عمومی)',
          configured: true,
          hint: 'فالوور، لایک، کامنت، بازدید ریلز و نرخ تعامل از خود اینستاگرام',
        },
        {
          id: 'supermetrics',
          name: 'Supermetrics',
          configured: false,
          hint: 'یک ماه/۱۴ روز رایگان. در Hub اینستاگرام را با فیسبوک بیزنس وصل کن، بعد SUPERMETRICS_API_KEY را در سرور بگذار',
        },
        {
          id: 'meta',
          name: 'Meta Instagram Insights',
          configured: false,
          hint: 'برای Reach و مخاطب، پیج باید Business/Creator باشد و با Facebook Login وصل شود — نه با پسورد اینستاگرام',
        },
      ]

  const extra: Record<string, string | undefined> = {
    supermetrics: supermetrics?.ok ? 'داده Reach/Impressions دریافت شد' : supermetrics?.error,
    meta: meta?.ok ? 'داده Graph دریافت شد' : meta?.error,
  }

  return (
    <div className="connector-grid">
      {fallback.map((c) => (
        <article key={c.id} className={`panel panel-pad connector-card ${c.configured ? 'on' : ''}`}>
          <header>
            <PlugZap size={16} />
            <strong>{c.name}</strong>
            <span className={`connector-dot ${c.configured ? 'on' : ''}`}>
              {c.configured ? 'وصل' : 'آماده اتصال'}
            </span>
          </header>
          <p>{c.hint}</p>
          {c.id === 'supermetrics' && !c.configured && (
            <ol className="connector-steps">
              <li>
                در{' '}
                <a href="https://supermetrics.com" target="_blank" rel="noreferrer">
                  supermetrics.com
                </a>{' '}
                حساب آزمایشی بساز
              </li>
              <li>Instagram Insights را با Facebook Business وصل کن (نه با پسورد اینستاگرام)</li>
              <li>
                کلید API را در سرور بگذار: <code>SUPERMETRICS_API_KEY</code>
              </li>
            </ol>
          )}
          {extra[c.id] && c.id !== 'instagram_public' && <p className="field-hint">{extra[c.id]}</p>}
        </article>
      ))}
    </div>
  )
}

function PageReport({ page }: { page: PageInsights }) {
  const mixTotal = Math.max(1, page.mix.reel + page.mix.carousel + page.mix.post)
  return (
    <>
      <section className="panel panel-pad ig-profile-card">
        {page.avatarUrl ? (
          <img className="ig-profile-avatar" src={page.avatarUrl} alt="" referrerPolicy="no-referrer" />
        ) : (
          <span className="ig-profile-avatar letter">{page.name.slice(0, 1)}</span>
        )}
        <div className="ig-profile-meta">
          <h2>
            {page.name}
            {page.verified ? <BadgeCheck size={18} className="ig-verified" /> : null}
          </h2>
          <p dir="ltr">
            @{page.handle}
            {page.category ? ` · ${page.category}` : ''}
          </p>
          {page.biography ? <p className="ig-bio">{page.biography}</p> : null}
          <div className="ig-badges">
            {page.isProfessional ? <span>حرفه‌ای</span> : null}
            {page.isBusiness ? <span>بیزنس</span> : null}
            {page.isPrivate ? <span>خصوصی</span> : null}
            <span>منبع: اینستاگرام عمومی</span>
          </div>
        </div>
      </section>

      <div className="ops-stat-grid ig-insight-stats">
        {[
          ['دنبال‌کننده', faNum(page.followers), <Users size={16} key="u" />],
          ['دنبال‌شونده', faNum(page.following), <Users size={16} key="f" />],
          ['پست', faNum(page.posts), <Images size={16} key="p" />],
          ['نرخ تعامل', `${faNum(page.engagementRate, 2)}٪`, <Heart size={16} key="e" />],
          ['میانگین لایک', faNum(page.avgLikes), <Heart size={16} key="l" />],
          ['میانگین کامنت', faNum(page.avgComments), <MessageCircle size={16} key="c" />],
          ['میانگین بازدید ریلز', page.avgViews ? faNum(page.avgViews) : '—', <Eye size={16} key="v" />],
          [
            'فاصله انتشار',
            page.postCadenceDays != null ? `${faNum(page.postCadenceDays, 1)} روز` : '—',
            <Clapperboard size={16} key="d" />,
          ],
        ].map(([label, value, icon]) => (
          <div key={String(label)} className="panel panel-pad ops-stat">
            <span>
              {icon} {label}
            </span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>

      {page.hints.length > 0 && (
        <ul className="ig-hints">
          {page.hints.map((h) => (
            <li key={h}>{h}</li>
          ))}
        </ul>
      )}

      <div className="ops-split" style={{ marginTop: '0.25rem' }}>
        <section className="panel panel-pad">
          <h2 className="section-title">ترکیب محتوا (پست‌های اخیر)</h2>
          <BarList
            entries={[
              ['ریلز', page.mix.reel],
              ['آلبوم', page.mix.carousel],
              ['پست', page.mix.post],
            ]}
          />
          <p className="section-sub" style={{ marginTop: '0.6rem' }}>
            از {faNum(mixTotal)} پست اخیر
          </p>
        </section>
        <section className="panel panel-pad">
          <h2 className="section-title">بهترین پست</h2>
          {page.bestPost ? (
            <PostRow post={page.bestPost} />
          ) : (
            <p className="section-sub">پست عمومی برای مقایسه نیست</p>
          )}
        </section>
      </div>

      <section className="panel panel-pad" style={{ marginTop: '1rem' }}>
        <h2 className="section-title">پست‌های اخیر</h2>
        {page.recentPosts.length === 0 ? (
          <p className="section-sub">پست عمومی دیده نشد</p>
        ) : (
          <div className="ig-post-grid">
            {page.recentPosts.map((post) => (
              <PostCard key={post.shortcode || post.url} post={post} />
            ))}
          </div>
        )}
        <p className="section-sub" style={{ marginTop: '0.85rem' }}>
          به‌روز شده {faDate(page.fetchedAt)} — لایک و کامنت از پست‌های عمومی است؛ Reach و Impressions فقط با
          Supermetrics یا Meta می‌آید.
        </p>
      </section>
    </>
  )
}

function PostRow({ post }: { post: PagePostInsight }) {
  return (
    <a className="ig-post-row" href={post.url} target="_blank" rel="noreferrer">
      {post.thumbUrl ? (
        <img src={post.thumbUrl} alt="" referrerPolicy="no-referrer" />
      ) : (
        <span className="ig-thumb-fallback">{POST_TYPE[post.type]}</span>
      )}
      <span>
        <strong>
          {POST_TYPE[post.type]} · تعامل {faNum(post.engagement, 2)}٪
        </strong>
        <em>
          {faNum(post.likes)} لایک · {faNum(post.comments)} کامنت
          {post.views != null ? ` · ${faNum(post.views)} بازدید` : ''}
          {post.takenAt ? ` · ${faDate(post.takenAt)}` : ''}
        </em>
        {post.caption ? <em className="ig-caption">{post.caption}</em> : null}
      </span>
    </a>
  )
}

function PostCard({ post }: { post: PagePostInsight }) {
  return (
    <a className="ig-post-card" href={post.url} target="_blank" rel="noreferrer">
      {post.thumbUrl ? (
        <img src={post.thumbUrl} alt="" referrerPolicy="no-referrer" />
      ) : (
        <span className="ig-thumb-fallback">{POST_TYPE[post.type]}</span>
      )}
      <span className="ig-post-type">{POST_TYPE[post.type]}</span>
      <span className="ig-post-metrics">
        <Heart size={12} /> {faNum(post.likes)}
        <MessageCircle size={12} /> {faNum(post.comments)}
        {post.views != null ? (
          <>
            <Eye size={12} /> {faNum(post.views)}
          </>
        ) : null}
      </span>
    </a>
  )
}

function SupermetricsTable({ rows, fields }: { rows: unknown[]; fields?: string[] }) {
  const keys =
    fields && fields.length
      ? fields
      : rows[0] && typeof rows[0] === 'object'
        ? Object.keys(rows[0] as object)
        : []
  return (
    <section className="panel panel-pad" style={{ marginTop: '1rem' }}>
      <h2 className="section-title">Supermetrics · ۳۰ روز</h2>
      <div className="ig-table-wrap">
        <table className="ig-table">
          <thead>
            <tr>
              {keys.map((k) => (
                <th key={k}>{k}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 14).map((row, i) => {
              const rec = (row && typeof row === 'object' ? row : {}) as Record<string, unknown>
              return (
                <tr key={i}>
                  {keys.map((k) => (
                    <td key={k}>{String(rec[k] ?? '')}</td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function WorkspaceAnalytics({ data, error }: { data: AnalyticsData | null; error: string | null }) {
  if (error) {
    return (
      <section className="panel panel-pad" style={{ marginTop: '1.25rem' }}>
        <h2 className="section-title">آمار تولید در پست‌یار</h2>
        <p className="section-sub">{error}</p>
      </section>
    )
  }
  if (!data) {
    return (
      <section className="panel panel-pad" style={{ marginTop: '1.25rem' }}>
        <p className="section-sub">در حال محاسبه آمار ورک‌اسپیس...</p>
      </section>
    )
  }

  const { summary } = data
  return (
    <div style={{ marginTop: '1.5rem' }}>
      <header className="ops-page-head">
        <div>
          <h2 className="section-title" style={{ margin: 0 }}>
            آمار تولید در پست‌یار
          </h2>
          <p>عملکرد محتوا، انتشار و دارایی‌های همین ورک‌اسپیس</p>
        </div>
      </header>

      <div className="ops-stat-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        {[
          ['کل محتوا', summary.totalContent],
          ['نرخ انتشار', `${summary.publishRate}%`],
          ['منتشر ۳۰ روز', summary.publishedLast30],
          ['عقب‌افتاده', summary.overdue],
        ].map(([label, value]) => (
          <div key={String(label)} className="panel panel-pad ops-stat">
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>

      <div className="ops-stat-grid" style={{ marginTop: '0.75rem' }}>
        {[
          ['زمان‌بندی آینده', summary.scheduledUpcoming],
          ['تعداد فایل', summary.assets],
          ['حجم تقریبی', `${(summary.assetBytes / (1024 * 1024)).toFixed(1)} MB`],
          ['منتشر شده', summary.published],
        ].map(([label, value]) => (
          <div key={String(label)} className="panel panel-pad ops-stat">
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>

      <div className="ops-split" style={{ marginTop: '1rem' }}>
        <section className="panel panel-pad">
          <h2 className="section-title">وضعیت‌ها</h2>
          <BarList
            entries={Object.entries(data.byStatus).map(([k, v]) => [
              CONTENT_STATUS_LABELS[k as ContentStatus] || k,
              v,
            ])}
          />
        </section>
        <section className="panel panel-pad">
          <h2 className="section-title">انواع محتوا</h2>
          <BarList
            entries={Object.entries(data.byType).map(([k, v]) => [
              CONTENT_TYPE_LABELS[k as ContentType] || k,
              v,
            ])}
          />
        </section>
        <section className="panel panel-pad">
          <h2 className="section-title">پلتفرم‌ها</h2>
          <BarList
            entries={Object.entries(data.byPlatform).map(([k, v]) => [
              PLATFORM_LABELS[k as Platform] || k,
              v,
            ])}
          />
        </section>
        <section className="panel panel-pad">
          <h2 className="section-title">انواع فایل</h2>
          <BarList entries={Object.entries(data.assetByType)} />
        </section>
      </div>

      <div className="ops-split" style={{ marginTop: '1rem' }}>
        <section className="panel panel-pad">
          <h2 className="section-title">آخرین انتشارها</h2>
          <ul className="ops-list">
            {data.recentPublished.length === 0 && <li className="section-sub">موردی نیست</li>}
            {data.recentPublished.map((item) => (
              <li key={item.id}>
                <strong>{item.title}</strong>
                <span>
                  {CONTENT_TYPE_LABELS[item.contentType as ContentType] || item.contentType}
                  {item.publishDate ? ` · ${item.publishDate}` : ''}
                </span>
              </li>
            ))}
          </ul>
        </section>
        <section className="panel panel-pad">
          <h2 className="section-title">محتوای بدون Asset</h2>
          <ul className="ops-list">
            {data.missingAssets.length === 0 && <li className="section-sub">همه پوشش داده شده‌اند</li>}
            {data.missingAssets.map((item) => (
              <li key={item.id}>
                <strong>{item.title}</strong>
                <span>{CONTENT_STATUS_LABELS[item.status as ContentStatus] || item.status}</span>
              </li>
            ))}
          </ul>
          <p className="section-sub" style={{ marginTop: '0.85rem' }}>
            آماده AI: {data.aiReadyHints.join(' · ')}
          </p>
        </section>
      </div>
    </div>
  )
}

function BarList({ entries }: { entries: Array<[string, number] | string[]> }) {
  const max = Math.max(1, ...entries.map((e) => Number(e[1]) || 0))
  if (!entries.length) return <p className="section-sub">داده‌ای نیست</p>
  return (
    <div className="bar-list">
      {entries.map(([label, value]) => (
        <div key={String(label)} className="bar-row">
          <div className="bar-meta">
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
          <div className="bar-track">
            <div className="bar-fill" style={{ width: `${(Number(value) / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  )
}
