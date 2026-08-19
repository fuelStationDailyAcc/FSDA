import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  createSalary,
  deleteSalary,
  fetchSalaries,
  updateSalary,
  type SalaryEntry,
} from '../api/salaries'
import Loader from '../components/Loader'
import { formatINR, paiseToInput } from '../lib/money'

function SalariesPage() {
  const [entries, setEntries] = useState<SalaryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [name, setName] = useState('')
  const [salary, setSalary] = useState('')
  const [notes, setNotes] = useState('')

  async function reload() {
    const res = await fetchSalaries()
    setEntries(res.data)
  }

  useEffect(() => {
    setLoading(true)
    void reload()
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load salaries'))
      .finally(() => setLoading(false))
  }, [])

  const totalMonthly = useMemo(
    () => entries.reduce((sum, row) => sum + row.salaryPaise, 0),
    [entries]
  )

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    setError('')
    setMessage('')
    setSubmitting(true)
    try {
      await createSalary({
        name: name.trim(),
        salaryRupees: salary || 0,
        notes: notes.trim() || undefined,
      })
      setName('')
      setSalary('')
      setNotes('')
      setMessage('Salary entry added')
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add salary')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleRemove(entry: SalaryEntry) {
    if (!window.confirm(`Remove salary entry for “${entry.name}”?`)) return
    setError('')
    setMessage('')
    try {
      await deleteSalary(entry.id)
      setMessage(`Removed ${entry.name}`)
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove entry')
    }
  }

  return (
    <div>
      <section className="panel">
        <h1 className="page-title">Salaries</h1>
        <p className="muted">
          Add monthly salaries for anyone at your station — staff, helpers, cleaners, or any other
          person. Names here are separate from staff login accounts.
        </p>
        {error ? <p className="error-text">{error}</p> : null}
        {message ? <p className="diff-pos">{message}</p> : null}
      </section>

      {loading ? (
        <Loader fullPage label="Loading salaries…" />
      ) : (
        <>
          <div className="kpi-grid">
            <div className="kpi-card">
              <p className="kpi-label">People</p>
              <p className="kpi-value">{entries.length}</p>
            </div>
            <div className="kpi-card">
              <p className="kpi-label">Total monthly salary</p>
              <p className="kpi-value">{formatINR(totalMonthly)}</p>
            </div>
          </div>

          <section className="panel">
            <h2 className="panel-title">Add salary</h2>
            <form className="filters" onSubmit={(e) => void handleCreate(e)}>
              <label className="field">
                Name
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Any name"
                  required
                />
              </label>
              <label className="field">
                Monthly salary (₹)
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={salary}
                  onChange={(e) => setSalary(e.target.value)}
                  required
                />
              </label>
              <label className="field">
                Notes
                <input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional"
                />
              </label>
              <div style={{ display: 'flex', alignItems: 'end' }}>
                <button type="submit" className="btn btn-sm" disabled={submitting}>
                  {submitting ? 'Adding…' : 'Add salary'}
                </button>
              </div>
            </form>
          </section>

          <section className="panel">
            <h2 className="panel-title">Salary list</h2>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th className="num">Monthly salary</th>
                    <th>Notes</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="empty-state">
                        No salaries added yet. Use the form above to add someone.
                      </td>
                    </tr>
                  ) : (
                    entries.map((entry) => (
                      <tr key={entry.id}>
                        <td>
                          <strong>{entry.name}</strong>
                        </td>
                        <td className="num">{formatINR(entry.salaryPaise)}</td>
                        <td className={entry.notes ? undefined : 'muted'}>
                          {entry.notes || '—'}
                        </td>
                        <td>
                          <button
                            type="button"
                            className="btn-ghost btn-sm"
                            onClick={() => {
                              const amount = window.prompt(
                                `Monthly salary for ${entry.name} (₹)`,
                                paiseToInput(entry.salaryPaise)
                              )
                              if (amount === null) return
                              setError('')
                              setMessage('')
                              void updateSalary(entry.id, { salaryRupees: amount })
                                .then(() => {
                                  setMessage(`Salary updated for ${entry.name}`)
                                  return reload()
                                })
                                .catch((err) =>
                                  setError(err instanceof Error ? err.message : 'Failed to update')
                                )
                            }}
                          >
                            Edit salary
                          </button>{' '}
                          <button
                            type="button"
                            className="btn-ghost btn-sm"
                            onClick={() => {
                              const newName = window.prompt('Name', entry.name)
                              if (newName === null || !newName.trim()) return
                              setError('')
                              setMessage('')
                              void updateSalary(entry.id, { name: newName.trim() })
                                .then(() => {
                                  setMessage(`Updated ${newName.trim()}`)
                                  return reload()
                                })
                                .catch((err) =>
                                  setError(err instanceof Error ? err.message : 'Failed to update')
                                )
                            }}
                          >
                            Edit name
                          </button>{' '}
                          <button
                            type="button"
                            className="btn-ghost btn-sm"
                            onClick={() => void handleRemove(entry)}
                          >
                            Remove
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

export default SalariesPage
