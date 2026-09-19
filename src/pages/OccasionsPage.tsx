import { useEffect, useMemo, useState } from 'react'
import { localToday } from '../lib/dates'
import { Link } from 'react-router-dom'
import { api, type OccasionDto, type ProjectDto } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { occasionLabel } from '../lib/occasionLabel'
import { occasionHint } from '../lib/occasionSpan'
import { useI18n } from '../prefs/PrefsProvider'

export function OccasionsPage() {
  const { t, lang } = useI18n()
  const { workspaceId } = useAuth()
  const [items, setItems] = useState<OccasionDto[]>([])
  const [projects, setProjects] = useState<ProjectDto[]>([])
  const [linkedIds, setLinkedIds] = useState<Set<string>>(new Set())
  const [region, setRegion] = useState<'all' | 'ir' | 'global' | 'custom'>('all')
  const [fit, setFit] = useState<'all' | 'content'>('content')
  const [projectId, setProjectId] = useState('')
  const [year, setYear] = useState(new Date().getFullYear())
  const [error, setError] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [customName, setCustomName] = useState('')
  const [customCal, setCustomCal] = useState<'jalali' | 'gregorian'>('jalali')
  const [customMonth, setCustomMonth] = useState('1')
  const [customDay, setCustomDay] = useState('1')
  const [busy, setBusy] = useState(false)

  async function reload() {
    if (!workspaceId) return
    const [all, proj] = await Promise.all([
      api.listOccasions(workspaceId, { region: region === 'all' ? undefined : region, year }),
      api.listProjects(workspaceId),
    ])
    setItems(all.items || [])
    setProjects(proj.items || [])
    if (projectId) {
      const linkedRes = await api.listOccasions(workspaceId, { projectId, year })
      setLinkedIds(new Set((linkedRes.items || []).map((i) => i.id)))
    } else {
      setLinkedIds(new Set())
    }
  }

  useEffect(() => {
    if (!workspaceId) return
    void reload().catch((e) => setError((e as Error).message))
  }, [workspaceId, region, year, projectId])

  const visible = useMemo(() => {
    return [...items]
      .filter((o) => (fit === 'content' ? (o.priority || 0) >= 3 || Boolean(o.custom) : true))
      .sort((a, b) => {
        if (projectId) {
          const al = linkedIds.has(a.id) ? 0 : 1
          const bl = linkedIds.has(b.id) ? 0 : 1
          if (al !== bl) return al - bl
        }
        const dateA = String(a.dateInYear || `${a.month}-${String(a.day).padStart(2, '0')}`)
        const dateB = String(b.dateInYear || `${b.month}-${String(b.day).padStart(2, '0')}`)
        return dateA.localeCompare(dateB)
      })
  }, [items, fit, linkedIds, projectId])

  const upcoming = useMemo(() => {
    const today = localToday()
    return visible
      .filter((o) => o.dateInYear && o.dateInYear >= today)
      .slice(0, 12)
  }, [visible])

  async function toggleLink(occasionId: string) {
    if (!projectId) {
      setError(t('occ.pickFirst'))
      return
    }
    setError(null)
    setMsg(null)
    try {
      if (linkedIds.has(occasionId)) {
        await api.unlinkOccasionFromProject(projectId, occasionId)
        setLinkedIds((prev) => {
          const next = new Set(prev)
          next.delete(occasionId)
          return next
        })
        setMsg(t('occ.unlinked'))
      } else {
        await api.linkOccasionToProject(projectId, occasionId)
        setLinkedIds((prev) => new Set(prev).add(occasionId))
        setMsg(t('occ.linked'))
      }
      await reload()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  async function addCustom() {
    if (!workspaceId) return
    if (!customName.trim()) {
      setError(t('occ.needName'))
      return
    }
    setBusy(true)
    setError(null)
    setMsg(null)
    try {
      await api.createOccasion({
        workspaceId,
        nameFa: customName.trim(),
        calendar: customCal,
        month: Number(customMonth),
        day: Number(customDay),
        projectId: projectId || undefined,
      })
      setCustomName('')
      setMsg(t('occ.saved'))
      await reload()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function removeCustom(id: string) {
    if (!window.confirm(t('occ.confirmDelete'))) return
    try {
      await api.deleteOccasion(id)
      await reload()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <div className="ops-page">
      <header className="ops-page-head">
        <div>
          <p className="ops-kicker">{t('nav.occasions')}</p>
          <h1>{t('pages.occasionsTitle')}</h1>
          <p>{t('pages.occasionsSub')}</p>
        </div>
      </header>

      <div className="panel panel-pad" style={{ marginBottom: '1rem' }}>
        <div className="ops-filters" style={{ gridTemplateColumns: '1fr 1fr 0.7fr 1.3fr' }}>
          <select value={region} onChange={(e) => setRegion(e.target.value as typeof region)}>
            <option value="all">{t('occ.allRegions')}</option>
            <option value="ir">{t('occ.ir')}</option>
            <option value="global">{t('occ.global')}</option>
            <option value="custom">{t('occ.custom')}</option>
          </select>
          <select value={fit} onChange={(e) => setFit(e.target.value as typeof fit)}>
            <option value="content">{t('occ.fitContent')}</option>
            <option value="all">{t('occ.fitAll')}</option>
          </select>
          <select value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {[year - 1, year, year + 1].map((y) => (
              <option key={y} value={y}>
                {t('common.year', { y })}
              </option>
            ))}
          </select>
          <select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            <option value="">{t('occ.pickPage')}</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        {error && <p className="form-banner error">{error}</p>}
        {msg && <p className="form-banner ok">{msg}</p>}
        {!projectId && (
          <p className="section-sub" style={{ marginTop: '0.65rem' }}>
            {t('occ.pickToLink')}
          </p>
        )}
        {projectId && projects.find((p) => p.id === projectId)?.handle?.toLowerCase().includes('karaland') && (
          <p className="section-sub" style={{ marginTop: '0.65rem' }}>
            {t('occ.karalandHint')}
          </p>
        )}
      </div>

      <form
        className="panel panel-pad"
        style={{ marginBottom: '1rem' }}
        onSubmit={(e) => {
          e.preventDefault()
          void addCustom()
        }}
      >
        <h2 className="section-title">{t('occ.customTitle')}</h2>
        <p className="section-sub">{t('occ.customSub')}</p>
        <div className="ops-filters" style={{ gridTemplateColumns: '1.4fr 0.8fr 0.5fr 0.5fr auto' }}>
          <input
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            placeholder={t('occ.namePh')}
          />
          <select value={customCal} onChange={(e) => setCustomCal(e.target.value as 'jalali' | 'gregorian')}>
            <option value="jalali">{t('occ.jalali')}</option>
            <option value="gregorian">{t('occ.gregorian')}</option>
          </select>
          <input
            type="number"
            min={1}
            max={12}
            value={customMonth}
            onChange={(e) => setCustomMonth(e.target.value)}
            placeholder={t('occ.month')}
          />
          <input
            type="number"
            min={1}
            max={31}
            value={customDay}
            onChange={(e) => setCustomDay(e.target.value)}
            placeholder={t('occ.day')}
          />
          <button type="submit" className="btn btn-solid btn-sm" disabled={busy}>
            {t('common.add')}
          </button>
        </div>
      </form>

      <section className="panel panel-pad" style={{ marginBottom: '1rem' }}>
        <h2 className="section-title">{t('occ.upcoming')}</h2>
        <div className="chip-row" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
          {upcoming.length === 0 && <p className="section-sub">{t('occ.noneUpcoming')}</p>}
          {upcoming.map((o) => (
            <Link
              key={o.id}
              className="tag tag-link"
              title={o.nameEn}
              to={`/content?date=${o.dateInYear}&occasionId=${o.id}${projectId ? `&projectId=${projectId}` : ''}`}
            >
              {o.dateInYear} — {occasionLabel(o, lang)}
            </Link>
          ))}
        </div>
      </section>

      <div className="asset-grid">
        {visible.map((o) => {
          const linked = linkedIds.has(o.id)
          const hint = occasionHint(o, lang)
          return (
            <article key={o.id} className={`panel panel-pad occ-card${linked ? ' is-linked' : ''}`}>
              <div className="list-meta">
                <h3 style={{ margin: 0 }}>{occasionLabel(o, lang)}</h3>
                <span className="meta-badge">
                  {t(`occ.${o.region === 'ir' ? 'ir' : o.region === 'custom' ? 'custom' : 'global'}`)}
                </span>
              </div>
              <div className="chip-row occ-angles">
                {o.angle && <span className="meta-badge">{t(`occ.angle.${o.angle}`)}</span>}
                {linked && <span className="meta-badge">{t('occ.linkedBadge')}</span>}
                {(o.priority || 0) >= 5 && <span className="meta-badge">{t('occ.priorityHigh')}</span>}
              </div>
              <p className="section-sub" style={{ margin: '0.45rem 0' }}>
                {o.dateInYear || `${o.month}/${o.day}`}
                {o.dateEndInYear ? ` – ${o.dateEndInYear}` : ''}
                {o.calendar === 'jalali' ? ` · ${t('occ.jalaliDate', { date: `${o.month}/${o.day}` })}` : ''}
              </p>
              {hint && <p className="occ-hint">{hint}</p>}
              {projectId && (
                <button
                  type="button"
                  className={`btn btn-sm ${linked ? 'btn-solid' : 'btn-outline'}`}
                  onClick={() => void toggleLink(o.id)}
                >
                  {linked ? t('occ.linkedBtn') : t('occ.linkBtn')}
                </button>
              )}
              {o.dateInYear && (
                <Link
                  className="btn btn-outline btn-sm"
                  to={`/content?date=${o.dateInYear}&occasionId=${o.id}${projectId ? `&projectId=${projectId}` : ''}`}
                >
                  {t('occ.planContent')}
                </Link>
              )}
              {o.custom && (
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => void removeCustom(o.id)}
                >
                  {t('occ.deleteCustom')}
                </button>
              )}
            </article>
          )
        })}
      </div>
    </div>
  )
}
