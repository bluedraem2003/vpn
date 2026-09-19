import type { InstagramPage } from '../types'
import { Trash2, Check } from 'lucide-react'
import { useState } from 'react'
import { InstagramPageSearch } from './InstagramPageSearch'
import type { IgPageHit } from '../api/client'
import { useI18n } from '../prefs/PrefsProvider'

export type PageFormInput = {
  name: string
  handle: string
  niche: string
  audience: string
  voice: string
}

interface PagesViewProps {
  pages: InstagramPage[]
  activePageId: string | null
  busy?: boolean
  error?: string | null
  onCreate: (form: PageFormInput) => Promise<void> | void
  onRemove: (id: string) => Promise<void> | void
  onSelect: (id: string) => void
}

const emptyForm: PageFormInput = { name: '', handle: '', niche: '', audience: '', voice: '' }

export function PagesView({
  pages,
  activePageId,
  busy = false,
  error = null,
  onCreate,
  onRemove,
  onSelect,
}: PagesViewProps) {
  const { t } = useI18n()
  const [form, setForm] = useState(emptyForm)
  const [localError, setLocalError] = useState<string | null>(null)

  async function addPage() {
    if (busy) return
    const handle = form.handle.trim().replace(/^@/, '')
    const name = form.name.trim() || handle
    if (!name) {
      setLocalError(t('projects.needName'))
      return
    }
    setLocalError(null)
    try {
      await onCreate({
        name,
        handle,
        niche: form.niche.trim(),
        audience: form.audience.trim(),
        voice: form.voice.trim(),
      })
      setForm(emptyForm)
    } catch {
      /* parent shows error */
    }
  }

  return (
    <div className="pages-layout">
      <form
        className="panel panel-pad"
        onSubmit={(e) => {
          e.preventDefault()
          void addPage()
        }}
      >
        <h2 className="section-title">{t('projects.addTitle')}</h2>
        <p className="section-sub">{t('projects.searchHintStudio')}</p>

        {(error || localError) && <p className="form-banner error">{error || localError}</p>}

        <div className="field">
          <label htmlFor="page-name">{t('projects.name')}</label>
          <input
            id="page-name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder={t('projects.namePh')}
            disabled={busy}
          />
        </div>
        <InstagramPageSearch
          id="page-handle"
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
          <label htmlFor="page-niche">{t('projects.niche')}</label>
          <input
            id="page-niche"
            value={form.niche}
            onChange={(e) => setForm({ ...form, niche: e.target.value })}
            placeholder={t('projects.nichePh')}
            disabled={busy}
          />
        </div>
        <div className="field">
          <label htmlFor="page-audience">{t('projects.audience')}</label>
          <input
            id="page-audience"
            value={form.audience}
            onChange={(e) => setForm({ ...form, audience: e.target.value })}
            placeholder={t('projects.audiencePh')}
            disabled={busy}
          />
        </div>
        <div className="field">
          <label htmlFor="page-voice">{t('projects.voice')}</label>
          <textarea
            id="page-voice"
            value={form.voice}
            onChange={(e) => setForm({ ...form, voice: e.target.value })}
            placeholder={t('projects.voicePh')}
            disabled={busy}
          />
        </div>
        <button type="submit" className="btn btn-solid" disabled={busy}>
          {busy ? t('common.saving') : t('projects.save')}
        </button>
      </form>

      <div className="panel panel-pad">
        <h2 className="section-title">{t('projects.mine')}</h2>
        <p className="section-sub">{t('projects.activateHint')}</p>

        {pages.length === 0 ? (
          <div className="empty">
            <strong>{t('projects.emptyTitle')}</strong>
            {t('projects.emptyStudio')}
          </div>
        ) : (
          <div className="page-list">
            {pages.map((page) => (
              <div
                key={page.id}
                className={`list-item ${activePageId === page.id ? 'active-page' : ''}`}
              >
                <div className="list-meta">
                  <h3>{page.name}</h3>
                  {activePageId === page.id && <span className="meta-badge">{t('common.active')}</span>}
                </div>
                {page.handle && <p>@{page.handle.replace(/^@/, '')}</p>}
                {page.niche && <p>{t('projects.nicheLine', { v: page.niche })}</p>}
                {page.audience && <p>{t('projects.audienceLine', { v: page.audience })}</p>}
                {page.voice && <p>{t('projects.voiceLine', { v: page.voice })}</p>}
                <div className="form-actions">
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    disabled={busy}
                    onClick={() => onSelect(page.id)}
                  >
                    <Check size={14} />
                    {t('common.pick')}
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    disabled={busy}
                    onClick={() => {
                      if (window.confirm(t('projects.confirmDelete'))) void onRemove(page.id)
                    }}
                  >
                    <Trash2 size={14} />
                    {t('common.delete')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
