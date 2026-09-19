import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  BadgeCheck,
  Clapperboard,
  Clock,
  Eye,
  Globe,
  Hash,
  Heart,
  Images,
  Link2,
  Mail,
  MapPin,
  MessageCircle,
  Music,
  Phone,
  PlugZap,
  RefreshCw,
  Send,
  TrendingUp,
  Users,
  X,
} from 'lucide-react'
import {
  api,
  type AnalyticsConnector,
  type CountStat,
  type PageAnalyticsResponse,
  type PageEnrichment,
  type PageGrowth,
  type PageInsights,
  type PagePostInsight,
  type ProjectDto,
  type RelatedProfile,
  type TypeStats,
} from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { InstagramPageSearch } from '../components/InstagramPageSearch'
import { normalizeHandle } from '../lib/handle'
import { useI18n } from '../prefs/PrefsProvider'
import type { ContentStatus, ContentType, Platform } from '../domain/types'

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

function postTypeLabel(type: PagePostInsight['type'], t: (key: string) => string) {
  if (type === 'reel') return t('analytics.reel')
  if (type === 'carousel') return t('analytics.carousel')
  return t('analytics.post')
}

export function AnalyticsPage() {
  const { workspaceId } = useAuth()
  const { t } = useI18n()
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [handle, setHandle] = useState('')
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
      .then((res) => {
        const items = res.items || []
        setPages(items)
        setDraft((current) => {
          if (current) return current
          for (const p of items) {
            const h = normalizeHandle(p.handle || p.clientName || '')
            if (h && h.toLowerCase() !== SAMPLE_HANDLE) return h
          }
          return current
        })
      })
      .catch(() => setPages([]))
  }, [workspaceId])

  useEffect(() => {
    if (!workspaceId || !handle) return
    let cancelled = false
    setPageBusy(true)
    setPageError(null)
    setReport((prev) => (prev && prev.page.handle.toLowerCase() === handle.toLowerCase() ? prev : null))
    api
      .pageAnalytics(workspaceId, handle, fresh)
      .then((res) => {
        if (!cancelled) setReport(res)
      })
      .catch((e) => {
        if (!cancelled) {
          setReport((prev) => {
            if (prev && prev.page.handle.toLowerCase() === handle.toLowerCase()) return prev
            return null
          })
          const code = (e as { code?: string }).code
          const mapped =
            code === 'busy'
              ? t('analytics.errBusy')
              : code === 'ig_busy'
                ? t('analytics.errIgBusy')
                : code === 'ig_unavailable'
                  ? t('analytics.errUnavailable')
                  : code === 'not_found'
                    ? t('analytics.errNotFound')
                    : code === 'need_handle'
                      ? t('analytics.needHandle')
                      : (e as Error).message
          setPageError(mapped)
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
      setPageError(t('analytics.needHandle'))
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
          <p className="ops-kicker">{t('nav.analytics')}</p>
          <h1>{t('analytics.title')}</h1>
          <p>{t('analytics.sub')}</p>
        </div>
      </header>

      <section className="panel panel-pad ig-insight-panel">
        <div className="ig-insight-toolbar">
          <InstagramPageSearch
            id="analytics-ig-search"
            value={draft}
            label={t('analytics.searchLabel')}
            hint={t('analytics.searchHint')}
            placeholder={t('analytics.searchPh')}
            allowRemoteSearch={false}
            onChange={setDraft}
            onPick={(hit) => runAnalysis(hit.username, false)}
          />
          <div className="ig-insight-actions">
            <button
              type="button"
              className="btn btn-solid"
              disabled={pageBusy}
              onClick={() => runAnalysis(draft, true)}
            >
              <RefreshCw size={16} className={pageBusy ? 'spin' : undefined} aria-hidden />
              {pageBusy ? t('analytics.analyzing') : t('analytics.analyze')}
            </button>
          </div>
        </div>

        <div className="ig-chip-row" role="list">
          <button
            type="button"
            className={`ig-chip ${handle.toLowerCase() === SAMPLE_HANDLE ? 'active' : ''}`}
            onClick={() => runAnalysis(SAMPLE_HANDLE, false)}
          >
            {t('analytics.sample')} · @{SAMPLE_HANDLE}
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

        <div className="ig-insight-status">
          {pageError && (
            <div className="form-banner error" role="alert">
              {pageError}
            </div>
          )}
          {!pageError && report?.cached && (
            <div className="form-banner ok ig-cache-banner" role="status">
              {report.staleReason === 'rate_limit' ? t('analytics.cachedRateLimit') : t('analytics.cachedStale')}
            </div>
          )}
          {!handle && !pageBusy && !pageError && (
            <div className="empty quiet">
              <strong>{t('analytics.idleTitle')}</strong>
              {t('analytics.idleHint')}
            </div>
          )}
        </div>
      </section>

      <ConnectorCards items={connectors} supermetrics={report?.supermetrics} meta={report?.meta} />

      {pageBusy && !page && (
        <section className="panel panel-pad empty" aria-live="polite">
          <span className="empty-spinner" aria-hidden />
          <strong>{t('analytics.loadingTitle')}</strong>
          {t('analytics.fetching')}
        </section>
      )}

      {page && (
        <PageReport
          page={page}
          growth={report?.growth}
          enrichment={report?.enrichment}
          onOpenRelated={(username) => runAnalysis(username, false)}
        />
      )}

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
  const { t } = useI18n()
  const ids: AnalyticsConnector['id'][] = ['instagram_public', 'website', 'ads_library', 'supermetrics', 'meta']
  const byId = new Map((items || []).map((c) => [c.id, c]))
  const extra: Record<string, string | undefined> = {
    supermetrics: supermetrics?.ok
      ? t('analytics.smOk')
      : !supermetrics?.error || supermetrics.error === 'not_configured'
        ? t('analytics.smUnset')
        : supermetrics.error,
    meta: meta?.ok
      ? t('analytics.metaOk')
      : !meta?.error || meta.error === 'not_configured'
        ? t('analytics.metaUnset')
        : meta.error,
  }

  return (
    <div className="connector-grid">
      {ids.map((id) => {
        const c = byId.get(id)
        const configured = c?.configured ?? (id === 'instagram_public' || id === 'ads_library')
        const hintKey =
          id === 'website'
            ? configured
              ? 'connectors.website.hintOn'
              : 'connectors.website.hintOff'
            : id === 'supermetrics'
              ? configured
                ? 'connectors.supermetrics.hintOn'
                : 'connectors.supermetrics.hintOff'
              : id === 'meta'
                ? configured
                  ? 'connectors.meta.hintOn'
                  : 'connectors.meta.hintOff'
                : `connectors.${id}.hint`
        return (
          <article key={id} className={`panel panel-pad connector-card ${configured ? 'on' : ''}`}>
            <header>
              <PlugZap size={16} />
              <strong>{t(`connectors.${id}.name`)}</strong>
              <span className={`connector-dot ${configured ? 'on' : ''}`}>
                {configured ? t('common.connected') : t('common.ready')}
              </span>
            </header>
            <p>{t(hintKey)}</p>
            {id === 'supermetrics' && !configured && (
              <ol className="connector-steps">
                <li>
                  {t('analytics.smStep1')}{' '}
                  <a href="https://supermetrics.com" target="_blank" rel="noreferrer">
                    supermetrics.com
                  </a>
                </li>
                <li>{t('analytics.smStep2')}</li>
                <li>
                  {t('analytics.smStep3')} (<code>SUPERMETRICS_API_KEY</code>)
                </li>
              </ol>
            )}
            {id === 'ads_library' && <p className="field-hint">{t('analytics.adsHint')}</p>}
            {extra[id] && id !== 'instagram_public' && <p className="field-hint">{extra[id]}</p>}
          </article>
        )
      })}
    </div>
  )
}

function PageReport({
  page,
  growth,
  enrichment,
  onOpenRelated,
}: {
  page: PageInsights
  growth?: PageGrowth
  enrichment?: PageEnrichment
  onOpenRelated: (username: string) => void
}) {
  const { t, n, d, weekday } = useI18n()
  const mixTotal = Math.max(1, page.mix.reel + page.mix.carousel + page.mix.post)
  const [openPost, setOpenPost] = useState<PagePostInsight | null>(null)
  const typeRows: Array<[string, TypeStats]> = [
    [t('analytics.reel'), page.byType.reel],
    [t('analytics.carousel'), page.byType.carousel],
    [t('analytics.post'), page.byType.post],
  ]
  const bestDayLabel = page.bestDay ? weekday(page.bestDay) : ''
  const suggested = page.bestDay && page.bestHour
    ? t('analytics.suggested', { day: bestDayLabel || t('analytics.peakDays'), hour: page.bestHour })
    : '—'

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
          <div className="ig-contact-row">
            {page.website ? (
              <a href={page.website} target="_blank" rel="noreferrer">
                <Globe size={14} /> {page.website.replace(/^https?:\/\//, '')}
              </a>
            ) : null}
            {page.phone ? (
              <a href={`tel:${page.phone}`}>
                <Phone size={14} /> {page.phone}
              </a>
            ) : null}
            {page.email ? (
              <a href={`mailto:${page.email}`}>
                <Mail size={14} /> {page.email}
              </a>
            ) : null}
            {page.telegram ? (
              <a href={`https://t.me/${page.telegram}`} target="_blank" rel="noreferrer">
                <Send size={14} /> @{page.telegram}
              </a>
            ) : null}
          </div>
          <div className="ig-badges">
            {page.isProfessional ? <span>{t('analytics.professional')}</span> : null}
            {page.isBusiness ? <span>{t('analytics.business')}</span> : null}
            {page.isPrivate ? <span>{t('analytics.private')}</span> : null}
            {page.hasClips ? <span>{t('analytics.clips')}</span> : null}
            {page.highlightCount > 0 ? <span>{t('analytics.highlights', { n: n(page.highlightCount) })}</span> : null}
            {page.isJoinedRecently ? <span>{t('analytics.newbie')}</span> : null}
            <span>{t('analytics.sourcePublic')}</span>
          </div>
        </div>
        <div className="ig-health" title={t('analytics.healthTitle')}>
          <strong>{n(page.health.score)}</strong>
          <span>{t('analytics.health')}</span>
        </div>
      </section>

      <div className="ops-stat-grid ig-insight-stats">
        {[
          [t('analytics.followers'), n(page.followers), <Users size={16} key="u" />],
          [t('analytics.following'), n(page.following), <Users size={16} key="f" />],
          [t('analytics.ratio'), n(page.followerFollowingRatio, 1), <TrendingUp size={16} key="r" />],
          [t('analytics.posts'), n(page.posts), <Images size={16} key="p" />],
          [t('analytics.engagement'), t('analytics.pct', { n: n(page.engagementRate, 2) }), <Heart size={16} key="e" />],
          [t('analytics.avgLikes'), n(page.avgLikes), <Heart size={16} key="l" />],
          [t('analytics.avgComments'), n(page.avgComments), <MessageCircle size={16} key="c" />],
          [t('analytics.commentsToLikes'), n(page.commentsToLikes, 2), <MessageCircle size={16} key="cl" />],
          [t('analytics.avgViews'), page.avgViews ? n(page.avgViews) : '—', <Eye size={16} key="v" />],
          [
            t('analytics.playRate'),
            page.reelPlayRate != null ? t('analytics.pct', { n: n(page.reelPlayRate, 1) }) : '—',
            <Eye size={16} key="pr" />,
          ],
          [
            t('analytics.cadence'),
            page.postCadenceDays != null ? t('analytics.daysUnit', { n: n(page.postCadenceDays, 1) }) : '—',
            <Clapperboard size={16} key="d" />,
          ],
          [t('analytics.window'), suggested, <Clock size={16} key="w" />],
          [t('analytics.lastPost'), page.lastPostedAt ? d(page.lastPostedAt) : '—', <Clock size={16} key="lp" />],
          [
            t('analytics.captionLen'),
            page.avgCaptionLength ? t('analytics.chars', { n: n(page.avgCaptionLength) }) : '—',
            <Hash size={16} key="cap" />,
          ],
          [t('analytics.pinned'), n(page.pinnedCount), <Images size={16} key="pin" />],
          [
            t('analytics.consistency'),
            page.postingStdevDays != null ? t('analytics.daysUnit', { n: n(page.postingStdevDays, 1) }) : '—',
            <Clock size={16} key="st" />,
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

      {growth ? (
        <section className="panel panel-pad ig-growth">
          <h2 className="section-title">{t('analytics.growthTitle')}</h2>
          {growth.previousFetchedAt ? (
            <p>
              {t('analytics.growthLine', {
                followers: fmtDelta(growth.followerDelta, t, n),
                posts: fmtDelta(growth.postsDelta, t, n),
                engagement: fmtDelta(growth.engagementDelta, t, n, true),
              })}
              <span className="section-sub">{t('analytics.growthFrom', { date: d(growth.previousFetchedAt) })}</span>
            </p>
          ) : (
            <p className="section-sub">{t('analytics.growthFirst')}</p>
          )}
          {(growth.history?.length || 0) > 1 ? <Sparkline points={growth.history!.map((h) => h.followers)} /> : null}
        </section>
      ) : null}

      {page.hints.length > 0 && (
        <ul className="ig-hints">
          {page.hints.map((h) => {
            const args = { ...(h.args || {}) }
            if (typeof args.day === 'string') args.day = weekday(args.day)
            return <li key={h.id}>{t(`hints.${h.id}`, args)}</li>
          })}
        </ul>
      )}

      <div className="ops-split" style={{ marginTop: '0.25rem' }}>
        <section className="panel panel-pad">
          <h2 className="section-title">{t('analytics.typePerf')}</h2>
          <div className="ig-table-wrap">
            <table className="ig-table">
              <thead>
                <tr>
                  <th>{t('analytics.type')}</th>
                  <th>{t('analytics.count')}</th>
                  <th>{t('analytics.likes')}</th>
                  <th>{t('analytics.comments')}</th>
                  <th>{t('analytics.views')}</th>
                  <th>{t('analytics.engagement')}</th>
                </tr>
              </thead>
              <tbody>
                {typeRows.map(([label, row]) => (
                  <tr key={label}>
                    <td>{label}</td>
                    <td>{n(row.count)}</td>
                    <td>{row.count ? n(row.avgLikes) : '—'}</td>
                    <td>{row.count ? n(row.avgComments) : '—'}</td>
                    <td>{row.avgViews ? n(row.avgViews) : '—'}</td>
                    <td>{row.count ? t('analytics.pct', { n: n(row.avgEngagement, 2) }) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="section-sub" style={{ marginTop: '0.6rem' }}>
            {t('analytics.mixLine', {
              n: n(mixTotal),
              reel: n(page.mix.reel),
              carousel: n(page.mix.carousel),
              post: n(page.mix.post),
            })}
          </p>
        </section>
        <section className="panel panel-pad">
          <h2 className="section-title">{t('analytics.timing')}</h2>
          <BarList entries={page.heatmapDays.map((day) => [weekday(day.key) || day.key, day.count])} />
          {page.heatmapHours.length > 0 && (
            <p className="section-sub" style={{ marginTop: '0.7rem' }}>
              {t('analytics.busyHours')}{' '}
              {page.heatmapHours
                .slice()
                .sort((a, b) => b.count - a.count)
                .slice(0, 4)
                .map((h) => `${h.key}:00 (${n(h.count)})`)
                .join(' · ')}
            </p>
          )}
          {page.bestDay || page.bestHour ? (
            <p className="section-sub">
              {t('analytics.bestSignal', {
                day: bestDayLabel || '—',
                hour: page.bestHour ? t('analytics.around', { hour: page.bestHour }) : '',
              })}
            </p>
          ) : null}
        </section>
      </div>

      <div className="ops-split" style={{ marginTop: '1rem' }}>
        <section className="panel panel-pad">
          <h2 className="section-title">{t('analytics.bestPost')}</h2>
          {page.bestPost ? (
            <PostRow post={page.bestPost} onOpen={setOpenPost} />
          ) : (
            <p className="section-sub">{t('analytics.noPublic')}</p>
          )}
        </section>
        <section className="panel panel-pad">
          <h2 className="section-title">{t('analytics.weakPost')}</h2>
          {page.weakestPost ? (
            <PostRow post={page.weakestPost} onOpen={setOpenPost} />
          ) : (
            <p className="section-sub">{t('analytics.notEnough')}</p>
          )}
        </section>
      </div>

      <div className="ig-chip-panels">
        <TagPanel title={t('analytics.hashtags')} icon={<Hash size={14} />} items={page.topHashtags} />
        <TagPanel title={t('analytics.collabs')} icon={<Users size={14} />} items={page.collaborators} />
        <TagPanel title={t('analytics.locations')} icon={<MapPin size={14} />} items={page.locations} />
        <section className="panel panel-pad">
          <h2 className="section-title">
            <Music size={14} /> {t('analytics.audio')}
          </h2>
          {page.audioMix.original + page.audioMix.licensed === 0 ? (
            <p className="section-sub">{t('analytics.noAudio')}</p>
          ) : (
            <BarList
              entries={[
                [t('analytics.originalAudio'), page.audioMix.original],
                [t('analytics.licensedAudio'), page.audioMix.licensed],
              ]}
            />
          )}
        </section>
      </div>

      {(page.relatedProfiles?.length || 0) > 0 && (
        <section className="panel panel-pad" style={{ marginTop: '1rem' }}>
          <h2 className="section-title">{t('analytics.related')}</h2>
          <div className="ig-related">
            {page.relatedProfiles.map((rel) => (
              <RelatedChip key={rel.username} profile={rel} onOpen={() => onOpenRelated(rel.username)} />
            ))}
          </div>
        </section>
      )}

      {(enrichment?.website ||
        enrichment?.wikidata ||
        enrichment?.wikipedia ||
        enrichment?.domain ||
        (enrichment?.researchLinks.length || 0) > 0) && (
        <section className="panel panel-pad" style={{ marginTop: '1rem' }}>
          <h2 className="section-title">{t('analytics.research')}</h2>
          {enrichment?.website ? (
            <p className="ig-site-meta">
              <Globe size={14} />{' '}
              <a href={enrichment.website.url} target="_blank" rel="noreferrer">
                {enrichment.website.title || enrichment.website.url}
              </a>
              {enrichment.website.description ? ` — ${enrichment.website.description}` : ''}
              {enrichment.website.address ? ` · ${enrichment.website.address}` : ''}
            </p>
          ) : null}
          {enrichment?.wikipedia ? (
            <p className="section-sub">
              {t('analytics.wikipedia')}: {enrichment.wikipedia.extract}
            </p>
          ) : enrichment?.wikidata ? (
            <p className="section-sub">
              {t('analytics.wikiData', { label: enrichment.wikidata.label })}
              {enrichment.wikidata.description ? ` · ${enrichment.wikidata.description}` : ''}
            </p>
          ) : null}
          {enrichment?.domain ? (
            <p className="section-sub">
              {t('analytics.domainAge', { host: enrichment.domain.host })}
              {enrichment.domain.createdAt ? ` · ${t('analytics.registered', { date: d(enrichment.domain.createdAt) })}` : ''}
              {enrichment.domain.registrar ? ` · ${enrichment.domain.registrar}` : ''}
            </p>
          ) : null}
          {enrichment?.place ? (
            <p className="section-sub">
              {t('analytics.place')}: {enrichment.place.displayName}
            </p>
          ) : null}
          <div className="ig-research">
            {(enrichment?.researchLinks || []).map((l) => (
              <a key={l.url} className="ig-research-link" href={l.url} target="_blank" rel="noreferrer">
                <Link2 size={14} />
                <span>
                  <strong>{l.id ? t(`research.${l.id}`) : l.label}</strong>
                  <em>{l.hint}</em>
                </span>
              </a>
            ))}
          </div>
        </section>
      )}

      <section className="panel panel-pad" style={{ marginTop: '1rem' }}>
        <h2 className="section-title">{t('analytics.healthDetails')}</h2>
        <BarList entries={page.health.parts.map((p) => [t(`health.${p.id}`), p.score])} />
        <p className="section-sub" style={{ marginTop: '0.6rem' }}>
          {t('analytics.healthNote')}
        </p>
      </section>

      <section className="panel panel-pad" style={{ marginTop: '1rem' }}>
        <h2 className="section-title">{t('analytics.recent')}</h2>
        {page.recentPosts.length === 0 ? (
          <p className="section-sub">{t('analytics.noPosts')}</p>
        ) : (
          <div className="ig-post-grid">
            {page.recentPosts.map((post) => (
              <PostCard key={post.shortcode || post.url} post={post} onOpen={setOpenPost} />
            ))}
          </div>
        )}
        <p className="section-sub" style={{ marginTop: '0.85rem' }}>
          {t('analytics.updated', { date: d(page.fetchedAt) })}
        </p>
      </section>
      {openPost ? <IgPostModal post={openPost} onClose={() => setOpenPost(null)} /> : null}
    </>
  )
}

function RelatedChip({ profile, onOpen }: { profile: RelatedProfile; onOpen: () => void }) {
  const { n } = useI18n()
  return (
    <button type="button" className="ig-related-chip" onClick={onOpen}>
      {profile.avatarUrl ? (
        <img src={profile.avatarUrl} alt="" referrerPolicy="no-referrer" />
      ) : (
        <span>{profile.name.slice(0, 1)}</span>
      )}
      <em>
        <strong dir="ltr">@{profile.username}</strong>
        {profile.followers ? <small>{n(profile.followers)}</small> : null}
      </em>
    </button>
  )
}

function Sparkline({ points }: { points: number[] }) {
  if (points.length < 2) return null
  const min = Math.min(...points)
  const max = Math.max(...points)
  const span = Math.max(1, max - min)
  const w = 220
  const h = 36
  const d = points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * w
      const y = h - ((p - min) / span) * (h - 4) - 2
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
  return (
    <svg className="ig-spark" viewBox={`0 0 ${w} ${h}`} width={w} height={h} aria-hidden>
      <path d={d} fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  )
}

function fmtDelta(
  value: number | undefined,
  t: (k: string, vars?: Record<string, string | number>) => string,
  n: (v: number, d?: number) => string,
  pct = false,
) {
  if (value == null || value === 0) return t('analytics.unchanged')
  const sign = value > 0 ? '+' : '−'
  const v = Math.abs(value)
  return `${sign}${pct ? t('analytics.pct', { n: n(v, 2) }) : n(v)}`
}

function TagPanel({ title, icon, items }: { title: string; icon: ReactNode; items: CountStat[] }) {
  const { t, n } = useI18n()
  return (
    <section className="panel panel-pad">
      <h2 className="section-title">
        {icon} {title}
      </h2>
      {items.length === 0 ? (
        <p className="section-sub">{t('analytics.emptyTags')}</p>
      ) : (
        <ul className="ig-tag-list">
          {items.map((it) => (
            <li key={it.key}>
              <strong>{it.key}</strong>
              <span>{t('analytics.times', { n: n(it.count), er: n(it.avgEngagement, 1) })}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function PostRow({ post, onOpen }: { post: PagePostInsight; onOpen: (post: PagePostInsight) => void }) {
  const { t, n, d } = useI18n()
  const type = postTypeLabel(post.type, t)
  return (
    <button type="button" className="ig-post-row" onClick={() => onOpen(post)}>
      {post.thumbUrl ? (
        <img src={post.thumbUrl} alt="" referrerPolicy="no-referrer" />
      ) : (
        <span className="ig-thumb-fallback">{type}</span>
      )}
      <span>
        <strong>{t('analytics.postEng', { type, er: n(post.engagement, 2) })}</strong>
        <em>
          {t('analytics.postStats', { likes: n(post.likes), comments: n(post.comments) })}
          {post.views != null ? t('analytics.withViews', { views: n(post.views) }) : ''}
          {post.takenAt ? ` · ${d(post.takenAt)}` : ''}
        </em>
        {post.caption ? <em className="ig-caption">{post.caption}</em> : null}
      </span>
    </button>
  )
}

function PostCard({ post, onOpen }: { post: PagePostInsight; onOpen: (post: PagePostInsight) => void }) {
  const { t, n } = useI18n()
  const type = postTypeLabel(post.type, t)
  return (
    <button type="button" className="ig-post-card" onClick={() => onOpen(post)}>
      {post.thumbUrl ? (
        <img src={post.thumbUrl} alt="" referrerPolicy="no-referrer" />
      ) : (
        <span className="ig-thumb-fallback">{type}</span>
      )}
      <span className="ig-post-type">{type}</span>
      <span className="ig-post-metrics">
        <Heart size={12} /> {n(post.likes)}
        <MessageCircle size={12} /> {n(post.comments)}
        {post.views != null ? (
          <>
            <Eye size={12} /> {n(post.views)}
          </>
        ) : null}
      </span>
    </button>
  )
}

function IgPostModal({ post, onClose }: { post: PagePostInsight; onClose: () => void }) {
  const { t, n, d } = useI18n()
  const type = postTypeLabel(post.type, t)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="modal-backdrop ig-post-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="panel panel-pad ig-post-modal"
        role="dialog"
        aria-modal="true"
        aria-label={t('analytics.preview')}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="ig-post-modal-head">
          <strong>{t('analytics.postEng', { type, er: n(post.engagement, 2) })}</strong>
          <button type="button" className="btn btn-outline btn-sm" onClick={onClose} aria-label={t('common.close')}>
            <X size={16} />
          </button>
        </header>
        {post.thumbUrl ? (
          <img className="ig-post-modal-img" src={post.thumbUrl} alt="" referrerPolicy="no-referrer" />
        ) : (
          <span className="ig-thumb-fallback">{type}</span>
        )}
        <p className="ig-post-modal-stats">
          {t('analytics.postStats', { likes: n(post.likes), comments: n(post.comments) })}
          {post.views != null ? t('analytics.withViews', { views: n(post.views) }) : ''}
          {post.takenAt ? ` · ${d(post.takenAt)}` : ''}
        </p>
        {post.locationName ? (
          <p className="section-sub">
            <MapPin size={12} /> {post.locationName}
          </p>
        ) : null}
        {post.songName ? (
          <p className="section-sub">
            <Music size={12} /> {post.originalAudio ? t('analytics.originalAudio') : post.songName}
            {post.artistName ? ` · ${post.artistName}` : ''}
          </p>
        ) : null}
        {post.taggedUsers.length > 0 ? (
          <p className="section-sub">{t('analytics.tagged', { list: post.taggedUsers.map((u) => `@${u}`).join(' · ') })}</p>
        ) : null}
        {post.hashtags.length > 0 ? (
          <p className="section-sub">{post.hashtags.map((h) => `#${h}`).join(' ')}</p>
        ) : null}
        {post.caption ? <p className="ig-post-modal-caption">{post.caption}</p> : null}
        <p className="section-sub">{t('analytics.inAppPreview')}</p>
      </div>
    </div>
  )
}

function SupermetricsTable({ rows, fields }: { rows: unknown[]; fields?: string[] }) {
  const { t } = useI18n()
  const keys =
    fields && fields.length
      ? fields
      : rows[0] && typeof rows[0] === 'object'
        ? Object.keys(rows[0] as object)
        : []
  return (
    <section className="panel panel-pad" style={{ marginTop: '1rem' }}>
      <h2 className="section-title">{t('analytics.supermetrics')}</h2>
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
  const { t } = useI18n()
  if (error) {
    return (
      <section className="panel panel-pad" style={{ marginTop: '1.25rem' }}>
        <h2 className="section-title">{t('analytics.workspaceTitle')}</h2>
        <p className="section-sub">{error}</p>
      </section>
    )
  }
  if (!data) {
    return (
      <section className="panel panel-pad" style={{ marginTop: '1.25rem' }}>
        <p className="section-sub">{t('analytics.wsLoading')}</p>
      </section>
    )
  }

  const { summary } = data
  return (
    <div style={{ marginTop: '1.5rem' }}>
      <header className="ops-page-head">
        <div>
          <h2 className="section-title" style={{ margin: 0 }}>
            {t('analytics.workspaceTitle')}
          </h2>
          <p>{t('analytics.workspaceSub')}</p>
        </div>
      </header>

      <div className="ops-stat-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        {[
          [t('analytics.totalContent'), summary.totalContent],
          [t('analytics.publishRate'), t('analytics.pct', { n: summary.publishRate })],
          [t('analytics.published30'), summary.publishedLast30],
          [t('analytics.overdue'), summary.overdue],
        ].map(([label, value]) => (
          <div key={String(label)} className="panel panel-pad ops-stat">
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>

      <div className="ops-stat-grid" style={{ marginTop: '0.75rem' }}>
        {[
          [t('analytics.upcoming'), summary.scheduledUpcoming],
          [t('analytics.files'), summary.assets],
          [t('analytics.size'), `${(summary.assetBytes / (1024 * 1024)).toFixed(1)} MB`],
          [t('analytics.published'), summary.published],
        ].map(([label, value]) => (
          <div key={String(label)} className="panel panel-pad ops-stat">
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>

      <div className="ops-split" style={{ marginTop: '1rem' }}>
        <section className="panel panel-pad">
          <h2 className="section-title">{t('analytics.statuses')}</h2>
          <BarList entries={Object.entries(data.byStatus).map(([k, v]) => [t(`status.${k as ContentStatus}`), v])} />
        </section>
        <section className="panel panel-pad">
          <h2 className="section-title">{t('analytics.types')}</h2>
          <BarList entries={Object.entries(data.byType).map(([k, v]) => [t(`type.${k as ContentType}`), v])} />
        </section>
        <section className="panel panel-pad">
          <h2 className="section-title">{t('analytics.platforms')}</h2>
          <BarList entries={Object.entries(data.byPlatform).map(([k, v]) => [t(`platform.${k as Platform}`), v])} />
        </section>
        <section className="panel panel-pad">
          <h2 className="section-title">{t('analytics.fileTypes')}</h2>
          <BarList entries={Object.entries(data.assetByType)} />
        </section>
      </div>

      <div className="ops-split" style={{ marginTop: '1rem' }}>
        <section className="panel panel-pad">
          <h2 className="section-title">{t('analytics.lastPublished')}</h2>
          <ul className="ops-list">
            {data.recentPublished.length === 0 && <li className="section-sub">{t('common.none')}</li>}
            {data.recentPublished.map((item) => (
              <li key={item.id}>
                <strong>{item.title}</strong>
                <span>
                  {t(`type.${item.contentType as ContentType}`)}
                  {item.publishDate ? ` · ${item.publishDate}` : ''}
                </span>
              </li>
            ))}
          </ul>
        </section>
        <section className="panel panel-pad">
          <h2 className="section-title">{t('analytics.missingAssets')}</h2>
          <ul className="ops-list">
            {data.missingAssets.length === 0 && <li className="section-sub">{t('analytics.allCovered')}</li>}
            {data.missingAssets.map((item) => (
              <li key={item.id}>
                <strong>{item.title}</strong>
                <span>{t(`status.${item.status as ContentStatus}`)}</span>
              </li>
            ))}
          </ul>
          <p className="section-sub" style={{ marginTop: '0.85rem' }}>
            {t('analytics.aiReady')}: {data.aiReadyHints.join(' · ')}
          </p>
        </section>
      </div>
    </div>
  )
}

function BarList({ entries }: { entries: Array<[string, number] | string[]> }) {
  const { t } = useI18n()
  const max = Math.max(1, ...entries.map((e) => Number(e[1]) || 0))
  if (!entries.length) return <p className="section-sub">{t('common.noData')}</p>
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
