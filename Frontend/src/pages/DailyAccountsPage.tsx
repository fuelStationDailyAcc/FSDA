import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react'
import {
  addExpense,
  addReading,
  addTransaction,
  closeDay,
  deleteTransaction,
  fetchDailyAccount,
  fetchLedgerNames,
  fetchProducts,
  fetchCustomers,
  fetchVendors,
  reopenDay,
  updateCashTaken,
  updateReading,
  upsertCollection,
  type DailyAccountPayload,
  type LedgerTxn,
  type MeterReading,
  type Party,
  type FuelProduct,
} from '../api/accounts'
import { Modal, ModalForm } from '../components/Modal'
import Loader from '../components/Loader'
import { downloadDayReport } from '../lib/dayReport'
import {
  formatDisplayDate,
  formatINR,
  paiseToInput,
  shiftDate,
  todayISO,
} from '../lib/money'
import { useAuth } from '../context/AuthContext'

type ReadingDraft = Partial<Record<'newReading' | 'oldReading' | 'testingLitres' | 'rateRupees', string>>

type FuelSaveHandle = {
  getChanges: () => Array<{ id: string; patch: Record<string, string | number> }>
}

type CashSaveHandle = {
  getChanges: () => {
    collections: Array<{ paymentMethodId: string; amountRupees: string }>
    cashTaken: string | null
  }
}

function isReadingDirty(reading: MeterReading, draft?: ReadingDraft) {
  if (!draft) return false
  return (
    Number(draft.newReading) !== Number(reading.newReading) ||
    Number(draft.oldReading) !== Number(reading.oldReading) ||
    Number(draft.testingLitres) !== Number(reading.testingLitres) ||
    Number(draft.rateRupees) !== Number(paiseToInput(reading.ratePaise))
  )
}

function isCreditCollection(row: { methodType?: string; code?: string; name?: string }) {
  return (
    String(row.methodType || '').toLowerCase() === 'credit' ||
    String(row.code || '').toLowerCase() === 'credit'
  )
}

function DailyAccountsPage() {
  const { user } = useAuth()
  const [date, setDate] = useState(todayISO())
  const [data, setData] = useState<DailyAccountPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [products, setProducts] = useState<FuelProduct[]>([])
  const [customers, setCustomers] = useState<Party[]>([])
  const [vendors, setVendors] = useState<Party[]>([])

  const [expenseOpen, setExpenseOpen] = useState(false)
  const [closeOpen, setCloseOpen] = useState(false)
  const [confirmClose, setConfirmClose] = useState(false)
  const [actualCash, setActualCash] = useState('')
  const [busy, setBusy] = useState(false)
  const [readingsDirty, setReadingsDirty] = useState(false)
  const [cashDirty, setCashDirty] = useState(false)

  const fuelSaveRef = useRef<FuelSaveHandle>(null)
  const cashSaveRef = useRef<CashSaveHandle>(null)

  const closed = data?.account.status === 'closed'
  const dirty = readingsDirty || cashDirty

  const load = useCallback(async (d: string) => {
    setLoading(true)
    setError('')
    try {
      const payload = await fetchDailyAccount(d, { limit: 200 })
      setData(payload.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load daily account')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load(date)
  }, [date, load])

  useEffect(() => {
    void Promise.all([
      fetchProducts(true),
      fetchCustomers(),
      fetchVendors(),
    ]).then(([p, c, v]) => {
      setProducts(p.data)
      setCustomers(c.data)
      setVendors(v.data)
    })
  }, [])

  function applyDay(next: DailyAccountPayload) {
    setData(next)
  }

  function requestDateChange(next: string) {
    if (next === date) return
    if (
      dirty &&
      !window.confirm('You have unsaved changes. Discard them and change the date?')
    ) {
      return
    }
    setDate(next)
  }

  async function handleSave() {
    if (closed || !dirty) return
    setBusy(true)
    setError('')
    try {
      const readingChanges = fuelSaveRef.current?.getChanges() ?? []
      const cashChanges = cashSaveRef.current?.getChanges() ?? {
        collections: [],
        cashTaken: null,
      }
      let latest: DailyAccountPayload | null = null
      for (const change of readingChanges) {
        const res = await updateReading(date, change.id, change.patch)
        latest = res.data
      }
      for (const row of cashChanges.collections) {
        const res = await upsertCollection(date, row.paymentMethodId, row.amountRupees)
        latest = res.data
      }
      if (cashChanges.cashTaken != null) {
        const res = await updateCashTaken(date, cashChanges.cashTaken)
        latest = res.data
      }
      if (latest) applyDay(latest)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setBusy(false)
    }
  }

  const localNames = useMemo(() => {
    const names = new Map<string, string>()
    for (const p of [...customers, ...vendors]) {
      const name = p.name?.trim()
      if (name) names.set(name.toLowerCase(), name)
    }
    for (const t of data?.ledger.items || []) {
      const name = t.description?.trim()
      if (name) names.set(name.toLowerCase(), name)
    }
    return [...names.values()].sort((a, b) => a.localeCompare(b))
  }, [customers, vendors, data?.ledger.items])

  return (
    <div className={loading ? 'page-loading' : undefined}>
      {loading && data ? <Loader overlay label="Updating…" /> : null}
      <section className="panel">
        <div className="toolbar">
          <div className="toolbar-left">
            <h1 className="page-title">Daily Accounts</h1>
            <button
              type="button"
              className="btn-ghost btn-sm"
              onClick={() => requestDateChange(shiftDate(date, -1))}
              aria-label="Previous day"
            >
              ←
            </button>
            <label className="field" style={{ minWidth: 150 }}>
              Date
              <input
                type="date"
                value={date}
                onChange={(e) => requestDateChange(e.target.value)}
              />
            </label>
            <button
              type="button"
              className="btn-ghost btn-sm"
              onClick={() => requestDateChange(shiftDate(date, 1))}
              aria-label="Next day"
            >
              →
            </button>
            <button
              type="button"
              className="btn-secondary btn-sm"
              onClick={() => requestDateChange(todayISO())}
            >
              Today
            </button>
            <span className={`status-pill ${closed ? 'closed' : ''}`}>
              <span className="status-dot" />
              {closed ? 'Day Closed' : 'Open'}
            </span>
          </div>
          <div className="toolbar-right">
            <button
              type="button"
              className="btn-secondary"
              disabled={!data}
              onClick={() => window.print()}
            >
              Print
            </button>
            <button
              type="button"
              className="btn-secondary"
              disabled={!data}
              onClick={() => data && downloadDayReport(data, user?.stationName)}
            >
              Download
            </button>
            {!closed ? (
              <button
                type="button"
                className="btn"
                disabled={busy || !dirty}
                onClick={() => void handleSave()}
              >
                {busy ? 'Saving…' : dirty ? 'Save' : 'Saved'}
              </button>
            ) : null}
            {closed ? (
              <button
                type="button"
                className="btn-secondary"
                onClick={async () => {
                  try {
                    const res = await reopenDay(date)
                    applyDay(res.data)
                  } catch (err) {
                    setError(err instanceof Error ? err.message : 'Cannot reopen')
                  }
                }}
              >
                Reopen Day
              </button>
            ) : (
              <button type="button" className="btn-secondary" onClick={() => setCloseOpen(true)}>
                Close Day
              </button>
            )}
          </div>
        </div>
        <p className="muted" style={{ margin: '8px 0 0' }}>
          Accounting date: <strong>{formatDisplayDate(date)}</strong>
          {user?.stationName ? ` · ${user.stationName}` : null}
          {user?.role ? ` · Role: ${user.role}` : null}
          {!closed ? (
            <span className="no-print">
              {' '}
              · Edits stay local until you click Save. Reload discards unsaved changes.
            </span>
          ) : null}
        </p>
        {error ? <p className="error-text">{error}</p> : null}
        {loading && !data ? <Loader fullPage label="Loading daily account…" /> : null}
      </section>

      {data ? (
        <>
          <div className="kpi-grid">
            <Kpi label="Total Fuel Sales" value={data.kpis.totalFuelSalesPaise} />
            <Kpi label="Total Credit" value={data.kpis.totalCreditPaise} />
            <Kpi label="Total Debit" value={data.kpis.totalDebitPaise} />
            <Kpi label="Total Expenses" value={data.kpis.totalExpensesPaise} />
            <Kpi label="Online Collections" value={data.kpis.onlineCollectionsPaise} />
            <Kpi label="Closing Cash" value={data.kpis.closingCashPaise} />
          </div>

          <FuelReadingsSection
            ref={fuelSaveRef}
            readings={data.readings}
            products={products}
            closed={!!closed}
            total={data.kpis.totalFuelSalesPaise}
            onDirtyChange={setReadingsDirty}
            onAdd={async (productId) => {
              const res = await addReading(date, productId)
              applyDay(res.data)
            }}
          />

          <CreditDebitSection
            date={date}
            closed={!!closed}
            localNames={localNames}
            entries={data.ledger.items}
            onSave={async (body) => {
              const key = crypto.randomUUID()
              const res = await addTransaction(date, body, key)
              applyDay(res.data)
            }}
            onDelete={async (id) => {
              const res = await deleteTransaction(date, id)
              applyDay(res.data)
            }}
            cashSummary={
              <CashSummarySection
                ref={cashSaveRef}
                data={data}
                closed={!!closed}
                onDirtyChange={setCashDirty}
              />
            }
          />

          <ExpensesSection
            expenses={data.expenses}
            total={data.kpis.totalExpensesPaise}
            closed={!!closed}
            onAdd={() => setExpenseOpen(true)}
          />

          <ReconciliationSection data={data} onClose={() => setCloseOpen(true)} closed={!!closed} />
        </>
      ) : null}

      <AddExpenseModal
        open={expenseOpen}
        onClose={() => setExpenseOpen(false)}
        busy={busy}
        onSave={async (body) => {
          setBusy(true)
          try {
            const res = await addExpense(date, body)
            applyDay(res.data)
            setExpenseOpen(false)
          } finally {
            setBusy(false)
          }
        }}
      />

      <Modal
        title="Daily Reconciliation"
        open={closeOpen}
        onClose={() => {
          setCloseOpen(false)
          setConfirmClose(false)
        }}
      >
        {data ? (
          <>
            <div className="summary-list">
              <div className="summary-row">
                <span>Fuel Sales</span>
                <span>{formatINR(data.reconciliation.fuelSalesPaise)}</span>
              </div>
              <div className="summary-row">
                <span>Credit Sales</span>
                <span>{formatINR(data.reconciliation.creditSalesPaise)}</span>
              </div>
              <div className="summary-row">
                <span>Online Collections</span>
                <span>{formatINR(data.reconciliation.onlineCollectionsPaise)}</span>
              </div>
              <div className="summary-row">
                <span>Expenses</span>
                <span>{formatINR(data.reconciliation.expensesPaise)}</span>
              </div>
              <div className="summary-row">
                <span>Cash Taken</span>
                <span>{formatINR(data.reconciliation.cashTakenPaise)}</span>
              </div>
              <div className="summary-row total">
                <span>Expected Closing Cash</span>
                <span>{formatINR(data.reconciliation.expectedClosingCashPaise)}</span>
              </div>
            </div>
            <label className="field" style={{ marginTop: 12 }}>
              Actual Cash in Hand
              <input
                type="number"
                min="0"
                step="0.01"
                value={actualCash}
                onChange={(e) => setActualCash(e.target.value)}
                required
              />
            </label>
            {actualCash !== '' ? (
              <p
                className={
                  Math.round(Number(actualCash) * 100) -
                    data.reconciliation.expectedClosingCashPaise ===
                  0
                    ? 'diff-pos'
                    : 'diff-neg'
                }
                style={{ fontWeight: 800 }}
              >
                Difference:{' '}
                {formatINR(
                  Math.round(Number(actualCash) * 100) -
                    data.reconciliation.expectedClosingCashPaise
                )}
              </p>
            ) : null}
            {!confirmClose ? (
              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setCloseOpen(false)}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn"
                  disabled={actualCash === ''}
                  onClick={() => setConfirmClose(true)}
                >
                  Review & Close
                </button>
              </div>
            ) : (
              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setConfirmClose(false)}>
                  Back
                </button>
                <button
                  type="button"
                  className="btn"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true)
                    try {
                      const res = await closeDay(date, actualCash)
                      applyDay(res.data)
                      setCloseOpen(false)
                      setConfirmClose(false)
                      setActualCash('')
                    } catch (err) {
                      setError(err instanceof Error ? err.message : 'Close failed')
                    } finally {
                      setBusy(false)
                    }
                  }}
                >
                  Confirm Close Day
                </button>
              </div>
            )}
          </>
        ) : null}
      </Modal>
    </div>
  )
}

function Kpi({ label, value }: { label: string; value: number }) {
  return (
    <article className="kpi-card">
      <p className="kpi-label">{label}</p>
      <p className="kpi-value">{formatINR(value)}</p>
    </article>
  )
}

const FuelReadingsSection = forwardRef<
  FuelSaveHandle,
  {
    readings: DailyAccountPayload['readings']
    products: FuelProduct[]
    closed: boolean
    total: number
    onDirtyChange: (dirty: boolean) => void
    onAdd: (productId: string) => Promise<void>
  }
>(function FuelReadingsSection(
  { readings, products, closed, total, onDirtyChange, onAdd },
  ref
) {
  const [drafts, setDrafts] = useState<Record<string, ReadingDraft>>({})
  const [productId, setProductId] = useState('')

  useEffect(() => {
    setDrafts((prev) => {
      const next: Record<string, ReadingDraft> = {}
      for (const r of readings) {
        const existing = prev[r.id]
        next[r.id] =
          existing && isReadingDirty(r, existing)
            ? existing
            : {
                newReading: String(r.newReading),
                oldReading: String(r.oldReading),
                testingLitres: String(r.testingLitres),
                rateRupees: paiseToInput(r.ratePaise),
              }
      }
      return next
    })
  }, [readings])

  const dirty = useMemo(
    () => readings.some((r) => isReadingDirty(r, drafts[r.id])),
    [readings, drafts]
  )

  useEffect(() => {
    onDirtyChange(dirty)
    return () => onDirtyChange(false)
  }, [dirty, onDirtyChange])

  useImperativeHandle(
    ref,
    () => ({
      getChanges() {
        if (closed) return []
        return readings.flatMap((r) => {
          const d = drafts[r.id]
          if (!d || !isReadingDirty(r, d)) return []
          return [
            {
              id: r.id,
              patch: {
                newReading: Number(d.newReading),
                oldReading: Number(d.oldReading),
                testingLitres: Number(d.testingLitres),
                rateRupees: Number(d.rateRupees),
              },
            },
          ]
        })
      },
    }),
    [closed, drafts, readings]
  )

  return (
    <section className="panel">
      <div className="panel-head">
        <h2 className="panel-title">Fuel Sales / Meter Readings</h2>
        {!closed ? (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <select
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              aria-label="Product"
            >
              <option value="">Add product row…</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn-secondary btn-sm"
              disabled={!productId}
              onClick={() => productId && void onAdd(productId)}
            >
              + Add Row
            </button>
          </div>
        ) : null}
      </div>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Product</th>
              <th className="num">New Reading</th>
              <th className="num">Old Reading</th>
              <th className="num">LTR</th>
              <th className="num">Testing</th>
              <th className="num">Net</th>
              <th className="num">Rate</th>
              <th className="num">Total Sale</th>
            </tr>
          </thead>
          <tbody>
            {readings.map((r) => {
              const d = drafts[r.id] || {}
              return (
                <tr key={r.id}>
                  <td>{r.meterLabel || r.productName}</td>
                  <td className="num">
                    <input
                      className="cell-input"
                      disabled={closed}
                      value={d.newReading ?? ''}
                      onChange={(e) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [r.id]: { ...prev[r.id], newReading: e.target.value },
                        }))
                      }
                    />
                  </td>
                  <td className="num">
                    <input
                      className="cell-input"
                      disabled={closed}
                      value={d.oldReading ?? ''}
                      onChange={(e) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [r.id]: { ...prev[r.id], oldReading: e.target.value },
                        }))
                      }
                    />
                  </td>
                  <td className="num">{r.litres}</td>
                  <td className="num">
                    <input
                      className="cell-input"
                      disabled={closed}
                      value={d.testingLitres ?? ''}
                      onChange={(e) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [r.id]: { ...prev[r.id], testingLitres: e.target.value },
                        }))
                      }
                    />
                  </td>
                  <td className="num">{r.netLitres}</td>
                  <td className="num">
                    <input
                      className="cell-input"
                      disabled={closed}
                      value={d.rateRupees ?? ''}
                      onChange={(e) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [r.id]: { ...prev[r.id], rateRupees: e.target.value },
                        }))
                      }
                    />
                  </td>
                  <td className="num">{formatINR(r.totalSalePaise)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="summary-row total" style={{ marginTop: 12 }}>
        <span>Total Fuel Sale</span>
        <span>{formatINR(total)}</span>
      </div>
      <p className="muted no-print" style={{ margin: '8px 0 0', fontSize: 12 }}>
        LTR, Net and Total Sale update after you click Save. Rate is stored per reading so historical
        days stay correct when product rates change later.
      </p>
    </section>
  )
})

const CashSummarySection = forwardRef<
  CashSaveHandle,
  {
    data: DailyAccountPayload
    closed: boolean
    onDirtyChange: (dirty: boolean) => void
  }
>(function CashSummarySection({ data, closed, onDirtyChange }, ref) {
  const [cashTaken, setCashTaken] = useState(paiseToInput(data.account.cashTakenPaise))
  const [amounts, setAmounts] = useState<Record<string, string>>({})

  useEffect(() => {
    setCashTaken((prev) => {
      const saved = paiseToInput(data.account.cashTakenPaise)
      return Number(prev || 0) !== Number(saved) ? prev : saved
    })
    setAmounts((prev) => {
      const next: Record<string, string> = {}
      for (const c of data.collections) {
        const saved = paiseToInput(c.amountPaise)
        const existing = prev[c.paymentMethodId]
        next[c.paymentMethodId] =
          existing != null && Number(existing || 0) !== Number(saved) ? existing : saved
      }
      return next
    })
  }, [data])

  const displayRows = data.collections.filter(
    (c) => !c.isCashTaken && !isCreditCollection(c)
  )
  const cashTakenRows = data.collections.filter((c) => c.isCashTaken)

  const dirty = useMemo(() => {
    if (Number(cashTaken || 0) !== Number(paiseToInput(data.account.cashTakenPaise))) {
      return true
    }
    return data.collections.some(
      (row) =>
        !isCreditCollection(row) &&
        Number(amounts[row.paymentMethodId] || 0) !== Number(paiseToInput(row.amountPaise))
    )
  }, [amounts, cashTaken, data.account.cashTakenPaise, data.collections])

  useEffect(() => {
    onDirtyChange(dirty)
    return () => onDirtyChange(false)
  }, [dirty, onDirtyChange])

  useImperativeHandle(
    ref,
    () => ({
      getChanges() {
        if (closed) return { collections: [], cashTaken: null }
        const collections = data.collections.flatMap((row) => {
          if (isCreditCollection(row)) return []
          const value = amounts[row.paymentMethodId] || '0'
          if (Number(value) === Number(paiseToInput(row.amountPaise))) return []
          return [{ paymentMethodId: row.paymentMethodId, amountRupees: value }]
        })
        const savedCashTaken = paiseToInput(data.account.cashTakenPaise)
        const cashTakenChanged =
          Number(cashTaken || 0) !== Number(savedCashTaken) ? cashTaken || '0' : null
        return { collections, cashTaken: cashTakenChanged }
      },
    }),
    [amounts, cashTaken, closed, data]
  )

  return (
    <section className="panel">
      <h2 className="panel-title">Daily Cash Summary</h2>
      <div className="summary-list">
        <div className="summary-row">
          <span>Total Sale</span>
          <span>{formatINR(data.cashSummary.totalFuelSalePaise)}</span>
        </div>
        {displayRows.map((row) => (
          <div className="summary-row" key={row.paymentMethodId}>
            <span>{row.name}</span>
            <input
              disabled={closed}
              value={amounts[row.paymentMethodId] ?? ''}
              onChange={(e) =>
                setAmounts((prev) => ({ ...prev, [row.paymentMethodId]: e.target.value }))
              }
            />
          </div>
        ))}
        <div className="summary-row">
          <span>Expense</span>
          <span>{formatINR(data.cashSummary.totalExpensePaise)}</span>
        </div>
        <div className="summary-row total">
          <span>Total Cash</span>
          <span>{formatINR(data.cashSummary.totalCashPaise)}</span>
        </div>
        <div className="summary-row">
          <span>Cash Taken</span>
          <input
            disabled={closed}
            value={cashTaken}
            onChange={(e) => setCashTaken(e.target.value)}
          />
        </div>
        {cashTakenRows.map((row) => (
          <div className="summary-row" key={row.paymentMethodId}>
            <span>{row.name}</span>
            <input
              disabled={closed}
              value={amounts[row.paymentMethodId] ?? ''}
              onChange={(e) =>
                setAmounts((prev) => ({ ...prev, [row.paymentMethodId]: e.target.value }))
              }
            />
          </div>
        ))}
        <div className="summary-row total">
          <span>Closing Cash</span>
          <span>{formatINR(data.cashSummary.expectedClosingCashPaise)}</span>
        </div>
      </div>
    </section>
  )
})

function ExpensesSection({
  expenses,
  total,
  closed,
  onAdd,
}: {
  expenses: DailyAccountPayload['expenses']
  total: number
  closed: boolean
  onAdd: () => void
}) {
  return (
    <section className="panel">
      <div className="panel-head">
        <h2 className="panel-title">Daily Expenses</h2>
        <button type="button" className="btn-secondary btn-sm" disabled={closed} onClick={onAdd}>
          + Add Expense
        </button>
      </div>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Expense</th>
              <th className="num">Amount</th>
            </tr>
          </thead>
          <tbody>
            {expenses.length === 0 ? (
              <tr>
                <td colSpan={2} className="empty-state">
                  No expenses for this day.
                </td>
              </tr>
            ) : (
              expenses.map((e) => (
                <tr key={e.id}>
                  <td>{e.description}</td>
                  <td className="num">{formatINR(e.amountPaise)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="summary-row total" style={{ marginTop: 12 }}>
        <span>Total Expense</span>
        <span>{formatINR(total)}</span>
      </div>
    </section>
  )
}

function ReconciliationSection({
  data,
  onClose,
  closed,
}: {
  data: DailyAccountPayload
  onClose: () => void
  closed: boolean
}) {
  const diff = data.reconciliation.differencePaise
  return (
    <section className="panel">
      <div className="panel-head">
        <h2 className="panel-title">Daily Reconciliation</h2>
        {!closed ? (
          <button type="button" className="btn" onClick={onClose}>
            Close Day
          </button>
        ) : (
          <span className="status-pill closed">
            <span className="status-dot" /> Locked
          </span>
        )}
      </div>
      <div className="two-col">
        <div className="summary-list">
          <div className="summary-row">
            <span>Fuel Sales</span>
            <span>{formatINR(data.reconciliation.fuelSalesPaise)}</span>
          </div>
          <div className="summary-row">
            <span>Credit Sales</span>
            <span>{formatINR(data.reconciliation.creditSalesPaise)}</span>
          </div>
          <div className="summary-row">
            <span>Online Collections</span>
            <span>{formatINR(data.reconciliation.onlineCollectionsPaise)}</span>
          </div>
          <div className="summary-row">
            <span>Expenses</span>
            <span>{formatINR(data.reconciliation.expensesPaise)}</span>
          </div>
          <div className="summary-row">
            <span>Cash Taken</span>
            <span>{formatINR(data.reconciliation.cashTakenPaise)}</span>
          </div>
        </div>
        <div className="summary-list">
          <div className="summary-row total">
            <span>Expected Closing Cash</span>
            <span>{formatINR(data.reconciliation.expectedClosingCashPaise)}</span>
          </div>
          <div className="summary-row">
            <span>Actual Closing Cash</span>
            <span>
              {data.reconciliation.actualClosingCashPaise === null
                ? '—'
                : formatINR(data.reconciliation.actualClosingCashPaise)}
            </span>
          </div>
          <div className="summary-row total">
            <span>Difference</span>
            <span className={diff === null ? '' : diff === 0 ? 'diff-pos' : 'diff-neg'}>
              {diff === null ? '—' : formatINR(diff)}
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}

function CreditDebitSection({
  date,
  closed,
  localNames,
  entries,
  onSave,
  onDelete,
  cashSummary,
}: {
  date: string
  closed: boolean
  localNames: string[]
  entries: LedgerTxn[]
  onSave: (body: Record<string, unknown>) => Promise<void>
  onDelete: (id: string) => Promise<void>
  cashSummary: ReactNode
}) {
  const credits = useMemo(() => entries.filter((t) => t.type === 'CREDIT'), [entries])
  const debits = useMemo(() => entries.filter((t) => t.type === 'DEBIT'), [entries])

  return (
    <div className="three-col credit-cash-row">
      <TxnQuickBox
        type="CREDIT"
        title="Credit"
        date={date}
        closed={closed}
        localNames={localNames}
        entries={credits}
        onSave={onSave}
        onDelete={onDelete}
      />
      <TxnQuickBox
        type="DEBIT"
        title="Debit"
        date={date}
        closed={closed}
        localNames={localNames}
        entries={debits}
        onSave={onSave}
        onDelete={onDelete}
      />
      {cashSummary}
    </div>
  )
}

function TxnQuickBox({
  type,
  title,
  date,
  closed,
  localNames,
  entries,
  onSave,
  onDelete,
}: {
  type: 'CREDIT' | 'DEBIT'
  title: string
  date: string
  closed: boolean
  localNames: string[]
  entries: LedgerTxn[]
  onSave: (body: Record<string, unknown>) => Promise<void>
  onDelete: (id: string) => Promise<void>
}) {
  const [personName, setPersonName] = useState('')
  const [amount, setAmount] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [openSuggest, setOpenSuggest] = useState(false)
  const [highlight, setHighlight] = useState(0)
  const [remoteNames, setRemoteNames] = useState<string[]>([])
  const [searching, setSearching] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const requestId = useRef(0)

  const totalPaise = useMemo(
    () => entries.reduce((sum, t) => sum + t.amountPaise, 0),
    [entries]
  )

  const suggestions = useMemo(() => {
    const q = personName.trim().toLowerCase()
    const merged = new Map<string, string>()
    for (const n of [...localNames, ...remoteNames]) {
      const name = n.trim()
      if (!name) continue
      const key = name.toLowerCase()
      if (!merged.has(key)) merged.set(key, name)
    }
    let list = [...merged.values()]
    if (q) list = list.filter((n) => n.toLowerCase().includes(q))
    list.sort((a, b) => {
      const al = a.toLowerCase()
      const bl = b.toLowerCase()
      const aStarts = q && al.startsWith(q) ? 0 : 1
      const bStarts = q && bl.startsWith(q) ? 0 : 1
      if (aStarts !== bStarts) return aStarts - bStarts
      return a.localeCompare(b)
    })
    return list.slice(0, 10)
  }, [localNames, remoteNames, personName])

  useEffect(() => {
    function onDocDown(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpenSuggest(false)
    }
    document.addEventListener('mousedown', onDocDown)
    return () => document.removeEventListener('mousedown', onDocDown)
  }, [])

  useEffect(() => {
    setHighlight(0)
  }, [suggestions])

  useEffect(() => {
    if (!openSuggest) return
    const q = personName.trim()
    const id = ++requestId.current
    setSearching(true)
    const timer = window.setTimeout(() => {
      void fetchLedgerNames(undefined, q || undefined)
        .then((res) => {
          if (requestId.current !== id) return
          setRemoteNames(res.data || [])
        })
        .catch(() => {
          if (requestId.current !== id) return
          setRemoteNames([])
        })
        .finally(() => {
          if (requestId.current === id) setSearching(false)
        })
    }, 180)
    return () => window.clearTimeout(timer)
  }, [personName, openSuggest])

  function pickName(name: string) {
    setPersonName(name)
    setOpenSuggest(false)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (!personName.trim()) return setError('Name required')
    if (!(Number(amount) > 0)) return setError('Amount must be greater than 0')
    if (closed) return setError('Day is closed')

    setSubmitting(true)
    const savedName = personName.trim()
    try {
      await onSave({
        type,
        date,
        personName: savedName,
        description: savedName,
        category: type,
        amountRupees: amount,
        partyType: 'other',
      })
      setPersonName('')
      setAmount('')
      setOpenSuggest(false)
      setRemoteNames((prev) => {
        if (!savedName) return prev
        if (prev.some((n) => n.toLowerCase() === savedName.toLowerCase())) return prev
        return [...prev, savedName]
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!window.confirm(`Delete ${title.toLowerCase()} for “${name}”?`)) return
    setDeletingId(id)
    try {
      await onDelete(id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <section className={`panel txn-quick-box ${type === 'CREDIT' ? 'txn-credit' : 'txn-debit'}`}>
      <div className="panel-head">
        <h2 className="panel-title">{title}</h2>
        <span className="txn-box-total">{formatINR(totalPaise)}</span>
      </div>
      <form className="txn-quick-form" onSubmit={(e) => void handleSubmit(e)}>
        <div className="field name-suggest" ref={wrapRef}>
          <label htmlFor={`${type}-person-name`}>Name of the person</label>
          <input
            id={`${type}-person-name`}
            value={personName}
            onChange={(e) => {
              setPersonName(e.target.value)
              setOpenSuggest(true)
            }}
            onFocus={() => setOpenSuggest(true)}
            onKeyDown={(e) => {
              if (!openSuggest || suggestions.length === 0) return
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                setHighlight((h) => (h + 1) % suggestions.length)
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setHighlight((h) => (h - 1 + suggestions.length) % suggestions.length)
              } else if (e.key === 'Enter' && suggestions[highlight]) {
                const pick = suggestions[highlight]
                if (personName.trim().toLowerCase() !== pick.toLowerCase()) {
                  e.preventDefault()
                  pickName(pick)
                } else {
                  setOpenSuggest(false)
                }
              } else if (e.key === 'Escape') {
                setOpenSuggest(false)
              }
            }}
            placeholder="Start typing a name…"
            disabled={closed || submitting}
            autoComplete="off"
            required
          />
          {openSuggest ? (
            <ul className="name-suggest-list" role="listbox">
              {suggestions.length === 0 ? (
                <li className="name-suggest-empty">
                  {searching ? 'Searching…' : personName.trim() ? 'No matching names' : 'No names yet — type a new one'}
                </li>
              ) : (
                suggestions.map((name, i) => (
                  <li key={name}>
                    <button
                      type="button"
                      className={i === highlight ? 'active' : undefined}
                      onMouseDown={(e) => {
                        e.preventDefault()
                        pickName(name)
                      }}
                    >
                      {name}
                    </button>
                  </li>
                ))
              )}
            </ul>
          ) : null}
        </div>
        <label className="field">
          Amount
          <input
            type="number"
            min="0.01"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            disabled={closed || submitting}
            required
          />
        </label>
        {error ? <p className="error-text">{error}</p> : null}
        <button type="submit" className="btn" disabled={closed || submitting}>
          {submitting ? 'Saving…' : `Add ${title}`}
        </button>
      </form>

      <div className="txn-entry-list">
        {entries.length === 0 ? (
          <p className="txn-entry-empty">No {title.toLowerCase()} entries yet.</p>
        ) : (
          entries.map((t) => (
            <div className="txn-entry-row" key={t.id}>
              <span className="txn-entry-name">{t.description}</span>
              <span className="txn-entry-amount">{formatINR(t.amountPaise)}</span>
              <button
                type="button"
                className="btn-ghost btn-sm"
                disabled={closed || deletingId === t.id}
                onClick={() => void handleDelete(t.id, t.description)}
              >
                {deletingId === t.id ? '…' : '×'}
              </button>
            </div>
          ))
        )}
      </div>
    </section>
  )
}

function AddExpenseModal({
  open,
  onClose,
  busy,
  onSave,
}: {
  open: boolean
  onClose: () => void
  busy: boolean
  onSave: (body: Record<string, unknown>) => Promise<void>
}) {
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [error, setError] = useState('')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!(Number(amount) > 0)) return setError('Amount must be greater than 0')
    if (!description.trim()) return setError('Description required')
    try {
      await onSave({
        description,
        amountRupees: amount,
      })
      setDescription('')
      setAmount('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    }
  }

  return (
    <Modal title="Add Expense" open={open} onClose={onClose}>
      <ModalForm
        onSubmit={handleSubmit}
        onCancel={onClose}
        submitting={busy}
        submitLabel="Save Expense"
        error={error}
      >
        <label className="field span-2">
          Expense
          <input value={description} onChange={(e) => setDescription(e.target.value)} required />
        </label>
        <label className="field span-2">
          Amount
          <input
            type="number"
            min="0.01"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
        </label>
      </ModalForm>
    </Modal>
  )
}

export default DailyAccountsPage
