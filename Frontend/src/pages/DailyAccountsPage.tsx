import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  addCollection,
  addExpense,
  addReading,
  addTransaction,
  closeDay,
  deleteCollection,
  deleteTransaction,
  fetchDailyAccount,
  fetchLedgerNames,
  fetchPaymentMethods,
  fetchProducts,
  fetchCustomers,
  fetchVendors,
  createCustomer,
  createVendor,
  reopenDay,
  updateReading,
  type DailyAccountPayload,
  type LedgerTxn,
  type MeterReading,
  type Party,
  type FuelProduct,
  type PaymentMethod,
} from '../api/accounts'
import { Modal, ModalForm } from '../components/Modal'
import Loader from '../components/Loader'
import { downloadDayReport } from '../lib/dayReport'
import {
  calcFuelSalePaise,
  calcLitres,
  calcNetLitres,
  formatDisplayDate,
  formatINR,
  formatINRFloor,
  formatLitres,
  formatRate,
  shiftDate,
  todayISO,
} from '../lib/money'
import { useAuth } from '../context/AuthContext'
import { hasPermission, isOwner } from '../lib/permissions'

type ReadingDraft = Partial<Record<'newReading' | 'oldReading' | 'testingLitres', string>>

type FuelSaveHandle = {
  getChanges: () => Array<{ id: string; patch: Record<string, string | number> }>
}

function isReadingDirty(reading: MeterReading, draft?: ReadingDraft) {
  if (!draft) return false
  return (
    Number(draft.newReading) !== Number(reading.newReading) ||
    Number(draft.oldReading) !== Number(reading.oldReading) ||
    Number(draft.testingLitres) !== Number(reading.testingLitres)
  )
}

function isCreditCollection(row: { methodType?: string; code?: string; name?: string }) {
  return (
    String(row.methodType || '').toLowerCase() === 'credit' ||
    String(row.code || '').toLowerCase() === 'credit'
  )
}

function isCashMethod(row: { methodType?: string; code?: string }) {
  return (
    String(row.methodType || '').toLowerCase() === 'cash' ||
    String(row.code || '').toLowerCase() === 'cash'
  )
}

const METHOD_TYPE_ORDER = ['card', 'online', 'bank']

function collectionMethodSections(
  methods: PaymentMethod[],
  collections: DailyAccountPayload['collections']
) {
  const byId = new Map<string, PaymentMethod>()
  for (const method of methods) byId.set(method.id, method)
  for (const row of collections) {
    if (byId.has(row.paymentMethodId)) continue
    byId.set(row.paymentMethodId, {
      id: row.paymentMethodId,
      name: row.name,
      code: row.code,
      methodType: row.methodType,
      reducesCash: row.reducesCash,
      isCashTaken: row.isCashTaken,
      isActive: true,
    })
  }
  return [...byId.values()]
    .filter((method) => {
      if (!method.reducesCash || method.isCashTaken) return false
      if (isCreditCollection(method) || isCashMethod(method)) return false
      const type = String(method.methodType || '').toLowerCase()
      const known = METHOD_TYPE_ORDER.includes(type)
      const hasEntries = collections.some((row) => row.paymentMethodId === method.id)
      return known || hasEntries
    })
    .sort((a, b) => {
      const ai = METHOD_TYPE_ORDER.indexOf(String(a.methodType || '').toLowerCase())
      const bi = METHOD_TYPE_ORDER.indexOf(String(b.methodType || '').toLowerCase())
      const ao = ai === -1 ? 99 : ai
      const bo = bi === -1 ? 99 : bi
      if (ao !== bo) return ao - bo
      return a.name.localeCompare(b.name)
    })
}

function isISODate(value: string | null) {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value))
}

function DailyAccountsPage() {
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const dateParam = searchParams.get('date')
  const date = isISODate(dateParam) ? dateParam! : todayISO()
  const [data, setData] = useState<DailyAccountPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [products, setProducts] = useState<FuelProduct[]>([])
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([])
  const [customers, setCustomers] = useState<Party[]>([])
  const [vendors, setVendors] = useState<Party[]>([])

  const [expenseOpen, setExpenseOpen] = useState(false)
  const [closeOpen, setCloseOpen] = useState(false)
  const [confirmClose, setConfirmClose] = useState(false)
  const [actualCash, setActualCash] = useState('')
  const [busy, setBusy] = useState(false)
  const [readingsDirty, setReadingsDirty] = useState(false)
  const [liveFuelSalesPaise, setLiveFuelSalesPaise] = useState<number | null>(null)

  const fuelSaveRef = useRef<FuelSaveHandle>(null)

  const closed = data?.account.status === 'closed'
  const canWrite = hasPermission(user, 'accounts.write')
  const owner = isOwner(user)
  const locked = Boolean(closed || !canWrite)
  const dirty = readingsDirty
  const fuelSalesPaise = liveFuelSalesPaise ?? data?.kpis.totalFuelSalesPaise ?? 0
  const closingCashPaise =
    (data?.kpis.closingCashPaise ?? 0) +
    (fuelSalesPaise - (data?.kpis.totalFuelSalesPaise ?? 0))

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
      fetchPaymentMethods(true),
      fetchCustomers(),
      fetchVendors(),
    ]).then(([p, m, c, v]) => {
      setProducts(p.data)
      setPaymentMethods(m.data)
      setCustomers(c.data)
      setVendors(v.data)
    })
  }, [date])

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
    setSearchParams(next === todayISO() ? {} : { date: next }, { replace: true })
  }

  async function handleSave() {
    if (locked || !dirty) return
    setBusy(true)
    setError('')
    try {
      const readingChanges = fuelSaveRef.current?.getChanges() ?? []
      let latest: DailyAccountPayload | null = null
      for (const change of readingChanges) {
        const res = await updateReading(date, change.id, change.patch)
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
            {!locked ? (
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
              owner ? (
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
              ) : null
            ) : canWrite ? (
              <button type="button" className="btn-secondary" onClick={() => setCloseOpen(true)}>
                Close Day
              </button>
            ) : null}
          </div>
        </div>
        <p className="muted" style={{ margin: '8px 0 0' }}>
          Accounting date: <strong>{formatDisplayDate(date)}</strong>
          {user?.stationName ? ` · ${user.stationName}` : null}
          {user?.role ? ` · Role: ${user.role}` : null}
          {!canWrite ? (
            <span className="read-only-note no-print"> · View only</span>
          ) : !closed ? (
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
            <Kpi label="Total Fuel Sales" value={fuelSalesPaise} whole />
            <Kpi label="Total Credit" value={data.kpis.totalCreditPaise} />
            <Kpi label="Total Debit" value={data.kpis.totalDebitPaise} />
            <Kpi label="Total Expenses" value={data.kpis.totalExpensesPaise} />
            <Kpi label="Online Collections" value={data.kpis.onlineCollectionsPaise} />
            <Kpi label="Closing Cash" value={closingCashPaise} whole />
          </div>

          <FuelReadingsSection
            ref={fuelSaveRef}
            readings={data.readings}
            products={products}
            closed={locked}
            onDirtyChange={setReadingsDirty}
            onLiveSalesChange={setLiveFuelSalesPaise}
            onAdd={async (productId) => {
              const res = await addReading(date, productId)
              applyDay(res.data)
            }}
          />

          <CreditDebitSection
            date={date}
            closed={locked}
            localNames={localNames}
            customers={customers}
            vendors={vendors}
            entries={data.ledger.items}
            onPartyCreated={(party, kind) => {
              if (kind === 'customer') {
                setCustomers((prev) =>
                  prev.some((p) => p.id === party.id) ? prev : [...prev, party]
                )
              } else {
                setVendors((prev) =>
                  prev.some((p) => p.id === party.id) ? prev : [...prev, party]
                )
              }
            }}
            onSave={async (body) => {
              const key = crypto.randomUUID()
              const res = await addTransaction(date, body, key)
              applyDay(res.data)
            }}
            onDelete={async (id) => {
              const res = await deleteTransaction(date, id)
              applyDay(res.data)
            }}
          />

          <div className="expenses-cash-row">
            <ExpensesSection
              expenses={data.expenses}
              total={data.kpis.totalExpensesPaise}
              closed={locked}
              onAdd={() => setExpenseOpen(true)}
            />
            <CashSummarySection
              data={data}
              methods={paymentMethods}
              closed={locked}
              onAdd={async (paymentMethodId, amountRupees, description) => {
                const res = await addCollection(date, paymentMethodId, amountRupees, description)
                applyDay(res.data)
              }}
              onDelete={async (id) => {
                const res = await deleteCollection(date, id)
                applyDay(res.data)
              }}
            />
          </div>

          <ReconciliationSection
            data={data}
            liveFuelSalesPaise={fuelSalesPaise}
            liveClosingCashPaise={closingCashPaise}
            onClose={() => setCloseOpen(true)}
            closed={locked}
          />
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
                <span>{formatINRFloor(fuelSalesPaise)}</span>
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
                <span>{formatINRFloor(closingCashPaise)}</span>
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

function Kpi({ label, value, whole }: { label: string; value: number; whole?: boolean }) {
  return (
    <article className="kpi-card">
      <p className="kpi-label">{label}</p>
      <p className="kpi-value">{whole ? formatINRFloor(value) : formatINR(value)}</p>
    </article>
  )
}

const FuelReadingsSection = forwardRef<
  FuelSaveHandle,
  {
    readings: DailyAccountPayload['readings']
    products: FuelProduct[]
    closed: boolean
    onDirtyChange: (dirty: boolean) => void
    onLiveSalesChange: (paise: number) => void
    onAdd: (productId: string) => Promise<void>
  }
>(function FuelReadingsSection(
  { readings, products, closed, onDirtyChange, onLiveSalesChange, onAdd },
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
              }
      }
      return next
    })
  }, [readings])

  const liveRows = useMemo(
    () =>
      readings.map((r) => {
        const d = drafts[r.id]
        const litres = calcLitres(d?.newReading ?? r.newReading, d?.oldReading ?? r.oldReading)
        const netLitres = calcNetLitres(litres, d?.testingLitres ?? r.testingLitres)
        return {
          ...r,
          litres,
          netLitres,
          totalSalePaise: calcFuelSalePaise(netLitres, r.ratePaise),
        }
      }),
    [drafts, readings]
  )

  const liveTotal = useMemo(
    () => liveRows.reduce((sum, r) => sum + r.totalSalePaise, 0),
    [liveRows]
  )

  const dirty = useMemo(
    () => readings.some((r) => isReadingDirty(r, drafts[r.id])),
    [readings, drafts]
  )

  useEffect(() => {
    onDirtyChange(dirty)
    return () => onDirtyChange(false)
  }, [dirty, onDirtyChange])

  useEffect(() => {
    onLiveSalesChange(liveTotal)
  }, [liveTotal, onLiveSalesChange])

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
            {liveRows.map((r) => {
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
                  <td className="num">{formatLitres(r.litres)}</td>
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
                  <td className="num">{formatLitres(r.netLitres)}</td>
                  <td className="num">{formatRate(r.ratePaise)}</td>
                  <td className="num">{formatINR(r.totalSalePaise)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="summary-row total" style={{ marginTop: 12 }}>
        <span>Total Fuel Sale</span>
        <span>{formatINRFloor(liveTotal)}</span>
      </div>
    </section>
  )
})

function CashSummarySection({
  data,
  methods,
  closed,
  onAdd,
  onDelete,
}: {
  data: DailyAccountPayload
  methods: PaymentMethod[]
  closed: boolean
  onAdd: (paymentMethodId: string, amountRupees: string, description: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
}) {
  const sections = collectionMethodSections(methods, data.collections)

  return (
    <>
      {sections.map((method) => (
        <CollectionMethodBox
          key={method.id}
          method={method}
          entries={data.collections.filter((row) => row.paymentMethodId === method.id)}
          closed={closed}
          onAdd={onAdd}
          onDelete={onDelete}
        />
      ))}
    </>
  )
}

function CollectionMethodBox({
  method,
  entries,
  closed,
  onAdd,
  onDelete,
}: {
  method: PaymentMethod
  entries: DailyAccountPayload['collections']
  closed: boolean
  onAdd: (paymentMethodId: string, amountRupees: string, description: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
}) {
  const [note, setNote] = useState('')
  const [amount, setAmount] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const totalPaise = entries.reduce((sum, row) => sum + row.amountPaise, 0)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (!(Number(amount) > 0)) return setError('Amount must be greater than 0')
    if (closed) return setError('This day cannot be edited')
    setSubmitting(true)
    try {
      await onAdd(method.id, amount, note.trim())
      setNote('')
      setAmount('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(id: string, label: string) {
    if (!window.confirm(`Delete ${method.name.toLowerCase()} entry “${label}”?`)) return
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
    <section className="panel cash-method-box">
      <div className="panel-head">
        <h2 className="panel-title">{method.name}</h2>
        <span className="txn-box-total">{formatINR(totalPaise)}</span>
      </div>
      <form className="cash-method-form" onSubmit={(e) => void handleSubmit(e)}>
        <label className="field">
          Note
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Optional"
            disabled={closed || submitting}
          />
        </label>
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
        <button type="submit" className="btn btn-sm" disabled={closed || submitting}>
          {submitting ? '…' : 'Add'}
        </button>
      </form>
      {error ? <p className="error-text">{error}</p> : null}
      <div className="txn-entry-list">
        {entries.length === 0 ? (
          <p className="txn-entry-empty">No {method.name.toLowerCase()} entries yet.</p>
        ) : (
          entries.map((row, index) => {
            const label = row.description?.trim() || `${method.name} ${index + 1}`
            return (
              <div className="txn-entry-row" key={row.id}>
                <span className="txn-entry-name">{label}</span>
                <span className="txn-entry-amount">{formatINR(row.amountPaise)}</span>
                <button
                  type="button"
                  className="btn-ghost btn-sm"
                  disabled={closed || deletingId === row.id}
                  onClick={() => void handleDelete(row.id, label)}
                >
                  {deletingId === row.id ? '…' : '×'}
                </button>
              </div>
            )
          })
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
  liveFuelSalesPaise,
  liveClosingCashPaise,
  onClose,
  closed,
}: {
  data: DailyAccountPayload
  liveFuelSalesPaise: number
  liveClosingCashPaise: number
  onClose: () => void
  closed: boolean
}) {
  const expectedClosing = liveClosingCashPaise
  const diff =
    data.reconciliation.actualClosingCashPaise === null
      ? null
      : data.reconciliation.actualClosingCashPaise - expectedClosing
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
            <span>{formatINRFloor(liveFuelSalesPaise)}</span>
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
            <span>{formatINRFloor(expectedClosing)}</span>
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

function findLedgerParty(
  name: string,
  type: 'CREDIT' | 'DEBIT',
  customers: Party[],
  vendors: Party[]
): Party | null {
  const q = name.trim().toLowerCase()
  if (!q) return null
  const list = type === 'CREDIT' ? customers : vendors
  return list.find((p) => p.name.toLowerCase() === q) ?? null
}

function CreditDebitSection({
  date,
  closed,
  localNames,
  customers,
  vendors,
  entries,
  onSave,
  onDelete,
  onPartyCreated,
}: {
  date: string
  closed: boolean
  localNames: string[]
  customers: Party[]
  vendors: Party[]
  entries: LedgerTxn[]
  onSave: (body: Record<string, unknown>) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onPartyCreated: (party: Party, kind: 'customer' | 'vendor') => void
}) {
  const credits = useMemo(() => entries.filter((t) => t.type === 'CREDIT'), [entries])
  const debits = useMemo(() => entries.filter((t) => t.type === 'DEBIT'), [entries])

  return (
    <div className="two-col credit-debit-row">
      <TxnQuickBox
        type="CREDIT"
        title="Credit"
        date={date}
        closed={closed}
        localNames={localNames}
        customers={customers}
        vendors={vendors}
        entries={credits}
        onSave={onSave}
        onDelete={onDelete}
        onPartyCreated={onPartyCreated}
      />
      <TxnQuickBox
        type="DEBIT"
        title="Debit"
        date={date}
        closed={closed}
        localNames={localNames}
        customers={customers}
        vendors={vendors}
        entries={debits}
        onSave={onSave}
        onDelete={onDelete}
        onPartyCreated={onPartyCreated}
      />
    </div>
  )
}

function TxnQuickBox({
  type,
  title,
  date,
  closed,
  localNames,
  customers,
  vendors,
  entries,
  onSave,
  onDelete,
  onPartyCreated,
}: {
  type: 'CREDIT' | 'DEBIT'
  title: string
  date: string
  closed: boolean
  localNames: string[]
  customers: Party[]
  vendors: Party[]
  entries: LedgerTxn[]
  onSave: (body: Record<string, unknown>) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onPartyCreated: (party: Party, kind: 'customer' | 'vendor') => void
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

  const typedName = personName.trim()
  const ledgerParty = typedName ? findLedgerParty(typedName, type, customers, vendors) : null
  const showAddToLedger = Boolean(typedName && !searching && !ledgerParty)

  type DropdownItem = { kind: 'name'; name: string } | { kind: 'add'; name: string }

  const dropdownItems = useMemo((): DropdownItem[] => {
    const items: DropdownItem[] = suggestions.map((name) => ({ kind: 'name', name }))
    if (showAddToLedger) {
      items.push({ kind: 'add', name: typedName })
    }
    return items
  }, [suggestions, showAddToLedger, typedName])

  useEffect(() => {
    function onDocDown(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpenSuggest(false)
    }
    document.addEventListener('mousedown', onDocDown)
    return () => document.removeEventListener('mousedown', onDocDown)
  }, [])

  useEffect(() => {
    setHighlight(0)
  }, [dropdownItems])

  async function ensureLedgerParty(name: string) {
    const existing = findLedgerParty(name, type, customers, vendors)
    if (existing) {
      return {
        partyType: type === 'CREDIT' ? 'customer' : 'vendor',
        partyId: existing.id,
      }
    }
    if (type === 'CREDIT') {
      const created = await createCustomer({ name })
      onPartyCreated(created.data, 'customer')
      return { partyType: 'customer', partyId: created.data.id }
    }
    const created = await createVendor({ name })
    onPartyCreated(created.data, 'vendor')
    return { partyType: 'vendor', partyId: created.data.id }
  }

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
    if (closed) return setError('This day cannot be edited')

    setSubmitting(true)
    const savedName = personName.trim()
    try {
      const { partyType, partyId } = await ensureLedgerParty(savedName)
      await onSave({
        type,
        date,
        personName: savedName,
        description: savedName,
        category: type,
        amountRupees: amount,
        partyType,
        partyId,
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
              if (!openSuggest || dropdownItems.length === 0) return
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                setHighlight((h) => (h + 1) % dropdownItems.length)
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setHighlight((h) => (h - 1 + dropdownItems.length) % dropdownItems.length)
              } else if (e.key === 'Enter' && dropdownItems[highlight]) {
                const pick = dropdownItems[highlight].name
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
              {dropdownItems.length === 0 ? (
                <li className="name-suggest-empty">
                  {searching
                    ? 'Searching…'
                    : typedName
                      ? 'No matching names'
                      : 'No names yet — type a new one'}
                </li>
              ) : (
                dropdownItems.map((item, i) => (
                  <li key={item.kind === 'add' ? `add-${item.name}` : item.name}>
                    <button
                      type="button"
                      className={
                        item.kind === 'add'
                          ? `name-suggest-add${i === highlight ? ' active' : ''}`
                          : i === highlight
                            ? 'active'
                            : undefined
                      }
                      onMouseDown={(e) => {
                        e.preventDefault()
                        pickName(item.name)
                      }}
                    >
                      {item.kind === 'add' ? `Add “${item.name}” to ledger` : item.name}
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
