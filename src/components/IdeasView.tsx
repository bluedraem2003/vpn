import { weeklyIdeas, formatLabels } from '../lib/generator'
import type { ContentFormat } from '../types'

interface IdeasViewProps {
  onUseIdea: (topic: string, format: ContentFormat) => void
}

export function IdeasView({ onUseIdea }: IdeasViewProps) {
  return (
    <div className="ideas-layout">
      <div className="panel panel-pad">
        <h2 className="section-title">تقویم ایده‌های هفته</h2>
        <p className="section-sub">
          یک ریتم ساده برای پیج‌هایت: آموزش، پشت‌صحنه، تعامل و فروش نرم در تعادل.
        </p>
        <div className="ideas-list">
          {weeklyIdeas.map((idea) => (
            <div key={idea.day} className="list-item">
              <div className="list-meta">
                <span className="idea-day">{idea.day}</span>
                <span className="meta-badge">{formatLabels[idea.format]}</span>
              </div>
              <h3>{idea.title}</h3>
              <div className="form-actions">
                <button
                  type="button"
                  className="btn btn-solid btn-sm"
                  onClick={() => onUseIdea(idea.title, idea.format)}
                >
                  ساخت این محتوا
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
