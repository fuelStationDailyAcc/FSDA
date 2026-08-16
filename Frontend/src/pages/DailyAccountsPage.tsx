import { useCallback, useEffect, useMemo, useState, type Dispatch, type FormEvent, type SetStateAction } from 'react'
import {
  addExpense,
  addReading,
  addTransaction,
  closeDay,
  deleteExpense,
  deleteTransaction,
  fetchDailyAccount,
  fetchExpenseCategories,
  fetchPaymentMethods,
  fetchProducts,
  fetchTxnCategories,
  fetchCustomers,
  fetchVendors,
  reopenDay,
  updateCashTaken,
  updateReading,
  upsertCollection,
  type DailyAccountPayload,
  type NamedItem,
  type Party,
  type PaymentMethod,
  type FuelProduct,
} from '../api/accounts'
import { Modal, ModalForm } from '../components/Modal'
import {
  formatDisplayDate,
  formatINR,
  paiseToInput,
  shiftDate,
  todayISO,
} from '../lib/money'
import { useAuth } from '../context/AuthContext'

type Filters = {
  type: string
  category: string
  partyType: string
  partyId: string
  paymentMethodId: string
  search: string
  minAmount: string
  maxAmount: string
  page: number
}

const emptyFilters: Filters = {
  type: '',
  category: '',
  partyType: '',
  partyId: '',
  paymentMethodId: '',
  search: '',
  minAmount: '',
  maxAmount: '',
  page: 1,
}

function DailyAccountsPage() {
  const { user } = useAuth()
  const [date, setDate] = useState(todayISO())
  const [data, setData] = useState<DailyAccountPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filters, setFilters] = useState<Filters>(emptyFilters)
  const [products, setProducts] = useState<FuelProduct[]>([])
  const [methods, setMethods] = useState<PaymentMethod[]>([])
  const [expenseCats, setExpenseCats] = useState<NamedItem[]>([])
  const [txnCats, setTxnCats] = useState<NamedItem[]>([])
  const [customers, setCustomers] = useState<Party[]>([])
  const [vendors, setVendors] = useState<Party[]>([])

  const [txnOpen, setTxnOpen] = useState(false)
  const [expenseOpen, setExpenseOpen] = useState(false)
  const [closeOpen, setCloseOpen] = useState(false)
  const [confirmClose, setConfirmClose] = useState(false)
  const [actualCash, setActualCash] = useState('')
  const [busy, setBusy] = useState(false)

  const closed = data?.account.status === 'closed'

  const load = useCallback(async (d: string, f: Filters) => {
    setLoading(true)
    setError('')
    try {
      const payload = await fetchDailyAccount(d, {
        type: f.type || undefined,
        category: f.category || undefined,
        partyType: f.partyType || undefined,
        partyId: f.partyId || undefined,
        paymentMethodId: f.paymentMethodId || undefined,
        search: f.search || undefined,
        minAmountPaise: f.minAmount ? Math.round(Number(f.minAmount) * 100) : undefined,
        maxAmountPaise: f.maxAmount ? Math.round(Number(f.maxAmount) * 100) : undefined,
        page: f.page,
        limit: 50,
      })
      setData(payload.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load daily account')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load(date, filters)
  }, [date, filters, load])

  useEffect(() => {
    void Promise.all([
      fetchProducts(true),
      fetchPaymentMethods(true),
      fetchExpenseCategories(),
      fetchTxnCategories(),
      fetchCustomers(),
      fetchVendors(),
    ]).then(([p, m, e, t, c, v]) => {
      setProducts(p.data)
      setMethods(m.data)
      setExpenseCats(e.data)
      setTxnCats(t.data)
      setCustomers(c.data)
      setVendors(v.data)
    })
  }, [])

  function applyDay(next: DailyAccountPayload) {
    setData(next)
  }

  async function saveReading(
    id: string,
    patch: Record<string, string | number>
  ) {
    if (closed) return
    try {
      const res = await updateReading(date, id, patch)
      applyDay(res.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update reading')
    }
  }

  const parties = useMemo(() => {
    if (filters.partyType === 'vendor') return vendors
    if (filters.partyType === 'customer') return customers
    return [...customers, ...vendors]
  }, [filters.partyType, customers, vendors])

  return (
    <div>
      <section className="panel">
        <div className="toolbar">
          <div className="toolbar-left">
            <h1 className="page-title">Daily Accounts</h1>
            <button
              type="button"
              className="btn-ghost btn-sm"
              onClick={() => setDate((d) => shiftDate(d, -1))}
              aria-label="Previous day"
            >
              ←
            </button>
            <label className="field" style={{ minWidth: 150 }}>
              Date
              <input
                type="date"
                value={date}
                onChange={(e) => {
                  setFilters((f) => ({ ...f, page: 1 }))
                  setDate(e.target.value)
                }}
              />
            </label>
            <button
              type="button"
              className="btn-ghost btn-sm"
              onClick={() => setDate((d) => shiftDate(d, 1))}
              aria-label="Next day"
            >
              →
            </button>
            <button
              type="button"
              className="btn-secondary btn-sm"
              onClick={() => setDate(todayISO())}
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
              className="btn"
              disabled={closed}
              onClick={() => setTxnOpen(true)}
            >
              + Add Transaction
            </button>
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
          {user?.role ? ` · Role: ${user.role}` : null}
        </p>
        {error ? <p className="error-text">{error}</p> : null}
        {loading && !data ? <p className="muted">Loading…</p> : null}
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
            readings={data.readings}
            products={products}
            closed={!!closed}
            total={data.kpis.totalFuelSalesPaise}
            onSave={saveReading}
            onAdd={async (productId) => {
              const res = await addReading(date, productId)
              applyDay(res.data)
            }}
          />

          <div className="two-col">
            <CashSummarySection
              data={data}
              closed={!!closed}
              onCollection={async (paymentMethodId, amountRupees) => {
                const res = await upsertCollection(date, paymentMethodId, amountRupees)
                applyDay(res.data)
              }}
              onCashTaken={async (cashTakenRupees) => {
                const res = await updateCashTaken(date, cashTakenRupees)
                applyDay(res.data)
              }}
            />

            <PaymentBreakdownSection collections={data.collections} />
          </div>

          <ExpensesSection
            expenses={data.expenses}
            total={data.kpis.totalExpensesPaise}
            closed={!!closed}
            onAdd={() => setExpenseOpen(true)}
            onDelete={async (id) => {
              const res = await deleteExpense(date, id)
              applyDay(res.data)
            }}
          />

          <LedgerSection
            data={data}
            filters={filters}
            setFilters={setFilters}
            methods={methods}
            parties={parties}
            closed={!!closed}
            onDelete={async (id) => {
              const res = await deleteTransaction(date, id)
              applyDay(res.data)
            }}
          />

          <ReconciliationSection data={data} onClose={() => setCloseOpen(true)} closed={!!closed} />
        </>
      ) : null}

      <AddTransactionModal
        open={txnOpen}
        onClose={() => setTxnOpen(false)}
        date={date}
        methods={methods}
        categories={txnCats}
        customers={customers}
        vendors={vendors}
        busy={busy}
        onSave={async (body) => {
          setBusy(true)
          try {
            const key = crypto.randomUUID()
            const res = await addTransaction(date, body, key)
            applyDay(res.data)
            setTxnOpen(false)
          } finally {
            setBusy(false)
          }
        }}
      />

      <AddExpenseModal
        open={expenseOpen}
        onClose={() => setExpenseOpen(false)}
        categories={expenseCats}
        methods={methods}
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

function FuelReadingsSection({
  readings,
  products,
  closed,
  total,
  onSave,
  onAdd,
}: {
  readings: DailyAccountPayload['readings']
  products: FuelProduct[]
  closed: boolean
  total: number
  onSave: (id: string, patch: Record<string, string | number>) => Promise<void>
  onAdd: (productId: string) => Promise<void>
}) {
  const [drafts, setDrafts] = useState<Record<string, Partial<Record<string, string>>>>({})
  const [productId, setProductId] = useState('')

  useEffect(() => {
    const next: Record<string, Partial<Record<string, string>>> = {}
    for (const r of readings) {
      next[r.id] = {
        newReading: String(r.newReading),
        oldReading: String(r.oldReading),
        testingLitres: String(r.testingLitres),
        rateRupees: paiseToInput(r.ratePaise),
      }
    }
    setDrafts(next)
  }, [readings])

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
                      onBlur={() =>
                        void onSave(r.id, {
                          newReading: Number(d.newReading),
                          oldReading: Number(d.oldReading),
                          testingLitres: Number(d.testingLitres),
                          rateRupees: Number(d.rateRupees),
                        })
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
                      onBlur={() =>
                        void onSave(r.id, {
                          newReading: Number(d.newReading),
                          oldReading: Number(d.oldReading),
                          testingLitres: Number(d.testingLitres),
                          rateRupees: Number(d.rateRupees),
                        })
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
                      onBlur={() =>
                        void onSave(r.id, {
                          newReading: Number(d.newReading),
                          oldReading: Number(d.oldReading),
                          testingLitres: Number(d.testingLitres),
                          rateRupees: Number(d.rateRupees),
                        })
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
                      onBlur={() =>
                        void onSave(r.id, {
                          newReading: Number(d.newReading),
                          oldReading: Number(d.oldReading),
                          testingLitres: Number(d.testingLitres),
                          rateRupees: Number(d.rateRupees),
                        })
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
      <p className="muted" style={{ margin: '8px 0 0', fontSize: 12 }}>
        LTR, Net and Total Sale are calculated on the server. Rate is stored per reading so historical
        days stay correct when product rates change later.
      </p>
    </section>
  )
}

function CashSummarySection({
  data,
  closed,
  onCollection,
  onCashTaken,
}: {
  data: DailyAccountPayload
  closed: boolean
  onCollection: (paymentMethodId: string, amountRupees: string) => Promise<void>
  onCashTaken: (cashTakenRupees: string) => Promise<void>
}) {
  const [cashTaken, setCashTaken] = useState(paiseToInput(data.account.cashTakenPaise))
  const [amounts, setAmounts] = useState<Record<string, string>>({})

  useEffect(() => {
    setCashTaken(paiseToInput(data.account.cashTakenPaise))
    const next: Record<string, string> = {}
    for (const c of data.collections) {
      next[c.paymentMethodId] = paiseToInput(c.amountPaise)
    }
    setAmounts(next)
  }, [data])

  const displayRows = data.collections.filter((c) => !c.isCashTaken)
  const cashTakenRows = data.collections.filter((c) => c.isCashTaken)

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
              onBlur={() =>
                void onCollection(row.paymentMethodId, amounts[row.paymentMethodId] || '0')
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
            onBlur={() => void onCashTaken(cashTaken || '0')}
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
                onBlur={() =>
                  void onCollection(row.paymentMethodId, amounts[row.paymentMethodId] || '0')
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
}

function PaymentBreakdownSection({
  collections,
}: {
  collections: DailyAccountPayload['collections']
}) {
  const online = collections.filter((c) => c.reducesCash && !c.isCashTaken)
  return (
    <section className="panel">
      <h2 className="panel-title">Payment Breakdown</h2>
      <div className="summary-list">
        {online.length === 0 ? (
          <p className="empty-state">No payment methods configured.</p>
        ) : (
          online.map((c) => (
            <div className="summary-row" key={c.id}>
              <span>
                {c.name} <span className="muted">({c.methodType})</span>
              </span>
              <span>{formatINR(c.amountPaise)}</span>
            </div>
          ))
        )}
      </div>
    </section>
  )
}

function ExpensesSection({
  expenses,
  total,
  closed,
  onAdd,
  onDelete,
}: {
  expenses: DailyAccountPayload['expenses']
  total: number
  closed: boolean
  onAdd: () => void
  onDelete: (id: string) => Promise<void>
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
              <th>Category</th>
              <th>Payment Mode</th>
              <th className="num">Amount</th>
              <th>Notes</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {expenses.length === 0 ? (
              <tr>
                <td colSpan={6} className="empty-state">
                  No expenses for this day.
                </td>
              </tr>
            ) : (
              expenses.map((e) => (
                <tr key={e.id}>
                  <td>{e.description}</td>
                  <td>{e.categoryName || '—'}</td>
                  <td>{e.paymentMethodName || '—'}</td>
                  <td className="num">{formatINR(e.amountPaise)}</td>
                  <td>{e.notes || '—'}</td>
                  <td>
                    <button
                      type="button"
                      className="btn-ghost btn-sm"
                      disabled={closed}
                      onClick={() => void onDelete(e.id)}
                    >
                      Delete
                    </button>
                  </td>
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

function LedgerSection({
  data,
  filters,
  setFilters,
  methods,
  parties,
  closed,
  onDelete,
}: {
  data: DailyAccountPayload
  filters: Filters
  setFilters: Dispatch<SetStateAction<Filters>>
  methods: PaymentMethod[]
  parties: Party[]
  closed: boolean
  onDelete: (id: string) => Promise<void>
}) {
  return (
    <section className="panel">
      <h2 className="panel-title">Debit / Credit Ledger</h2>
      <div className="filters">
        <label className="field">
          Search
          <input
            value={filters.search}
            onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value, page: 1 }))}
            placeholder="Description…"
          />
        </label>
        <label className="field">
          Type
          <select
            value={filters.type}
            onChange={(e) => setFilters((f) => ({ ...f, type: e.target.value, page: 1 }))}
          >
            <option value="">All</option>
            <option value="DEBIT">Debit</option>
            <option value="CREDIT">Credit</option>
          </select>
        </label>
        <label className="field">
          Category
          <input
            value={filters.category}
            onChange={(e) => setFilters((f) => ({ ...f, category: e.target.value, page: 1 }))}
          />
        </label>
        <label className="field">
          Party Type
          <select
            value={filters.partyType}
            onChange={(e) =>
              setFilters((f) => ({ ...f, partyType: e.target.value, partyId: '', page: 1 }))
            }
          >
            <option value="">All</option>
            <option value="customer">Customer</option>
            <option value="vendor">Vendor</option>
            <option value="other">Other</option>
          </select>
        </label>
        <label className="field">
          Party
          <select
            value={filters.partyId}
            onChange={(e) => setFilters((f) => ({ ...f, partyId: e.target.value, page: 1 }))}
          >
            <option value="">All</option>
            {parties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Payment Method
          <select
            value={filters.paymentMethodId}
            onChange={(e) =>
              setFilters((f) => ({ ...f, paymentMethodId: e.target.value, page: 1 }))
            }
          >
            <option value="">All</option>
            {methods.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Min Amount
          <input
            type="number"
            min="0"
            value={filters.minAmount}
            onChange={(e) => setFilters((f) => ({ ...f, minAmount: e.target.value, page: 1 }))}
          />
        </label>
        <label className="field">
          Max Amount
          <input
            type="number"
            min="0"
            value={filters.maxAmount}
            onChange={(e) => setFilters((f) => ({ ...f, maxAmount: e.target.value, page: 1 }))}
          />
        </label>
      </div>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Description</th>
              <th>Party</th>
              <th>Category</th>
              <th>Payment Mode</th>
              <th className="num">Debit</th>
              <th className="num">Credit</th>
              <th className="num">Balance</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {data.ledger.items.length === 0 ? (
              <tr>
                <td colSpan={9} className="empty-state">
                  No ledger entries for this day.
                </td>
              </tr>
            ) : (
              data.ledger.items.map((t) => (
                <tr key={t.id}>
                  <td>{formatDisplayDate(String(t.date).slice(0, 10))}</td>
                  <td>
                    <span className={`badge ${t.type === 'DEBIT' ? 'badge-debit' : 'badge-credit'}`}>
                      {t.type}
                    </span>{' '}
                    {t.description}
                  </td>
                  <td>{t.partyName || '—'}</td>
                  <td>{t.category}</td>
                  <td>{t.paymentMethodName || '—'}</td>
                  <td className="num">{t.type === 'DEBIT' ? formatINR(t.amountPaise) : '—'}</td>
                  <td className="num">{t.type === 'CREDIT' ? formatINR(t.amountPaise) : '—'}</td>
                  <td className="num">{formatINR(t.balancePaise)}</td>
                  <td>
                    <button
                      type="button"
                      className="btn-ghost btn-sm"
                      disabled={closed}
                      onClick={() => void onDelete(t.id)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="toolbar" style={{ marginTop: 12 }}>
        <span className="muted">
          Page {data.ledger.pagination.page} of {data.ledger.pagination.totalPages} ·{' '}
          {data.ledger.pagination.total} entries
        </span>
        <div className="toolbar-right">
          <button
            type="button"
            className="btn-ghost btn-sm"
            disabled={filters.page <= 1}
            onClick={() => setFilters((f) => ({ ...f, page: f.page - 1 }))}
          >
            Prev
          </button>
          <button
            type="button"
            className="btn-ghost btn-sm"
            disabled={filters.page >= data.ledger.pagination.totalPages}
            onClick={() => setFilters((f) => ({ ...f, page: f.page + 1 }))}
          >
            Next
          </button>
        </div>
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

function AddTransactionModal({
  open,
  onClose,
  date,
  methods,
  categories,
  customers,
  vendors,
  busy,
  onSave,
}: {
  open: boolean
  onClose: () => void
  date: string
  methods: PaymentMethod[]
  categories: NamedItem[]
  customers: Party[]
  vendors: Party[]
  busy: boolean
  onSave: (body: Record<string, unknown>) => Promise<void>
}) {
  const [type, setType] = useState<'DEBIT' | 'CREDIT'>('DEBIT')
  const [txnDate, setTxnDate] = useState(date)
  const [time, setTime] = useState('')
  const [description, setDescription] = useState('')
  const [partyType, setPartyType] = useState('')
  const [partyId, setPartyId] = useState('')
  const [category, setCategory] = useState('')
  const [amount, setAmount] = useState('')
  const [paymentMethodId, setPaymentMethodId] = useState('')
  const [referenceNumber, setReferenceNumber] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) {
      setTxnDate(date)
      setError('')
    }
  }, [open, date])

  const partyOptions = partyType === 'vendor' ? vendors : partyType === 'customer' ? customers : []

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (!type) return setError('Transaction type required')
    if (!txnDate) return setError('Date required')
    if (!category.trim()) return setError('Category required')
    if (!paymentMethodId) return setError('Payment method required')
    if (!(Number(amount) > 0)) return setError('Amount must be greater than 0')

    try {
      await onSave({
        type,
        date: txnDate,
        time: time || null,
        description,
        partyType: partyType || null,
        partyId: partyId || null,
        category,
        amountRupees: amount,
        paymentMethodId,
        referenceNumber: referenceNumber || null,
        notes: notes || null,
      })
      setDescription('')
      setAmount('')
      setNotes('')
      setReferenceNumber('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    }
  }

  return (
    <Modal title="Add Transaction" open={open} onClose={onClose}>
      <ModalForm
        onSubmit={handleSubmit}
        onCancel={onClose}
        submitting={busy}
        submitLabel="Save Transaction"
        error={error}
      >
        <label className="field">
          Transaction Type
          <select value={type} onChange={(e) => setType(e.target.value as 'DEBIT' | 'CREDIT')}>
            <option value="DEBIT">Debit</option>
            <option value="CREDIT">Credit</option>
          </select>
        </label>
        <label className="field">
          Date
          <input type="date" value={txnDate} onChange={(e) => setTxnDate(e.target.value)} required />
        </label>
        <label className="field">
          Time
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </label>
        <label className="field">
          Category
          <select value={category} onChange={(e) => setCategory(e.target.value)} required>
            <option value="">Select…</option>
            {categories
              .filter((c) => !c.type || c.type === 'BOTH' || c.type === type)
              .map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
          </select>
        </label>
        <label className="field span-2">
          Description
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
          />
        </label>
        <label className="field">
          Party
          <select
            value={partyType}
            onChange={(e) => {
              setPartyType(e.target.value)
              setPartyId('')
            }}
          >
            <option value="">None</option>
            <option value="customer">Customer</option>
            <option value="vendor">Vendor</option>
            <option value="other">Other</option>
          </select>
        </label>
        <label className="field">
          Party Name
          <select
            value={partyId}
            onChange={(e) => setPartyId(e.target.value)}
            disabled={!partyType || partyType === 'other'}
          >
            <option value="">Select…</option>
            {partyOptions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
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
        <label className="field">
          Payment Method
          <select
            value={paymentMethodId}
            onChange={(e) => setPaymentMethodId(e.target.value)}
            required
          >
            <option value="">Select…</option>
            {methods.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Reference Number
          <input value={referenceNumber} onChange={(e) => setReferenceNumber(e.target.value)} />
        </label>
        <label className="field span-2">
          Notes
          <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
      </ModalForm>
    </Modal>
  )
}

function AddExpenseModal({
  open,
  onClose,
  categories,
  methods,
  busy,
  onSave,
}: {
  open: boolean
  onClose: () => void
  categories: NamedItem[]
  methods: PaymentMethod[]
  busy: boolean
  onSave: (body: Record<string, unknown>) => Promise<void>
}) {
  const [description, setDescription] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [amount, setAmount] = useState('')
  const [paymentMethodId, setPaymentMethodId] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!(Number(amount) > 0)) return setError('Amount must be greater than 0')
    if (!description.trim()) return setError('Description required')
    try {
      await onSave({
        description,
        categoryId: categoryId || null,
        amountRupees: amount,
        paymentMethodId: paymentMethodId || null,
        notes: notes || null,
      })
      setDescription('')
      setAmount('')
      setNotes('')
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
        <label className="field">
          Category
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">Select…</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
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
        <label className="field">
          Payment Mode
          <select value={paymentMethodId} onChange={(e) => setPaymentMethodId(e.target.value)}>
            <option value="">Select…</option>
            {methods.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field span-2">
          Notes
          <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
      </ModalForm>
    </Modal>
  )
}

export default DailyAccountsPage
