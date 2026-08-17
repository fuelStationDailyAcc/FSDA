import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import heroBg from '../assets/hero-bg.png'
import { useAuth } from '../context/AuthContext'
import { hasPermission, isOwner } from '../lib/permissions'
import ThemeToggle from './ThemeToggle'
import './AppShell.css'

function AppShell() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const owner = isOwner(user)

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="app-shell">
      <img className="app-bg" src={heroBg} alt="" />
      <div className="theme-grid" aria-hidden="true" />
      <header className="app-topbar">
        <div className="app-brand">
          <span className="app-brand-mark">FuelSNC</span>
          <span className="app-brand-sub">Daily Accounts</span>
        </div>
        <nav className="app-nav" aria-label="Main">
          <NavLink to="/dashboard" end>
            Home
          </NavLink>
          {hasPermission(user, 'accounts.read') ? (
            <>
              <NavLink to="/accounts">Daily Accounts</NavLink>
              <NavLink to="/history">History</NavLink>
            </>
          ) : null}
          {hasPermission(user, 'ledger.read') ? <NavLink to="/ledger">Ledger</NavLink> : null}
          {hasPermission(user, 'settings.read') ? <NavLink to="/settings">Settings</NavLink> : null}
          {owner && user?.role !== 'staff' ? <NavLink to="/staff">Staff</NavLink> : null}
        </nav>
        <div className="app-user">
          <ThemeToggle />
          <span className="app-user-name">{user?.username}</span>
          <button type="button" className="btn-ghost" onClick={handleLogout}>
            Log out
          </button>
        </div>
      </header>
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  )
}

export default AppShell
