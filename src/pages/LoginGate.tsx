import { useAuth } from '../auth/AuthContext'

export function LoginGate({ children }: { children: React.ReactNode }) {
  const { session, loading, login, error } = useAuth()

  if (loading) {
    return (
      <div className="login-gate">
        <div className="panel panel-pad login-card">
          <p className="section-sub">در حال بررسی نشست...</p>
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
          <p className="section-sub">
            نسخهٔ اول با ورود bootstrap برای ورک‌اسپیس محلی. ایمیل پیش‌فرض:
            <code> owner@postyar.local</code>
          </p>
          {error && <p className="section-sub">{error}</p>}
          <button type="button" className="btn btn-solid" onClick={() => void login()}>
            ورود به ورک‌اسپیس
          </button>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
