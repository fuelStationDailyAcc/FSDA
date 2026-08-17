import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchAccountHistory, type DailyAccountSummary } from '../api/accounts'
import Loader from '../components/Loader'
import { formatDisplayDate, formatINR, formatINRFloor } from '../lib/money'

function AccountHistoryPage() {
  const navigate = useNavigate()
  const [items, setItems] = useState<DailyAccountSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [status, setStatus] = useState<'all' | 'open' | 'closed'>('all')

  useEffect(() => {
    setLoading(true)
    setError('')
    void fetchAccountHistory({
      from: from || undefined,
      to: to || undefined,
      status: status === 'all' ? '' : status,
    })
      .then((res) => setItems(res.data))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load history'))
      .finally(() => setLoading(false))
  }, [from, to, status])

  const totals = useMemo(() => {
    return items.reduce(
      (acc, row) => {
        acc.fuel += row.totalFuelSalesPaise
        acc.credit += row.totalCreditPaise
        acc.debit += row.totalDebitPaise
        acc.expenses += row.totalExpensesPaise
        acc.closing += row.closingCashPaise
        return acc
      },
      { fuel: 0, credit: 0, debit: 0, expenses: 0, closing: 0 }
    )
  }, [items])

  function openDay(date: string) {
    navigate(`/accounts?date=${date}`)
  }

  return (
    <div>
      <section className="panel">
        <div className="toolbar">
          <div className="toolbar-left">
            <h1 className="page-title">History</h1>
          </div>
        </div>
        <p className="muted" style={{ margin: '8px 0 0' }}>
          All daily accounts you have created. Open a day to view or edit the full sheet.
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
          <label className="field">
            Status
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as 'all' | 'open' | 'closed')}
            >
              <option value="all">All</option>
              <option value="open">Open</option>
              <option value="closed">Closed</option>
            </select>
          </label>
          {from || to || status !== 'all' ? (
            <div style={{ display: 'flex', alignItems: 'end' }}>
              <button
                type="button"
                className="btn-ghost btn-sm"
                onClick={() => {
                  setFrom('')
                  setTo('')
                  setStatus('all')
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
        <Loader fullPage label="Loading past accounts…" />
      ) : (
        <>
          {items.length ? (
            <div className="kpi-grid">
              <div className="kpi-card">
                <p className="kpi-label">Days</p>
                <p className="kpi-value">{items.length}</p>
              </div>
              <div className="kpi-card">
                <p className="kpi-label">Fuel Sales</p>
                <p className="kpi-value">{formatINRFloor(totals.fuel)}</p>
              </div>
              <div className="kpi-card">
                <p className="kpi-label">Credit</p>
                <p className="kpi-value">{formatINR(totals.credit)}</p>
              </div>
              <div className="kpi-card">
                <p className="kpi-label">Debit</p>
                <p className="kpi-value">{formatINR(totals.debit)}</p>
              </div>
              <div className="kpi-card">
                <p className="kpi-label">Expenses</p>
                <p className="kpi-value">{formatINR(totals.expenses)}</p>
              </div>
              <div className="kpi-card">
                <p className="kpi-label">Closing Cash</p>
                <p className="kpi-value">{formatINRFloor(totals.closing)}</p>
              </div>
            </div>
          ) : null}

          <section className="panel">
            <h2 className="panel-title">Past accounts</h2>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Status</th>
                    <th className="num">Fuel Sales</th>
                    <th className="num">Credit</th>
                    <th className="num">Debit</th>
                    <th className="num">Expenses</th>
                    <th className="num">Closing Cash</th>
                    <th className="num">Actual Cash</th>
                    <th className="num">Difference</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="empty-state">
                        No daily accounts yet. Create a day from Daily Accounts and it will show up
                        here.
                      </td>
                    </tr>
                  ) : (
                    items.map((row) => (
                      <tr
                        key={row.id}
                        className="clickable-row"
                        onClick={() => openDay(row.accountDate)}
                      >
                        <td>{formatDisplayDate(row.accountDate)}</td>
                        <td>
                          <span className={`status-pill ${row.status === 'closed' ? 'closed' : ''}`}>
                            <span className="status-dot" />
                            {row.status === 'closed' ? 'Closed' : 'Open'}
                          </span>
                        </td>
                        <td className="num">{formatINRFloor(row.totalFuelSalesPaise)}</td>
                        <td className="num">{formatINR(row.totalCreditPaise)}</td>
                        <td className="num">{formatINR(row.totalDebitPaise)}</td>
                        <td className="num">{formatINR(row.totalExpensesPaise)}</td>
                        <td className="num">{formatINRFloor(row.closingCashPaise)}</td>
                        <td className="num">{formatINR(row.actualClosingCashPaise)}</td>
                        <td className="num">{formatINR(row.differencePaise)}</td>
                        <td>
                          <button
                            type="button"
                            className="btn-ghost btn-sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              openDay(row.accountDate)
                            }}
                          >
                            Open
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  )
}

export default AccountHistoryPage
