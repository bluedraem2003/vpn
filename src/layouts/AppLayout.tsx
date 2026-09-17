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
} from 'lucide-react'
import { useAuth } from '../auth/AuthContext'

const links = [
  { to: '/', label: 'داشبورد', icon: LayoutDashboard, end: true },
  { to: '/calendar', label: 'تقویم محتوا', icon: CalendarDays },
  { to: '/content', label: 'محتوا', icon: FileText },
  { to: '/ideas', label: 'ایده‌ها', icon: Lightbulb },
  { to: '/assets', label: 'دارایی‌ها', icon: FolderOpen },
  { to: '/telegram', label: 'تلگرام', icon: Send },
  { to: '/projects', label: 'پروژه‌ها', icon: FolderKanban },
  { to: '/campaigns', label: 'کمپین‌ها', icon: Megaphone },
  { to: '/studio', label: 'استودیو', icon: Sparkles },
  { to: '/team', label: 'تیم', icon: Users },
  { to: '/analytics', label: 'آنالیتیکس', icon: BarChart3 },
  { to: '/settings', label: 'تنظیمات', icon: Settings },
]

export function AppLayout() {
  const { session, logout } = useAuth()

  return (
    <div className="ops-shell">
      <aside className="ops-sidebar" aria-label="ناوبری اصلی">
        <div className="ops-brand">
          <div className="brand-mark" aria-hidden>
            پ
          </div>
          <div>
            <strong>پست‌یار</strong>
            <span>Content Ops</span>
          </div>
        </div>
        <nav className="ops-nav">
          {links.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => (isActive ? 'active' : '')}>
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="ops-user">
          <div>
            <strong>{session?.user.name}</strong>
            <span>{session?.role}</span>
          </div>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => void logout()} title="خروج">
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
