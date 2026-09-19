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
      setError(t('campaigns.needName'))
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
      setMsg(t('campaigns.saved'))
      await reload()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function remove(id: string) {
    if (!window.confirm(t('campaigns.confirmDelete'))) return
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
          <p className="ops-kicker">{t('nav.campaigns')}</p>
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
          <h2 className="section-title">{t('campaigns.newTitle')}</h2>
          <div className="field">
            <label>{t('campaigns.name')}</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('campaigns.namePh')} />
          </div>
          <div className="field">
            <label>{t('campaigns.goal')}</label>
            <input value={goal} onChange={(e) => setGoal(e.target.value)} placeholder={t('campaigns.goalPh')} />
          </div>
          <div className="field">
            <label>{t('campaigns.page')}</label>
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
            <label>{t('campaigns.start')}</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div className="field">
            <label>{t('campaigns.end')}</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
          <button type="submit" className="btn btn-solid" disabled={busy}>
            {busy ? t('common.saving') : t('common.save')}
          </button>
        </form>
        <section className="panel panel-pad">
          <h2 className="section-title">{t('campaigns.listTitle')}</h2>
          <div className="page-list">
            {items.length === 0 && <p className="section-sub">{t('campaigns.empty')}</p>}
            {items.map((c) => (
              <article key={c.id} className="list-item">
                <div className="list-meta">
                  <h3>{c.name}</h3>
                  <span className="meta-badge">{c.status}</span>
                </div>
                {c.goal && <p>{c.goal}</p>}
                <p>
                  {t('campaigns.range', { start: c.startDate || '—', end: c.endDate || '—' })}
                  {c.projectId ? ` · ${projects.find((p) => p.id === c.projectId)?.name || ''}` : ''}
                </p>
                <div className="form-actions">
                  <Link
                    className="btn btn-outline btn-sm"
                    to={`/content?campaignId=${c.id}${c.projectId ? `&projectId=${c.projectId}` : ''}`}
                  >
                    {t('campaigns.planContent')}
                  </Link>
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => void remove(c.id)}>
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
