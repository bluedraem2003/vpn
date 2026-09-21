import { useEffect, useState } from 'react'
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
  PartyPopper,
  Menu,
  X,
  Bell,
  type LucideIcon,
} from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { AppearanceControls } from '../components/AppearanceControls'
import { useI18n } from '../prefs/PrefsProvider'
import { useNotifications } from '../notifications/useNotifications'

type NavLinkDef = { to: string; key: string; icon: LucideIcon; end?: boolean; badge?: boolean }

const groups: Array<{ key: string; links: NavLinkDef[] }> = [
  {
    key: 'nav.groupPlan',
    links: [
      { to: '/', key: 'nav.dashboard', icon: LayoutDashboard, end: true },
      { to: '/calendar', key: 'nav.calendar', icon: CalendarDays },
      { to: '/occasions', key: 'nav.occasions', icon: PartyPopper },
    ],
  },
  {
    key: 'nav.groupCreate',
    links: [
      { to: '/content', key: 'nav.content', icon: FileText },
      { to: '/ideas', key: 'nav.ideas', icon: Lightbulb },
      { to: '/studio', key: 'nav.studio', icon: Sparkles },
      { to: '/campaigns', key: 'nav.campaigns', icon: Megaphone },
    ],
  },
  {
    key: 'nav.groupLibrary',
    links: [
      { to: '/assets', key: 'nav.assets', icon: FolderOpen },
      { to: '/telegram', key: 'nav.telegram', icon: Send },
      { to: '/projects', key: 'nav.projects', icon: FolderKanban },
    ],
  },
  {
    key: 'nav.groupManage',
    links: [
      { to: '/notifications', key: 'nav.notifications', icon: Bell, badge: true },
      { to: '/team', key: 'nav.team', icon: Users },
      { to: '/analytics', key: 'nav.analytics', icon: BarChart3 },
      { to: '/settings', key: 'nav.settings', icon: Settings },
    ],
  },
]

export function AppLayout() {
  const { session } = useAuth()
  const { t, lang } = useI18n()
  const [menuOpen, setMenuOpen] = useState(false)
  const { unread } = useNotifications({ limit: 1 })

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 981px)')
    const onChange = () => {
      if (mq.matches) setMenuOpen(false)
    }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    document.body.classList.toggle('nav-open', menuOpen)
    return () => document.body.classList.remove('nav-open')
  }, [menuOpen])

  return (
    <div className="ops-shell">
      <a className="skip-link" href="#main-content">
        {t('nav.skip')}
      </a>
      <aside className={`ops-sidebar ${menuOpen ? 'is-open' : ''}`} aria-label={t('nav.aria')}>
        <div className="ops-sidebar-top">
          <div className="ops-brand">
            <div className="brand-mark" aria-hidden>
              {lang === 'fa' ? 'پ' : 'P'}
            </div>
            <div>
              <strong>{t('brand')}</strong>
              <span>{t('brandSub')}</span>
            </div>
          </div>
          <button
            type="button"
            className="ops-menu-toggle"
            aria-expanded={menuOpen}
            aria-controls="ops-nav"
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <X size={18} aria-hidden /> : <Menu size={18} aria-hidden />}
            <span className="sr-only">{menuOpen ? t('nav.closeMenu') : t('nav.menu')}</span>
          </button>
        </div>
        <div className="ops-sidebar-body" id="ops-nav">
          <nav className="ops-nav">
            {groups.map((group) => (
              <div key={group.key} className="ops-nav-group">
                <p className="ops-nav-label">{t(group.key)}</p>
                {group.links.map(({ to, key, icon: Icon, end, badge }) => (
                  <NavLink
                    key={to}
                    to={to}
                    end={end}
                    className={({ isActive }) => (isActive ? 'active' : '')}
                    onClick={() => setMenuOpen(false)}
                  >
                    <Icon size={16} aria-hidden />
                    {t(key)}
                    {badge && unread > 0 && (
                      <span className="nav-badge" aria-label={t('notif.unreadAria', { n: unread })}>
                        {unread > 99 ? '99+' : unread}
                      </span>
                    )}
                  </NavLink>
                ))}
              </div>
            ))}
          </nav>
          <div className="ops-sidebar-foot">
            <AppearanceControls compact />
            <div className="ops-user">
              <div>
                <strong>{session?.user.name}</strong>
                <span>{session?.role}</span>
              </div>
            </div>
          </div>
        </div>
      </aside>
      <main className="ops-main" id="main-content">
        <Outlet />
      </main>
    </div>
  )
}
