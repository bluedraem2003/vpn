import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { RefreshCw } from 'lucide-react'
import { api, type IgPageHit, type ProjectDto } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { normalizeHandle } from '../lib/handle'
import { formatHashtags, parseHashtags } from '../lib/hashtags'
import { InstagramPageSearch } from '../components/InstagramPageSearch'
import { SyncStatusChip, relativeTime } from '../components/ConnectedPageCard'
import { useI18n } from '../prefs/PrefsProvider'

const emptyForm = {
  name: '',
  handle: '',
  niche: '',
  audience: '',
  voice: '',
  notes: '',
  windowStart: '10:00',
  windowEnd: '12:00',
  hashtagText: '',
}

export function ProjectsPage() {
  const { t, n, lang } = useI18n()
  const { workspaceId } = useAuth()
  const [items, setItems] = useState<ProjectDto[]>([])
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [syncingId, setSyncingId] = useState<string | null>(null)

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
      setError(t('projects.notSignedIn'))
      return
    }
    const handle = normalizeHandle(form.handle) || undefined
    const name = form.name.trim() || handle || ''
    if (!name) {
      setError(t('projects.needName'))
      return
    }
    setBusy(true)
    setError(null)
    setMsg(null)
    const body = {
      name,
      handle,
      clientName: handle,
      niche: form.niche.trim() || undefined,
      audience: form.audience.trim() || undefined,
      voice: form.voice.trim() || undefined,
      notes: form.notes.trim() || undefined,
      windowStart: form.windowStart || undefined,
      windowEnd: form.windowEnd || undefined,
      hashtags: parseHashtags(form.hashtagText),
    }
    try {
      if (editingId) {
        const res = await api.updateProject(editingId, body)
        setItems((prev) => prev.map((p) => (p.id === editingId ? res.item : p)))
        setMsg(t('projects.updated'))
        resetForm()
      } else {
        const res = await api.createProject({ workspaceId, ...body })
        setItems((prev) => [res.item, ...prev.filter((p) => p.id !== res.item.id)])
        const sync = res.sync
        setMsg(
          !sync
            ? t('projects.saved')
            : sync.ok
              ? t('projects.connected', { followers: res.item.live ? res.item.live.followers : 0 })
              : sync.code === 'rate_limit'
                ? t('projects.savedCooldown')
                : sync.code === 'not_found'
                  ? t('projects.savedNotFound')
                  : t('projects.savedError'),
        )
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
      notes: p.notes || '',
      windowStart: p.windowStart || '10:00',
      windowEnd: p.windowEnd || '12:00',
      hashtagText: formatHashtags(p.hashtags),
    })
    setError(null)
    setMsg(null)
  }

  async function syncOne(id: string) {
    setSyncingId(id)
    setError(null)
    setMsg(null)
    try {
      const res = await api.syncProject(id)
      setItems((prev) => prev.map((p) => (p.id === id ? res.item : p)))
      if (res.sync?.ok) setMsg(res.sync.cached ? t('pagesLive.syncCached') : t('pagesLive.syncDone', { n: res.sync.events.length }))
    } catch (e) {
      const err = e as Error & { code?: string }
      setError(
        err.code === 'ig_busy'
          ? t('pagesLive.syncBusy')
          : err.code === 'not_found'
            ? t('pagesLive.statusNotFound')
            : err.code === 'busy'
              ? t('analytics.errBusy')
              : err.message,
      )
    } finally {
      setSyncingId(null)
    }
  }

  async function remove(id: string) {
    if (!window.confirm(t('projects.confirmDelete'))) return
    setError(null)
    try {
      await api.deleteProject(id)
      setItems((prev) => prev.filter((p) => p.id !== id))
      if (editingId === id) resetForm()
      setMsg(t('projects.deleted'))
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <div className="ops-page">
      <header className="ops-page-head">
        <div>
          <p className="ops-kicker">{t('nav.projects')}</p>
          <h1>{t('pages.projectsTitle')}</h1>
          <p>{t('pages.projectsSub')}</p>
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
          <h2 className="section-title">{editingId ? t('projects.editTitle') : t('projects.addTitle')}</h2>
          <p className="section-sub">{t('projects.searchHint')}</p>
          <div className="field">
            <label htmlFor="prj-name">{t('projects.name')}</label>
            <input
              id="prj-name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder={t('projects.namePh')}
              disabled={busy}
            />
          </div>
          <InstagramPageSearch
            id="prj-handle"
            value={form.handle}
            disabled={busy}
            onChange={(handle) => setForm((f) => ({ ...f, handle }))}
            onPick={(hit: IgPageHit) =>
              setForm((f) => ({
                ...f,
                handle: hit.username,
                name: f.name.trim() && f.name !== f.handle ? f.name : hit.name || hit.username,
                niche: f.niche.trim() ? f.niche : hit.biography || f.niche,
              }))
            }
          />
          <div className="field">
            <label htmlFor="prj-niche">{t('projects.niche')}</label>
            <input
              id="prj-niche"
              value={form.niche}
              onChange={(e) => setForm({ ...form, niche: e.target.value })}
              placeholder={t('projects.nichePh')}
              disabled={busy}
            />
          </div>
          <div className="field">
            <label htmlFor="prj-audience">{t('projects.audience')}</label>
            <input
              id="prj-audience"
              value={form.audience}
              onChange={(e) => setForm({ ...form, audience: e.target.value })}
              placeholder={t('projects.audiencePh')}
              disabled={busy}
            />
          </div>
          <div className="field">
            <label htmlFor="prj-voice">{t('projects.voice')}</label>
            <textarea
              id="prj-voice"
              value={form.voice}
              onChange={(e) => setForm({ ...form, voice: e.target.value })}
              placeholder={t('projects.voicePh')}
              disabled={busy}
            />
          </div>
          <div className="ops-filters" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <div className="field" style={{ margin: 0 }}>
              <label htmlFor="prj-ws">{t('projects.windowFrom')}</label>
              <input
                id="prj-ws"
                type="time"
                value={form.windowStart}
                onChange={(e) => setForm({ ...form, windowStart: e.target.value })}
                disabled={busy}
              />
            </div>
            <div className="field" style={{ margin: 0 }}>
              <label htmlFor="prj-we">{t('common.toHour')}</label>
              <input
                id="prj-we"
                type="time"
                value={form.windowEnd}
                onChange={(e) => setForm({ ...form, windowEnd: e.target.value })}
                disabled={busy}
              />
            </div>
          </div>
          <div className="field">
            <label htmlFor="prj-tags">{t('projects.defaultTags')}</label>
            <input
              id="prj-tags"
              value={form.hashtagText}
              onChange={(e) => setForm({ ...form, hashtagText: e.target.value })}
              placeholder="#brand #tehran"
              disabled={busy}
              dir="ltr"
            />
          </div>
          <div className="field">
            <label htmlFor="prj-notes">{t('projects.notes')}</label>
            <textarea
              id="prj-notes"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder={t('projects.notesPh')}
              disabled={busy}
            />
          </div>
          <div className="form-actions">
            <button type="submit" className="btn btn-solid" disabled={busy}>
              {busy ? t('common.saving') : editingId ? t('projects.update') : t('projects.save')}
            </button>
            {editingId && (
              <button type="button" className="btn btn-outline" disabled={busy} onClick={resetForm}>
                {t('common.cancel')}
              </button>
            )}
          </div>
        </form>
        <section className="panel panel-pad">
          <h2 className="section-title">{t('projects.mine')}</h2>
          <div className="page-list">
            {items.length === 0 && (
              <div className="empty">
                <strong>{t('projects.emptyTitle')}</strong>
                {t('projects.emptySub')}
              </div>
            )}
            {items.map((p) => (
              <article key={p.id} className="list-item">
                <div className="list-meta">
                  <h3>{p.name}</h3>
                  <SyncStatusChip project={p} />
                </div>
                {(p.handle || p.clientName) && <p dir="ltr">@{String(p.handle || p.clientName).replace(/^@/, '')}</p>}
                {p.live && (
                  <p className="live-line">
                    {t('projects.liveLine', {
                      followers: n(p.live.followers),
                      posts: n(p.live.posts),
                      er: n(p.live.engagementRate, 2),
                    })}
                    {p.igLastSyncedAt ? ` · ${t('pagesLive.syncedAgo', { when: relativeTime(p.igLastSyncedAt, lang) })}` : ''}
                  </p>
                )}
                {p.niche && <p>{t('projects.nicheLine', { v: p.niche })}</p>}
                {p.audience && <p>{t('projects.audienceLine', { v: p.audience })}</p>}
                {p.voice && <p>{t('projects.voiceLine', { v: p.voice })}</p>}
                {(p.windowStart || p.windowEnd) && (
                  <p>
                    {t('projects.windowLine', { start: p.windowStart || '—', end: p.windowEnd || '—' })}
                  </p>
                )}
                {p.hashtags && p.hashtags.length > 0 && <p>{p.hashtags.join(' ')}</p>}
                <div className="form-actions">
                  {(p.handle || p.clientName) && (
                    <button
                      type="button"
                      className="btn btn-solid btn-sm"
                      disabled={syncingId === p.id}
                      onClick={() => void syncOne(p.id)}
                    >
                      <RefreshCw size={13} className={syncingId === p.id ? 'spin' : undefined} aria-hidden />
                      {syncingId === p.id ? t('pagesLive.syncing') : t('pagesLive.syncNow')}
                    </button>
                  )}
                  {(p.handle || p.clientName) && (
                    <Link
                      className="btn btn-outline btn-sm"
                      to={`/analytics?handle=${encodeURIComponent(String(p.handle || p.clientName))}`}
                    >
                      {t('nav.analytics')}
                    </Link>
                  )}
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => startEdit(p)}>
                    {t('common.edit')}
                  </button>
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => void remove(p.id)}>
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
