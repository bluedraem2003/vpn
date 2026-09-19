import { useEffect, useState } from 'react'
import { Link2, ShieldCheck, Trash2 } from 'lucide-react'
import { api } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { CopyButton } from '../components/CopyButton'
import { relativeTime } from '../components/ConnectedPageCard'
import { useI18n } from '../prefs/PrefsProvider'

const ROLES = ['admin', 'manager', 'editor', 'designer', 'copywriter', 'viewer'] as const
type Member = { id: string; email: string; name: string; role: string; lastLoginAt?: string | null }

export function TeamPage() {
  const { t, lang } = useI18n()
  const { session } = useAuth()
  const [items, setItems] = useState<Member[]>([])
  const [error, setError] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [role, setRole] = useState('editor')
  const [inviteLink, setInviteLink] = useState<{ email: string; url: string; expiresAt: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [linkBusy, setLinkBusy] = useState<string | null>(null)

  async function reload() {
    const res = await api.team()
    setItems(res.items)
  }

  useEffect(() => {
    void reload().catch((e) => setError((e as Error).message))
  }, [])

  const isAdmin = session?.role === 'admin'
  const canInvite = isAdmin || session?.role === 'manager'
  const grantable = isAdmin ? [...ROLES] : ROLES.filter((r) => r !== 'admin')

  async function invite() {
    setError(null)
    setMsg(null)
    setInviteLink(null)
    setBusy(true)
    try {
      const res = await api.inviteMember({ email: email.trim(), name: name.trim() || undefined, role })
      if (res.invite.inviteUrl) {
        setInviteLink({ email: res.member.email, url: res.invite.inviteUrl, expiresAt: res.invite.expiresAt })
      } else {
        setMsg(t('team.invitedNoLink', { email: res.member.email }))
      }
      setEmail('')
      setName('')
      await reload()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function mintLink(member: Member) {
    setError(null)
    setMsg(null)
    setLinkBusy(member.id)
    try {
      const res = await api.mintLoginLink(member.id)
      if (res.inviteUrl) setInviteLink({ email: member.email, url: res.inviteUrl, expiresAt: res.expiresAt })
      else setMsg(t('team.invitedNoLink', { email: member.email }))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLinkBusy(null)
    }
  }

  async function changeRole(member: Member, next: string) {
    setError(null)
    try {
      await api.updateMemberRole(member.id, next)
      setItems((prev) => prev.map((m) => (m.id === member.id ? { ...m, role: next } : m)))
      setMsg(t('team.roleChanged', { name: member.name }))
    } catch (e) {
      setError((e as Error).message)
    }
  }

  async function remove(member: Member) {
    if (!window.confirm(t('team.confirmRemove', { name: member.name }))) return
    setError(null)
    try {
      await api.removeMember(member.id)
      setItems((prev) => prev.filter((m) => m.id !== member.id))
      setMsg(t('team.removed', { name: member.name }))
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <div className="ops-page">
      <header className="ops-page-head">
        <div>
          <p className="ops-kicker">{t('nav.groupManage')}</p>
          <h1>{t('pages.teamTitle')}</h1>
          <p>{t('pages.teamSub')}</p>
        </div>
      </header>

      {error && <div className="form-banner error">{error}</div>}
      {msg && <div className="form-banner ok">{msg}</div>}
      {inviteLink && (
        <div className="panel panel-pad invite-box" style={{ marginBottom: '1rem' }}>
          <p className="section-sub" style={{ marginBottom: '0.45rem' }}>
            {t('team.linkReadyFor', { email: inviteLink.email })}
          </p>
          <code className="invite-code" dir="ltr">
            {inviteLink.url}
          </code>
          <div className="form-actions" style={{ marginTop: '0.65rem' }}>
            <CopyButton text={inviteLink.url} label={t('team.copyInvite')} />
            <button type="button" className="btn btn-outline btn-sm" onClick={() => setInviteLink(null)}>
              {t('common.close')}
            </button>
          </div>
          <p className="section-sub" style={{ marginTop: '0.5rem' }}>
            {t('team.linkSecurity')}
          </p>
        </div>
      )}

      <div className="ops-split">
        {canInvite && (
          <form
            className="panel panel-pad"
            onSubmit={(e) => {
              e.preventDefault()
              void invite()
            }}
          >
            <h2 className="section-title">{t('team.inviteTitle')}</h2>
            <p className="section-sub">{t('team.inviteHint')}</p>
            <div className="field">
              <label htmlFor="team-email">{t('team.email')}</label>
              <input
                id="team-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="colleague@example.com"
                autoComplete="off"
                dir="ltr"
                required
              />
            </div>
            <div className="field">
              <label htmlFor="team-name">{t('team.name')}</label>
              <input id="team-name" value={name} onChange={(e) => setName(e.target.value)} placeholder={t('team.namePh')} />
            </div>
            <div className="field">
              <label htmlFor="team-role">{t('team.role')}</label>
              <select id="team-role" value={role} onChange={(e) => setRole(e.target.value)}>
                {grantable.map((r) => (
                  <option key={r} value={r}>
                    {t(`roles.${r}`)}
                  </option>
                ))}
              </select>
              <span className="field-hint">{t(`roleHints.${role}`)}</span>
            </div>
            <button type="submit" className="btn btn-solid" disabled={busy || !email.trim()}>
              {busy ? t('common.saving') : t('team.createInvite')}
            </button>
          </form>
        )}

        <section className="panel panel-pad">
          <h2 className="section-title">{t('team.members')}</h2>
          <div className="page-list">
            {items.map((m) => {
              const isSelf = m.id === session?.user.id
              return (
                <article key={m.id} className="list-item">
                  <div className="list-meta">
                    <h3>
                      {m.name}
                      {isSelf ? <span className="section-sub"> · {t('team.you')}</span> : null}
                    </h3>
                    <span className="meta-badge">{t(`roles.${m.role}`)}</span>
                  </div>
                  <p dir="ltr" style={{ textAlign: lang === 'fa' ? 'right' : 'left' }}>
                    {m.email}
                  </p>
                  <p>
                    {m.lastLoginAt
                      ? t('team.lastLogin', { when: relativeTime(m.lastLoginAt, lang) })
                      : t('team.neverLoggedIn')}
                  </p>
                  {canInvite && (
                    <div className="form-actions">
                      {!(m.role === 'admin' && !isAdmin) && (
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          disabled={linkBusy === m.id}
                          onClick={() => void mintLink(m)}
                        >
                          <Link2 size={13} aria-hidden />
                          {linkBusy === m.id ? t('common.loading') : t('team.loginLink')}
                        </button>
                      )}
                      {isAdmin && !isSelf && (
                        <label className="inline-select">
                          <ShieldCheck size={13} aria-hidden />
                          <select value={m.role} onChange={(e) => void changeRole(m, e.target.value)}>
                            {ROLES.map((r) => (
                              <option key={r} value={r}>
                                {t(`roles.${r}`)}
                              </option>
                            ))}
                          </select>
                        </label>
                      )}
                      {isAdmin && !isSelf && (
                        <button type="button" className="btn btn-outline btn-sm" onClick={() => void remove(m)}>
                          <Trash2 size={13} aria-hidden />
                          {t('common.delete')}
                        </button>
                      )}
                    </div>
                  )}
                </article>
              )
            })}
          </div>
        </section>
      </div>
    </div>
  )
}
