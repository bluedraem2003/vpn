import { NavLink, Outlet } from 'react-router-dom'
import {
  LayoutDashboard,
  CalendarDays,
  FileText,
  Lightbulb,
  FolderOpen,
  Send,
  FolderKanban,
  Megaphone,
  Users,
  BarChart3,
  Settings,
  Sparkles,
  LogOut,
  PartyPopper,
} from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { AppearanceControls } from '../components/AppearanceControls'
import { useI18n } from '../prefs/PrefsProvider'

const links = [
  { to: '/', key: 'nav.dashboard', icon: LayoutDashboard, end: true },
  { to: '/calendar', key: 'nav.calendar', icon: CalendarDays },
  { to: '/occasions', key: 'nav.occasions', icon: PartyPopper },
  { to: '/content', key: 'nav.content', icon: FileText },
  { to: '/ideas', key: 'nav.ideas', icon: Lightbulb },
  { to: '/assets', key: 'nav.assets', icon: FolderOpen },
  { to: '/telegram', key: 'nav.telegram', icon: Send },
  { to: '/projects', key: 'nav.projects', icon: FolderKanban },
  { to: '/campaigns', key: 'nav.campaigns', icon: Megaphone },
  { to: '/studio', key: 'nav.studio', icon: Sparkles },
  { to: '/team', key: 'nav.team', icon: Users },
  { to: '/analytics', key: 'nav.analytics', icon: BarChart3 },
  { to: '/settings', key: 'nav.settings', icon: Settings },
]

export function AppLayout() {
  const { session, logout } = useAuth()
  const { t, lang } = useI18n()

  return (
    <div className="ops-shell">
      <aside className="ops-sidebar" aria-label={t('nav.dashboard')}>
        <div className="ops-brand">
          <div className="brand-mark" aria-hidden>
            {lang === 'fa' ? 'پ' : 'P'}
          </div>
          <div>
            <strong>{t('brand')}</strong>
            <span>{t('brandSub')}</span>
          </div>
        </div>
        <nav className="ops-nav">
          {links.map(({ to, key, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => (isActive ? 'active' : '')}>
              <Icon size={16} />
              {t(key)}
            </NavLink>
          ))}
        </nav>
        <AppearanceControls compact />
        <div className="ops-user">
          <div>
            <strong>{session?.user.name}</strong>
            <span>{session?.role}</span>
          </div>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => void logout()} title={t('common.logout')}>
            <LogOut size={14} />
          </button>
        </div>
      </aside>
      <main className="ops-main">
        <Outlet />
      </main>
    </div>
  )
}
