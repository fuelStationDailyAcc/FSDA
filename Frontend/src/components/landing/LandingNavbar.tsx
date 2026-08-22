import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import BrandLogo from '../BrandLogo'
import PwaInstallButton from '../PwaInstallButton'
import ThemeIconButton from '../ThemeIconButton'

const NAV_LINKS = [
  { href: '#features', label: 'Features' },
  { href: '#workflow', label: 'How it works' },
  { href: '#highlights', label: 'Why PetroBook' },
]

function LandingNavbar() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

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
          <Link to="/login" className="landing-btn landing-btn-ghost">
            Sign in
          </Link>
          <Link to="/login" className="landing-btn landing-btn-primary">
            Get started
          </Link>
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
        {NAV_LINKS.map((link) => (
          <a key={link.href} href={link.href} onClick={closeMenu}>
            {link.label}
          </a>
        ))}
        <Link to="/login" className="landing-btn landing-btn-primary landing-mobile-cta" onClick={closeMenu}>
          Get started free
        </Link>
      </div>
    </header>
  )
}

export default LandingNavbar
