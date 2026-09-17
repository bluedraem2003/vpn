import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, type IdeaDto } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { CONTENT_TYPE_LABELS, type ContentType } from '../domain/types'

export function IdeasPage() {
  const { workspaceId } = useAuth()
  const navigate = useNavigate()
  const [items, setItems] = useState<IdeaDto[]>([])
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [contentType, setContentType] = useState<ContentType>('reel')
  const [error, setError] = useState<string | null>(null)

  async function reload() {
    if (!workspaceId) return
    const res = await api.listIdeas(workspaceId)
    setItems(res.items)
  }

  useEffect(() => {
    void reload().catch((e) => setError((e as Error).message))
  }, [workspaceId])

  async function create() {
    if (!workspaceId || !title.trim()) return
    await api.createIdea({
      workspaceId,
      title: title.trim(),
      description,
      contentType,
      platforms: ['instagram'],
      priority: 'medium',
    })
    setTitle('')
    setDescription('')
    await reload()
  }

  async function convert(id: string) {
    const res = await api.convertIdea(id)
    await reload()
    navigate('/content')
    return res
  }

  return (
    <div className="ops-page">
      <header className="ops-page-head">
        <div>
          <h1>ایده‌ها</h1>
          <p>بانک ایده با تبدیل مستقیم به Content Item</p>
        </div>
      </header>
      {error && <p className="section-sub">{error}</p>}
      <div className="ops-split" style={{ gridTemplateColumns: '0.9fr 1.1fr' }}>
        <section className="panel panel-pad">
          <h2 className="section-title">ایده جدید</h2>
          <div className="field">
            <label>عنوان</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="field">
            <label>توضیح</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="field">
            <label>نوع پیشنهادی</label>
            <select value={contentType} onChange={(e) => setContentType(e.target.value as ContentType)}>
              {Object.entries(CONTENT_TYPE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <button type="button" className="btn btn-solid" onClick={() => void create()}>
            ذخیره ایده
          </button>
        </section>
        <section className="panel panel-pad">
          <h2 className="section-title">لیست</h2>
          <div className="page-list">
            {items.map((idea) => (
              <article key={idea.id} className="list-item">
                <div className="list-meta">
                  <h3>{idea.title}</h3>
                  <span className="meta-badge">{idea.priority}</span>
                </div>
                {idea.description && <p>{idea.description}</p>}
                <div className="form-actions">
                  {idea.convertedContentId ? (
                    <span className="meta-badge">تبدیل‌شده</span>
                  ) : (
                    <button type="button" className="btn btn-solid btn-sm" onClick={() => void convert(idea.id)}>
                      Convert to Content
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => void api.deleteIdea(idea.id).then(reload)}
                  >
                    حذف
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
