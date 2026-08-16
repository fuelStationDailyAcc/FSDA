import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

function DashboardPage() {
  const { user } = useAuth()

  return (
    <div>
      <section className="panel">
        <h1 className="page-title">Welcome, {user?.username}</h1>
        <p className="muted" style={{ marginTop: 8 }}>
          FuelSNC Daily Accounts — enter meter readings, expenses, and ledger entries for each
          accounting day.
        </p>
        <div className="toolbar" style={{ marginTop: 18 }}>
          <Link to="/accounts" className="btn" style={{ textDecoration: 'none' }}>
            Open Daily Accounts
          </Link>
          <Link to="/settings" className="btn-secondary" style={{ textDecoration: 'none' }}>
            Settings
          </Link>
        </div>
      </section>
    </div>
  )
}

export default DashboardPage
