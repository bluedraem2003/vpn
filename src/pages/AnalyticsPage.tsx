import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import {
  CONTENT_STATUS_LABELS,
  CONTENT_TYPE_LABELS,
  PLATFORM_LABELS,
  type ContentStatus,
  type ContentType,
  type Platform,
} from '../domain/types'

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

export function AnalyticsPage() {
  const { workspaceId } = useAuth()
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!workspaceId) return
    api
      .analytics(workspaceId)
      .then((res) => setData(res as AnalyticsData))
      .catch((e) => setError((e as Error).message))
  }, [workspaceId])

  if (error) {
    return (
      <div className="panel panel-pad">
        <h1 className="section-title">آنالیتیکس</h1>
        <p className="section-sub">{error}</p>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="panel panel-pad">
        <p className="section-sub">در حال محاسبه آمار...</p>
      </div>
    )
  }

  const { summary } = data

  return (
    <div className="ops-page">
      <header className="ops-page-head">
        <div>
          <h1>آنالیتیکس</h1>
          <p>عملکرد تولید، انتشار و دارایی‌ها از داده‌های واقعی ورک‌اسپیس</p>
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
