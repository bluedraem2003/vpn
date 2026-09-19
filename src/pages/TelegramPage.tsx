import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { RefreshCw, Send } from 'lucide-react'
import { api, type TelegramChatDto } from '../api/client'
import { useI18n } from '../prefs/PrefsProvider'

type TelegramStatus = {
  configured: boolean
  chatIdConfigured: boolean
  webhookSecretConfigured?: boolean
  indexedFiles: number
  bot?: { id: number; username: string | null; name: string | null } | null
  chats?: TelegramChatDto[]
  connectedChats?: number
  limits: Record<string, unknown>
}

function chatLetter(title: string) {
  const trimmed = title.replace(/^@/, '').trim()
  return (trimmed[0] || '#').toUpperCase()
}

export function TelegramPage() {
  const { t, n, lang } = useI18n()
  const [status, setStatus] = useState<TelegramStatus | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function load() {
    setBusy(true)
    try {
      const next = await api.telegramStatus()
      setStatus(next)
      setError(null)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const chats = status?.chats || []
  const botHandle = status?.bot?.username ? `@${status.bot.username}` : null

  function formatWhen(iso: string | null) {
    if (!iso) return t('telegram.noFilesYet')
    const date = new Date(iso)
    if (!Number.isFinite(date.getTime())) return t('telegram.noFilesYet')
    return date.toLocaleString(lang === 'fa' ? 'fa-IR' : 'en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    })
  }

  function typeLabel(type: string) {
    if (type === 'channel') return t('telegram.typeChannel')
    if (type === 'group') return t('telegram.typeGroup')
    if (type === 'private') return t('telegram.typePrivate')
    return t('telegram.typeSupergroup')
  }

  return (
    <div className="ops-page">
      <header className="ops-page-head">
        <div>
          <p className="ops-kicker">{t('nav.telegram')}</p>
          <h1>{t('pages.telegramTitle')}</h1>
          <p>{t('pages.telegramSub')}</p>
        </div>
        <button type="button" className="btn btn-outline btn-sm" onClick={() => void load()} disabled={busy}>
          <RefreshCw size={14} />
          {busy ? t('common.loading') : t('common.refresh')}
        </button>
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
              {botHandle && (
                <li>
                  <strong>{t('telegram.botUser')}</strong>
                  <span>{botHandle}</span>
                </li>
              )}
              <li>
                <strong>{t('telegram.allowedChat')}</strong>
                <span>{status.chatIdConfigured ? t('telegram.set') : t('telegram.unset')}</span>
              </li>
              <li>
                <strong>{t('telegram.webhookSecret')}</strong>
                <span>{status.webhookSecretConfigured ? t('telegram.set') : t('telegram.unset')}</span>
              </li>
              <li>
                <strong>{t('telegram.connectedGroups')}</strong>
                <span>{n(status.connectedChats ?? chats.filter((chat) => chat.connected).length)}</span>
              </li>
              <li>
                <strong>{t('telegram.indexed')}</strong>
                <span>{n(status.indexedFiles)}</span>
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

      <section className="panel panel-pad tg-chats">
        <h2 className="section-title">
          <Send size={18} />
          {t('telegram.groups')}
        </h2>
        <p className="section-sub">{t('telegram.groupsSub')}</p>
        {!status ? (
          <p className="section-sub">{t('telegram.checking')}</p>
        ) : chats.length === 0 ? (
          <div className="empty quiet">
            <strong>{t('telegram.groupsEmpty')}</strong>
            <p>{t('telegram.groupsEmptyHint')}</p>
          </div>
        ) : (
          <div className="tg-chat-grid">
            {chats.map((chat) => (
              <article
                key={chat.chatId}
                className={`tg-chat-card${chat.connected ? '' : ' is-left'}`}
              >
                <div className="tg-chat-top">
                  <div className="tg-chat-letter" aria-hidden="true">
                    {chatLetter(chat.title)}
                  </div>
                  <div>
                    <h3 className="tg-chat-title">{chat.title}</h3>
                    <p className="tg-chat-meta">
                      {typeLabel(chat.type)}
                      {chat.username ? ` · @${chat.username}` : ''}
                    </p>
                  </div>
                </div>
                <div className="chip-row">
                  <span className={`meta-badge${chat.ingesting ? '' : ' is-muted'}`}>
                    {chat.ingesting ? t('telegram.receiving') : chat.connected ? t('telegram.paused') : t('telegram.left')}
                  </span>
                  {chat.notifyChat && <span className="meta-badge">{t('telegram.notifyChat')}</span>}
                </div>
                <div className="tg-chat-stats">
                  <span>{t('telegram.filesCount', { n: n(chat.fileCount) })}</span>
                  <span>
                    {chat.lastFileAt
                      ? `${t('telegram.lastFile')} · ${formatWhen(chat.lastFileAt)}`
                      : t('telegram.noFilesYet')}
                  </span>
                </div>
                <p className="tg-chat-id">{t('telegram.chatId')}: {chat.chatId}</p>
                <Link to="/assets" className="btn btn-outline btn-sm">
                  {t('telegram.viewAssets')}
                </Link>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
