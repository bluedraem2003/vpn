import { type ContentType } from '../domain/types'
import { formatHashtags } from '../lib/hashtags'
import { useI18n } from '../prefs/PrefsProvider'

export function InstagramPreview({
  handle,
  caption,
  hashtags,
  firstComment,
  contentType,
}: {
  handle?: string
  caption?: string
  hashtags?: string[]
  firstComment?: string
  contentType?: ContentType | string
}) {
  const { t } = useI18n()
  const name = handle ? `@${String(handle).replace(/^@/, '')}` : '@page'
  const tags = formatHashtags(hashtags)
  const typeLabel = t(`type.${contentType || 'post'}`)

  return (
    <div className="ig-preview" aria-label="پیش‌نمایش اینستاگرام">
      <div className="ig-preview-head">
        <span className="ig-preview-avatar" aria-hidden />
        <strong>{name}</strong>
        <span className="ig-preview-type">{typeLabel}</span>
      </div>
      <div className="ig-preview-media">{typeLabel}</div>
      <div className="ig-preview-body">
        <p>
          <strong>{name}</strong> {caption?.trim() || 'کپشن اینجا دیده می‌شود'}
        </p>
        {tags && <p className="ig-preview-tags">{tags}</p>}
        {firstComment?.trim() && (
          <p className="ig-preview-comment">
            کامنت اول: {firstComment.trim()}
          </p>
        )}
      </div>
    </div>
  )
}
