import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCheck } from 'lucide-react'
import { api, type NotificationDto, type PageAnalyticsResponse, type PagePostInsight } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { NotificationList } from '../components/NotificationList'
import { PostPreviewModal } from '../components/PostPreviewModal'
import { useNotifications } from '../notifications/useNotifications'
import { useI18n } from '../prefs/PrefsProvider'

export function NotificationsPage() {
  const { t } = useI18n()
  const { workspaceId } = useAuth()
  const { items, unread, loading, error, markAllRead } = useNotifications({ limit: 100 })
  const [preview, setPreview] = useState<{ post: PagePostInsight; handle: string } | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)

  useEffect(() => {
    // Opening the page counts as seeing the list.
    if (!loading && unread > 0) void markAllRead().catch(() => null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading])

  async function openNotification(item: NotificationDto) {
    if (!workspaceId || !item.handle) return
    setPreviewError(null)
    const shortcode = String(item.meta?.shortcode || '')
    try {
      const report: PageAnalyticsResponse = await api.pageAnalytics(workspaceId, item.handle, false)
      const post = report.page.recentPosts.find((p) => p.shortcode === shortcode)
      if (post) setPreview({ post, handle: report.page.handle })
      else setPreviewError(t('notif.postGone'))
    } catch (e) {
      setPreviewError((e as Error).message)
    }
  }

  return (
    <div className="ops-page">
      <header className="ops-page-head">
        <div>
          <p className="ops-kicker">{t('nav.groupManage')}</p>
          <h1>{t('notif.title')}</h1>
          <p>{t('notif.sub')}</p>
        </div>
        <div className="form-actions">
          <Link to="/projects" className="btn btn-outline btn-sm">
            {t('nav.projects')}
          </Link>
          {unread > 0 && (
            <button type="button" className="btn btn-solid btn-sm" onClick={() => void markAllRead()}>
              <CheckCheck size={14} aria-hidden />
              {t('notif.markAll')}
            </button>
          )}
        </div>
      </header>
      {error && <div className="form-banner error">{error}</div>}
      {previewError && <div className="form-banner error">{previewError}</div>}
      <section className="panel panel-pad">
        {loading ? (
          <p className="section-sub">{t('common.loading')}</p>
        ) : (
          <NotificationList items={items} onOpen={(item) => void openNotification(item)} />
        )}
      </section>
      {preview && <PostPreviewModal post={preview.post} handle={preview.handle} onClose={() => setPreview(null)} />}
    </div>
  )
}
