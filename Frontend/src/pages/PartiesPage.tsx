import { useEffect, useState, type FormEvent } from 'react'
import {
  addTransaction,
  createCustomer,
  deleteCustomer,
  fetchCustomers,
  fetchLedgerTotals,
  type Party,
} from '../api/accounts'
import Loader from '../components/Loader'
import { formatINR, todayISO } from '../lib/money'
import { useAuth } from '../context/AuthContext'
import { hasPermission } from '../lib/permissions'

function PartiesPage() {
  const { user } = useAuth()
  const canWrite = hasPermission(user, 'ledger.write')
  const [customers, setCustomers] = useState<Party[]>([])
  const [totalUdhaarPaise, setTotalUdhaarPaise] = useState(0)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [customerName, setCustomerName] = useState('')
  const [customerAmount, setCustomerAmount] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)

  async function reload() {
    const [c, totals] = await Promise.all([fetchCustomers(), fetchLedgerTotals()])
    setCustomers(c.data)
    setTotalUdhaarPaise(totals.data.totalUdhaarPaise || 0)
  }

  useEffect(() => {
    setLoading(true)
    void reload()
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load ledger'))
      .finally(() => setLoading(false))
  }, [])

  async function addCustomer(e: FormEvent) {
    e.preventDefault()
    setError('')
    const name = customerName.trim()
    if (!name) return setError('Name required')

    const amount = Number(customerAmount)
    if (!(amount > 0)) return setError('Amount must be greater than 0')

    try {
      const created = await createCustomer({ name })
      await addTransaction(
        todayISO(),
        {
          type: 'CREDIT',
          date: todayISO(),
          personName: name,
          description: name,
          category: 'CREDIT',
          amountRupees: amount,
          partyType: 'customer',
          partyId: created.data.id,
        },
        crypto.randomUUID()
      )
      setCustomerName('')
      setCustomerAmount('')
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed')
    }
  }

  async function removeCustomer(id: string, name: string) {
    if (!window.confirm(`Delete customer “${name}”?`)) return
    setError('')
    setDeletingId(id)
    try {
      await deleteCustomer(id)
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div>
      <section className="panel">
        <div className="panel-head ledger-head">
          <h1 className="page-title">Ledger</h1>
          <div className="total-udhaar">
            <span className="total-udhaar-label">Total Udhaar</span>
            <span className="total-udhaar-value">{formatINR(totalUdhaarPaise)}</span>
          </div>
        </div>
        <p className="muted">
          Track credit parties and outstanding balances from the ledger.
          {!canWrite ? ' You have view-only access.' : ''}
        </p>
        {error ? <p className="error-text">{error}</p> : null}
      </section>

      {loading ? (
        <Loader fullPage label="Loading ledger…" />
      ) : (
      <section className="panel">
        <h2 className="panel-title">Customers</h2>
        {canWrite ? (
        <form className="filters" onSubmit={(e) => void addCustomer(e)}>
          <label className="field">
            Name
            <input
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              required
            />
          </label>
          <label className="field">
            Amount
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={customerAmount}
              onChange={(e) => setCustomerAmount(e.target.value)}
              placeholder="0.00"
              required
            />
          </label>
          <div style={{ display: 'flex', alignItems: 'end' }}>
            <button type="submit" className="btn btn-sm">
              Add Customer
            </button>
          </div>
        </form>
        ) : null}
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th className="num">Total Credit</th>
                <th className="num">Total Paid</th>
                <th className="num">Outstanding</th>
                {canWrite ? <th>Actions</th> : null}
              </tr>
            </thead>
            <tbody>
              {customers.length === 0 ? (
                <tr>
                  <td colSpan={canWrite ? 5 : 4} className="empty-state">
                    No customers yet.
                  </td>
                </tr>
              ) : (
                customers.map((c) => (
                  <tr key={c.id}>
                    <td>{c.name}</td>
                    <td className="num">{formatINR(c.totalCreditPaise || 0)}</td>
                    <td className="num">{formatINR(c.totalPaidPaise || 0)}</td>
                    <td className="num">{formatINR(c.outstandingPaise || 0)}</td>
                    {canWrite ? (
                    <td>
                      <button
                        type="button"
                        className="btn-ghost btn-sm"
                        disabled={deletingId === c.id}
                        onClick={() => void removeCustomer(c.id, c.name)}
                      >
                        {deletingId === c.id ? 'Deleting…' : 'Delete'}
                      </button>
                    </td>
                    ) : null}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
      )}
    </div>
  )
}

export default PartiesPage
