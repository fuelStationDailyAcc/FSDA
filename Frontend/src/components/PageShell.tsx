import heroBg from '../assets/hero-bg.png'
import type { ReactNode } from 'react'
import '../pages/HeroPage.css'

function PageShell({ children }: { children: ReactNode }) {
  return (
    <main className="hero-page">
      <img className="hero-bg" src={heroBg} alt="" />
      {children}
    </main>
  )
}

export default PageShell
