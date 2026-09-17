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
    try {
      const res = await api.inviteMember({ email, name, role })
      setInviteLink(res.invite.devMagicUrl)
      setEmail('')
      setName('')
      await reload()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const canInvite = session?.role === 'admin' || session?.role === 'manager'

  return (
    <div className="ops-page">
      <header className="ops-page-head">
        <div>
          <h1>تیم</h1>
          <p>اعضای ورک‌اسپیس، نقش‌ها و دعوت با Magic Link</p>
        </div>
      </header>

      <div className="ops-split">
        {canInvite && (
          <section className="panel panel-pad">
            <h2 className="section-title">دعوت عضو</h2>
            <div className="field">
              <label>ایمیل</label>
              <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="editor@example.com" />
            </div>
            <div className="field">
              <label>نام</label>
              <input value={name} onChange={(e) => setName(e.target.value)} />
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
              <p className="section-sub">
                لینک دعوت (dev): <code>{inviteLink}</code>
              </p>
            )}
            <button type="button" className="btn btn-solid" onClick={() => void invite()}>
              ارسال دعوت
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
