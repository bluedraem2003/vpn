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
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function reload() {
    if (!workspaceId) return
    const res = await api.listIdeas(workspaceId)
    setItems(res.items || [])
  }

  useEffect(() => {
    void reload().catch((e) => setError((e as Error).message))
  }, [workspaceId])

  async function create() {
    if (!workspaceId) return
    if (!title.trim()) {
      setError('عنوان ایده را بنویس')
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
      setMsg('ایده ذخیره شد')
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
      await api.convertIdea(id)
      await reload()
      navigate('/content')
    } catch (e) {
      setError((e as Error).message)
    }
  }

  async function remove(id: string) {
    if (!window.confirm('این ایده حذف شود؟')) return
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
          <h1>ایده‌ها</h1>
          <p>بانک ایده با تبدیل مستقیم به محتوا</p>
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
          <h2 className="section-title">ایده جدید</h2>
          <div className="field">
            <label>عنوان</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="عنوان ایده" />
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
          <button type="submit" className="btn btn-solid" disabled={busy}>
            {busy ? 'در حال ذخیره...' : 'ذخیره ایده'}
          </button>
        </form>
        <section className="panel panel-pad">
          <h2 className="section-title">لیست</h2>
          <div className="page-list">
            {items.length === 0 && <p className="section-sub">ایده‌ای نیست</p>}
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
                      تبدیل به محتوا
                    </button>
                  )}
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => void remove(idea.id)}>
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
