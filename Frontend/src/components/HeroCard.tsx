import { Link } from 'react-router-dom'
import BrandLogo from './BrandLogo'

function HeroCard() {
  return (
    <section className="hero-card">
      <BrandLogo className="hero-logo" alt="FuelSNC Daily Accounts" size={512} />
      <h1>
        FuelSNC
        <br />
        Daily Accounts
      </h1>
      <p className="tagline">Ledger • Meters • Station Operations</p>
      <Link to="/login" className="cta">
        GET STARTED
        <span className="cta-arrow" aria-hidden="true" />
      </Link>
    </section>
  )
}

export default HeroCard
