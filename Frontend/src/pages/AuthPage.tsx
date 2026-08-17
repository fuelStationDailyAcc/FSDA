import { Link, Navigate } from 'react-router-dom'
import AuthForm from '../components/AuthForm'
import BrandLogo from '../components/BrandLogo'
import PageShell from '../components/PageShell'
import { useAuth } from '../context/AuthContext'
import './AuthPage.css'

function AuthPage() {
  const { user, loading } = useAuth()

  if (!loading && user) {
    return <Navigate to="/dashboard" replace />
  }

  return (
    <PageShell>
      <section className="hero-card auth-card">
        <Link to="/" className="auth-back">
          <BrandLogo className="auth-back-logo" alt="" size={40} />
          FuelSNC Daily Accounts
        </Link>
        <h1>Get started</h1>
        <p className="tagline">Sign in or create your station ledger account.</p>
        <AuthForm />
      </section>
    </PageShell>
  )
}

export default AuthPage
