import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  IconCash,
  IconChart,
  IconLedger,
  IconMeter,
  IconUsers,
  IconArrowRight,
} from '../components/landing/icons'
import { useAuth } from '../context/AuthContext'
import { hasPermission, isOwner } from '../lib/permissions'

type DashLink = {
  to: string
  title: string
  description: string
  icon: ReactNode
}

function DashboardPage() {
  const { user } = useAuth()
  const owner = isOwner(user)

  const links: DashLink[] = []

  if (hasPermission(user, 'accounts.read')) {
    links.push(
      {
        to: '/accounts',
        title: 'Daily Accounts',
        description: 'Enter meter readings, expenses, and close the day.',
        icon: <IconMeter />,
      },
      {
        to: '/history',
        title: 'History',
        description: 'Browse past accounting days and download reports.',
        icon: <IconCash />,
      },
      {
        to: '/analytics',
        title: 'Analytics',
        description: 'Track profit trends and fuel sales over time.',
        icon: <IconChart />,
      }
    )
  }

  if (hasPermission(user, 'ledger.read')) {
    links.push({
      to: '/ledger',
      title: 'Ledger',
      description: 'Manage parties, credit, and outstanding balances.',
      icon: <IconLedger />,
    })
  }

  if (owner && user?.role !== 'staff') {
    links.push(
      {
        to: '/staff',
        title: 'Staff',
        description: 'Add team members and manage access permissions.',
        icon: <IconUsers />,
      },
      {
        to: '/salaries',
        title: 'Salaries',
        description: 'Record and track staff salary payments.',
        icon: <IconCash />,
      }
    )
  }

  if (hasPermission(user, 'settings.read')) {
    links.push({
      to: '/settings',
      title: 'Settings',
      description: 'Configure products, rates, and station preferences.',
      icon: <IconLedger />,
    })
  }

  return (
    <div>
      <section className="dash-hero">
        <p className="page-eyebrow">Dashboard</p>
        <h1 className="page-title">
          {user?.stationName
            ? `Welcome to ${user.stationName}`
            : `Welcome, ${user?.username}`}
        </h1>
        <p className="muted" style={{ marginTop: 8, maxWidth: '52ch', lineHeight: 1.6 }}>
          Your station command center — enter meter readings, reconcile cash, manage the ledger,
          and review profit analytics from one place.
        </p>
      </section>

      {links.length > 0 ? (
        <div className="dash-grid">
          {links.map((link) => (
            <Link key={link.to} to={link.to} className="dash-card">
              <div className="dash-card-icon">{link.icon}</div>
              <h3>{link.title}</h3>
              <p>{link.description}</p>
              <span className="dash-card-arrow">
                Open
                <IconArrowRight />
              </span>
            </Link>
          ))}
        </div>
      ) : (
        <section className="panel">
          <p className="muted">No modules are available for your account yet.</p>
        </section>
      )}
    </div>
  )
}

export default DashboardPage
