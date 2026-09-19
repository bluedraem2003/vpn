import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api, type AssetDto, type CampaignDto, type ContentDto, type OccasionDto, type ProjectDto } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { CopyButton } from '../components/CopyButton'
import { InstagramPreview } from '../components/InstagramPreview'
import {
  CONTENT_STATUS_FLOW,
  IG_CONTENT_TYPES,
  type ContentStatus,
  type ContentType,
} from '../domain/types'
import { formatHashtags, IG_CAPTION_LIMIT, IG_FIRST_COMMENT_LIMIT, IG_HASHTAG_LIMIT, parseHashtags } from '../lib/hashtags'
import { formatJalaliFromIso } from '../lib/jalaali'
import { occasionLabel } from '../lib/occasionLabel'
import { useI18n } from '../prefs/PrefsProvider'

const emptyForm = {
  title: '',
  contentType: 'reel' as ContentType,
  publishDate: '',
  windowStart: '10:00',
  windowEnd: '12:00',
  projectId: '',
  campaignId: '',
  occasionId: '',
  caption: '',
  hashtagText: '',
  firstComment: '',
  notes: '',
}

export function ContentPage() {
  const { t, lang } = useI18n()
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
  const [filterType, setFilterType] = useState('')
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(false)
  const [attachFor, setAttachFor] = useState<string | null>(null)
  const [remindMsg, setRemindMsg] = useState<string | null>(null)

  async function reload(id: string) {
    const year = new Date().getFullYear()
    const [contentRes, assetRes, projectRes, campaignRes, occRes, occNext] = await Promise.all([
      api.listContent(id),
      api.listAssets(id),
      api.listProjects(id),
      api.listCampaigns(id),
      api.listOccasions(id, { year }),
      api.listOccasions(id, { year: year + 1 }),
    ])
    setItems(contentRes.items || [])
    setAssets(assetRes.items || [])
    setProjects(projectRes.items || [])
    setCampaigns(campaignRes.items || [])
    const byId = new Map<string, OccasionDto>()
    for (const o of [...(occRes.items || []), ...(occNext.items || [])]) {
      const prev = byId.get(o.id)
      if (!prev || String(o.dateInYear) < String(prev.dateInYear)) byId.set(o.id, o)
    }
    setOccasions([...byId.values()])

    const map: Record<string, Array<AssetDto & { linkId: string }>> = {}
    await Promise.all(
      (contentRes.items || []).map(async (item) => {
        const res = await api.contentAssets(item.id)
        map[item.id] = res.items
      }),
    )
    setAttached(map)
    return {
      items: contentRes.items || [],
      projects: projectRes.items || [],
      occasions: [...byId.values()],
    }
  }

  function applyQuery(loaded: ContentDto[], pages: ProjectDto[], occs: OccasionDto[] = occasions) {
    const date = params.get('date')
    const edit = params.get('edit')
    const project = params.get('projectId')
    const occasion = params.get('occasionId')
    const campaign = params.get('campaignId')
    if (edit) {
      const item = loaded.find((i) => i.id === edit)
      if (item) startEdit(item)
      return
    }
    setForm((f) => {
      const next = { ...f }
      if (date) next.publishDate = date
      if (project) next.projectId = project
      if (campaign) next.campaignId = campaign
      if (occasion) next.occasionId = occasion
      else if (!f.occasionId && date) {
        const match = occs.find((o) => o.dateInYear === date)
        if (match) next.occasionId = match.id
      }
      if (!next.projectId && pages.length === 1) next.projectId = pages[0]!.id
      const page = pages.find((p) => p.id === next.projectId)
      if (page) {
        next.windowStart = page.windowStart || next.windowStart || '10:00'
        next.windowEnd = page.windowEnd || next.windowEnd || '12:00'
        next.hashtagText = next.hashtagText.trim() ? next.hashtagText : formatHashtags(page.hashtags)
      }
      return next
    })
  }

  useEffect(() => {
    if (!workspaceId) return
    void reload(workspaceId)
      .then(({ items: loaded, projects: pages, occasions: occs }) => applyQuery(loaded, pages, occs))
      .catch((e) => setError((e as Error).message))
  }, [workspaceId])

  useEffect(() => {
    const edit = params.get('edit')
    const date = params.get('date')
    const project = params.get('projectId')
    const occasion = params.get('occasionId')
    const campaign = params.get('campaignId')
    if (!edit && !date && !project && !occasion && !campaign) return
    applyQuery(items, projects)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.get('edit'), params.get('date'), params.get('projectId'), params.get('occasionId'), params.get('campaignId')])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return items
      .filter((item) => {
        if (filterProject && item.projectId !== filterProject) return false
        if (filterStatus && item.status !== filterStatus) return false
        if (filterType && item.contentType !== filterType) return false
        if (q) {
          const hay = `${item.title} ${item.caption || ''} ${item.notes || ''} ${item.hashtags.join(' ')}`.toLowerCase()
          if (!hay.includes(q)) return false
        }
        return true
      })
      .sort((a, b) => String(a.publishDate || '9999').localeCompare(String(b.publishDate || '9999')))
  }, [items, filterProject, filterStatus, filterType, query])

  const occasionOptions = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    return [...occasions]
      .filter((o) => o.dateInYear)
      .sort((a, b) => String(a.dateInYear).localeCompare(String(b.dateInYear)))
      .filter((o) => String(o.dateInYear) >= today || o.id === form.occasionId || o.dateInYear === form.publishDate)
  }, [occasions, form.occasionId, form.publishDate])

  const dateOccasions = useMemo(
    () => (form.publishDate ? occasions.filter((o) => o.dateInYear === form.publishDate) : []),
    [occasions, form.publishDate],
  )

  const selectedPage = projects.find((p) => p.id === form.projectId)
  const captionLen = form.caption.length
  const firstLen = form.firstComment.length
  const tagCount = parseHashtags(form.hashtagText).length
  const typeOptions = IG_CONTENT_TYPES.includes(form.contentType)
    ? IG_CONTENT_TYPES
    : [form.contentType, ...IG_CONTENT_TYPES]

  function patchForm(partial: Partial<typeof emptyForm>) {
    setForm((f) => ({ ...f, ...partial }))
  }

  function applyPageDefaults(projectId: string) {
    const page = projects.find((p) => p.id === projectId)
    if (!page) {
      patchForm({ projectId })
      return
    }
    setForm((f) => ({
      ...f,
      projectId,
      windowStart: page.windowStart || f.windowStart || '10:00',
      windowEnd: page.windowEnd || f.windowEnd || '12:00',
      hashtagText: f.hashtagText.trim() ? f.hashtagText : formatHashtags(page.hashtags),
    }))
  }

  function resetForm() {
    setForm({ ...emptyForm, projectId: projects.length === 1 ? projects[0]!.id : '' })
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
      firstComment: item.firstComment || '',
      notes: item.notes || '',
    })
    setError(null)
    setMsg(null)
  }

  function applyDate(date: string) {
    const matches = occasions.filter((o) => o.dateInYear === date)
    setForm((f) => ({
      ...f,
      publishDate: date,
      occasionId: f.occasionId || (matches.length === 1 ? matches[0]!.id : f.occasionId),
    }))
  }

  function applyOccasion(id: string) {
    const o = occasions.find((x) => x.id === id)
    setForm((f) => ({
      ...f,
      occasionId: id,
      publishDate: o?.dateInYear || f.publishDate,
    }))
  }

  async function save() {
    if (!workspaceId) return
    if (!form.title.trim()) {
      setError(t('content.needTitle'))
      return
    }
    const tags = parseHashtags(form.hashtagText)
    if (form.caption.length > IG_CAPTION_LIMIT) {
      setError(t('content.captionLimit', { n: IG_CAPTION_LIMIT }))
      return
    }
    if (tags.length > IG_HASHTAG_LIMIT) {
      setError(t('content.hashtagLimit', { n: IG_HASHTAG_LIMIT }))
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
      publishDate: form.publishDate || '',
      publishTime: form.windowStart || '',
      windowStart: form.windowStart || '',
      windowEnd: form.windowEnd || '',
      projectId: form.projectId || undefined,
      campaignId: form.campaignId || undefined,
      occasionId: form.occasionId || '',
      caption: form.caption.trim(),
      hashtags: tags,
      firstComment: form.firstComment.trim(),
      notes: form.notes.trim(),
    }
    try {
      if (editingId) {
        const res = await api.updateContent(editingId, body)
        setItems((prev) => prev.map((i) => (i.id === editingId ? res.item : i)))
        setMsg(t('content.updated'))
        resetForm()
      } else {
        const res = await api.createContent({ workspaceId, ...body })
        setItems((prev) => [res.item, ...prev.filter((i) => i.id !== res.item.id)])
        setMsg(t('content.saved'))
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

  async function detach(contentId: string, linkId: string) {
    try {
      await api.detachAsset(contentId, linkId)
      setAttached((prev) => ({
        ...prev,
        [contentId]: (prev[contentId] || []).filter((a) => a.linkId !== linkId),
      }))
    } catch (e) {
      setError((e as Error).message)
    }
  }

  async function duplicateItem(item: ContentDto) {
    try {
      const res = await api.duplicateContent(item.id)
      setItems((prev) => [res.item, ...prev.filter((i) => i.id !== res.item.id)])
      startEdit(res.item)
      setMsg(t('content.duplicated'))
    } catch (e) {
      setError((e as Error).message)
    }
  }

  async function removeItem(id: string) {
    if (!workspaceId || !window.confirm(t('content.confirmDelete'))) return
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
      setRemindMsg(t('content.reminders', { checked: res.checked, sent: res.sent }))
    } catch (e) {
      setRemindMsg((e as Error).message)
    }
  }

  const canRemind = session?.role === 'admin' || session?.role === 'manager'

  return (
    <div className="ops-page">
      <header className="ops-page-head">
        <div>
          <h1>{t('pages.contentTitle')}</h1>
          <p>{t('pages.contentSub')}</p>
        </div>
        <div className="form-actions">
          <Link to="/studio" className="btn btn-outline btn-sm">
            {t('content.studioCaption')}
          </Link>
          {canRemind && (
            <button type="button" className="btn btn-outline btn-sm" onClick={() => void runReminders()}>
              {t('content.checkReminders')}
            </button>
          )}
        </div>
      </header>
      {projects.length === 0 && (
        <div className="form-banner error">
          {t('content.needPage')}{' '}
          <Link to="/projects">{t('content.goPages')}</Link>
        </div>
      )}
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
          <h2 className="section-title">{editingId ? t('content.editTitle') : t('content.createTitle')}</h2>
          <div className="field">
            <label>{t('common.title')}</label>
            <input
              value={form.title}
              onChange={(e) => patchForm({ title: e.target.value })}
              placeholder={t('content.titlePh')}
            />
          </div>
          <div className="field">
            <label>{t('content.igType')}</label>
            <select
              value={form.contentType}
              onChange={(e) => patchForm({ contentType: e.target.value as ContentType })}
            >
              {typeOptions.map((k) => (
                <option key={k} value={k}>
                  {t(`type.${k}`)}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>{t('common.page')}</label>
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
            <label>{t('content.campaign')}</label>
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
            <label>{t('content.occasion')}</label>
            <select value={form.occasionId} onChange={(e) => applyOccasion(e.target.value)}>
              <option value="">{t('content.noOccasion')}</option>
              {occasionOptions.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.dateInYear} — {occasionLabel(o, lang)}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>{t('content.publishDate')}</label>
            <input type="date" value={form.publishDate} onChange={(e) => applyDate(e.target.value)} />
            {form.publishDate && (
              <span className="field-hint">{t('content.jalali', { date: formatJalaliFromIso(form.publishDate) })}</span>
            )}
            {dateOccasions.length > 0 && (
              <div className="chip-row" style={{ marginTop: '0.4rem' }}>
                {dateOccasions.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    className={`chip ${form.occasionId === o.id ? 'active' : ''}`}
                    onClick={() => applyOccasion(o.id)}
                  >
                    {occasionLabel(o, lang)}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="ops-filters" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <div className="field" style={{ margin: 0 }}>
              <label>{t('common.fromHour')}</label>
              <input
                type="time"
                value={form.windowStart}
                onChange={(e) => patchForm({ windowStart: e.target.value })}
              />
            </div>
            <div className="field" style={{ margin: 0 }}>
              <label>{t('common.toHour')}</label>
              <input type="time" value={form.windowEnd} onChange={(e) => patchForm({ windowEnd: e.target.value })} />
            </div>
          </div>
          <div className="field">
            <label>{t('content.caption')}</label>
            <textarea
              value={form.caption}
              onChange={(e) => patchForm({ caption: e.target.value })}
              placeholder={t('content.captionPh')}
            />
            <span className={`field-hint ${captionLen > IG_CAPTION_LIMIT ? 'warn' : ''}`}>
              {t('content.captionCount', { n: captionLen, max: IG_CAPTION_LIMIT })}
            </span>
          </div>
          <div className="field">
            <label>{t('content.hashtags')}</label>
            <input
              value={form.hashtagText}
              onChange={(e) => patchForm({ hashtagText: e.target.value })}
              placeholder="#cafe #tehran"
              dir="ltr"
            />
            <span className={`field-hint ${tagCount > IG_HASHTAG_LIMIT ? 'warn' : ''}`}>
              {t('content.hashtagHint', { n: tagCount, max: IG_HASHTAG_LIMIT })}
            </span>
          </div>
          <div className="field">
            <label>{t('content.firstComment')}</label>
            <textarea
              value={form.firstComment}
              onChange={(e) => patchForm({ firstComment: e.target.value })}
              placeholder="#more #tags"
            />
            <span className={`field-hint ${firstLen > IG_FIRST_COMMENT_LIMIT ? 'warn' : ''}`}>
              {t('content.firstHint', { n: firstLen, max: IG_FIRST_COMMENT_LIMIT })}
            </span>
          </div>
          <div className="field">
            <label>{t('content.notes')}</label>
            <textarea
              value={form.notes}
              onChange={(e) => patchForm({ notes: e.target.value })}
              placeholder={t('content.notesPh')}
            />
          </div>
          <InstagramPreview
            handle={selectedPage?.handle || selectedPage?.clientName || selectedPage?.name}
            caption={form.caption}
            hashtags={parseHashtags(form.hashtagText)}
            firstComment={form.firstComment}
            contentType={form.contentType}
          />
          <p className="section-sub">{t('content.remindHint')}</p>
          <div className="form-actions">
            <button type="submit" className="btn btn-solid" disabled={busy}>
              {busy ? t('common.saving') : editingId ? t('content.update') : t('content.save')}
            </button>
            {editingId && (
              <button type="button" className="btn btn-outline" disabled={busy} onClick={resetForm}>
                {t('common.cancel')}
              </button>
            )}
          </div>
        </form>

        <section className="panel panel-pad">
          <h2 className="section-title">{t('content.listTitle')}</h2>
          <div className="ops-filters" style={{ gridTemplateColumns: '1fr 1fr', marginBottom: '0.65rem' }}>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('content.searchPh')} />
            <select value={filterType} onChange={(e) => setFilterType(e.target.value)}>
              <option value="">{t('content.allTypes')}</option>
              {IG_CONTENT_TYPES.map((typeId) => (
                <option key={typeId} value={typeId}>
                  {t(`type.${typeId}`)}
                </option>
              ))}
            </select>
          </div>
          <div className="ops-filters" style={{ gridTemplateColumns: '1fr 1fr', marginBottom: '0.85rem' }}>
            <select value={filterProject} onChange={(e) => setFilterProject(e.target.value)}>
              <option value="">{t('cal.allPages')}</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
              <option value="">{t('content.allStatuses')}</option>
              {CONTENT_STATUS_FLOW.map((s) => (
                <option key={s} value={s}>
                  {t(`status.${s}`)}
                </option>
              ))}
            </select>
          </div>
          <div className="page-list">
            {filtered.length === 0 && <p className="section-sub">{t('common.none')}</p>}
            {filtered.map((item) => {
              const copyCaption = [item.caption, formatHashtags(item.hashtags)].filter(Boolean).join('\n\n')
              return (
                <article key={item.id} className="list-item content-card">
                  <div className="list-meta">
                    <h3>{item.title}</h3>
                    <span className="meta-badge">
                      {t(`status.${item.status as ContentStatus}`)}
                    </span>
                  </div>
                  <p>
                    {t(`type.${item.contentType as ContentType}`)}
                    {item.projectId ? ` · ${projects.find((p) => p.id === item.projectId)?.name || t('common.page')}` : ''}
                    {item.occasionId
                      ? ` · ${(() => {
                          const o = occasions.find((x) => x.id === item.occasionId)
                          return o ? occasionLabel(o, lang) : t('content.occasion')
                        })()}`
                      : ''}
                    {item.publishDate
                      ? lang === 'fa'
                        ? ` · ${item.publishDate} (${formatJalaliFromIso(item.publishDate)})`
                        : ` · ${item.publishDate}`
                      : ''}
                    {item.windowStart || item.windowEnd
                      ? ` · ${item.windowStart || '—'} ${t('common.until')} ${item.windowEnd || '—'}`
                      : item.publishTime
                        ? ` · ${item.publishTime}`
                        : ''}
                    {item.remindedAt ? ` · ${t('content.reminded')}` : ''}
                  </p>
                  {item.caption && <p className="pre" style={{ marginTop: '0.35rem' }}>{item.caption}</p>}
                  {item.hashtags?.length > 0 && (
                    <div className="chip-row">
                      {item.hashtags.map((tag) => (
                        <span className="tag" key={tag}>
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                  {item.firstComment && (
                    <p className="section-sub">{t('content.firstCommentLine', { text: item.firstComment })}</p>
                  )}
                  <div className="chip-row">
                    {(attached[item.id] || []).map((a) => (
                      <button
                        type="button"
                        className="tag tag-btn"
                        key={a.linkId}
                        onClick={() => void detach(item.id, a.linkId)}
                        title={t('content.detach')}
                      >
                        {a.type}: {a.filename} ×
                      </button>
                    ))}
                  </div>
                  <div className="form-actions">
                    <select
                      value={item.status}
                      onChange={(e) => void moveStatus(item, e.target.value as ContentStatus)}
                    >
                      {CONTENT_STATUS_FLOW.map((s) => (
                        <option key={s} value={s}>
                          {t(`status.${s}`)}
                        </option>
                      ))}
                    </select>
                    {item.status !== 'published' && (
                      <button
                        type="button"
                        className="btn btn-solid btn-sm"
                        onClick={() => void moveStatus(item, 'published')}
                      >
                        {t('dash.markPublished')}
                      </button>
                    )}
                  </div>
                  <div className="form-actions">
                    <button type="button" className="btn btn-outline btn-sm" onClick={() => startEdit(item)}>
                      {t('common.edit')}
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={() => void duplicateItem(item)}
                    >
                      {t('content.duplicate')}
                    </button>
                    {copyCaption && <CopyButton text={copyCaption} label={t('content.copyCaption')} />}
                    {item.firstComment && <CopyButton text={item.firstComment} label={t('content.copyFirst')} />}
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={() => setAttachFor(attachFor === item.id ? null : item.id)}
                    >
                      {t('content.addFile')}
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={() => void removeItem(item.id)}
                    >
                      {t('common.delete')}
                    </button>
                  </div>
                  {attachFor === item.id && (
                    <div className="attach-panel">
                      {assets.length === 0 && <p className="section-sub">{t('content.noFiles')}</p>}
                      {assets
                        .filter((asset) => !(attached[item.id] || []).some((a) => a.id === asset.id))
                        .map((asset) => (
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
