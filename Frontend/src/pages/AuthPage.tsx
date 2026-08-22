import { Link, Navigate } from 'react-router-dom'
import AuthForm from '../components/AuthForm'
import BrandLogo from '../components/BrandLogo'
import PwaInstallButton from '../components/PwaInstallButton'
import ThemeIconButton from '../components/ThemeIconButton'
import { IconCheck } from '../components/landing/icons'
import { useAuth } from '../context/AuthContext'
import './AuthPage.css'

const HIGHLIGHTS = [
  'Meter readings & cash reconciliation',
  'Party ledger & credit tracking',
  'Profit analytics & day history',
]

function AuthPage() {
  const { user, loading } = useAuth()

  if (!loading && user) {
    return <Navigate to="/dashboard" replace />
  }

  return (
    <div className="auth-page">
      <div className="auth-page-glow" aria-hidden="true" />
      <header className="auth-page-nav">
        <div className="auth-page-nav-inner">
          <Link to="/" className="auth-page-brand">
            <BrandLogo className="auth-page-brand-logo" alt="" size={36} />
            <div className="auth-page-brand-copy">
              <span className="auth-page-brand-mark">PetroBook</span>
              <span className="auth-page-brand-sub">Fuel station accounting</span>
            </div>
          </Link>
          <div className="auth-page-nav-actions">
            <ThemeIconButton />
            <PwaInstallButton />
            <Link to="/" className="auth-page-back-link">
              Back to home
            </Link>
          </div>
        </div>
      </header>

      <div className="auth-page-grid">
        <section className="auth-page-promo">
          <p className="auth-page-eyebrow">Built for petroleum retail</p>
          <h1>
            Sign in to your
            <span className="auth-page-gradient"> station workspace</span>
          </h1>
          <p className="auth-page-lead">
            Manage daily accounts, track meter readings, reconcile cash, and monitor profits —
            all from one professional dashboard.
          </p>
          <ul className="auth-page-checklist">
            {HIGHLIGHTS.map((item) => (
              <li key={item}>
                <IconCheck />
                {item}
              </li>
            ))}
          </ul>
        </section>

        <section className="auth-page-card">
          <h2>Get started</h2>
          <p className="auth-page-card-lead">Sign in or create your station account.</p>
          <AuthForm />
        </section>
      </div>
    </div>
  )
}

export default AuthPage
