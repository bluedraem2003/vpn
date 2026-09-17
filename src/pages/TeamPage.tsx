import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { useAuth } from '../auth/AuthContext'

export function TeamPage() {
  const { session } = useAuth()
  const [items, setItems] = useState<Array<{ id: string; email: string; name: string; role: string }>>([])
  const [error, setError] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [role, setRole] = useState('editor')
  const [inviteLink, setInviteLink] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  async function reload() {
    const res = await api.team()
    setItems(res.items)
  }

  useEffect(() => {
    void reload().catch((e) => setError((e as Error).message))
  }, [])

  async function invite() {
    setError(null)
    setInviteLink(null)
    setCopied(false)
    try {
      const res = await api.inviteMember({ email, name, role })
      const link = res.invite.inviteUrl || res.invite.devMagicUrl
      setInviteLink(link)
      setEmail('')
      setName('')
      await reload()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  async function copyInvite() {
    if (!inviteLink) return
    await navigator.clipboard.writeText(inviteLink)
    setCopied(true)
  }

  const canInvite = session?.role === 'admin' || session?.role === 'manager'

  return (
    <div className="ops-page">
      <header className="ops-page-head">
        <div>
          <h1>تیم</h1>
          <p>اعضای ورک‌اسپیس را دعوت کنید و لینک ورود را برای هم‌تیمی بفرستید</p>
        </div>
      </header>

      <div className="ops-split">
        {canInvite && (
          <section className="panel panel-pad">
            <h2 className="section-title">دعوت هم‌تیمی</h2>
            <p className="section-sub">
              بعد از دعوت، لینک یک‌بارمصرف را کپی کنید و در واتساپ/تلگرام برای همکارتان بفرستید.
            </p>
            <div className="field">
              <label>ایمیل</label>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="colleague@example.com"
                autoComplete="email"
              />
            </div>
            <div className="field">
              <label>نام</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="نام همکار" />
            </div>
            <div className="field">
              <label>نقش</label>
              <select value={role} onChange={(e) => setRole(e.target.value)}>
                {['admin', 'manager', 'editor', 'designer', 'copywriter', 'viewer'].map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            {error && <p className="section-sub">{error}</p>}
            {inviteLink && (
              <div className="invite-box">
                <p className="section-sub" style={{ marginBottom: '0.45rem' }}>
                  لینک دعوت آماده است (۲۴ ساعت معتبر):
                </p>
                <code className="invite-code">{inviteLink}</code>
                <div className="form-actions" style={{ marginTop: '0.65rem' }}>
                  <button type="button" className="btn btn-solid btn-sm" onClick={() => void copyInvite()}>
                    {copied ? 'کپی شد ✓' : 'کپی لینک دعوت'}
                  </button>
                  <a className="btn btn-outline btn-sm" href={inviteLink} target="_blank" rel="noreferrer">
                    باز کردن
                  </a>
                </div>
              </div>
            )}
            <button type="button" className="btn btn-solid" onClick={() => void invite()} style={{ marginTop: '0.75rem' }}>
              ساخت دعوت
            </button>
          </section>
        )}

        <section className="panel panel-pad">
          <h2 className="section-title">اعضا</h2>
          {!canInvite && error && <p className="section-sub">{error}</p>}
          <div className="page-list">
            {items.map((m) => (
              <article key={m.id} className="list-item">
                <div className="list-meta">
                  <h3>{m.name}</h3>
                  <span className="meta-badge">{m.role}</span>
                </div>
                <p>{m.email}</p>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
