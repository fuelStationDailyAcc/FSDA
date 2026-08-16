import { useNavigate } from 'react-router-dom'
import PageShell from '../components/PageShell'
import { useAuth } from '../context/AuthContext'

function DashboardPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <PageShell>
      <section className="hero-card">
        <h1>
          WELCOME
          <br />
          {user?.username}
        </h1>
        <p className="tagline">
          You are signed in to FuelSNC Daily Accounts.
        </p>
        <p className="tagline">{user?.email}</p>
        <button type="button" className="cta" onClick={handleLogout}>
          LOG OUT
          <span className="cta-arrow" aria-hidden="true" />
        </button>
      </section>
    </PageShell>
  )
}

export default DashboardPage
