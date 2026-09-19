import { Bell, ExternalLink } from 'lucide-react'
import type { NotificationDto } from '../api/client'
import { useI18n } from '../prefs/PrefsProvider'
import { relativeTime } from './ConnectedPageCard'

export function notificationTitle(
  item: NotificationDto,
  t: (key: string, vars?: Record<string, string | number>) => string,
  n: (v: number, d?: number) => string,
) {
  const h = item.handle || ''
  const m = item.meta || {}
  switch (item.kind) {
    case 'page_connected':
      return t('notif.pageConnected', { h })
    case 'new_post':
      return t('notif.newPost', { h })
    case 'followers_up':
      return t('notif.followersUp', { h, n: n(Math.abs(Number(m.delta) || 0)) })
    case 'followers_down':
      return t('notif.followersDown', { h, n: n(Math.abs(Number(m.delta) || 0)) })
    case 'bio_changed':
      return t('notif.bioChanged', { h })
    case 'name_changed':
      return t('notif.nameChanged', { h })
    case 'website_changed':
      return t('notif.websiteChanged', { h })
    case 'privacy_changed':
      return m.isPrivate ? t('notif.wentPrivate', { h }) : t('notif.wentPublic', { h })
    case 'post_removed':
      return t('notif.postRemoved', { h })
    case 'sync_error':
      return t('notif.syncError', { h })
    default:
      return item.title
  }
}

export function notificationBody(
  item: NotificationDto,
  t: (key: string, vars?: Record<string, string | number>) => string,
  n: (v: number, d?: number) => string,
) {
  const m = item.meta || {}
  if (!Object.keys(m).length) return item.body || ''
  switch (item.kind) {
    case 'page_connected':
      return t('notif.connectedBody', { followers: n(Number(m.followers) || 0), posts: n(Number(m.posts) || 0) })
    case 'followers_up':
    case 'followers_down':
      return `${n(Number(m.from) || 0)} → ${n(Number(m.to) || 0)}`
    case 'new_post':
      return String(m.caption || '') || t('notif.newPostBody', { likes: n(Number(m.likes) || 0), comments: n(Number(m.comments) || 0) })
    case 'sync_error':
      return m.code === 'not_found' ? t('pagesLive.statusNotFound') : t('pagesLive.liveErrorHint')
    default:
      return item.body || ''
  }
}

export function NotificationList({
  items,
  onOpen,
  emptyText,
}: {
  items: NotificationDto[]
  onOpen?: (item: NotificationDto) => void
  emptyText?: string
}) {
  const { t, n, lang } = useI18n()
  if (!items.length) {
    return (
      <div className="empty quiet">
        <Bell size={18} aria-hidden />
        <strong>{t('notif.emptyTitle')}</strong>
        {emptyText || t('notif.emptyHint')}
      </div>
    )
  }
  return (
    <ul className="notif-list">
      {items.map((item) => {
        const thumb = typeof item.meta?.thumbUrl === 'string' ? item.meta.thumbUrl : ''
        return (
          <li key={item.id} className={`notif-item kind-${item.kind} ${item.readAt ? '' : 'unread'}`}>
            {thumb ? <img className="notif-thumb" src={thumb} alt="" loading="lazy" /> : <span className={`notif-dot kind-${item.kind}`} aria-hidden />}
            <div className="notif-body">
              <strong>{notificationTitle(item, t, n)}</strong>
              {notificationBody(item, t, n) && <p>{notificationBody(item, t, n)}</p>}
              <span className="notif-time">{relativeTime(item.createdAt, lang)}</span>
            </div>
            {item.url && onOpen && (
              <button type="button" className="btn btn-outline btn-sm" onClick={() => onOpen(item)}>
                <ExternalLink size={13} aria-hidden />
                {t('notif.open')}
              </button>
            )}
          </li>
        )
      })}
    </ul>
  )
}
