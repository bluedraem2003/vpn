import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, type IdeaDto, type ProjectDto } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { type ContentType } from '../domain/types'
import { useI18n } from '../prefs/PrefsProvider'

export function IdeasPage() {
  const { t } = useI18n()
  const { workspaceId } = useAuth()
  const navigate = useNavigate()
  const [items, setItems] = useState<IdeaDto[]>([])
  const [projects, setProjects] = useState<ProjectDto[]>([])
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [contentType, setContentType] = useState<ContentType>('reel')
  const [projectId, setProjectId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function reload() {
    if (!workspaceId) return
    const [ideas, pages] = await Promise.all([api.listIdeas(workspaceId), api.listProjects(workspaceId)])
    setItems(ideas.items || [])
    setProjects(pages.items || [])
    if (!projectId && pages.items?.length === 1) setProjectId(pages.items[0]!.id)
  }

  useEffect(() => {
    void reload().catch((e) => setError((e as Error).message))
  }, [workspaceId])

  async function create() {
    if (!workspaceId) return
    if (!title.trim()) {
      setError(t('ideas.needTitle'))
      return
    }
    setBusy(true)
    setError(null)
    setMsg(null)
    try {
      const res = await api.createIdea({
        workspaceId,
        title: title.trim(),
        description: description.trim() || undefined,
        contentType,
        platforms: ['instagram'],
        priority: 'medium',
      })
      setItems((prev) => [res.item, ...prev.filter((i) => i.id !== res.item.id)])
      setTitle('')
      setDescription('')
      setMsg(t('ideas.saved'))
      await reload()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function convert(id: string) {
    setError(null)
    try {
      const res = await api.convertIdea(id, projectId ? { projectId } : undefined)
      await reload()
      navigate(`/content?edit=${res.contentId}`)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  async function remove(id: string) {
    if (!window.confirm(t('ideas.confirmDelete'))) return
    try {
      await api.deleteIdea(id)
      setItems((prev) => prev.filter((i) => i.id !== id))
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <div className="ops-page">
      <header className="ops-page-head">
        <div>
          <h1>{t('pages.ideasTitle')}</h1>
          <p>{t('pages.ideasSub')}</p>
        </div>
      </header>
      {error && <div className="form-banner error">{error}</div>}
      {msg && <div className="form-banner ok">{msg}</div>}
      <div className="ops-split" style={{ gridTemplateColumns: '0.9fr 1.1fr' }}>
        <form
          className="panel panel-pad"
          onSubmit={(e) => {
            e.preventDefault()
            void create()
          }}
        >
          <h2 className="section-title">{t('ideas.newTitle')}</h2>
          <div className="field">
            <label>{t('ideas.title')}</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('ideas.titlePh')} />
          </div>
          <div className="field">
            <label>{t('ideas.desc')}</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="field">
            <label>{t('ideas.suggestedType')}</label>
            <select value={contentType} onChange={(e) => setContentType(e.target.value as ContentType)}>
              {(['reel', 'post', 'carousel', 'story'] as ContentType[]).map((typeId) => (
                  <option key={typeId} value={typeId}>
                    {t(`type.${typeId}`)}
                  </option>
                ))}
            </select>
          </div>
          <div className="field">
            <label>{t('ideas.page')}</label>
            <select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
              <option value="">—</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="btn btn-solid" disabled={busy}>
            {busy ? t('common.saving') : t('ideas.save')}
          </button>
        </form>
        <section className="panel panel-pad">
          <h2 className="section-title">{t('ideas.listTitle')}</h2>
          <div className="page-list">
            {items.length === 0 && <p className="section-sub">{t('ideas.empty')}</p>}
            {items.map((idea) => (
              <article key={idea.id} className="list-item">
                <div className="list-meta">
                  <h3>{idea.title}</h3>
                  <span className="meta-badge">{idea.priority}</span>
                </div>
                {idea.description && <p>{idea.description}</p>}
                <div className="form-actions">
                  {idea.convertedContentId ? (
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={() => navigate(`/content?edit=${idea.convertedContentId}`)}
                    >
                      {t('ideas.openContent')}
                    </button>
                  ) : (
                    <button type="button" className="btn btn-solid btn-sm" onClick={() => void convert(idea.id)}>
                      {t('ideas.convert')}
                    </button>
                  )}
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => void remove(idea.id)}>
                    {t('common.delete')}
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
