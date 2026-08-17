import type { ReactNode } from 'react'
import heroBg from '../assets/hero-bg.png'
import BrandLogo from './BrandLogo'
import PwaInstallButton from './PwaInstallButton'
import '../pages/HeroPage.css'

function PageShell({ children }: { children: ReactNode }) {
  return (
    <main className="hero-page">
      <img className="hero-bg" src={heroBg} alt="" />
      <div className="theme-grid" aria-hidden="true" />
      <header className="hero-topbar">
        <div className="hero-brand">
          <BrandLogo className="hero-brand-logo" alt="" size={40} />
          <div className="hero-brand-copy">
            <span className="hero-brand-mark">FuelSNC</span>
            <span className="hero-brand-sub">Daily Accounts</span>
          </div>
        </div>
        <PwaInstallButton />
      </header>
      {children}
    </main>
  )
}

export default PageShell
