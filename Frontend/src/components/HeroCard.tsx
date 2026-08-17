import { Link } from 'react-router-dom'
import FuelPump from './FuelPump'

function HeroCard() {
  return (
    <section className="hero-card">
      <h1>
        FuelSNC
        <br />
        Daily Accounts
      </h1>
      <p className="tagline">Ledger • Meters • Station Operations</p>
      <div className="pumps" aria-hidden="true">
        <FuelPump fill="#3f8f3a" />
        <FuelPump fill="#e6c12b" />
        <FuelPump fill="#3b8fd0" />
      </div>
      <Link to="/login" className="cta">
        GET STARTED
        <span className="cta-arrow" aria-hidden="true" />
      </Link>
    </section>
  )
}

export default HeroCard
