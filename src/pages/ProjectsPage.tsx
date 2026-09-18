import { useEffect, useState } from 'react'
import { api, type ProjectDto } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { normalizeHandle } from '../lib/handle'

const emptyForm = { name: '', handle: '', niche: '', audience: '', voice: '' }

export function ProjectsPage() {
  const { workspaceId } = useAuth()
  const [items, setItems] = useState<ProjectDto[]>([])
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function reload() {
    if (!workspaceId) return
    const res = await api.listProjects(workspaceId)
    setItems(res.items || [])
  }

  useEffect(() => {
    if (!workspaceId) return
    void reload().catch((e) => setError((e as Error).message))
  }, [workspaceId])

  function resetForm() {
    setForm(emptyForm)
    setEditingId(null)
  }

  async function save() {
    if (!workspaceId) {
      setError('وارد حساب نشده‌اید')
      return
    }
    if (!form.name.trim()) {
      setError('نام پیج را بنویس')
      return
    }
    setBusy(true)
    setError(null)
    setMsg(null)
    const handle = normalizeHandle(form.handle) || undefined
    const body = {
      name: form.name.trim(),
      handle,
      clientName: handle,
      niche: form.niche.trim() || undefined,
      audience: form.audience.trim() || undefined,
      voice: form.voice.trim() || undefined,
    }
    try {
      if (editingId) {
        const res = await api.updateProject(editingId, body)
        setItems((prev) => prev.map((p) => (p.id === editingId ? res.item : p)))
        setMsg('پیج به‌روزرسانی شد')
        resetForm()
      } else {
        const res = await api.createProject({ workspaceId, ...body })
        setItems((prev) => [res.item, ...prev.filter((p) => p.id !== res.item.id)])
        setMsg('پیج ذخیره شد')
        resetForm()
      }
      await reload()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  function startEdit(p: ProjectDto) {
    setEditingId(p.id)
    setForm({
      name: p.name || '',
      handle: String(p.handle || p.clientName || '').replace(/^@/, ''),
      niche: p.niche || '',
      audience: p.audience || '',
      voice: p.voice || '',
    })
    setError(null)
    setMsg(null)
  }

  async function remove(id: string) {
    if (!window.confirm('این پیج حذف شود؟')) return
    setError(null)
    try {
      await api.deleteProject(id)
      setItems((prev) => prev.filter((p) => p.id !== id))
      if (editingId === id) resetForm()
      setMsg('پیج حذف شد')
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
      {error && <div className="form-banner error">{error}</div>}
      {msg && <div className="form-banner ok">{msg}</div>}
      <div className="ops-split">
        <form
          className="panel panel-pad"
          onSubmit={(e) => {
            e.preventDefault()
            void save()
          }}
        >
          <h2 className="section-title">{editingId ? 'ویرایش پیج' : 'افزودن پیج'}</h2>
          <div className="field">
            <label htmlFor="prj-name">نام پیج</label>
            <input
              id="prj-name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="نام پیج اینستاگرام"
              disabled={busy}
            />
          </div>
          <div className="field">
            <label htmlFor="prj-handle">آیدی اینستاگرام (@)</label>
            <input
              id="prj-handle"
              value={form.handle}
              onChange={(e) => setForm({ ...form, handle: e.target.value })}
              placeholder="instagram_handle"
              disabled={busy}
              dir="ltr"
            />
          </div>
          <div className="field">
            <label htmlFor="prj-niche">حوزه / نیچ</label>
            <input
              id="prj-niche"
              value={form.niche}
              onChange={(e) => setForm({ ...form, niche: e.target.value })}
              placeholder="کافه، زیبایی، آموزش..."
              disabled={busy}
            />
          </div>
          <div className="field">
            <label htmlFor="prj-audience">مخاطب هدف</label>
            <input
              id="prj-audience"
              value={form.audience}
              onChange={(e) => setForm({ ...form, audience: e.target.value })}
              placeholder="مثلاً جوانان ۲۰–۳۵"
              disabled={busy}
            />
          </div>
          <div className="field">
            <label htmlFor="prj-voice">صدای برند</label>
            <textarea
              id="prj-voice"
              value={form.voice}
              onChange={(e) => setForm({ ...form, voice: e.target.value })}
              placeholder="صمیمی، آموزشی، لوکس..."
              disabled={busy}
            />
          </div>
          <div className="form-actions">
            <button type="submit" className="btn btn-solid" disabled={busy}>
              {busy ? 'در حال ذخیره...' : editingId ? 'به‌روزرسانی پیج' : 'ذخیره پیج'}
            </button>
            {editingId && (
              <button type="button" className="btn btn-outline" disabled={busy} onClick={resetForm}>
                انصراف
              </button>
            )}
          </div>
        </form>
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
                <div className="form-actions">
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => startEdit(p)}>
                    ویرایش
                  </button>
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => void remove(p.id)}>
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
