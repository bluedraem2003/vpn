import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { KeyRound, Mail } from 'lucide-react'
import { api } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { AppearanceControls } from '../components/AppearanceControls'
import { useI18n } from '../prefs/PrefsProvider'

type Mode = 'magic' | 'ownerKey'

export function LoginGate({ children }: { children: React.ReactNode }) {
  const { t, lang } = useI18n()
  const { session, loading, login, loginWithMagic, loginWithOwnerKey, requestMagicLink, error } = useAuth()
  const [params] = useSearchParams()
  const [email, setEmail] = useState('')
  const [ownerKey, setOwnerKey] = useState('')
  const [mode, setMode] = useState<Mode>('magic')
  const [magicMsg, setMagicMsg] = useState<string | null>(null)
  const [devMagicUrl, setDevMagicUrl] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const [allowDevLogin, setAllowDevLogin] = useState(false)
  const [ownerKeyEnabled, setOwnerKeyEnabled] = useState(false)

  useEffect(() => {
    void api
      .bootstrap()
      .then((b) => {
        setAllowDevLogin(Boolean(b.allowDevLogin))
        setOwnerKeyEnabled(Boolean(b.ownerKeyEnabled))
        if (b.defaultEmail) setEmail((cur) => cur || b.defaultEmail)
        if (b.ownerKeyEnabled && !b.allowDevLogin) setMode('ownerKey')
      })
      .catch(() => null)
  }, [])

  const magicToken = params.get('magic')
  useEffect(() => {
    if (!magicToken || session) return
    setBusy(true)
    void loginWithMagic(magicToken)
      .catch((e) => setLocalError((e as Error).message))
      .finally(() => setBusy(false))
  }, [magicToken, session, loginWithMagic])

  if (loading || (magicToken && !session && busy)) {
    return (
      <div className="login-gate">
        <div className="panel panel-pad login-card">
          <p className="section-sub">{t('login.loading')}</p>
        </div>
      </div>
    )
  }

  if (!session) {
    const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
    return (
      <div className="login-gate">
        <form
          className="panel panel-pad login-card"
          onSubmit={(e) => {
            e.preventDefault()
            if (busy) return
            setLocalError(null)
            setMagicMsg(null)
            setBusy(true)
            const job =
              mode === 'ownerKey'
                ? loginWithOwnerKey(email.trim(), ownerKey)
                : requestMagicLink(email.trim()).then((res) => {
                    setMagicMsg(res.message)
                    setDevMagicUrl(res.devMagicUrl || null)
                  })
            void job.catch((e) => setLocalError((e as Error).message)).finally(() => setBusy(false))
          }}
        >
          <div className="brand-mark" aria-hidden style={{ marginBottom: '1rem' }}>
            {lang === 'fa' ? 'پ' : 'P'}
          </div>
          <h1 className="section-title">{t('login.title')}</h1>
          <p className="section-sub">{t('login.sub')}</p>
          <AppearanceControls />

          {ownerKeyEnabled && (
            <div className="nav-pills login-modes" role="tablist" aria-label={t('login.modeAria')}>
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'magic'}
                className={mode === 'magic' ? 'active' : ''}
                onClick={() => setMode('magic')}
              >
                <Mail size={14} aria-hidden /> {t('login.modeMagic')}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'ownerKey'}
                className={mode === 'ownerKey' ? 'active' : ''}
                onClick={() => setMode('ownerKey')}
              >
                <KeyRound size={14} aria-hidden /> {t('login.modeOwnerKey')}
              </button>
            </div>
          )}

          <div className="field">
            <label htmlFor="login-email">{t('login.email')}</label>
            <input
              id="login-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              autoComplete="email"
              dir="ltr"
              required
            />
          </div>

          {mode === 'ownerKey' && (
            <div className="field">
              <label htmlFor="login-key">{t('login.ownerKey')}</label>
              <input
                id="login-key"
                type="password"
                value={ownerKey}
                onChange={(e) => setOwnerKey(e.target.value)}
                autoComplete="current-password"
                dir="ltr"
                required
              />
              <span className="field-hint">{t('login.ownerKeyHint')}</span>
            </div>
          )}

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
          {devMagicUrl && (
            <div className="invite-box">
              <p className="section-sub" style={{ marginBottom: '0.5rem' }}>
                {t('login.devLinkNote')}
              </p>
              <code className="invite-code">{devMagicUrl}</code>
              <div className="form-actions" style={{ marginTop: '0.65rem', justifyContent: 'center' }}>
                <button
                  type="button"
                  className="btn btn-solid btn-sm"
                  onClick={() => void loginWithMagic(new URL(devMagicUrl).searchParams.get('magic') || '')}
                >
                  {t('login.enterNow')}
                </button>
              </div>
            </div>
          )}

          <div className="login-actions">
            <button type="submit" className="btn btn-solid" disabled={busy || !validEmail || (mode === 'ownerKey' && !ownerKey)}>
              {busy ? t('login.loading') : mode === 'ownerKey' ? t('login.enterWithKey') : t('login.getLink')}
            </button>
            {allowDevLogin && (
              <button
                type="button"
                className="btn btn-outline"
                disabled={busy || !validEmail}
                onClick={() => {
                  setBusy(true)
                  setLocalError(null)
                  void login(email.trim())
                    .catch((e) => setLocalError((e as Error).message))
                    .finally(() => setBusy(false))
                }}
              >
                {t('login.devLogin')}
              </button>
            )}
          </div>
          <p className="section-sub" style={{ marginTop: '0.85rem' }}>
            {t('login.notMember')}
          </p>
        </form>
      </div>
    )
  }

  return <>{children}</>
}
