import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  deleteDay,
  fetchAccountHistory,
  fetchDailyAccount,
  type DailyAccountSummary,
} from '../api/accounts'
import { Modal } from '../components/Modal'
import Loader from '../components/Loader'
import { useAuth } from '../context/AuthContext'
import { downloadDayReportPdf, printDayReportPdf } from '../lib/dayReportPdf'
import { hasPermission } from '../lib/permissions'
import { formatDisplayDate, formatINR, formatINRFloor } from '../lib/money'

type ViewLevel = 'years' | 'months' | 'days'

function formatMonthLabel(monthKey: string): string {
  const [year, m] = monthKey.split('-').map(Number)
  return new Date(year, m - 1, 1).toLocaleDateString('en-IN', {
    month: 'long',
    year: 'numeric',
  })
}

function groupCounts<T>(
  items: T[],
  keyFn: (item: T) => string
): Array<{ key: string; count: number }> {
  const map = new Map<string, number>()
  for (const item of items) {
    const key = keyFn(item)
    map.set(key, (map.get(key) ?? 0) + 1)
  }
  return [...map.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.key.localeCompare(a.key))
}

function AccountHistoryPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const canWrite = hasPermission(user, 'accounts.write')
  const [items, setItems] = useState<DailyAccountSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [status, setStatus] = useState<'all' | 'open' | 'closed'>('all')
  const [view, setView] = useState<ViewLevel>('years')
  const [selectedYear, setSelectedYear] = useState('')
  const [selectedMonth, setSelectedMonth] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<DailyAccountSummary | null>(null)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [downloadingDate, setDownloadingDate] = useState('')
  const [printingDate, setPrintingDate] = useState('')

  useEffect(() => {
    setLoading(true)
    setError('')
    void fetchAccountHistory({
      status: status === 'all' ? '' : status,
    })
      .then((res) => setItems(res.data))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load history'))
      .finally(() => setLoading(false))
  }, [status])

  const years = useMemo(
    () => groupCounts(items, (row) => row.accountDate.slice(0, 4)),
    [items]
  )

  const months = useMemo(() => {
    if (!selectedYear) return []
    return groupCounts(
      items.filter((row) => row.accountDate.startsWith(selectedYear)),
      (row) => row.accountDate.slice(0, 7)
    )
  }, [items, selectedYear])

  const days = useMemo(() => {
    if (!selectedMonth) return []
    return items
      .filter((row) => row.accountDate.startsWith(selectedMonth))
      .sort((a, b) => b.accountDate.localeCompare(a.accountDate))
  }, [items, selectedMonth])

  function openYear(year: string) {
    setSelectedYear(year)
    setSelectedMonth('')
    setView('months')
  }

  function openMonth(month: string) {
    setSelectedMonth(month)
    setView('days')
  }

  function goToYears() {
    setSelectedYear('')
    setSelectedMonth('')
    setView('years')
  }

  function goToMonths() {
    setSelectedMonth('')
    setView('months')
  }

  function openDay(date: string) {
    navigate(`/accounts?date=${date}`)
  }

  async function downloadPdf(date: string) {
    setDownloadingDate(date)
    setError('')
    try {
      const res = await fetchDailyAccount(date)
      downloadDayReportPdf(res.data, user?.stationName)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'PDF download failed')
    } finally {
      setDownloadingDate('')
    }
  }

  async function printPdf(date: string) {
    setPrintingDate(date)
    setError('')
    try {
      const res = await fetchDailyAccount(date)
      printDayReportPdf(res.data, user?.stationName)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Print failed')
    } finally {
      setPrintingDate('')
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleteBusy(true)
    setError('')
    try {
      await deleteDay(deleteTarget.accountDate)
      setItems((prev) => prev.filter((row) => row.id !== deleteTarget.id))
      setDeleteTarget(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed')
    } finally {
      setDeleteBusy(false)
    }
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
          Browse past daily accounts by year and month. Open a day to view or edit, or print
          or download its report.
        </p>
        <form className="filters" style={{ marginTop: 16 }} onSubmit={(e) => e.preventDefault()}>
          <label className="field">
            Status
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as 'all' | 'open' | 'closed')
                goToYears()
              }}
            >
              <option value="all">All</option>
              <option value="open">Open</option>
              <option value="closed">Closed</option>
            </select>
          </label>
        </form>
        <nav className="history-breadcrumb" aria-label="History navigation">
          <button type="button" className="history-crumb" onClick={goToYears}>
            All years
          </button>
          {selectedYear ? (
            <>
              <span className="history-crumb-sep">›</span>
              <button
                type="button"
                className="history-crumb"
                onClick={view === 'days' ? goToMonths : undefined}
                disabled={view === 'months'}
              >
                {selectedYear}
              </button>
            </>
          ) : null}
          {selectedMonth ? (
            <>
              <span className="history-crumb-sep">›</span>
              <span className="history-crumb current">{formatMonthLabel(selectedMonth)}</span>
            </>
          ) : null}
        </nav>
        {error ? <p className="error-text">{error}</p> : null}
      </section>

      {loading ? (
        <Loader fullPage label="Loading past accounts…" />
      ) : (
        <section className="panel">
          {view === 'years' ? (
            <>
              <h2 className="panel-title">Select year</h2>
              {years.length === 0 ? (
                <p className="muted">
                  No daily accounts yet. Create a day from Daily Accounts and it will show up here.
                </p>
              ) : (
                <div className="history-grid">
                  {years.map(({ key, count }) => (
                    <button
                      key={key}
                      type="button"
                      className="history-box"
                      onClick={() => openYear(key)}
                    >
                      <span className="history-box-title">{key}</span>
                      <span className="history-box-meta">
                        {count} {count === 1 ? 'day' : 'days'}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : null}

          {view === 'months' ? (
            <>
              <h2 className="panel-title">{selectedYear} — Select month</h2>
              <div className="history-grid">
                {months.map(({ key, count }) => (
                  <button
                    key={key}
                    type="button"
                    className="history-box"
                    onClick={() => openMonth(key)}
                  >
                    <span className="history-box-title">
                      {new Date(
                        Number(key.slice(0, 4)),
                        Number(key.slice(5, 7)) - 1,
                        1
                      ).toLocaleDateString('en-IN', { month: 'long' })}
                    </span>
                    <span className="history-box-meta">
                      {count} {count === 1 ? 'day' : 'days'}
                    </span>
                  </button>
                ))}
              </div>
            </>
          ) : null}

          {view === 'days' ? (
            <>
              <h2 className="panel-title">{formatMonthLabel(selectedMonth)}</h2>
              {days.length === 0 ? (
                <p className="muted">No accounts for this month.</p>
              ) : (
                <div className="history-days-grid">
                  {days.map((row) => (
                    <article key={row.id} className="history-day-card">
                      <div className="history-day-card-head">
                        <span className="history-day-date">{formatDisplayDate(row.accountDate)}</span>
                        <span
                          className={`status-pill ${row.status === 'closed' ? 'closed' : ''}`}
                        >
                          <span className="status-dot" />
                          {row.status === 'closed' ? 'Closed' : 'Open'}
                        </span>
                      </div>
                      <div className="history-day-stats">
                        <div>
                          <span className="history-day-stat-label">Fuel sales</span>
                          <span>{formatINRFloor(row.totalFuelSalesPaise)}</span>
                        </div>
                        <div>
                          <span className="history-day-stat-label">Closing cash</span>
                          <span>{formatINRFloor(row.closingCashPaise)}</span>
                        </div>
                        <div>
                          <span className="history-day-stat-label">Expenses</span>
                          <span>{formatINR(row.totalExpensesPaise)}</span>
                        </div>
                      </div>
                      <div className="history-day-actions">
                        <button
                          type="button"
                          className="btn-secondary btn-sm"
                          disabled={printingDate === row.accountDate}
                          onClick={() => void printPdf(row.accountDate)}
                        >
                          {printingDate === row.accountDate ? 'Preparing…' : 'Print'}
                        </button>
                        <button
                          type="button"
                          className="btn-secondary btn-sm"
                          disabled={downloadingDate === row.accountDate}
                          onClick={() => void downloadPdf(row.accountDate)}
                        >
                          {downloadingDate === row.accountDate ? 'Downloading…' : 'PDF'}
                        </button>
                        <button
                          type="button"
                          className="btn-ghost btn-sm"
                          onClick={() => openDay(row.accountDate)}
                        >
                          Open
                        </button>
                        {canWrite ? (
                          <button
                            type="button"
                            className="btn-danger btn-sm"
                            onClick={() => setDeleteTarget(row)}
                          >
                            Delete
                          </button>
                        ) : null}
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </>
          ) : null}
        </section>
      )}

      <Modal
        title="Delete daily account"
        open={Boolean(deleteTarget)}
        onClose={() => !deleteBusy && setDeleteTarget(null)}
      >
        {deleteTarget ? (
          <>
            <p>
              Permanently delete the account for{' '}
              <strong>{formatDisplayDate(deleteTarget.accountDate)}</strong>? All fuel readings,
              expenses, credit/debit entries, and payment collections for this day will be removed.
              This cannot be undone.
            </p>
            <div className="modal-actions">
              <button
                type="button"
                className="btn-secondary"
                disabled={deleteBusy}
                onClick={() => setDeleteTarget(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-danger"
                disabled={deleteBusy}
                onClick={() => void confirmDelete()}
              >
                {deleteBusy ? 'Deleting…' : 'Delete account'}
              </button>
            </div>
          </>
        ) : null}
      </Modal>
    </div>
  )
}

export default AccountHistoryPage
