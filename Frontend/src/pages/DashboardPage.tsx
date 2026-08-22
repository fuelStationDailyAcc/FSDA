import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  fetchAccountHistory,
  fetchCustomers,
  fetchLedgerTotals,
  fetchProfitAnalytics,
  type DailyAccountSummary,
  type Party,
  type ProfitAnalytics,
} from '../api/accounts'
import {
  BarTrendChart,
  FUEL_COLORS,
  LineTrendChart,
  MixBars,
} from '../components/DashboardCharts'
import Loader from '../components/Loader'
import {
  IconArrowRight,
  IconCash,
  IconChart,
  IconLedger,
  IconMeter,
  IconUsers,
} from '../components/landing/icons'
import { useAuth } from '../context/AuthContext'
import {
  diffLineClass,
  formatDisplayDate,
  formatINR,
  formatINRFloor,
  shiftDate,
  todayISO,
} from '../lib/money'
import { hasPermission, isOwner } from '../lib/permissions'

type DashLink = {
  to: string
  title: string
  description: string
  icon: ReactNode
}

function formatMonthLabel(month: string, short = false): string {
  const [year, m] = month.split('-').map(Number)
  const date = new Date(year, m - 1, 1)
  return date.toLocaleDateString(
    'en-IN',
    short ? { month: 'short' } : { month: 'short', year: 'numeric' }
  )
}

function lastDates(n: number): string[] {
  const today = todayISO()
  return Array.from({ length: n }, (_, i) => shiftDate(today, i - n + 1))
}

function lastMonths(n: number): string[] {
  const [y, m] = todayISO().split('-').map(Number)
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(y, m - 1 - (n - 1 - i), 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
}

function weekdayLabel(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', { weekday: 'short' })
}

function DashboardPage() {
  const { user } = useAuth()
  const owner = isOwner(user)
  const canAccounts = hasPermission(user, 'accounts.read')
  const canLedger = hasPermission(user, 'ledger.read')

  const [analytics, setAnalytics] = useState<ProfitAnalytics | null>(null)
  const [history, setHistory] = useState<DailyAccountSummary[]>([])
  const [udhaarPaise, setUdhaarPaise] = useState(0)
  const [customers, setCustomers] = useState<Party[]>([])
  const [loading, setLoading] = useState(canAccounts || canLedger)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError('')
      try {
        const jobs: Promise<void>[] = []
        if (canAccounts) {
          jobs.push(
            fetchProfitAnalytics().then((res) => {
              if (!cancelled) setAnalytics(res.data)
            })
          )
          jobs.push(
            fetchAccountHistory({ from: lastDates(14)[0], to: todayISO() }).then((res) => {
              if (!cancelled) setHistory(res.data)
            })
          )
        }
        if (canLedger) {
          jobs.push(
            Promise.all([fetchLedgerTotals(), fetchCustomers()]).then(([totals, parties]) => {
              if (cancelled) return
              setUdhaarPaise(totals.data.totalUdhaarPaise || 0)
              setCustomers(parties.data)
            })
          )
        }
        await Promise.all(jobs)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load dashboard')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [canAccounts, canLedger])

  const today = todayISO()
  const thisMonth = today.slice(0, 7)
  const lastMonth = lastMonths(2)[0]
  const todayRow = history.find((row) => row.accountDate === today)

  const thisMonthNet = analytics?.monthly.find((row) => row.month === thisMonth)?.netProfitPaise ?? 0
  const lastMonthNet = analytics?.monthly.find((row) => row.month === lastMonth)?.netProfitPaise ?? 0
  const monthDelta = thisMonthNet - lastMonthNet

  const last14 = useMemo(() => {
    const byDate = new Map((analytics?.daily ?? []).map((row) => [row.accountDate, row]))
    return lastDates(14).map((date) => {
      const row = byDate.get(date)
      return {
        label: weekdayLabel(date),
        value: row?.netProfitPaise ?? 0,
        hint: `${formatDisplayDate(date)} · ${formatINRFloor(row?.netProfitPaise ?? 0)}`,
      }
    })
  }, [analytics])

  const last7Net = useMemo(
    () => last14.slice(-7).reduce((sum, row) => sum + row.value, 0),
    [last14]
  )

  const monthlyBars = useMemo(() => {
    const byMonth = new Map((analytics?.monthly ?? []).map((row) => [row.month, row]))
    return lastMonths(6).map((month) => {
      const row = byMonth.get(month)
      return {
        label: formatMonthLabel(month, true),
        value: row?.netProfitPaise ?? 0,
        hint: `${formatMonthLabel(month)} · ${formatINRFloor(row?.netProfitPaise ?? 0)}`,
      }
    })
  }, [analytics])

  const fuelMix = useMemo(() => {
    const litres = new Map<string, { name: string; litres: number }>()
    for (const day of analytics?.daily ?? []) {
      if (!day.accountDate.startsWith(thisMonth)) continue
      for (const product of day.products) {
        const prev = litres.get(product.productId)
        litres.set(product.productId, {
          name: product.productName,
          litres: (prev?.litres ?? 0) + product.netLitres,
        })
      }
    }
    return [...litres.values()]
      .filter((row) => row.litres > 0)
      .sort((a, b) => b.litres - a.litres)
      .map((row, i) => ({
        label: row.name,
        value: row.litres,
        color: FUEL_COLORS[i % FUEL_COLORS.length],
      }))
  }, [analytics, thisMonth])

  const monthLitres = fuelMix.reduce((sum, row) => sum + row.value, 0)
  const topDebtors = [...customers]
    .filter((c) => (c.outstandingPaise ?? 0) > 0)
    .sort((a, b) => (b.outstandingPaise ?? 0) - (a.outstandingPaise ?? 0))
    .slice(0, 5)

  const links: DashLink[] = []
  if (canAccounts) {
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
  if (canLedger) {
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
        <p className="page-eyebrow">Home</p>
        <h1 className="page-title">
          {user?.stationName
            ? `Welcome to ${user.stationName}`
            : `Welcome, ${user?.username}`}
        </h1>
        <p className="muted" style={{ marginTop: 8, maxWidth: '52ch', lineHeight: 1.6 }}>
          Today’s snapshot, recent profit, and outstanding credit — then jump into the day’s work.
        </p>
      </section>

      {error ? <p className="error-text">{error}</p> : null}

      {loading ? (
        <Loader label="Loading dashboard…" />
      ) : (
        <>
          {canAccounts ? (
            <>
              <div className="kpi-grid dash-kpi-grid">
                <div className={`kpi-card ${diffLineClass(analytics?.profitTillDatePaise ?? 0)}`}>
                  <p className="kpi-label">Profit till date</p>
                  <p className="kpi-value">{formatINRFloor(analytics?.profitTillDatePaise ?? 0)}</p>
                </div>
                <div className={`kpi-card ${diffLineClass(thisMonthNet)}`}>
                  <p className="kpi-label">This month</p>
                  <p className="kpi-value">{formatINRFloor(thisMonthNet)}</p>
                  <p className="kpi-hint">
                    {monthDelta === 0
                      ? 'Same as last month'
                      : `${monthDelta > 0 ? '+' : ''}${formatINRFloor(monthDelta)} vs last month`}
                  </p>
                </div>
                <div className={`kpi-card ${diffLineClass(last7Net)}`}>
                  <p className="kpi-label">Last 7 days</p>
                  <p className="kpi-value">{formatINRFloor(last7Net)}</p>
                </div>
                <div className="kpi-card">
                  <p className="kpi-label">Fuel this month</p>
                  <p className="kpi-value">
                    {monthLitres.toLocaleString('en-IN', { maximumFractionDigits: 1 })} L
                  </p>
                </div>
              </div>

              <div className="dash-overview">
                <section className="panel dash-today">
                  <div className="dash-panel-head">
                    <h2 className="panel-title">Today</h2>
                    <span className={`dash-status ${todayRow?.status === 'closed' ? 'is-closed' : 'is-open'}`}>
                      {todayRow ? (todayRow.status === 'closed' ? 'Closed' : 'Open') : 'Not started'}
                    </span>
                  </div>
                  {todayRow ? (
                    <dl className="dash-today-stats">
                      <div>
                        <dt>Fuel sales</dt>
                        <dd>{formatINR(todayRow.totalFuelSalesPaise)}</dd>
                      </div>
                      <div>
                        <dt>Expenses</dt>
                        <dd>{formatINR(todayRow.totalExpensesPaise)}</dd>
                      </div>
                      <div>
                        <dt>Credit</dt>
                        <dd>{formatINR(todayRow.totalCreditPaise)}</dd>
                      </div>
                      <div>
                        <dt>Expected closing</dt>
                        <dd>{formatINR(todayRow.closingCashPaise)}</dd>
                      </div>
                    </dl>
                  ) : (
                    <p className="muted">No day opened yet. Start daily accounts to record meters and cash.</p>
                  )}
                  <Link to="/accounts" className="dash-inline-link">
                    Open daily accounts
                    <IconArrowRight />
                  </Link>
                </section>

                {canLedger ? (
                  <section className="panel">
                    <div className="dash-panel-head">
                      <h2 className="panel-title">Outstanding credit</h2>
                      <strong>{formatINR(udhaarPaise)}</strong>
                    </div>
                    {topDebtors.length ? (
                      <ul className="dash-debtors">
                        {topDebtors.map((party) => (
                          <li key={party.id}>
                            <span>{party.name}</span>
                            <strong>{formatINR(party.outstandingPaise)}</strong>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="muted">No outstanding customer balances.</p>
                    )}
                    <Link to="/ledger" className="dash-inline-link">
                      Open ledger
                      <IconArrowRight />
                    </Link>
                  </section>
                ) : (
                  <section className="panel">
                    <h2 className="panel-title">Fuel mix this month</h2>
                    <MixBars slices={fuelMix} />
                  </section>
                )}
              </div>

              <div className="dash-charts">
                <section className="panel">
                  <div className="dash-panel-head">
                    <h2 className="panel-title">Net profit · 14 days</h2>
                    <Link to="/analytics" className="dash-inline-link">
                      Analytics
                      <IconArrowRight />
                    </Link>
                  </div>
                  <LineTrendChart points={last14} />
                </section>
                <section className="panel">
                  <div className="dash-panel-head">
                    <h2 className="panel-title">Monthly net profit</h2>
                  </div>
                  <BarTrendChart bars={monthlyBars} />
                </section>
              </div>

              {canLedger ? (
                <section className="panel">
                  <h2 className="panel-title">Fuel mix this month</h2>
                  <MixBars slices={fuelMix} />
                </section>
              ) : null}
            </>
          ) : canLedger ? (
            <section className="panel">
              <div className="dash-panel-head">
                <h2 className="panel-title">Outstanding credit</h2>
                <strong>{formatINR(udhaarPaise)}</strong>
              </div>
              {topDebtors.length ? (
                <ul className="dash-debtors">
                  {topDebtors.map((party) => (
                    <li key={party.id}>
                      <span>{party.name}</span>
                      <strong>{formatINR(party.outstandingPaise)}</strong>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted">No outstanding customer balances.</p>
              )}
            </section>
          ) : null}
        </>
      )}

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
      ) : !canAccounts && !canLedger ? (
        <section className="panel">
          <p className="muted">No modules are available for your account yet.</p>
        </section>
      ) : null}
    </div>
  )
}

export default DashboardPage
