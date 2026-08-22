import { Link } from 'react-router-dom'
import { IconArrowRight } from './icons'

function LandingCta() {
  return (
    <section className="landing-cta">
      <div className="landing-container">
        <div className="landing-cta-card">
          <div className="landing-cta-copy">
            <h2>Ready to modernize your station accounts?</h2>
            <p>
              Create your station in minutes. Default products, payment methods, and categories
              are set up automatically — just sign up and open your first day.
            </p>
          </div>
          <div className="landing-cta-actions">
            <Link to="/login" className="landing-btn landing-btn-white landing-btn-lg">
              Create free account
              <IconArrowRight className="landing-btn-icon" />
            </Link>
            <Link to="/login" className="landing-btn landing-btn-ghost-white landing-btn-lg">
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}

export default LandingCta
