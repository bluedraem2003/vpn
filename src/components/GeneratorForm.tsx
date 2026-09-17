import type { ContentFormat, GenerateInput, InstagramPage, Language, Tone } from '../types'
import { formatLabels, toneLabels } from '../lib/generator'
import { Sparkles } from 'lucide-react'

interface GeneratorFormProps {
  pages: InstagramPage[]
  activePageId: string | null
  value: GenerateInput
  busy: boolean
  onChange: (next: GenerateInput) => void
  onGenerate: () => void
}

const formats: ContentFormat[] = ['feed', 'reel', 'story', 'carousel']
const tones: Tone[] = ['friendly', 'pro', 'witty', 'inspiring', 'luxury']
const languages: { id: Language; label: string }[] = [
  { id: 'fa', label: 'فارسی' },
  { id: 'en', label: 'English' },
  { id: 'bilingual', label: 'دوزبانه' },
]

export function GeneratorForm({
  pages,
  activePageId,
  value,
  busy,
  onChange,
  onGenerate,
}: GeneratorFormProps) {
  const active = pages.find((p) => p.id === activePageId)

  return (
    <div className="panel panel-pad">
      <h2 className="section-title">ساخت محتوا</h2>
      <p className="section-sub">
        موضوع را بنویس، فرمت و لحن را انتخاب کن؛ پست‌یار خروجی آماده انتشار می‌سازد.
        {active ? ` پیج فعال: ${active.name}` : ' هنوز پیجی انتخاب نشده.'}
      </p>

      <div className="field">
        <label htmlFor="topic">موضوع یا ایده پست</label>
        <textarea
          id="topic"
          placeholder="مثلاً: ۵ اشتباه رایج در نوشتن کپشن فروش"
          value={value.topic}
          onChange={(e) => onChange({ ...value, topic: e.target.value })}
        />
      </div>

      <div className="field">
        <label>فرمت محتوا</label>
        <div className="chip-row">
          {formats.map((f) => (
            <button
              key={f}
              type="button"
              className={`chip ${value.format === f ? 'active' : ''}`}
              onClick={() => onChange({ ...value, format: f })}
            >
              {formatLabels[f]}
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <label>لحن نوشتار</label>
        <div className="chip-row">
          {tones.map((t) => (
            <button
              key={t}
              type="button"
              className={`chip ${value.tone === t ? 'active' : ''}`}
              onClick={() => onChange({ ...value, tone: t })}
            >
              {toneLabels[t]}
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <label>زبان</label>
        <div className="chip-row">
          {languages.map((l) => (
            <button
              key={l.id}
              type="button"
              className={`chip ${value.language === l.id ? 'active' : ''}`}
              onClick={() => onChange({ ...value, language: l.id })}
            >
              {l.label}
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <label htmlFor="goal">هدف پست (اختیاری)</label>
        <input
          id="goal"
          placeholder="افزایش سیو، جذب لید، معرفی محصول..."
          value={value.goal}
          onChange={(e) => onChange({ ...value, goal: e.target.value })}
        />
      </div>

      <div className="toggle-row">
        <label className="toggle">
          <input
            type="checkbox"
            checked={value.includeEmoji}
            onChange={(e) => onChange({ ...value, includeEmoji: e.target.checked })}
          />
          ایموجی
        </label>
        <label className="toggle">
          <input
            type="checkbox"
            checked={value.includeCta}
            onChange={(e) => onChange({ ...value, includeCta: e.target.checked })}
          />
          دعوت به اقدام (CTA)
        </label>
      </div>

      <div className="form-actions">
        <button type="button" className="btn btn-solid" disabled={busy} onClick={onGenerate}>
          <Sparkles size={18} />
          {busy ? 'در حال ساخت...' : 'تولید محتوا'}
        </button>
      </div>
    </div>
  )
}
