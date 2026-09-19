import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api, type AssetDto, type CampaignDto, type ContentDto, type OccasionDto, type ProjectDto } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { CopyButton } from '../components/CopyButton'
import {
  CONTENT_STATUS_FLOW,
  CONTENT_STATUS_LABELS,
  CONTENT_TYPE_LABELS,
  type ContentStatus,
  type ContentType,
} from '../domain/types'
import { formatHashtags, parseHashtags } from '../lib/hashtags'

const emptyForm = {
  title: '',
  contentType: 'story' as ContentType,
  publishDate: '',
  windowStart: '10:00',
  windowEnd: '12:00',
  projectId: '',
  campaignId: '',
  occasionId: '',
  caption: '',
  hashtagText: '',
  notes: '',
}

export function ContentPage() {
  const { workspaceId, session } = useAuth()
  const [params, setParams] = useSearchParams()
  const [items, setItems] = useState<ContentDto[]>([])
  const [assets, setAssets] = useState<AssetDto[]>([])
  const [projects, setProjects] = useState<ProjectDto[]>([])
  const [campaigns, setCampaigns] = useState<CampaignDto[]>([])
  const [occasions, setOccasions] = useState<OccasionDto[]>([])
  const [attached, setAttached] = useState<Record<string, Array<AssetDto & { linkId: string }>>>({})
  const [error, setError] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [filterProject, setFilterProject] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [busy, setBusy] = useState(false)
  const [attachFor, setAttachFor] = useState<string | null>(null)
  const [remindMsg, setRemindMsg] = useState<string | null>(null)

  async function reload(id: string) {
    const [contentRes, assetRes, projectRes, campaignRes, occRes] = await Promise.all([
      api.listContent(id),
      api.listAssets(id),
      api.listProjects(id),
      api.listCampaigns(id),
      api.listOccasions(id, { year: new Date().getFullYear() }),
    ])
    setItems(contentRes.items || [])
    setAssets(assetRes.items || [])
    setProjects(projectRes.items || [])
    setCampaigns(campaignRes.items || [])
    setOccasions(occRes.items || [])

    const map: Record<string, Array<AssetDto & { linkId: string }>> = {}
    await Promise.all(
      (contentRes.items || []).map(async (item) => {
        const res = await api.contentAssets(item.id)
        map[item.id] = res.items
      }),
    )
    setAttached(map)
    return { items: contentRes.items || [], projects: projectRes.items || [] }
  }

  useEffect(() => {
    if (!workspaceId) return
    void reload(workspaceId)
      .then(({ items: loaded, projects: pages }) => {
        const date = params.get('date')
        const edit = params.get('edit')
        const project = params.get('projectId')
        if (date) setForm((f) => ({ ...f, publishDate: date }))
        if (project) setForm((f) => ({ ...f, projectId: project }))
        if (edit) {
          const item = loaded.find((i) => i.id === edit)
          if (item) startEdit(item)
        } else if (!project && pages.length === 1) {
          setForm((f) => (f.projectId ? f : { ...f, projectId: pages[0].id }))
        }
      })
      .catch((e) => setError((e as Error).message))
  }, [workspaceId])

  const filtered = useMemo(
    () =>
      items.filter((item) => {
        if (filterProject && item.projectId !== filterProject) return false
        if (filterStatus && item.status !== filterStatus) return false
        return true
      }),
    [items, filterProject, filterStatus],
  )

  const occasionOptions = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    return [...occasions]
      .filter((o) => o.dateInYear)
      .sort((a, b) => String(a.dateInYear).localeCompare(String(b.dateInYear)))
      .filter((o) => String(o.dateInYear) >= today || o.id === form.occasionId)
  }, [occasions, form.occasionId])

  function patchForm(partial: Partial<typeof emptyForm>) {
    setForm((f) => ({ ...f, ...partial }))
  }

  function applyPageDefaults(projectId: string) {
    const page = projects.find((p) => p.id === projectId)
    if (!page) return
    setForm((f) => ({
      ...f,
      projectId,
      windowStart: page.windowStart || f.windowStart || '10:00',
      windowEnd: page.windowEnd || f.windowEnd || '12:00',
      hashtagText: f.hashtagText.trim() ? f.hashtagText : formatHashtags(page.hashtags),
    }))
  }

  function resetForm() {
    setForm(emptyForm)
    setEditingId(null)
    setParams({}, { replace: true })
  }

  function startEdit(item: ContentDto) {
    setEditingId(item.id)
    setForm({
      title: item.title,
      contentType: item.contentType as ContentType,
      publishDate: item.publishDate || '',
      windowStart: item.windowStart || item.publishTime || '10:00',
      windowEnd: item.windowEnd || '12:00',
      projectId: item.projectId || '',
      campaignId: item.campaignId || '',
      occasionId: item.occasionId || '',
      caption: item.caption || '',
      hashtagText: formatHashtags(item.hashtags),
      notes: item.notes || '',
    })
    setError(null)
    setMsg(null)
  }

  async function save() {
    if (!workspaceId) return
    if (!form.title.trim()) {
      setError('عنوان را بنویس')
      return
    }
    setBusy(true)
    setError(null)
    setMsg(null)
    const body = {
      title: form.title.trim(),
      contentType: form.contentType,
      platforms: ['instagram'],
      status: form.publishDate ? 'scheduled' : 'planned',
      publishDate: form.publishDate || undefined,
      publishTime: form.windowStart || undefined,
      windowStart: form.windowStart || undefined,
      windowEnd: form.windowEnd || undefined,
      projectId: form.projectId || undefined,
      campaignId: form.campaignId || undefined,
      occasionId: form.occasionId || undefined,
      caption: form.caption.trim() || undefined,
      hashtags: parseHashtags(form.hashtagText),
      notes: form.notes.trim() || undefined,
    }
    try {
      if (editingId) {
        const res = await api.updateContent(editingId, body)
        setItems((prev) => prev.map((i) => (i.id === editingId ? res.item : i)))
        setMsg('محتوا به‌روزرسانی شد')
        resetForm()
      } else {
        const res = await api.createContent({ workspaceId, ...body })
        setItems((prev) => [res.item, ...prev.filter((i) => i.id !== res.item.id)])
        setMsg('محتوا ذخیره شد')
        setForm((f) => ({ ...emptyForm, projectId: f.projectId }))
      }
      await reload(workspaceId)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function moveStatus(item: ContentDto, status: ContentStatus) {
    if (!workspaceId) return
    setError(null)
    try {
      await api.updateContent(item.id, { status })
      await reload(workspaceId)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  async function attach(assetId: string, contentId: string) {
    if (!workspaceId) return
    try {
      await api.attachAsset(assetId, contentId, 'other')
      setAttachFor(null)
      await reload(workspaceId)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  async function removeItem(id: string) {
    if (!workspaceId || !window.confirm('این محتوا حذف شود؟')) return
    try {
      await api.deleteContent(id)
      setItems((prev) => prev.filter((i) => i.id !== id))
      if (editingId === id) resetForm()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  async function runReminders() {
    setRemindMsg(null)
    try {
      const res = await api.runMissedReminders()
      setRemindMsg(`یادآوری‌ها: بررسی ${res.checked} · ارسال ${res.sent}`)
    } catch (e) {
      setRemindMsg((e as Error).message)
    }
  }

  const canRemind = session?.role === 'admin' || session?.role === 'manager'

  return (
    <div className="ops-page">
      <header className="ops-page-head">
        <div>
          <h1>محتوا</h1>
          <p>کپشن، هشتگ، مناسبت و زمان انتشار را اینجا بنویس — اگر نگذاری، تلگرام یادآوری می‌کند</p>
        </div>
        {canRemind && (
          <button type="button" className="btn btn-outline btn-sm" onClick={() => void runReminders()}>
            چک یادآوری‌ها الان
          </button>
        )}
      </header>
      {remindMsg && <div className="form-banner ok">{remindMsg}</div>}
      {error && <div className="form-banner error">{error}</div>}
      {msg && <div className="form-banner ok">{msg}</div>}

      <div className="ops-split" style={{ gridTemplateColumns: '0.95fr 1.05fr' }}>
        <form
          className="panel panel-pad"
          onSubmit={(e) => {
            e.preventDefault()
            void save()
          }}
        >
          <h2 className="section-title">{editingId ? 'ویرایش محتوا' : 'ایجاد / اسکجول'}</h2>
          <div className="field">
            <label>عنوان</label>
            <input
              value={form.title}
              onChange={(e) => patchForm({ title: e.target.value })}
              placeholder="استوری صبحگاهی محصول"
            />
          </div>
          <div className="field">
            <label>نوع</label>
            <select
              value={form.contentType}
              onChange={(e) => patchForm({ contentType: e.target.value as ContentType })}
            >
              {Object.entries(CONTENT_TYPE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>پیج</label>
            <select
              value={form.projectId}
              onChange={(e) => {
                const id = e.target.value
                if (!id) patchForm({ projectId: '' })
                else applyPageDefaults(id)
              }}
            >
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
            <select value={form.campaignId} onChange={(e) => patchForm({ campaignId: e.target.value })}>
              <option value="">—</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>مناسبت</label>
            <select value={form.occasionId} onChange={(e) => patchForm({ occasionId: e.target.value })}>
              <option value="">— بدون مناسبت</option>
              {occasionOptions.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.dateInYear} — {o.nameFa}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>تاریخ انتشار</label>
            <input
              type="date"
              value={form.publishDate}
              onChange={(e) => patchForm({ publishDate: e.target.value })}
            />
          </div>
          <div className="ops-filters" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <div className="field" style={{ margin: 0 }}>
              <label>از ساعت</label>
              <input
                type="time"
                value={form.windowStart}
                onChange={(e) => patchForm({ windowStart: e.target.value })}
              />
            </div>
            <div className="field" style={{ margin: 0 }}>
              <label>تا ساعت</label>
              <input type="time" value={form.windowEnd} onChange={(e) => patchForm({ windowEnd: e.target.value })} />
            </div>
          </div>
          <div className="field">
            <label>کپشن</label>
            <textarea
              value={form.caption}
              onChange={(e) => patchForm({ caption: e.target.value })}
              placeholder="متن آماده انتشار..."
            />
          </div>
          <div className="field">
            <label>هشتگ‌ها</label>
            <input
              value={form.hashtagText}
              onChange={(e) => patchForm({ hashtagText: e.target.value })}
              placeholder="#cafe #tehran"
              dir="ltr"
            />
          </div>
          <div className="field">
            <label>یادداشت داخلی</label>
            <textarea
              value={form.notes}
              onChange={(e) => patchForm({ notes: e.target.value })}
              placeholder="ایده بصری، لوکیشن، نکات تولید..."
            />
          </div>
          <p className="section-sub">
            اگر تا پایان این بازه وضعیت «منتشر شده» نشود، پیام «اوستا اینو نذاشتی» به تلگرام می‌رود.
          </p>
          <div className="form-actions">
            <button type="submit" className="btn btn-solid" disabled={busy}>
              {busy ? 'در حال ذخیره...' : editingId ? 'به‌روزرسانی' : 'ذخیره محتوا'}
            </button>
            {editingId && (
              <button type="button" className="btn btn-outline" disabled={busy} onClick={resetForm}>
                انصراف
              </button>
            )}
          </div>
        </form>

        <section className="panel panel-pad">
          <h2 className="section-title">لیست محتوا</h2>
          <div className="ops-filters" style={{ gridTemplateColumns: '1fr 1fr', marginBottom: '0.85rem' }}>
            <select value={filterProject} onChange={(e) => setFilterProject(e.target.value)}>
              <option value="">همه پیج‌ها</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
              <option value="">همه وضعیت‌ها</option>
              {CONTENT_STATUS_FLOW.map((s) => (
                <option key={s} value={s}>
                  {CONTENT_STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </div>
          <div className="page-list">
            {filtered.length === 0 && <p className="section-sub">موردی نیست</p>}
            {filtered.map((item) => {
              const copyText = [item.caption, formatHashtags(item.hashtags)].filter(Boolean).join('\n\n')
              return (
                <article key={item.id} className="list-item content-card">
                  <div className="list-meta">
                    <h3>{item.title}</h3>
                    <span className="meta-badge">
                      {CONTENT_STATUS_LABELS[item.status as ContentStatus] || item.status}
                    </span>
                  </div>
                  <p>
                    {CONTENT_TYPE_LABELS[item.contentType as ContentType] || item.contentType}
                    {item.projectId ? ` · ${projects.find((p) => p.id === item.projectId)?.name || 'پیج'}` : ''}
                    {item.occasionId
                      ? ` · ${occasions.find((o) => o.id === item.occasionId)?.nameFa || 'مناسبت'}`
                      : ''}
                    {item.publishDate ? ` · ${item.publishDate}` : ''}
                    {item.windowStart || item.windowEnd
                      ? ` · ${item.windowStart || '—'} تا ${item.windowEnd || '—'}`
                      : item.publishTime
                        ? ` · ${item.publishTime}`
                        : ''}
                    {item.remindedAt ? ' · یادآوری ارسال شد' : ''}
                  </p>
                  {item.caption && <p className="pre" style={{ marginTop: '0.35rem' }}>{item.caption}</p>}
                  {item.hashtags?.length > 0 && (
                    <div className="chip-row">
                      {item.hashtags.map((t) => (
                        <span className="tag" key={t}>
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="chip-row">
                    {(attached[item.id] || []).map((a) => (
                      <span className="tag" key={a.linkId}>
                        {a.type}: {a.filename}
                      </span>
                    ))}
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
                    <button type="button" className="btn btn-outline btn-sm" onClick={() => startEdit(item)}>
                      ویرایش
                    </button>
                    {copyText && <CopyButton text={copyText} label="کپی کپشن" />}
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={() => setAttachFor(attachFor === item.id ? null : item.id)}
                    >
                      + فایل
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={() => void removeItem(item.id)}
                    >
                      حذف
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
              )
            })}
          </div>
        </section>
      </div>
    </div>
  )
}
