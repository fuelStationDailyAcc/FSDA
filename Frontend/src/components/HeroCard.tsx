import { Link } from 'react-router-dom'
import BrandLogo from './BrandLogo'
import FuelPump from './FuelPump'

function HeroCard() {
  return (
    <section className="hero-card">
      <BrandLogo className="hero-card-logo" alt="PetroBook" size={112} />
      <h1>
        PetroBook
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
