import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import BrandLogo from './BrandLogo'
import PwaInstallButton from './PwaInstallButton'
import ThemeIconButton from './ThemeIconButton'
import {
  IconCash,
  IconChart,
  IconHistory,
  IconHome,
  IconLedger,
  IconLogout,
  IconMeter,
  IconSettings,
  IconUsers,
} from './landing/icons'
import { useAuth } from '../context/AuthContext'
import { hasPermission, isOwner } from '../lib/permissions'
import './AppShell.css'

type NavItem = {
  to: string
  label: string
  icon: ReactNode
  end?: boolean
}

function AppShell() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const owner = isOwner(user)
  const [pinnedOpen, setPinnedOpen] = useState(false)

  const navItems = useMemo(() => {
    const items: NavItem[] = [{ to: '/dashboard', label: 'Home', icon: <IconHome />, end: true }]

    if (hasPermission(user, 'accounts.read')) {
      items.push(
        { to: '/accounts', label: 'Daily Accounts', icon: <IconMeter /> },
        { to: '/history', label: 'History', icon: <IconHistory /> },
        { to: '/analytics', label: 'Analytics', icon: <IconChart /> }
      )
    }

    if (hasPermission(user, 'ledger.read')) {
      items.push({ to: '/ledger', label: 'Ledger', icon: <IconLedger /> })
    }

    if (owner && user?.role !== 'staff') {
      items.push(
        { to: '/staff', label: 'Staff', icon: <IconUsers /> },
        { to: '/salaries', label: 'Salaries', icon: <IconCash /> }
      )
    }

    if (hasPermission(user, 'settings.read')) {
      items.push({ to: '/settings', label: 'Settings', icon: <IconSettings /> })
    }

    return items
  }, [owner, user])

  useEffect(() => {
    setPinnedOpen(false)
  }, [location.pathname])

  useEffect(() => {
    document.body.classList.toggle('nav-menu-open', pinnedOpen)
    return () => document.body.classList.remove('nav-menu-open')
  }, [pinnedOpen])

  async function handleLogout() {
    setPinnedOpen(false)
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="app-shell">
      {pinnedOpen ? (
        <button
          type="button"
          className="app-nav-backdrop"
          aria-label="Close menu"
          onClick={() => setPinnedOpen(false)}
        />
      ) : null}
      <div className="app-layout">
        <aside className={`app-sidebar${pinnedOpen ? ' is-pinned' : ''}`}>
          <div
            className="app-sidebar-head"
            onClick={() => {
              if (window.matchMedia('(hover: none)').matches) {
                setPinnedOpen((open) => !open)
              }
            }}
          >
            <div className="app-brand">
              <BrandLogo className="app-brand-logo" alt="" size={36} />
              <div className="app-brand-copy">
                <span className="app-brand-mark">PetroBook</span>
                <span className="app-brand-sub">Fuel station accounting</span>
              </div>
            </div>
          </div>
          <nav className="app-nav" id="app-main-nav" aria-label="Main">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className="app-nav-link"
                title={item.label}
                onClick={() => setPinnedOpen(false)}
              >
                <span className="app-nav-icon">{item.icon}</span>
                <span className="app-nav-label">{item.label}</span>
              </NavLink>
            ))}
          </nav>
          <div className="app-sidebar-footer">
            <div className="app-user">
              <ThemeIconButton />
              <PwaInstallButton />
              <span className="app-user-name">{user?.username}</span>
              <button
                type="button"
                className="btn-ghost app-logout-btn"
                title="Log out"
                onClick={() => void handleLogout()}
              >
                <span className="app-nav-icon">
                  <IconLogout />
                </span>
                <span className="app-nav-label">Log out</span>
              </button>
            </div>
          </div>
        </aside>
        <main className="app-main">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default AppShell
