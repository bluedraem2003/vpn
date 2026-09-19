import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { AppearanceControls } from '../components/AppearanceControls'
import { useI18n } from '../prefs/PrefsProvider'

export function LoginGate({ children }: { children: React.ReactNode }) {
  const { t, lang } = useI18n()
  const { session, loading, login, loginWithMagic, requestMagicLink, error } = useAuth()
  const [params] = useSearchParams()
  const [email, setEmail] = useState('owner@postyar.local')
  const [magicMsg, setMagicMsg] = useState<string | null>(null)
  const [magicUrl, setMagicUrl] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const [allowDevLogin, setAllowDevLogin] = useState(false)

  useEffect(() => {
    void api
      .bootstrap()
      .then((b) => {
        setAllowDevLogin(Boolean(b.allowDevLogin))
        if (b.defaultEmail) setEmail(b.defaultEmail)
      })
      .catch(() => null)
  }, [])

  useEffect(() => {
    const magic = params.get('magic')
    if (!magic || session) return
    setBusy(true)
    void loginWithMagic(magic)
      .catch((e) => setLocalError((e as Error).message))
      .finally(() => setBusy(false))
  }, [params, session, loginWithMagic])

  if (loading || (params.get('magic') && !session && busy)) {
    return (
      <div className="login-gate">
        <div className="panel panel-pad login-card">
          <p className="section-sub">{t('login.loading')}</p>
        </div>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="login-gate">
        <div className="panel panel-pad login-card">
          <div className="brand-mark" aria-hidden>
            {lang === 'fa' ? 'پ' : 'P'}
          </div>
          <p className="ops-kicker">{t('brand')}</p>
          <h1 className="section-title">{t('login.title')}</h1>
          <p className="section-sub">{t('login.sub')}</p>
          <AppearanceControls />

          <div className="field">
            <label htmlFor="login-email">{t('login.email')}</label>
            <input
              id="login-email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              autoComplete="email"
              dir="ltr"
            />
          </div>

          {(error || localError) && (
            <div className="form-banner error" role="alert">
              {error || localError}
            </div>
          )}
          {magicMsg && (
            <div className="form-banner ok" role="status">
              {magicMsg}
            </div>
          )}
          {magicUrl && (
            <div className="invite-box">
              <p className="section-sub" style={{ marginBottom: '0.5rem' }}>
                {t('login.yourLink')}
              </p>
              <code className="invite-code">{magicUrl}</code>
              <div className="form-actions" style={{ marginTop: '0.65rem', justifyContent: 'center' }}>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => void navigator.clipboard.writeText(magicUrl)}
                >
                  {t('login.copyLink')}
                </button>
                <button
                  type="button"
                  className="btn btn-solid btn-sm"
                  onClick={() => void loginWithMagic(new URL(magicUrl).searchParams.get('magic') || '')}
                >
                  {t('login.enterNow')}
                </button>
              </div>
            </div>
          )}

          <div className="form-actions login-actions">
            {allowDevLogin && (
              <button
                type="button"
                className="btn btn-solid"
                disabled={busy}
                onClick={() => {
                  setBusy(true)
                  void login(email)
                    .catch((e) => setLocalError((e as Error).message))
                    .finally(() => setBusy(false))
                }}
              >
                {t('login.devLogin')}
              </button>
            )}
            <button
              type="button"
              className={allowDevLogin ? 'btn btn-outline' : 'btn btn-solid'}
              disabled={busy}
              onClick={() => {
                setBusy(true)
                setLocalError(null)
                void requestMagicLink(email)
                  .then((res) => {
                    setMagicMsg(res.message)
                    setMagicUrl(res.inviteUrl || res.devMagicUrl || null)
                  })
                  .catch((e) => setLocalError((e as Error).message))
                  .finally(() => setBusy(false))
              }}
            >
              {t('login.getLink')}
            </button>
          </div>
          {allowDevLogin && <p className="field-hint login-hint">{t('login.devHint')}</p>}
          <p className="section-sub" style={{ marginTop: '0.85rem' }}>
            {t('login.notMember')}
          </p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
