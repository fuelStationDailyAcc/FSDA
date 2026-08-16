import { useEffect, useState, type FormEvent } from 'react'
import {
  createCustomer,
  createVendor,
  fetchCustomers,
  fetchVendors,
  type Party,
} from '../api/accounts'
import { formatINR } from '../lib/money'

function PartiesPage() {
  const [customers, setCustomers] = useState<Party[]>([])
  const [vendors, setVendors] = useState<Party[]>([])
  const [error, setError] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [vendorName, setVendorName] = useState('')
  const [vendorPhone, setVendorPhone] = useState('')

  async function reload() {
    const [c, v] = await Promise.all([fetchCustomers(), fetchVendors()])
    setCustomers(c.data)
    setVendors(v.data)
  }

  useEffect(() => {
    void reload().catch((err) =>
      setError(err instanceof Error ? err.message : 'Failed to load parties')
    )
  }, [])

  async function addCustomer(e: FormEvent) {
    e.preventDefault()
    try {
      await createCustomer({ name: customerName, phone: customerPhone || null })
      setCustomerName('')
      setCustomerPhone('')
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed')
    }
  }

  async function addVendor(e: FormEvent) {
    e.preventDefault()
    try {
      await createVendor({ name: vendorName, phone: vendorPhone || null })
      setVendorName('')
      setVendorPhone('')
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed')
    }
  }

  return (
    <div>
      <section className="panel">
        <h1 className="page-title">Customers & Vendors</h1>
        <p className="muted">Track credit parties and vendor outstanding balances from the ledger.</p>
        {error ? <p className="error-text">{error}</p> : null}
      </section>

      <div className="two-col">
        <section className="panel">
          <h2 className="panel-title">Customers</h2>
          <form className="filters" onSubmit={addCustomer}>
            <label className="field">
              Name
              <input
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                required
              />
            </label>
            <label className="field">
              Phone
              <input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
            </label>
            <div style={{ display: 'flex', alignItems: 'end' }}>
              <button type="submit" className="btn btn-sm">
                Add Customer
              </button>
            </div>
          </form>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th className="num">Total Credit</th>
                  <th className="num">Total Paid</th>
                  <th className="num">Outstanding</th>
                </tr>
              </thead>
              <tbody>
                {customers.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="empty-state">
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
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel">
          <h2 className="panel-title">Vendors</h2>
          <form className="filters" onSubmit={addVendor}>
            <label className="field">
              Name
              <input value={vendorName} onChange={(e) => setVendorName(e.target.value)} required />
            </label>
            <label className="field">
              Phone
              <input value={vendorPhone} onChange={(e) => setVendorPhone(e.target.value)} />
            </label>
            <div style={{ display: 'flex', alignItems: 'end' }}>
              <button type="submit" className="btn btn-sm">
                Add Vendor
              </button>
            </div>
          </form>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Vendor</th>
                  <th className="num">Purchases</th>
                  <th className="num">Total Paid</th>
                  <th className="num">Outstanding</th>
                </tr>
              </thead>
              <tbody>
                {vendors.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="empty-state">
                      No vendors yet.
                    </td>
                  </tr>
                ) : (
                  vendors.map((v) => (
                    <tr key={v.id}>
                      <td>{v.name}</td>
                      <td className="num">{formatINR(v.totalPurchasesPaise || 0)}</td>
                      <td className="num">{formatINR(v.totalPaidPaise || 0)}</td>
                      <td className="num">{formatINR(v.outstandingPaise || 0)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  )
}

export default PartiesPage
