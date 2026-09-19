import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, type CampaignDto, type ProjectDto } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { useI18n } from '../prefs/PrefsProvider'

export function CampaignsPage() {
  const { t } = useI18n()
  const { workspaceId } = useAuth()
  const [items, setItems] = useState<CampaignDto[]>([])
  const [projects, setProjects] = useState<ProjectDto[]>([])
  const [name, setName] = useState('')
  const [goal, setGoal] = useState('')
  const [projectId, setProjectId] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function reload() {
    if (!workspaceId) return
    const [c, p] = await Promise.all([api.listCampaigns(workspaceId), api.listProjects(workspaceId)])
    setItems(c.items || [])
    setProjects(p.items || [])
    if (!projectId && p.items?.length === 1) setProjectId(p.items[0].id)
  }

  useEffect(() => {
    void reload().catch((e) => setError((e as Error).message))
  }, [workspaceId])

  async function create() {
    if (!workspaceId) return
    if (!name.trim()) {
      setError('نام کمپین را بنویس')
      return
    }
    setBusy(true)
    setError(null)
    setMsg(null)
    try {
      const res = await api.createCampaign({
        workspaceId,
        name: name.trim(),
        goal: goal.trim() || undefined,
        projectId: projectId || undefined,
        platforms: ['instagram'],
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      })
      setItems((prev) => [res.item, ...prev.filter((i) => i.id !== res.item.id)])
      setName('')
      setGoal('')
      setMsg('کمپین ذخیره شد')
      await reload()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function remove(id: string) {
    if (!window.confirm('این کمپین حذف شود؟')) return
    try {
      await api.deleteCampaign(id)
      setItems((prev) => prev.filter((i) => i.id !== id))
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <div className="ops-page">
      <header className="ops-page-head">
        <div>
          <h1>{t('pages.campaignsTitle')}</h1>
          <p>{t('pages.campaignsSub')}</p>
        </div>
      </header>
      {error && <div className="form-banner error">{error}</div>}
      {msg && <div className="form-banner ok">{msg}</div>}
      <div className="ops-split">
        <form
          className="panel panel-pad"
          onSubmit={(e) => {
            e.preventDefault()
            void create()
          }}
        >
          <h2 className="section-title">کمپین جدید</h2>
          <div className="field">
            <label>نام</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="نام کمپین" />
          </div>
          <div className="field">
            <label>هدف</label>
            <input value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="مثلاً افزایش فروش" />
          </div>
          <div className="field">
            <label>پیج</label>
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
            <label>شروع</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div className="field">
            <label>پایان</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
          <button type="submit" className="btn btn-solid" disabled={busy}>
            {busy ? 'در حال ذخیره...' : 'ذخیره'}
          </button>
        </form>
        <section className="panel panel-pad">
          <h2 className="section-title">لیست کمپین‌ها</h2>
          <div className="page-list">
            {items.length === 0 && <p className="section-sub">کمپینی نیست</p>}
            {items.map((c) => (
              <article key={c.id} className="list-item">
                <div className="list-meta">
                  <h3>{c.name}</h3>
                  <span className="meta-badge">{c.status}</span>
                </div>
                {c.goal && <p>{c.goal}</p>}
                <p>
                  {c.startDate || '—'} تا {c.endDate || '—'}
                  {c.projectId ? ` · ${projects.find((p) => p.id === c.projectId)?.name || ''}` : ''}
                </p>
                <div className="form-actions">
                  <Link
                    className="btn btn-outline btn-sm"
                    to={`/content?campaignId=${c.id}${c.projectId ? `&projectId=${c.projectId}` : ''}`}
                  >
                    برنامه‌ریزی محتوا
                  </Link>
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => void remove(c.id)}>
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
