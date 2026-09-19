import { useEffect } from 'react'
import { MapPin, Music, X } from 'lucide-react'
import type { PagePostInsight } from '../api/client'
import { useI18n } from '../prefs/PrefsProvider'

export function postTypeLabel(type: PagePostInsight['type'], t: (key: string) => string) {
  if (type === 'reel') return t('analytics.reel')
  if (type === 'carousel') return t('analytics.carousel')
  return t('analytics.post')
}

export function PostPreviewModal({
  post,
  handle,
  onClose,
}: {
  post: PagePostInsight
  handle?: string
  onClose: () => void
}) {
  const { t, n, d } = useI18n()
  const type = postTypeLabel(post.type, t)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="modal-backdrop ig-post-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="panel panel-pad ig-post-modal"
        role="dialog"
        aria-modal="true"
        aria-label={t('analytics.preview')}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="ig-post-modal-head">
          <strong>
            {handle ? <span dir="ltr">@{handle} · </span> : null}
            {t('analytics.postEng', { type, er: n(post.engagement, 2) })}
          </strong>
          <button type="button" className="btn btn-outline btn-sm" onClick={onClose} aria-label={t('common.close')}>
            <X size={16} />
          </button>
        </header>
        {post.thumbUrl ? (
          <img className="ig-post-modal-img" src={post.thumbUrl} alt="" referrerPolicy="no-referrer" />
        ) : (
          <span className="ig-thumb-fallback">{type}</span>
        )}
        <p className="ig-post-modal-stats">
          {t('analytics.postStats', { likes: n(post.likes), comments: n(post.comments) })}
          {post.views != null ? t('analytics.withViews', { views: n(post.views) }) : ''}
          {post.takenAt ? ` · ${d(post.takenAt)}` : ''}
        </p>
        {post.locationName ? (
          <p className="section-sub">
            <MapPin size={12} /> {post.locationName}
          </p>
        ) : null}
        {post.songName ? (
          <p className="section-sub">
            <Music size={12} /> {post.originalAudio ? t('analytics.originalAudio') : post.songName}
            {post.artistName ? ` · ${post.artistName}` : ''}
          </p>
        ) : null}
        {post.taggedUsers.length > 0 ? (
          <p className="section-sub">{t('analytics.tagged', { list: post.taggedUsers.map((u) => `@${u}`).join(' · ') })}</p>
        ) : null}
        {post.hashtags.length > 0 ? <p className="section-sub">{post.hashtags.map((h) => `#${h}`).join(' ')}</p> : null}
        {post.caption ? <p className="ig-post-modal-caption">{post.caption}</p> : null}
        <p className="section-sub">{t('analytics.inAppPreview')}</p>
      </div>
    </div>
  )
}
