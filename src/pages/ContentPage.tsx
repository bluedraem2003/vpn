import { useEffect, useState } from 'react'
import { api, type ContentDto } from '../api/client'
import {
  CONTENT_STATUS_FLOW,
  CONTENT_STATUS_LABELS,
  CONTENT_TYPE_LABELS,
  type ContentStatus,
  type ContentType,
} from '../domain/types'

export function ContentPage() {
  const [workspaceId, setWorkspaceId] = useState<string | null>(null)
  const [items, setItems] = useState<ContentDto[]>([])
  const [error, setError] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [contentType, setContentType] = useState<ContentType>('reel')
  const [publishDate, setPublishDate] = useState('')
  const [busy, setBusy] = useState(false)

  async function reload(id: string) {
    const res = await api.listContent(id)
    setItems(res.items)
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const ws = await api.workspaces()
        const id = ws.items[0]?.id
        if (!id) throw new Error('ورک‌اسپیس یافت نشد')
        if (cancelled) return
        setWorkspaceId(id)
        await reload(id)
      } catch (e) {
        if (!cancelled) setError((e as Error).message)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  async function createItem() {
    if (!workspaceId || !title.trim()) return
    setBusy(true)
    setError(null)
    try {
      await api.createContent({
        workspaceId,
        title: title.trim(),
        contentType,
        platforms: ['instagram'],
        status: 'planned',
        publishDate: publishDate || undefined,
        hashtags: [],
      })
      setTitle('')
      await reload(workspaceId)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function moveStatus(item: ContentDto, status: ContentStatus) {
    if (!workspaceId) return
    await api.updateContent(item.id, { status })
    await reload(workspaceId)
  }

  return (
    <div className="ops-page">
      <header className="ops-page-head">
        <div>
          <h1>محتوا</h1>
          <p>مدیریت آیتم‌ها و گردش وضعیت تولید</p>
        </div>
      </header>

      <div className="ops-split" style={{ gridTemplateColumns: '0.9fr 1.1fr' }}>
        <section className="panel panel-pad">
          <h2 className="section-title">ایجاد محتوا</h2>
          <div className="field">
            <label>عنوان</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="معرفی پروژه جدید" />
          </div>
          <div className="field">
            <label>نوع</label>
            <select value={contentType} onChange={(e) => setContentType(e.target.value as ContentType)}>
              {Object.entries(CONTENT_TYPE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>تاریخ انتشار</label>
            <input type="date" value={publishDate} onChange={(e) => setPublishDate(e.target.value)} />
          </div>
          {error && <p className="section-sub">{error}</p>}
          <button type="button" className="btn btn-solid" disabled={busy} onClick={createItem}>
            ذخیره
          </button>
        </section>

        <section className="panel panel-pad">
          <h2 className="section-title">لیست محتوا</h2>
          <div className="page-list">
            {items.length === 0 && <p className="section-sub">موردی نیست</p>}
            {items.map((item) => (
              <article key={item.id} className="list-item content-card">
                <div className="list-meta">
                  <h3>{item.title}</h3>
                  <span className="meta-badge">
                    {CONTENT_STATUS_LABELS[item.status as ContentStatus] || item.status}
                  </span>
                </div>
                <p>
                  {CONTENT_TYPE_LABELS[item.contentType as ContentType] || item.contentType}
                  {item.publishDate ? ` · ${item.publishDate}` : ''}
                  {item.platforms?.length ? ` · ${item.platforms.join(', ')}` : ''}
                </p>
                <div className="chip-row">
                  {CONTENT_STATUS_FLOW.map((s) => (
                    <button
                      key={s}
                      type="button"
                      className={`chip ${item.status === s ? 'active' : ''}`}
                      onClick={() => moveStatus(item, s)}
                    >
                      {CONTENT_STATUS_LABELS[s]}
                    </button>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
