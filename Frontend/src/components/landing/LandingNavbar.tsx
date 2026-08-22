import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import BrandLogo from '../BrandLogo'
import PwaInstallButton from '../PwaInstallButton'
import ThemeIconButton from '../ThemeIconButton'
import { useAuth } from '../../context/AuthContext'

const NAV_LINKS = [
  { href: '#features', label: 'Features' },
  { href: '#workflow', label: 'How it works' },
  { href: '#highlights', label: 'Why PetroBook' },
]

function LandingNavbar() {
  const { user, loading, logout } = useAuth()
  const navigate = useNavigate()
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const signedIn = !loading && Boolean(user)
  const stationLabel = user?.stationName?.trim() || user?.username || 'My station'

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 12)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    document.body.classList.toggle('landing-nav-open', menuOpen)
    return () => document.body.classList.remove('landing-nav-open')
  }, [menuOpen])

  function closeMenu() {
    setMenuOpen(false)
  }

  async function handleLogout() {
    closeMenu()
    await logout()
    navigate('/', { replace: true })
  }

  return (
    <header className={`landing-nav${scrolled ? ' is-scrolled' : ''}${menuOpen ? ' is-open' : ''}`}>
      <div className="landing-nav-inner">
        <Link to="/" className="landing-brand" onClick={closeMenu}>
          <BrandLogo className="landing-brand-logo" alt="" size={36} />
          <div className="landing-brand-copy">
            <span className="landing-brand-mark">PetroBook</span>
            <span className="landing-brand-sub">Fuel station accounting</span>
          </div>
        </Link>

        <nav className="landing-nav-links" aria-label="Primary">
          {NAV_LINKS.map((link) => (
            <a key={link.href} href={link.href} onClick={closeMenu}>
              {link.label}
            </a>
          ))}
        </nav>

        <div className="landing-nav-actions">
          <ThemeIconButton className="landing-theme-btn" />
          <PwaInstallButton />
          {signedIn ? (
            <div className="landing-user-menu">
              <button type="button" className="landing-user-trigger" aria-haspopup="menu">
                <span className="landing-user-name">{stationLabel}</span>
                <svg
                  className="landing-user-chevron"
                  viewBox="0 0 24 24"
                  width="16"
                  height="16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden="true"
                >
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>
              <div className="landing-user-dropdown" role="menu">
                <Link to="/dashboard" className="landing-user-dropdown-item" role="menuitem" onClick={closeMenu}>
                  Dashboard
                </Link>
                <button
                  type="button"
                  className="landing-user-dropdown-item landing-user-dropdown-logout"
                  role="menuitem"
                  onClick={() => void handleLogout()}
                >
                  Log out
                </button>
              </div>
            </div>
          ) : (
            <>
              <Link to="/login" className="landing-btn landing-btn-ghost">
                Sign in
              </Link>
              <Link to="/login" className="landing-btn landing-btn-primary">
                Get started
              </Link>
            </>
          )}
          <button
            type="button"
            className="landing-nav-toggle"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            aria-controls="landing-mobile-nav"
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span aria-hidden="true" />
            <span aria-hidden="true" />
            <span aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="landing-mobile-nav" id="landing-mobile-nav">
        {signedIn ? (
          <div className="landing-mobile-user-label">
            <span>Signed in as</span>
            <strong>{stationLabel}</strong>
          </div>
        ) : null}
        {NAV_LINKS.map((link) => (
          <a key={link.href} href={link.href} onClick={closeMenu}>
            {link.label}
          </a>
        ))}
        {signedIn ? (
          <>
            <Link to="/dashboard" className="landing-mobile-user-link" onClick={closeMenu}>
              Dashboard
            </Link>
            <button
              type="button"
              className="landing-mobile-user-logout"
              onClick={() => void handleLogout()}
            >
              Log out
            </button>
          </>
        ) : (
          <Link to="/login" className="landing-btn landing-btn-primary landing-mobile-cta" onClick={closeMenu}>
            Get started free
          </Link>
        )}
      </div>
    </header>
  )
}

export default LandingNavbar
