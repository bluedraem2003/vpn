import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { useI18n } from '../prefs/PrefsProvider'

export function TelegramPage() {
  const { t } = useI18n()
  const [status, setStatus] = useState<{
    configured: boolean
    chatIdConfigured: boolean
    indexedFiles: number
    limits: Record<string, unknown>
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [syncMsg, setSyncMsg] = useState<string | null>(null)

  useEffect(() => {
    api
      .telegramStatus()
      .then(setStatus)
      .catch((e) => setError((e as Error).message))
  }, [])

  async function trySync() {
    setSyncMsg(null)
    try {
      const res = await fetch('/api/telegram/sync', { method: 'POST' })
      const data = await res.json()
      setSyncMsg(data.error || data.suggestion || JSON.stringify(data))
    } catch (e) {
      setSyncMsg((e as Error).message)
    }
  }

  return (
    <div className="ops-page">
      <header className="ops-page-head">
        <div>
          <h1>{t('pages.telegramTitle')}</h1>
          <p>{t('pages.telegramSub')}</p>
        </div>
        <button type="button" className="btn btn-outline btn-sm" onClick={trySync}>
          Sync
        </button>
      </header>

      {error && (
        <div className="panel panel-pad">
          <p className="section-sub">{error}</p>
        </div>
      )}

      <div className="ops-split">
        <section className="panel panel-pad">
          <h2 className="section-title">وضعیت اتصال</h2>
          {!status ? (
            <p className="section-sub">در حال بررسی...</p>
          ) : (
            <ul className="ops-list">
              <li>
                <strong>Bot Token</strong>
                <span>{status.configured ? 'تنظیم شده' : 'تنظیم نشده'}</span>
              </li>
              <li>
                <strong>Chat ID مجاز</strong>
                <span>{status.chatIdConfigured ? 'تنظیم شده' : 'تنظیم نشده'}</span>
              </li>
              <li>
                <strong>فایل‌های ایندکس‌شده</strong>
                <span>{status.indexedFiles}</span>
              </li>
              <li>
                <strong>سقف دانلود Bot API</strong>
                <span>{String(status.limits.botApiMaxDownloadMb)} MB</span>
              </li>
            </ul>
          )}
          {syncMsg && <p className="section-sub" style={{ marginTop: '1rem' }}>{syncMsg}</p>}
        </section>

        <section className="panel panel-pad">
          <h2 className="section-title">راه‌اندازی Webhook</h2>
          <ol className="ops-steps">
            <li>در BotFather یک بات بسازید و توکن را در <code>TELEGRAM_BOT_TOKEN</code> بگذارید.</li>
            <li>بات را ادمین کانال/گروه خصوصی دارایی‌ها کنید.</li>
            <li>
              <code>TELEGRAM_CHAT_ID</code> و <code>TELEGRAM_WEBHOOK_SECRET</code> را تنظیم کنید.
            </li>
            <li>
              Webhook را روی <code>POST /api/telegram/webhook</code> با HTTPS عمومی ست کنید.
            </li>
            <li>یک فایل تست بفرستید؛ باید در «دارایی‌ها» ظاهر شود.</li>
          </ol>
          <p className="section-sub">
            محدودیت واقعی: همگام‌سازی کامل تاریخچه کانال با Bot API ممکن نیست. برای فایل‌های قدیمی،
            فوروارد مجدد یا Local Bot API لازم است.
          </p>
        </section>
      </div>
    </div>
  )
}
