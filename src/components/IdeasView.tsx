import { weeklyIdeas } from '../lib/generator'
import type { ContentFormat } from '../types'
import { useI18n } from '../prefs/PrefsProvider'

interface IdeasViewProps {
  onUseIdea: (topic: string, format: ContentFormat) => void
}

const ideaKeys = ['sat', 'sun', 'mon', 'tue', 'wed', 'thu', 'fri'] as const

export function IdeasView({ onUseIdea }: IdeasViewProps) {
  const { t } = useI18n()
  return (
    <div className="ideas-layout">
      <div className="panel panel-pad">
        <h2 className="section-title">{t('studioIdeas.title')}</h2>
        <p className="section-sub">{t('studioIdeas.sub')}</p>
        <div className="ideas-list">
          {weeklyIdeas.map((idea, idx) => {
            const key = ideaKeys[idx] || 'sat'
            const title = t(`studioIdeas.${key}Title`)
            return (
              <div key={idea.day} className="list-item">
                <div className="list-meta">
                  <span className="idea-day">{t(`studioIdeas.${key}`)}</span>
                  <span className="meta-badge">{t(`format.${idea.format}`)}</span>
                </div>
                <h3>{title}</h3>
                <div className="form-actions">
                  <button
                    type="button"
                    className="btn btn-solid btn-sm"
                    onClick={() => onUseIdea(title, idea.format)}
                  >
                    {t('studioIdeas.use')}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
