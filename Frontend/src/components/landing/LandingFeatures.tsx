import {
  IconCash,
  IconChart,
  IconLedger,
  IconMeter,
  IconShield,
  IconUsers,
} from './icons'

const FEATURES = [
  {
    icon: IconMeter,
    title: 'Meter readings',
    description:
      'Record MS, HSD, CNG and more. Readings chain across days so you never lose continuity.',
  },
  {
    icon: IconCash,
    title: 'Cash reconciliation',
    description:
      'Track expected vs actual cash, pending amounts, and advances carried forward automatically.',
  },
  {
    icon: IconLedger,
    title: 'Ledger & udhaar',
    description:
      'Manage customer credit and debit entries alongside your daily sheet — no separate notebook.',
  },
  {
    icon: IconChart,
    title: 'Profit analytics',
    description:
      'See litres sold, profit per litre, and expenses visualized so you know how each day performed.',
  },
  {
    icon: IconUsers,
    title: 'Staff & permissions',
    description:
      'Add team members with role-based access. Owners control who can view, edit, or close days.',
  },
  {
    icon: IconShield,
    title: 'Secure & isolated',
    description:
      'Each fuel station is its own account. Your data stays private with JWT-secured sessions.',
  },
]

function LandingFeatures() {
  return (
    <section className="landing-section" id="features">
      <div className="landing-container">
        <div className="landing-section-head">
          <p className="landing-eyebrow">Everything you need</p>
          <h2>One platform for the full accounting day</h2>
          <p className="landing-section-lead">
            PetroBook mirrors the worksheet your station already uses — meter logs, cash counts,
            expenses, and closing — without the paper trail.
          </p>
        </div>

        <div className="landing-features-grid">
          {FEATURES.map((feature) => {
            const Icon = feature.icon
            return (
              <article key={feature.title} className="landing-feature-card">
                <div className="landing-feature-icon">
                  <Icon />
                </div>
                <h3>{feature.title}</h3>
                <p>{feature.description}</p>
              </article>
            )
          })}
        </div>
      </div>
    </section>
  )
}

export default LandingFeatures
