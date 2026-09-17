import { useEffect, useState } from 'react'
import { api, type CampaignDto, type ProjectDto } from '../api/client'
import { useAuth } from '../auth/AuthContext'

export function CampaignsPage() {
  const { workspaceId } = useAuth()
  const [items, setItems] = useState<CampaignDto[]>([])
  const [projects, setProjects] = useState<ProjectDto[]>([])
  const [name, setName] = useState('')
  const [goal, setGoal] = useState('')
  const [projectId, setProjectId] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function reload() {
    if (!workspaceId) return
    const [c, p] = await Promise.all([api.listCampaigns(workspaceId), api.listProjects(workspaceId)])
    setItems(c.items)
    setProjects(p.items)
  }

  useEffect(() => {
    void reload().catch((e) => setError((e as Error).message))
  }, [workspaceId])

  async function create() {
    if (!workspaceId || !name.trim()) return
    await api.createCampaign({
      workspaceId,
      name: name.trim(),
      goal,
      projectId: projectId || undefined,
      platforms: ['instagram'],
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    })
    setName('')
    setGoal('')
    await reload()
  }

  return (
    <div className="ops-page">
      <header className="ops-page-head">
        <div>
          <h1>کمپین‌ها</h1>
          <p>بازه‌ها و اهداف کمپین محتوایی</p>
        </div>
      </header>
      {error && <p className="section-sub">{error}</p>}
      <div className="ops-split">
        <section className="panel panel-pad">
          <h2 className="section-title">کمپین جدید</h2>
          <div className="field">
            <label>نام</label>
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="field">
            <label>هدف</label>
            <input value={goal} onChange={(e) => setGoal(e.target.value)} />
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
            <label>شروع</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div className="field">
            <label>پایان</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
          <button type="button" className="btn btn-solid" onClick={() => void create()}>
            ذخیره
          </button>
        </section>
        <section className="panel panel-pad">
          <h2 className="section-title">لیست کمپین‌ها</h2>
          <div className="page-list">
            {items.map((c) => (
              <article key={c.id} className="list-item">
                <div className="list-meta">
                  <h3>{c.name}</h3>
                  <span className="meta-badge">{c.status}</span>
                </div>
                {c.goal && <p>{c.goal}</p>}
                <p>
                  {c.startDate || '—'} تا {c.endDate || '—'}
                </p>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => void api.deleteCampaign(c.id).then(reload)}
                >
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
