import { useEffect, useState } from 'react'
import { api, type AssetDto, type CampaignDto, type ContentDto, type ProjectDto } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import {
  CONTENT_STATUS_FLOW,
  CONTENT_STATUS_LABELS,
  CONTENT_TYPE_LABELS,
  type ContentStatus,
  type ContentType,
} from '../domain/types'

export function ContentPage() {
  const { workspaceId } = useAuth()
  const [items, setItems] = useState<ContentDto[]>([])
  const [assets, setAssets] = useState<AssetDto[]>([])
  const [projects, setProjects] = useState<ProjectDto[]>([])
  const [campaigns, setCampaigns] = useState<CampaignDto[]>([])
  const [attached, setAttached] = useState<Record<string, Array<AssetDto & { linkId: string }>>>({})
  const [error, setError] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [contentType, setContentType] = useState<ContentType>('reel')
  const [publishDate, setPublishDate] = useState('')
  const [projectId, setProjectId] = useState('')
  const [campaignId, setCampaignId] = useState('')
  const [busy, setBusy] = useState(false)
  const [attachFor, setAttachFor] = useState<string | null>(null)

  async function reload(id: string) {
    const [contentRes, assetRes, projectRes, campaignRes] = await Promise.all([
      api.listContent(id),
      api.listAssets(id),
      api.listProjects(id),
      api.listCampaigns(id),
    ])
    setItems(contentRes.items)
    setAssets(assetRes.items)
    setProjects(projectRes.items)
    setCampaigns(campaignRes.items)

    const map: Record<string, Array<AssetDto & { linkId: string }>> = {}
    await Promise.all(
      contentRes.items.map(async (item) => {
        const res = await api.contentAssets(item.id)
        map[item.id] = res.items
      }),
    )
    setAttached(map)
  }

  useEffect(() => {
    if (!workspaceId) return
    void reload(workspaceId).catch((e) => setError((e as Error).message))
  }, [workspaceId])

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
        projectId: projectId || undefined,
        campaignId: campaignId || undefined,
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

  async function attach(assetId: string, contentId: string) {
    if (!workspaceId) return
    await api.attachAsset(assetId, contentId, 'other')
    setAttachFor(null)
    await reload(workspaceId)
  }

  return (
    <div className="ops-page">
      <header className="ops-page-head">
        <div>
          <h1>محتوا</h1>
          <p>مدیریت آیتم‌ها، گردش وضعیت و اتصال Asset</p>
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
            <label>پروژه</label>
            <select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
              <option value="">—</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>کمپین</label>
            <select value={campaignId} onChange={(e) => setCampaignId(e.target.value)}>
              <option value="">—</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>تاریخ انتشار</label>
            <input type="date" value={publishDate} onChange={(e) => setPublishDate(e.target.value)} />
          </div>
          {error && <p className="section-sub">{error}</p>}
          <button type="button" className="btn btn-solid" disabled={busy} onClick={() => void createItem()}>
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
                  {(attached[item.id] || []).map((a) => (
                    <span className="tag" key={a.linkId}>
                      {a.type}: {a.filename}
                    </span>
                  ))}
                  <span className="meta-badge">Assets: {(attached[item.id] || []).length}</span>
                </div>
                <div className="chip-row">
                  {CONTENT_STATUS_FLOW.map((s) => (
                    <button
                      key={s}
                      type="button"
                      className={`chip ${item.status === s ? 'active' : ''}`}
                      onClick={() => void moveStatus(item, s)}
                    >
                      {CONTENT_STATUS_LABELS[s]}
                    </button>
                  ))}
                </div>
                <div className="form-actions">
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => setAttachFor(attachFor === item.id ? null : item.id)}
                  >
                    + Attach Asset
                  </button>
                </div>
                {attachFor === item.id && (
                  <div className="attach-panel">
                    {assets.length === 0 && <p className="section-sub">فایلی برای اتصال نیست</p>}
                    {assets.map((asset) => (
                      <button
                        key={asset.id}
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={() => void attach(asset.id, item.id)}
                      >
                        {asset.filename}
                      </button>
                    ))}
                  </div>
                )}
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
