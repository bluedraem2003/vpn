import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { useI18n } from '../prefs/PrefsProvider'

export function TelegramPage() {
  const { t } = useI18n()
  const [status, setStatus] = useState<{
    configured: boolean
    chatIdConfigured: boolean
    webhookSecretConfigured?: boolean
    indexedFiles: number
    limits: Record<string, unknown>
  } | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api
      .telegramStatus()
      .then(setStatus)
      .catch((e) => setError((e as Error).message))
  }, [])

  return (
    <div className="ops-page">
      <header className="ops-page-head">
        <div>
          <p className="ops-kicker">{t('nav.telegram')}</p>
          <h1>{t('pages.telegramTitle')}</h1>
          <p>{t('pages.telegramSub')}</p>
        </div>
      </header>

      {error && (
        <div className="panel panel-pad">
          <p className="section-sub">{error}</p>
        </div>
      )}

      <div className="ops-split">
        <section className="panel panel-pad">
          <h2 className="section-title">{t('telegram.status')}</h2>
          {!status ? (
            <p className="section-sub">{t('telegram.checking')}</p>
          ) : (
            <ul className="ops-list">
              <li>
                <strong>{t('telegram.botToken')}</strong>
                <span>{status.configured ? t('telegram.set') : t('telegram.unset')}</span>
              </li>
              <li>
                <strong>{t('telegram.allowedChat')}</strong>
                <span>{status.chatIdConfigured ? t('telegram.set') : t('telegram.unset')}</span>
              </li>
              <li>
                <strong>{t('telegram.webhookSecret')}</strong>
                <span>{status.webhookSecretConfigured ? t('telegram.set') : t('telegram.unset')}</span>
              </li>
              <li>
                <strong>{t('telegram.indexed')}</strong>
                <span>{status.indexedFiles}</span>
              </li>
              <li>
                <strong>{t('telegram.botLimit')}</strong>
                <span>{String(status.limits.botApiMaxDownloadMb)} MB</span>
              </li>
            </ul>
          )}
        </section>

        <section className="panel panel-pad">
          <h2 className="section-title">{t('telegram.webhook')}</h2>
          <ol className="ops-steps">
            <li>{t('telegram.step1')}</li>
            <li>{t('telegram.step2')}</li>
            <li>{t('telegram.step3')}</li>
            <li>{t('telegram.step4')}</li>
            <li>{t('telegram.step5')}</li>
          </ol>
          <p className="section-sub">{t('telegram.limitNote')}</p>
        </section>
      </div>
    </div>
  )
}
