import { useEffect, useMemo, useState } from 'react'
import { fetchProfitAnalytics, type ProfitAnalytics } from '../api/accounts'
import Loader from '../components/Loader'
import { formatDisplayDate, formatINR, formatINRFloor, formatRate } from '../lib/money'

function formatMonthLabel(month: string): string {
  const [year, m] = month.split('-').map(Number)
  const date = new Date(year, m - 1, 1)
  return date.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
}

function AnalyticsPage() {
  const [data, setData] = useState<ProfitAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  useEffect(() => {
    setLoading(true)
    setError('')
    void fetchProfitAnalytics({
      from: from || undefined,
      to: to || undefined,
    })
      .then((res) => setData(res.data))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load analytics'))
      .finally(() => setLoading(false))
  }, [from, to])

  const filteredTotals = useMemo(() => {
    if (!data) return { gross: 0, expenses: 0, net: 0, days: 0 }
    return data.daily.reduce(
      (acc, row) => {
        acc.gross += row.grossProfitPaise
        acc.expenses += row.expensesPaise
        acc.net += row.netProfitPaise
        acc.days += 1
        return acc
      },
      { gross: 0, expenses: 0, net: 0, days: 0 }
    )
  }, [data])

  const filteredMonthly = useMemo(() => {
    if (!data) return []
    if (!from && !to) return data.monthly
    const months = new Set(data.daily.map((row) => row.accountDate.slice(0, 7)))
    return data.monthly.filter((row) => months.has(row.month))
  }, [data, from, to])

  return (
    <div>
      <section className="panel">
        <div className="toolbar">
          <div className="toolbar-left">
            <h1 className="page-title">Analytics</h1>
          </div>
        </div>
        <p className="muted" style={{ margin: '8px 0 0' }}>
          Daily profit = litres sold × profit per litre (from Settings) − expenses for that day.
          Profit rates use the current per-litre values in Settings, so changing them updates all
          historical calculations.
        </p>
        <form className="filters" style={{ marginTop: 16 }} onSubmit={(e) => e.preventDefault()}>
          <label className="field">
            From
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className="field">
            To
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </label>
          {from || to ? (
            <div style={{ display: 'flex', alignItems: 'end' }}>
              <button
                type="button"
                className="btn-ghost btn-sm"
                onClick={() => {
                  setFrom('')
                  setTo('')
                }}
              >
                Clear filters
              </button>
            </div>
          ) : null}
        </form>
        {error ? <p className="error-text">{error}</p> : null}
      </section>

      {loading ? (
        <Loader fullPage label="Loading analytics…" />
      ) : data ? (
        <>
          <div className="kpi-grid">
            <div className="kpi-card">
              <p className="kpi-label">Profit till date</p>
              <p className="kpi-value">{formatINRFloor(data.profitTillDatePaise)}</p>
            </div>
            <div className="kpi-card">
              <p className="kpi-label">
                {from || to ? 'Filtered net profit' : 'This month net profit'}
              </p>
              <p className="kpi-value">
                {from || to
                  ? formatINRFloor(filteredTotals.net)
                  : formatINRFloor(
                      data.monthly.find(
                        (row) => row.month === new Date().toISOString().slice(0, 7)
                      )?.netProfitPaise ?? 0
                    )}
              </p>
            </div>
            {from || to ? (
              <>
                <div className="kpi-card">
                  <p className="kpi-label">Filtered gross profit</p>
                  <p className="kpi-value">{formatINRFloor(filteredTotals.gross)}</p>
                </div>
                <div className="kpi-card">
                  <p className="kpi-label">Filtered expenses</p>
                  <p className="kpi-value">{formatINR(filteredTotals.expenses)}</p>
                </div>
                <div className="kpi-card">
                  <p className="kpi-label">Days in range</p>
                  <p className="kpi-value">{filteredTotals.days}</p>
                </div>
              </>
            ) : null}
          </div>

          {data.products.length ? (
            <section className="panel">
              <h2 className="panel-title">Current profit rates</h2>
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th className="num">Profit (₹/L)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.products.map((product) => (
                      <tr key={product.id}>
                        <td>{product.name}</td>
                        <td className="num">{formatRate(product.profitPaise)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          <section className="panel">
            <h2 className="panel-title">Monthly profit</h2>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Month</th>
                    <th className="num">Gross profit</th>
                    <th className="num">Expenses</th>
                    <th className="num">Net profit</th>
                    <th className="num">Days</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMonthly.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="empty-state">
                        No profit data yet. Enter daily accounts to see monthly totals.
                      </td>
                    </tr>
                  ) : (
                    filteredMonthly.map((row) => (
                      <tr key={row.month}>
                        <td>{formatMonthLabel(row.month)}</td>
                        <td className="num">{formatINRFloor(row.grossProfitPaise)}</td>
                        <td className="num">{formatINR(row.expensesPaise)}</td>
                        <td className="num">{formatINRFloor(row.netProfitPaise)}</td>
                        <td className="num">{row.days}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="panel">
            <h2 className="panel-title">Daily profit</h2>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th className="num">Gross profit</th>
                    <th className="num">Expenses</th>
                    <th className="num">Net profit</th>
                  </tr>
                </thead>
                <tbody>
                  {data.daily.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="empty-state">
                        No daily accounts in this range.
                      </td>
                    </tr>
                  ) : (
                    data.daily.map((row) => (
                      <tr key={row.accountDate}>
                        <td>{formatDisplayDate(row.accountDate)}</td>
                        <td className="num">{formatINRFloor(row.grossProfitPaise)}</td>
                        <td className="num">{formatINR(row.expensesPaise)}</td>
                        <td
                          className={`num ${row.netProfitPaise < 0 ? 'diff-neg' : row.netProfitPaise > 0 ? 'diff-pos' : ''}`}
                        >
                          {formatINRFloor(row.netProfitPaise)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}
    </div>
  )
}

export default AnalyticsPage
