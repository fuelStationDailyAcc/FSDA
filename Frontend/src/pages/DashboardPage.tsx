import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { hasPermission, isOwner } from '../lib/permissions'
import ThemeToggle from '../components/ThemeToggle'

function DashboardPage() {
  const { user } = useAuth()
  const owner = isOwner(user)

  return (
    <div>
      <section className="panel">
        <div className="panel-head">
          <h1 className="page-title">
            {user?.stationName
              ? `Welcome to ${user.stationName}`
              : `Welcome, ${user?.username}`}
          </h1>
          <ThemeToggle />
        </div>
        <p className="muted" style={{ marginTop: 8 }}>
          FuelSNC Daily Accounts — enter meter readings, expenses, and ledger entries for each
          accounting day.
        </p>
        <div className="toolbar" style={{ marginTop: 18 }}>
          {hasPermission(user, 'accounts.read') ? (
            <>
              <Link to="/accounts" className="btn" style={{ textDecoration: 'none' }}>
                Open Daily Accounts
              </Link>
              <Link to="/history" className="btn-secondary" style={{ textDecoration: 'none' }}>
                View History
              </Link>
            </>
          ) : null}
          {hasPermission(user, 'settings.read') ? (
            <Link to="/settings" className="btn-secondary" style={{ textDecoration: 'none' }}>
              Settings
            </Link>
          ) : null}
          {owner && user?.role !== 'staff' ? (
            <Link to="/staff" className="btn-secondary" style={{ textDecoration: 'none' }}>
              Staff
            </Link>
          ) : null}
        </div>
      </section>
    </div>
  )
}

export default DashboardPage
