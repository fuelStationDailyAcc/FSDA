import { IconCheck } from './icons'

const HIGHLIGHTS = [
  'Chains meter readings across days automatically',
  'Carries pending and advance cash between dates',
  'PDF day reports for your records',
  'Installable PWA — works like a native app',
  'Staff salaries and role management for owners',
  'History search across closed accounting days',
]

const STATS = [
  { value: '6+', label: 'Core modules' },
  { value: '24/7', label: 'Access anywhere' },
  { value: '100%', label: 'Paperless closing' },
]

function LandingHighlights() {
  return (
    <section className="landing-section" id="highlights">
      <div className="landing-container landing-highlights-grid">
        <div className="landing-highlights-copy">
          <p className="landing-eyebrow">Why stations choose PetroBook</p>
          <h2>Built for accuracy, speed, and peace of mind</h2>
          <p className="landing-section-lead">
            Stop reconciling notebooks at midnight. PetroBook gives owners and staff a shared,
            reliable source of truth for every accounting day.
          </p>
          <ul className="landing-checklist">
            {HIGHLIGHTS.map((item) => (
              <li key={item}>
                <IconCheck />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="landing-stats-panel">
          <div className="landing-stats-grid">
            {STATS.map((stat) => (
              <div key={stat.label} className="landing-stat">
                <strong>{stat.value}</strong>
                <span>{stat.label}</span>
              </div>
            ))}
          </div>
          <blockquote className="landing-quote">
            <p>
              &ldquo;The daily sheet workflow we already follow — just faster, searchable, and
              impossible to lose.&rdquo;
            </p>
            <footer>Designed for Indian fuel retail stations</footer>
          </blockquote>
        </div>
      </div>
    </section>
  )
}

export default LandingHighlights
