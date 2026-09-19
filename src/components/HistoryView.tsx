import type { GeneratedContent } from '../types'
import { CopyButton } from './CopyButton'
import { Trash2 } from 'lucide-react'
import { useI18n } from '../prefs/PrefsProvider'

interface HistoryViewProps {
  items: GeneratedContent[]
  onClear: () => void
  onReuse: (item: GeneratedContent) => void
}

export function HistoryView({ items, onClear, onReuse }: HistoryViewProps) {
  const { t, lang } = useI18n()

  function formatDate(ts: number) {
    return new Intl.DateTimeFormat(lang === 'fa' ? 'fa-IR' : 'en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(ts))
  }

  return (
    <div className="history-layout">
      <div className="panel panel-pad">
        <div className="result-head" style={{ marginBottom: '0.75rem' }}>
          <div>
            <h2 className="section-title">{t('history.title')}</h2>
            <p className="section-sub" style={{ marginBottom: 0 }}>
              {t('history.sub')}
            </p>
          </div>
          {items.length > 0 && (
            <button type="button" className="btn btn-outline btn-sm" onClick={onClear}>
              <Trash2 size={14} />
              {t('history.clear')}
            </button>
          )}
        </div>

        {items.length === 0 ? (
          <div className="empty">
            <strong>{t('history.emptyTitle')}</strong>
            {t('history.emptySub')}
          </div>
        ) : (
          <div className="history-list">
            {items.map((item) => (
              <div key={item.id} className="list-item">
                <div className="list-meta">
                  <h3>{item.input.topic || t('history.untitled')}</h3>
                  <span className="meta-badge">{t(`format.${item.input.format}`)}</span>
                </div>
                <p>{item.hook}</p>
                <p style={{ fontSize: '0.8rem' }}>{formatDate(item.createdAt)}</p>
                <div className="form-actions">
                  <CopyButton text={item.caption} label={t('content.copyCaption')} />
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => onReuse(item)}>
                    {t('history.reuse')}
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
