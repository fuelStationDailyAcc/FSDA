import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import heroBg from '../assets/hero-bg.png'
import BrandLogo from './BrandLogo'
import PwaInstallButton from './PwaInstallButton'
import { useAuth } from '../context/AuthContext'
import { hasPermission, isOwner } from '../lib/permissions'
import './AppShell.css'

function AppShell() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const owner = isOwner(user)
  const [navOpen, setNavOpen] = useState(false)

  useEffect(() => {
    setNavOpen(false)
  }, [location.pathname])

  useEffect(() => {
    document.body.classList.toggle('nav-menu-open', navOpen)
    return () => document.body.classList.remove('nav-menu-open')
  }, [navOpen])

  async function handleLogout() {
    setNavOpen(false)
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="app-shell">
      <img className="app-bg" src={heroBg} alt="" />
      <div className="theme-grid" aria-hidden="true" />
      {navOpen ? (
        <button
          type="button"
          className="app-nav-backdrop"
          aria-label="Close menu"
          onClick={() => setNavOpen(false)}
        />
      ) : null}
      <header className={`app-topbar${navOpen ? ' nav-open' : ''}`}>
        <div className="app-topbar-main">
          <div className="app-brand">
            <BrandLogo className="app-brand-logo" alt="" size={40} />
            <div className="app-brand-copy">
              <span className="app-brand-mark">PetroBook</span>
              <span className="app-brand-sub">Daily Accounts</span>
            </div>
          </div>
          <div className="app-topbar-end">
            <div className="app-user">
              <PwaInstallButton />
              <span className="app-user-name">{user?.username}</span>
              <button type="button" className="btn-ghost app-logout-btn" onClick={() => void handleLogout()}>
                Log out
              </button>
            </div>
            <button
              type="button"
              className="app-nav-toggle"
              aria-label={navOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={navOpen}
              aria-controls="app-main-nav"
              onClick={() => setNavOpen((open) => !open)}
            >
              <span className="app-nav-toggle-icon" aria-hidden="true">
                <span />
                <span />
                <span />
              </span>
            </button>
          </div>
        </div>
        <nav className="app-nav" id="app-main-nav" aria-label="Main">
          <NavLink to="/dashboard" end onClick={() => setNavOpen(false)}>
            Home
          </NavLink>
          {hasPermission(user, 'accounts.read') ? (
            <>
              <NavLink to="/accounts" onClick={() => setNavOpen(false)}>
                Daily Accounts
              </NavLink>
              <NavLink to="/history" onClick={() => setNavOpen(false)}>
                History
              </NavLink>
              <NavLink to="/analytics" onClick={() => setNavOpen(false)}>
                Analytics
              </NavLink>
            </>
          ) : null}
          {hasPermission(user, 'ledger.read') ? (
            <NavLink to="/ledger" onClick={() => setNavOpen(false)}>
              Ledger
            </NavLink>
          ) : null}
          {owner && user?.role !== 'staff' ? (
            <>
              <NavLink to="/staff" onClick={() => setNavOpen(false)}>
                Staff
              </NavLink>
              <NavLink to="/salaries" onClick={() => setNavOpen(false)}>
                Salaries
              </NavLink>
            </>
          ) : null}
          {hasPermission(user, 'settings.read') ? (
            <NavLink to="/settings" onClick={() => setNavOpen(false)}>
              Settings
            </NavLink>
          ) : null}
          <div className="app-nav-user-mobile">
            <span className="app-nav-user-label">Signed in as</span>
            <strong>{user?.username}</strong>
          </div>
        </nav>
      </header>
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  )
}

export default AppShell
