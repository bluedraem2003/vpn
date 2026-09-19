import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, type OccasionDto, type ProjectDto } from '../api/client'
import { useAuth } from '../auth/AuthContext'

export function OccasionsPage() {
  const { workspaceId } = useAuth()
  const [items, setItems] = useState<OccasionDto[]>([])
  const [projects, setProjects] = useState<ProjectDto[]>([])
  const [linkedIds, setLinkedIds] = useState<Set<string>>(new Set())
  const [region, setRegion] = useState<'all' | 'ir' | 'global' | 'custom'>('all')
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

  const upcoming = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    return items
      .filter((o) => o.dateInYear && o.dateInYear >= today)
      .sort((a, b) => String(a.dateInYear).localeCompare(String(b.dateInYear)))
      .slice(0, 10)
  }, [items])

  async function toggleLink(occasionId: string) {
    if (!projectId) {
      setError('اول یک پروژه/پیج انتخاب کنید')
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
        setMsg('از پیج حذف شد')
      } else {
        await api.linkOccasionToProject(projectId, occasionId)
        setLinkedIds((prev) => new Set(prev).add(occasionId))
        setMsg('به پیج وصل شد')
      }
      await reload()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  async function addCustom() {
    if (!workspaceId) return
    if (!customName.trim()) {
      setError('نام مناسبت را بنویس')
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
      setMsg('مناسبت اختصاصی ذخیره شد')
      await reload()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function removeCustom(id: string) {
    if (!window.confirm('این مناسبت اختصاصی حذف شود؟')) return
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
          <h1>مناسبت‌ها</h1>
          <p>ایرانی + جهانی — برای هر پروژه/پیج مناسبت‌های مرتبط را انتخاب کنید</p>
        </div>
      </header>

      <div className="panel panel-pad" style={{ marginBottom: '1rem' }}>
        <div className="ops-filters">
          <select value={region} onChange={(e) => setRegion(e.target.value as typeof region)}>
            <option value="all">همه مناطق</option>
            <option value="ir">ایرانی</option>
            <option value="global">جهانی</option>
            <option value="custom">اختصاصی پیج</option>
          </select>
          <select value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {[year - 1, year, year + 1].map((y) => (
              <option key={y} value={y}>
                سال {y}
              </option>
            ))}
          </select>
          <select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            <option value="">انتخاب پروژه/پیج…</option>
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
            برای اتصال مناسبت به یک پیج، پروژه را از لیست بالا انتخاب کنید.
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
        <h2 className="section-title">مناسبت اختصاصی</h2>
        <p className="section-sub">تولد برند، سالگرد فروشگاه، کمپین داخلی...</p>
        <div className="ops-filters" style={{ gridTemplateColumns: '1.4fr 0.8fr 0.5fr 0.5fr auto' }}>
          <input
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            placeholder="نام مناسبت"
          />
          <select value={customCal} onChange={(e) => setCustomCal(e.target.value as 'jalali' | 'gregorian')}>
            <option value="jalali">شمسی</option>
            <option value="gregorian">میلادی</option>
          </select>
          <input
            type="number"
            min={1}
            max={12}
            value={customMonth}
            onChange={(e) => setCustomMonth(e.target.value)}
            placeholder="ماه"
          />
          <input
            type="number"
            min={1}
            max={31}
            value={customDay}
            onChange={(e) => setCustomDay(e.target.value)}
            placeholder="روز"
          />
          <button type="submit" className="btn btn-solid btn-sm" disabled={busy}>
            افزودن
          </button>
        </div>
      </form>

      <section className="panel panel-pad" style={{ marginBottom: '1rem' }}>
        <h2 className="section-title">نزدیک‌ترین‌ها</h2>
        <div className="chip-row" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
          {upcoming.length === 0 && <p className="section-sub">موردی در ادامه سال نیست</p>}
          {upcoming.map((o) => (
            <Link
              key={o.id}
              className="tag tag-link"
              title={o.nameEn}
              to={`/content?date=${o.dateInYear}&occasionId=${o.id}${projectId ? `&projectId=${projectId}` : ''}`}
            >
              {o.dateInYear} — {o.nameFa}
            </Link>
          ))}
        </div>
      </section>

      <div className="asset-grid">
        {items.map((o) => {
          const linked = linkedIds.has(o.id)
          return (
            <article key={o.id} className="panel panel-pad">
              <div className="list-meta">
                <h3 style={{ margin: 0 }}>{o.nameFa}</h3>
                <span className="meta-badge">
                  {o.region === 'ir' ? 'ایرانی' : o.region === 'custom' ? 'اختصاصی' : 'جهانی'}
                </span>
              </div>
              <p className="section-sub" style={{ margin: '0.45rem 0' }}>
                {o.dateInYear || `${o.month}/${o.day}`} · {o.nameEn} · {o.kind}
                {o.calendar === 'jalali' ? ` · ${o.month}/${o.day} شمسی` : ''}
              </p>
              {projectId && (
                <button
                  type="button"
                  className={`btn btn-sm ${linked ? 'btn-solid' : 'btn-outline'}`}
                  onClick={() => void toggleLink(o.id)}
                >
                  {linked ? 'وصل است — حذف' : 'وصل به پیج'}
                </button>
              )}
              {o.dateInYear && (
                <Link
                  className="btn btn-outline btn-sm"
                  to={`/content?date=${o.dateInYear}&occasionId=${o.id}${projectId ? `&projectId=${projectId}` : ''}`}
                >
                  برنامه‌ریزی محتوا
                </Link>
              )}
              {o.custom && (
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => void removeCustom(o.id)}
                >
                  حذف مناسبت
                </button>
              )}
            </article>
          )
        })}
      </div>
    </div>
  )
}
