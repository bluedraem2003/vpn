import type { InstagramPage } from '../types'
import { Trash2, Check } from 'lucide-react'
import { useState } from 'react'
import { uid } from '../lib/storage'

interface PagesViewProps {
  pages: InstagramPage[]
  activePageId: string | null
  onSave: (pages: InstagramPage[], activeId: string | null) => void
}

const emptyForm = { name: '', niche: '', audience: '', voice: '' }

export function PagesView({ pages, activePageId, onSave }: PagesViewProps) {
  const [form, setForm] = useState(emptyForm)

  function addPage() {
    if (!form.name.trim()) return
    const page: InstagramPage = {
      id: uid('page'),
      name: form.name.trim(),
      niche: form.niche.trim(),
      audience: form.audience.trim(),
      voice: form.voice.trim(),
      createdAt: Date.now(),
    }
    const next = [page, ...pages]
    onSave(next, page.id)
    setForm(emptyForm)
  }

  function removePage(id: string) {
    const next = pages.filter((p) => p.id !== id)
    onSave(next, activePageId === id ? next[0]?.id ?? null : activePageId)
  }

  return (
    <div className="pages-layout">
      <div className="panel panel-pad">
        <h2 className="section-title">افزودن پیج</h2>
        <p className="section-sub">هویت هر پیج را ذخیره کن تا محتوا با لحن برند هماهنگ شود.</p>

        <div className="field">
          <label htmlFor="page-name">نام پیج</label>
          <input
            id="page-name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="مثلاً فروشگاه نور"
          />
        </div>
        <div className="field">
          <label htmlFor="page-niche">حوزه / نیچ</label>
          <input
            id="page-niche"
            value={form.niche}
            onChange={(e) => setForm({ ...form, niche: e.target.value })}
            placeholder="زیبایی، فیتنس، آموزش، کافه..."
          />
        </div>
        <div className="field">
          <label htmlFor="page-audience">مخاطب هدف</label>
          <input
            id="page-audience"
            value={form.audience}
            onChange={(e) => setForm({ ...form, audience: e.target.value })}
            placeholder="بانوان ۲۵–۴۰، صاحبان کسب‌وکار..."
          />
        </div>
        <div className="field">
          <label htmlFor="page-voice">صدای برند</label>
          <textarea
            id="page-voice"
            value={form.voice}
            onChange={(e) => setForm({ ...form, voice: e.target.value })}
            placeholder="صمیمی اما دقیق، بدون اغراق، تمرکز روی آموزش کوتاه"
          />
        </div>
        <button type="button" className="btn btn-solid" onClick={addPage}>
          ذخیره پیج
        </button>
      </div>

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
                {page.niche && <p>حوزه: {page.niche}</p>}
                {page.audience && <p>مخاطب: {page.audience}</p>}
                {page.voice && <p>صدا: {page.voice}</p>}
                <div className="form-actions">
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => onSave(pages, page.id)}
                  >
                    <Check size={14} />
                    انتخاب
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => removePage(page.id)}
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
