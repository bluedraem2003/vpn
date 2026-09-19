import type { ContentFormat, GenerateInput, InstagramPage, Language, Tone } from '../types'
import { Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useI18n } from '../prefs/PrefsProvider'

interface GeneratorFormProps {
  pages: InstagramPage[]
  activePageId: string | null
  onSelectPage?: (id: string) => void
  value: GenerateInput
  busy: boolean
  onChange: (next: GenerateInput) => void
  onGenerate: () => void
}

const formats: ContentFormat[] = ['feed', 'reel', 'story', 'carousel']
const tones: Tone[] = ['friendly', 'pro', 'witty', 'inspiring', 'luxury']
const languages: Language[] = ['fa', 'en', 'bilingual']

export function GeneratorForm({
  pages,
  activePageId,
  onSelectPage,
  value,
  busy,
  onChange,
  onGenerate,
}: GeneratorFormProps) {
  const { t } = useI18n()
  const active = pages.find((p) => p.id === activePageId)

  return (
    <div className="panel panel-pad">
      <h2 className="section-title">{t('studio.formTitle')}</h2>
      <p className="section-sub">{t('studio.formSub')}</p>

      <div className="field">
        <label htmlFor="studio-page">{t('studio.pageLabel')}</label>
        {pages.length === 0 ? (
          <p className="section-sub" style={{ margin: 0 }}>
            <Link to="/projects">{t('studio.noPageLink')}</Link>
          </p>
        ) : (
          <select
            id="studio-page"
            value={activePageId || ''}
            onChange={(e) => onSelectPage?.(e.target.value)}
          >
            {pages.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.handle ? ` · @${p.handle}` : ''}
              </option>
            ))}
          </select>
        )}
        {active?.voice && <span className="field-hint">{t('studio.voiceHint', { v: active.voice })}</span>}
      </div>

      <div className="field">
        <label htmlFor="topic">{t('studio.topic')}</label>
        <textarea
          id="topic"
          placeholder={t('studio.topicPh')}
          value={value.topic}
          onChange={(e) => onChange({ ...value, topic: e.target.value })}
        />
      </div>

      <div className="field">
        <label>{t('studio.format')}</label>
        <div className="chip-row">
          {formats.map((f) => (
            <button
              key={f}
              type="button"
              className={`chip ${value.format === f ? 'active' : ''}`}
              onClick={() => onChange({ ...value, format: f })}
            >
              {t(`format.${f}`)}
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <label>{t('studio.tone')}</label>
        <div className="chip-row">
          {tones.map((tone) => (
            <button
              key={tone}
              type="button"
              className={`chip ${value.tone === tone ? 'active' : ''}`}
              onClick={() => onChange({ ...value, tone })}
            >
              {t(`tone.${tone}`)}
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <label>{t('studio.language')}</label>
        <div className="chip-row">
          {languages.map((id) => (
            <button
              key={id}
              type="button"
              className={`chip ${value.language === id ? 'active' : ''}`}
              onClick={() => onChange({ ...value, language: id })}
            >
              {id === 'fa' ? t('settings.persian') : id === 'en' ? t('settings.english') : t('studio.bilingual')}
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <label htmlFor="goal">{t('studio.goal')}</label>
        <input
          id="goal"
          placeholder={t('studio.goalPh')}
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
          {t('studio.emoji')}
        </label>
        <label className="toggle">
          <input
            type="checkbox"
            checked={value.includeCta}
            onChange={(e) => onChange({ ...value, includeCta: e.target.checked })}
          />
          {t('studio.cta')}
        </label>
      </div>

      <div className="form-actions">
        <button type="button" className="btn btn-solid" disabled={busy} onClick={onGenerate}>
          <Sparkles size={18} />
          {busy ? t('studio.generating') : t('studio.generate')}
        </button>
      </div>
    </div>
  )
}
