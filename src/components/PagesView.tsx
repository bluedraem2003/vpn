import type { InstagramPage } from '../types'
import { Trash2, Check } from 'lucide-react'
import { useState } from 'react'

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
  const [form, setForm] = useState(emptyForm)
  const [localError, setLocalError] = useState<string | null>(null)

  async function addPage() {
    if (busy) return
    if (!form.name.trim()) {
      setLocalError('نام پیج را بنویس')
      return
    }
    setLocalError(null)
    try {
      await onCreate({
        name: form.name.trim(),
        handle: form.handle.trim(),
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
        <h2 className="section-title">افزودن پیج</h2>
        <p className="section-sub">هویت هر پیج روی سرور ذخیره می‌شود و در محتوا/مناسبت‌ها هم قابل انتخاب است.</p>

        {(error || localError) && <p className="form-banner error">{error || localError}</p>}

        <div className="field">
          <label htmlFor="page-name">نام پیج</label>
          <input
            id="page-name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="نام پیج اینستاگرام"
            disabled={busy}
          />
        </div>
        <div className="field">
          <label htmlFor="page-handle">آیدی اینستاگرام (@)</label>
          <input
            id="page-handle"
            value={form.handle}
            onChange={(e) => setForm({ ...form, handle: e.target.value })}
            placeholder="instagram_handle"
            disabled={busy}
            dir="ltr"
          />
        </div>
        <div className="field">
          <label htmlFor="page-niche">حوزه / نیچ</label>
          <input
            id="page-niche"
            value={form.niche}
            onChange={(e) => setForm({ ...form, niche: e.target.value })}
            placeholder="زیبایی، فیتنس، آموزش، کافه..."
            disabled={busy}
          />
        </div>
        <div className="field">
          <label htmlFor="page-audience">مخاطب هدف</label>
          <input
            id="page-audience"
            value={form.audience}
            onChange={(e) => setForm({ ...form, audience: e.target.value })}
            placeholder="بانوان ۲۵–۴۰، صاحبان کسب‌وکار..."
            disabled={busy}
          />
        </div>
        <div className="field">
          <label htmlFor="page-voice">صدای برند</label>
          <textarea
            id="page-voice"
            value={form.voice}
            onChange={(e) => setForm({ ...form, voice: e.target.value })}
            placeholder="صمیمی اما دقیق، بدون اغراق، تمرکز روی آموزش کوتاه"
            disabled={busy}
          />
        </div>
        <button type="submit" className="btn btn-solid" disabled={busy}>
          {busy ? 'در حال ذخیره...' : 'ذخیره پیج'}
        </button>
      </form>

      <div className="panel panel-pad">
        <h2 className="section-title">پیج‌های من</h2>
        <p className="section-sub">یک پیج را فعال کن تا تولید محتوا بر اساس آن تنظیم شود.</p>

        {pages.length === 0 ? (
          <div className="empty">
            <strong>پیجی ثبت نشده</strong>
            از فرم روبه‌رو اولین پیج را اضافه کن.
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
                  {activePageId === page.id && <span className="meta-badge">فعال</span>}
                </div>
                {page.handle && <p>@{page.handle.replace(/^@/, '')}</p>}
                {page.niche && <p>حوزه: {page.niche}</p>}
                {page.audience && <p>مخاطب: {page.audience}</p>}
                {page.voice && <p>صدا: {page.voice}</p>}
                <div className="form-actions">
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    disabled={busy}
                    onClick={() => onSelect(page.id)}
                  >
                    <Check size={14} />
                    انتخاب
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    disabled={busy}
                    onClick={() => {
                      if (window.confirm('این پیج حذف شود؟')) void onRemove(page.id)
                    }}
                  >
                    <Trash2 size={14} />
                    حذف
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
