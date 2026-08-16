import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import heroBg from '../assets/hero-bg.png'
import { useAuth } from '../context/AuthContext'
import './AppShell.css'

function AppShell() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="app-shell">
      <img className="app-bg" src={heroBg} alt="" />
      <header className="app-topbar">
        <div className="app-brand">
          <span className="app-brand-mark">FuelSNC</span>
          <span className="app-brand-sub">Daily Accounts</span>
        </div>
        <nav className="app-nav" aria-label="Main">
          <NavLink to="/dashboard" end>
            Home
          </NavLink>
          <NavLink to="/accounts">Daily Accounts</NavLink>
          <NavLink to="/parties">Parties</NavLink>
          <NavLink to="/settings">Settings</NavLink>
        </nav>
        <div className="app-user">
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
