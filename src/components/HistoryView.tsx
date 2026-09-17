import type { GeneratedContent } from '../types'
import { formatLabels } from '../lib/generator'
import { CopyButton } from './CopyButton'
import { Trash2 } from 'lucide-react'

interface HistoryViewProps {
  items: GeneratedContent[]
  onClear: () => void
  onReuse: (item: GeneratedContent) => void
}

function formatDate(ts: number) {
  return new Intl.DateTimeFormat('fa-IR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(ts))
}

export function HistoryView({ items, onClear, onReuse }: HistoryViewProps) {
  return (
    <div className="history-layout">
      <div className="panel panel-pad">
        <div className="result-head" style={{ marginBottom: '0.75rem' }}>
          <div>
            <h2 className="section-title">تاریخچه محتوا</h2>
            <p className="section-sub" style={{ marginBottom: 0 }}>
              آخرین خروجی‌های ساخته‌شده در همین مرورگر ذخیره می‌شوند.
            </p>
          </div>
          {items.length > 0 && (
            <button type="button" className="btn btn-outline btn-sm" onClick={onClear}>
              <Trash2 size={14} />
              پاک کردن
            </button>
          )}
        </div>

        {items.length === 0 ? (
          <div className="empty">
            <strong>تاریخچه خالی است</strong>
            بعد از اولین تولید، آیتم‌ها اینجا می‌آیند.
          </div>
        ) : (
          <div className="history-list">
            {items.map((item) => (
              <div key={item.id} className="list-item">
                <div className="list-meta">
                  <h3>{item.input.topic || 'بدون عنوان'}</h3>
                  <span className="meta-badge">{formatLabels[item.input.format]}</span>
                </div>
                <p>{item.hook}</p>
                <p style={{ fontSize: '0.8rem' }}>{formatDate(item.createdAt)}</p>
                <div className="form-actions">
                  <CopyButton text={item.caption} label="کپی کپشن" />
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => onReuse(item)}>
                    بازتولید در استودیو
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
