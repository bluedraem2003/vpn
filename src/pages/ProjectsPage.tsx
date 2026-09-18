import { useEffect, useState } from 'react'
import { api, type ProjectDto } from '../api/client'
import { useAuth } from '../auth/AuthContext'

export function ProjectsPage() {
  const { workspaceId } = useAuth()
  const [items, setItems] = useState<ProjectDto[]>([])
  const [name, setName] = useState('')
  const [handle, setHandle] = useState('')
  const [niche, setNiche] = useState('')
  const [audience, setAudience] = useState('')
  const [voice, setVoice] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function reload() {
    if (!workspaceId) return
    setItems((await api.listProjects(workspaceId)).items)
  }

  useEffect(() => {
    void reload().catch((e) => setError((e as Error).message))
  }, [workspaceId])

  async function create() {
    if (!workspaceId) return
    if (!name.trim()) {
      setError('نام پیج را بنویس')
      return
    }
    setBusy(true)
    setError(null)
    setMsg(null)
    try {
      await api.createProject({
        workspaceId,
        name: name.trim(),
        handle: handle.trim() || undefined,
        clientName: handle.trim() || undefined,
        niche: niche.trim() || undefined,
        audience: audience.trim() || undefined,
        voice: voice.trim() || undefined,
      })
      setName('')
      setHandle('')
      setNiche('')
      setAudience('')
      setVoice('')
      setMsg('پیج ذخیره شد')
      await reload()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function remove(id: string) {
    setError(null)
    try {
      await api.deleteProject(id)
      await reload()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <div className="ops-page">
      <header className="ops-page-head">
        <div>
          <h1>پیج‌ها</h1>
          <p>پیج اینستاگرام خودت را اینجا اضافه کن — روی سرور ذخیره می‌شود و در محتوا/مناسبت‌ها قابل انتخاب است</p>
        </div>
      </header>
      {error && (
        <div className="panel panel-pad" style={{ marginBottom: '1rem' }}>
          <p className="section-sub">{error}</p>
        </div>
      )}
      {msg && (
        <div className="panel panel-pad" style={{ marginBottom: '1rem' }}>
          <p className="section-sub">{msg}</p>
        </div>
      )}
      <div className="ops-split">
        <section className="panel panel-pad">
          <h2 className="section-title">افزودن پیج</h2>
          <div className="field">
            <label>نام پیج</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="نام پیج اینستاگرام" />
          </div>
          <div className="field">
            <label>آیدی اینستاگرام (@)</label>
            <input value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="instagram_handle" />
          </div>
          <div className="field">
            <label>حوزه / نیچ</label>
            <input value={niche} onChange={(e) => setNiche(e.target.value)} placeholder="کافه، زیبایی، آموزش..." />
          </div>
          <div className="field">
            <label>مخاطب هدف</label>
            <input value={audience} onChange={(e) => setAudience(e.target.value)} placeholder="مثلاً جوانان ۲۰–۳۵" />
          </div>
          <div className="field">
            <label>صدای برند</label>
            <textarea value={voice} onChange={(e) => setVoice(e.target.value)} placeholder="صمیمی، آموزشی، لوکس..." />
          </div>
          <button type="button" className="btn btn-solid" disabled={busy} onClick={() => void create()}>
            {busy ? 'در حال ذخیره...' : 'ذخیره پیج'}
          </button>
        </section>
        <section className="panel panel-pad">
          <h2 className="section-title">پیج‌های من</h2>
          <div className="page-list">
            {items.length === 0 && (
              <div className="empty">
                <strong>هنوز پیجی نیست</strong>
                از فرم روبه‌رو پیج اینستاگرامت را اضافه کن.
              </div>
            )}
            {items.map((p) => (
              <article key={p.id} className="list-item">
                <h3>{p.name}</h3>
                {(p.handle || p.clientName) && <p>@{String(p.handle || p.clientName).replace(/^@/, '')}</p>}
                {p.niche && <p>حوزه: {p.niche}</p>}
                {p.audience && <p>مخاطب: {p.audience}</p>}
                {p.voice && <p>صدا: {p.voice}</p>}
                <button type="button" className="btn btn-outline btn-sm" onClick={() => void remove(p.id)}>
                  حذف
                </button>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
