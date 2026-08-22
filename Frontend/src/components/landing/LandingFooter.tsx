import { Link } from 'react-router-dom'
import BrandLogo from '../BrandLogo'

function LandingFooter() {
  const year = new Date().getFullYear()

  return (
    <footer className="landing-footer">
      <div className="landing-container landing-footer-grid">
        <div className="landing-footer-brand">
          <Link to="/" className="landing-brand">
            <BrandLogo className="landing-brand-logo" alt="" size={32} />
            <div className="landing-brand-copy">
              <span className="landing-brand-mark">PetroBook</span>
              <span className="landing-brand-sub">Daily accounts for fuel stations</span>
            </div>
          </Link>
          <p className="landing-footer-tagline">
            Ledger, meters, and station operations — simplified.
          </p>
        </div>

        <div className="landing-footer-links">
          <strong>Product</strong>
          <a href="#features">Features</a>
          <a href="#workflow">How it works</a>
          <a href="#highlights">Why PetroBook</a>
        </div>

        <div className="landing-footer-links">
          <strong>Account</strong>
          <Link to="/login">Sign in</Link>
          <Link to="/login">Register station</Link>
        </div>
      </div>

      <div className="landing-container landing-footer-bottom">
        <span>© {year} PetroBook. All rights reserved.</span>
      </div>
    </footer>
  )
}

export default LandingFooter
