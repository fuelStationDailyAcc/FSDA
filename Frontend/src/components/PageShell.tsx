import type { ReactNode } from 'react'
import heroBg from '../assets/hero-bg.png'
import ThemeToggle from './ThemeToggle'
import '../pages/HeroPage.css'

function PageShell({ children }: { children: ReactNode }) {
  return (
    <main className="hero-page">
      <img className="hero-bg" src={heroBg} alt="" />
      <div className="theme-grid" aria-hidden="true" />
      <header className="hero-topbar">
        <div className="hero-brand">
          <span className="hero-brand-mark">FuelSNC</span>
          <span className="hero-brand-sub">Daily Accounts</span>
        </div>
        <ThemeToggle />
      </header>
      {children}
    </main>
  )
}

export default PageShell
