import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  createExpenseCategory,
  createPaymentMethod,
  createProduct,
  fetchExpenseCategories,
  fetchPaymentMethods,
  fetchProducts,
  updatePaymentMethod,
  updateProduct,
  type FuelProduct,
  type NamedItem,
  type PaymentMethod,
} from '../api/accounts'
import { formatRate, paiseToInput } from '../lib/money'
import Loader from '../components/Loader'
import { useAuth } from '../context/AuthContext'

function SettingsPage() {
  const { deleteAccount } = useAuth()
  const navigate = useNavigate()
  const [products, setProducts] = useState<FuelProduct[]>([])
  const [methods, setMethods] = useState<PaymentMethod[]>([])
  const [categories, setCategories] = useState<NamedItem[]>([])
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)

  const [productName, setProductName] = useState('')
  const [productType, setProductType] = useState('MS')
  const [productRate, setProductRate] = useState('')

  const [methodName, setMethodName] = useState('')
  const [methodCode, setMethodCode] = useState('')
  const [methodType, setMethodType] = useState('online')

  const [categoryName, setCategoryName] = useState('')

  async function reload() {
    const [p, m, c] = await Promise.all([
      fetchProducts(),
      fetchPaymentMethods(),
      fetchExpenseCategories(),
    ])
    setProducts(p.data)
    setMethods(m.data)
    setCategories(c.data)
  }

  useEffect(() => {
    setLoading(true)
    void reload()
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load settings'))
      .finally(() => setLoading(false))
  }, [])

  async function handleProduct(e: FormEvent) {
    e.preventDefault()
    setError('')
    try {
      await createProduct({
        name: productName,
        productType,
        currentRateRupees: productRate || 0,
      })
      setProductName('')
      setProductRate('')
      setMessage('Product added')
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed')
    }
  }

  async function handleMethod(e: FormEvent) {
    e.preventDefault()
    setError('')
    try {
      await createPaymentMethod({
        name: methodName,
        code: methodCode || methodName,
        methodType,
        reducesCash: methodType !== 'cash',
        isCashTaken: false,
      })
      setMethodName('')
      setMethodCode('')
      setMessage('Payment method added')
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed')
    }
  }

  async function handleCategory(e: FormEvent) {
    e.preventDefault()
    setError('')
    try {
      await createExpenseCategory(categoryName)
      setCategoryName('')
      setMessage('Expense category added')
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed')
    }
  }

  async function handleDeleteAccount() {
    const confirmed = window.confirm(
      'Delete your account permanently? This cannot be undone.'
    )
    if (!confirmed) return

    setError('')
    setDeleting(true)
    try {
      await deleteAccount()
      navigate('/login', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete account')
      setDeleting(false)
    }
  }

  return (
    <div>
      <section className="panel">
        <h1 className="page-title">Settings</h1>
        <p className="muted">
          Configure products, payment methods, and expense categories for this station.
        </p>
        {error ? <p className="error-text">{error}</p> : null}
        {message ? <p className="diff-pos">{message}</p> : null}
      </section>

      {loading ? <Loader fullPage label="Loading settings…" /> : null}

      {!loading ? (
      <>
      <section className="panel">
        <h2 className="panel-title">Fuel Products</h2>
        <form className="filters" onSubmit={handleProduct}>
          <label className="field">
            Name
            <input value={productName} onChange={(e) => setProductName(e.target.value)} required />
          </label>
          <label className="field">
            Type
            <select value={productType} onChange={(e) => setProductType(e.target.value)}>
              <option value="MS">MS</option>
              <option value="HSD">HSD</option>
              <option value="CNG">CNG</option>
              <option value="Other">Other</option>
            </select>
          </label>
          <label className="field">
            Current Rate (₹)
            <input
              type="number"
              step="0.01"
              min="0"
              value={productRate}
              onChange={(e) => setProductRate(e.target.value)}
            />
          </label>
          <div style={{ display: 'flex', alignItems: 'end' }}>
            <button type="submit" className="btn btn-sm">
              Add Product
            </button>
          </div>
        </form>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th className="num">Rate</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id}>
                  <td>{p.name}</td>
                  <td>{p.productType}</td>
                  <td className="num">{formatRate(p.currentRatePaise)}</td>
                  <td>{p.isActive ? 'Active' : 'Inactive'}</td>
                  <td>
                    <button
                      type="button"
                      className="btn-ghost btn-sm"
                      onClick={async () => {
                        const rate = window.prompt(
                          'New rate (₹)',
                          paiseToInput(p.currentRatePaise)
                        )
                        if (rate === null) return
                        await updateProduct(p.id, { currentRateRupees: rate })
                        await reload()
                      }}
                    >
                      Edit Rate
                    </button>{' '}
                    <button
                      type="button"
                      className="btn-ghost btn-sm"
                      onClick={async () => {
                        await updateProduct(p.id, { isActive: !p.isActive })
                        await reload()
                      }}
                    >
                      {p.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <h2 className="panel-title">Payment Methods</h2>
        <form className="filters" onSubmit={handleMethod}>
          <label className="field">
            Name
            <input value={methodName} onChange={(e) => setMethodName(e.target.value)} required />
          </label>
          <label className="field">
            Code
            <input value={methodCode} onChange={(e) => setMethodCode(e.target.value)} />
          </label>
          <label className="field">
            Type
            <select value={methodType} onChange={(e) => setMethodType(e.target.value)}>
              <option value="cash">Cash</option>
              <option value="credit">Credit</option>
              <option value="online">Online</option>
              <option value="card">Card</option>
              <option value="other">Other</option>
            </select>
          </label>
          <div style={{ display: 'flex', alignItems: 'end' }}>
            <button type="submit" className="btn btn-sm">
              Add Method
            </button>
          </div>
        </form>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Code</th>
                <th>Type</th>
                <th>Reduces Cash</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {methods.map((m) => (
                <tr key={m.id}>
                  <td>{m.name}</td>
                  <td>{m.code}</td>
                  <td>{m.methodType}</td>
                  <td>{m.reducesCash ? 'Yes' : 'No'}</td>
                  <td>{m.isActive ? 'Active' : 'Inactive'}</td>
                  <td>
                    <button
                      type="button"
                      className="btn-ghost btn-sm"
                      onClick={async () => {
                        await updatePaymentMethod(m.id, { isActive: !m.isActive })
                        await reload()
                      }}
                    >
                      {m.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <h2 className="panel-title">Expense Categories</h2>
        <form className="filters" onSubmit={handleCategory}>
          <label className="field">
            Name
            <input
              value={categoryName}
              onChange={(e) => setCategoryName(e.target.value)}
              required
            />
          </label>
          <div style={{ display: 'flex', alignItems: 'end' }}>
            <button type="submit" className="btn btn-sm">
              Add Category
            </button>
          </div>
        </form>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((c) => (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td>{c.isActive === false ? 'Inactive' : 'Active'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <h2 className="panel-title">Account</h2>
        <p className="muted" style={{ marginBottom: 14 }}>
          Permanently delete your login. Station records already entered stay in the system.
        </p>
        <button
          type="button"
          className="btn-danger"
          disabled={deleting}
          onClick={() => void handleDeleteAccount()}
        >
          {deleting ? 'Deleting…' : 'Delete account'}
        </button>
      </section>
      </>
      ) : null}
    </div>
  )
}

export default SettingsPage
