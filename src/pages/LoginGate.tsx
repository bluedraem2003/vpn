import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

export function LoginGate({ children }: { children: React.ReactNode }) {
  const { session, loading, login, loginWithMagic, requestMagicLink, error } = useAuth()
  const [params] = useSearchParams()
  const [email, setEmail] = useState('owner@postyar.local')
  const [magicMsg, setMagicMsg] = useState<string | null>(null)
  const [magicUrl, setMagicUrl] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

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
          <p className="section-sub">در حال ورود...</p>
        </div>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="login-gate">
        <div className="panel panel-pad login-card">
          <div className="brand-mark" aria-hidden style={{ marginBottom: '1rem' }}>
            پ
          </div>
          <h1 className="section-title">ورود به پست‌یار</h1>
          <p className="section-sub">ورود با Magic Link (رایگان/محلی) یا ورود سریع توسعه</p>

          <div className="field" style={{ textAlign: 'right' }}>
            <label>ایمیل</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>

          {(error || localError) && <p className="section-sub">{error || localError}</p>}
          {magicMsg && <p className="section-sub">{magicMsg}</p>}
          {magicUrl && (
            <p className="section-sub">
              لینک توسعه:{' '}
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => void loginWithMagic(new URL(magicUrl).searchParams.get('magic') || '')}
              >
                همین الان وارد شو
              </button>
            </p>
          )}

          <div className="form-actions" style={{ justifyContent: 'center' }}>
            <button
              type="button"
              className="btn btn-solid"
              disabled={busy}
              onClick={() => {
                setBusy(true)
                setLocalError(null)
                void requestMagicLink(email)
                  .then((res) => {
                    setMagicMsg(res.message)
                    setMagicUrl(res.devMagicUrl || null)
                  })
                  .catch((e) => setLocalError((e as Error).message))
                  .finally(() => setBusy(false))
              }}
            >
              ارسال Magic Link
            </button>
            <button
              type="button"
              className="btn btn-outline"
              disabled={busy}
              onClick={() => {
                setBusy(true)
                void login(email)
                  .catch((e) => setLocalError((e as Error).message))
                  .finally(() => setBusy(false))
              }}
            >
              ورود سریع (dev)
            </button>
          </div>
          <p className="section-sub" style={{ marginTop: '0.85rem' }}>
            بدون SMTP: لینک در حالت توسعه در UI و لاگ سرور نمایش داده می‌شود.
          </p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
