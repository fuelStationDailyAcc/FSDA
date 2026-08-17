import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  createPaymentMethod,
  createProduct,
  deletePaymentMethod,
  deleteProduct,
  fetchPaymentMethods,
  fetchProducts,
  updateProduct,
  type FuelProduct,
  type PaymentMethod,
} from '../api/accounts'
import { formatRate, paiseToInput } from '../lib/money'
import Loader from '../components/Loader'
import { useAuth } from '../context/AuthContext'
import { hasPermission, isOwner } from '../lib/permissions'

function SettingsPage() {
  const { deleteAccount, user } = useAuth()
  const navigate = useNavigate()
  const canWrite = hasPermission(user, 'settings.write')
  const owner = isOwner(user)
  const [products, setProducts] = useState<FuelProduct[]>([])
  const [methods, setMethods] = useState<PaymentMethod[]>([])
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)

  const [productName, setProductName] = useState('')
  const [productType, setProductType] = useState('MS')
  const [productRate, setProductRate] = useState('')

  const [methodName, setMethodName] = useState('')

  async function reload() {
    const [p, m] = await Promise.all([fetchProducts(), fetchPaymentMethods()])
    setProducts(p.data)
    setMethods(m.data)
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
        code: methodName,
        methodType: 'other',
        reducesCash: true,
        isCashTaken: false,
      })
      setMethodName('')
      setMessage('Payment method added')
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed')
    }
  }

  async function handleRemove(
    label: string,
    name: string,
    remove: () => Promise<{ message?: string }>
  ) {
    if (!window.confirm(`Remove ${label} “${name}”?`)) return
    setError('')
    setMessage('')
    try {
      const res = await remove()
      setMessage(res.message || `${label} removed`)
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove')
    }
  }

  async function handleRestoreProduct(product: FuelProduct) {
    setError('')
    setMessage('')
    try {
      await updateProduct(product.id, { isActive: true })
      setMessage(`${product.name} restored`)
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to restore product')
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
          Configure products and payment methods for this station.
          Products already used in daily accounts are hidden from new days instead of deleted.
          {!canWrite ? ' You have view-only access.' : ''}
        </p>
        {error ? <p className="error-text">{error}</p> : null}
        {message ? <p className="diff-pos">{message}</p> : null}
      </section>

      {loading ? <Loader fullPage label="Loading settings…" /> : null}

      {!loading ? (
      <>
      <section className="panel">
        <h2 className="panel-title">Fuel Products</h2>
        {canWrite ? (
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
        ) : null}
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th className="num">Rate</th>
                <th>Status</th>
                {canWrite ? <th>Action</th> : null}
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id}>
                  <td>{p.name}</td>
                  <td>{p.productType}</td>
                  <td className="num">{formatRate(p.currentRatePaise)}</td>
                  <td className={p.isActive ? undefined : 'muted'}>
                    {p.isActive ? 'Active' : 'Hidden'}
                  </td>
                  {canWrite ? (
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
                        setError('')
                        try {
                          await updateProduct(p.id, { currentRateRupees: rate })
                          setMessage('Product rate updated')
                          await reload()
                        } catch (err) {
                          setError(err instanceof Error ? err.message : 'Failed to update rate')
                        }
                      }}
                    >
                      Edit Rate
                    </button>{' '}
                    {p.isActive ? (
                    <button
                      type="button"
                      className="btn-ghost btn-sm"
                      onClick={() =>
                        void handleRemove('product', p.name, () => deleteProduct(p.id))
                      }
                    >
                      Remove
                    </button>
                    ) : (
                    <button
                      type="button"
                      className="btn-ghost btn-sm"
                      onClick={() => void handleRestoreProduct(p)}
                    >
                      Restore
                    </button>
                    )}
                  </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <h2 className="panel-title">Payment Methods</h2>
        {canWrite ? (
        <form className="filters" onSubmit={handleMethod}>
          <label className="field">
            Name
            <input value={methodName} onChange={(e) => setMethodName(e.target.value)} required />
          </label>
          <div style={{ display: 'flex', alignItems: 'end' }}>
            <button type="submit" className="btn btn-sm">
              Add Method
            </button>
          </div>
        </form>
        ) : null}
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                {canWrite ? <th>Action</th> : null}
              </tr>
            </thead>
            <tbody>
              {methods.map((m) => (
                <tr key={m.id}>
                  <td>{m.name}</td>
                  {canWrite ? (
                  <td>
                    <button
                      type="button"
                      className="btn-ghost btn-sm"
                      onClick={() =>
                        void handleRemove('payment method', m.name, () => deletePaymentMethod(m.id))
                      }
                    >
                      Remove
                    </button>
                  </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {owner ? (
      <section className="panel">
        <h2 className="panel-title">Account</h2>
        <p className="muted" style={{ marginBottom: 14 }}>
          Permanently delete your login. Station records already entered stay in the system.
          Staff logins you created will also be removed.
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
      ) : null}
      </>
      ) : null}
    </div>
  )
}

export default SettingsPage
