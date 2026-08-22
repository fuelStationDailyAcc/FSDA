import LandingNavbar from '../components/landing/LandingNavbar'
import LandingHero from '../components/landing/LandingHero'
import LandingFeatures from '../components/landing/LandingFeatures'
import LandingWorkflow from '../components/landing/LandingWorkflow'
import LandingHighlights from '../components/landing/LandingHighlights'
import LandingCta from '../components/landing/LandingCta'
import LandingFooter from '../components/landing/LandingFooter'
import './HeroPage.css'

function HeroPage() {
  return (
    <div className="landing">
      <LandingNavbar />
      <main>
        <LandingHero />
        <LandingFeatures />
        <LandingWorkflow />
        <LandingHighlights />
        <LandingCta />
      </main>
      <LandingFooter />
    </div>
  )
}

export default HeroPage
