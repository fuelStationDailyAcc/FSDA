import { Link } from 'react-router-dom'
import FuelPump from '../FuelPump'
import { IconArrowRight } from './icons'

function LandingHero() {
  return (
    <section className="landing-hero">
      <div className="landing-hero-glow" aria-hidden="true" />
      <div className="landing-container landing-hero-grid">
        <div className="landing-hero-copy">
          <p className="landing-eyebrow">Built for petroleum retail</p>
          <h1>
            Your station&apos;s daily accounts,
            <span className="landing-gradient-text"> finally digital.</span>
          </h1>
          <p className="landing-lead">
            Replace handwritten sheets with meter readings, cash reconciliation, ledger entries,
            and profit analytics — all in one clean workspace for your fuel station.
          </p>
          <div className="landing-hero-actions">
            <Link to="/login" className="landing-btn landing-btn-primary landing-btn-lg">
              Start free
              <IconArrowRight className="landing-btn-icon" />
            </Link>
            <a href="#workflow" className="landing-btn landing-btn-outline landing-btn-lg">
              See how it works
            </a>
          </div>
          <ul className="landing-hero-points">
            <li>No spreadsheets required</li>
            <li>Multi-user with permissions</li>
            <li>Works on phone &amp; desktop</li>
          </ul>
        </div>

        <div className="landing-hero-visual" aria-hidden="true">
          <div className="landing-preview">
            <div className="landing-preview-header">
              <div>
                <span className="landing-preview-label">Daily Accounts</span>
                <strong>Saturday, 23 Aug 2026</strong>
              </div>
              <span className="landing-preview-badge">Day open</span>
            </div>

            <div className="landing-preview-meters">
              <div className="landing-preview-meter landing-preview-meter-ms">
                <span>MS</span>
                <strong>1,284 L</strong>
                <small>+412 today</small>
              </div>
              <div className="landing-preview-meter landing-preview-meter-hsd">
                <span>HSD</span>
                <strong>2,910 L</strong>
                <small>+876 today</small>
              </div>
              <div className="landing-preview-meter landing-preview-meter-cng">
                <span>CNG</span>
                <strong>640 kg</strong>
                <small>+198 today</small>
              </div>
            </div>

            <div className="landing-preview-cash">
              <div className="landing-preview-cash-row">
                <span>Expected cash</span>
                <strong>₹ 1,42,800</strong>
              </div>
              <div className="landing-preview-cash-row">
                <span>Taken home</span>
                <strong>₹ 1,40,500</strong>
              </div>
              <div className="landing-preview-cash-bar">
                <div className="landing-preview-cash-fill" />
              </div>
              <div className="landing-preview-cash-row landing-preview-cash-pending">
                <span>Pending carry-forward</span>
                <strong>₹ 2,300</strong>
              </div>
            </div>

            <div className="landing-preview-footer">
              <span className="landing-preview-profit">Today&apos;s profit</span>
              <strong>₹ 18,420</strong>
            </div>
          </div>

          <div className="landing-hero-pumps">
            <FuelPump fill="#22c55e" />
            <FuelPump fill="#eab308" />
            <FuelPump fill="#3b82f6" />
          </div>
        </div>
      </div>
    </section>
  )
}

export default LandingHero
