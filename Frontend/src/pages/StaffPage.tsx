import { useEffect, useState, type FormEvent } from 'react'
import {
  createStaff,
  deleteStaff,
  fetchStaff,
  updateStaff,
  type StaffAccount,
} from '../api/staff'
import { Modal, ModalForm } from '../components/Modal'
import Loader from '../components/Loader'
import {
  DEFAULT_STAFF_PERMISSIONS,
  PERMISSION_AREAS,
  normalizePermissions,
  setPermission,
  type PermissionAction,
  type PermissionArea,
  type StaffPermissions,
} from '../lib/permissions'

function permissionSummary(permissions: StaffPermissions) {
  return PERMISSION_AREAS.map((area) => {
    const access = permissions[area.key]
    if (access.write) return `${area.label} edit`
    if (access.read) return `${area.label} view`
    return null
  }).filter(Boolean)
}

function PermissionFields({
  value,
  onChange,
}: {
  value: StaffPermissions
  onChange: (next: StaffPermissions) => void
}) {
  function toggle(area: PermissionArea, action: PermissionAction, checked: boolean) {
    onChange(setPermission(value, area, action, checked))
  }

  return (
    <div className="perm-grid">
      {PERMISSION_AREAS.map((area) => (
        <fieldset key={area.key} className="perm-card">
          <legend>{area.label}</legend>
          <p className="perm-hint">{area.hint}</p>
          <label className="perm-check">
            <input
              type="checkbox"
              checked={value[area.key].read}
              onChange={(e) => toggle(area.key, 'read', e.target.checked)}
            />
            View
          </label>
          <label className="perm-check">
            <input
              type="checkbox"
              checked={value[area.key].write}
              onChange={(e) => toggle(area.key, 'write', e.target.checked)}
            />
            Edit
          </label>
        </fieldset>
      ))}
    </div>
  )
}

function StaffPage() {
  const [staff, setStaff] = useState<StaffAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [permissions, setPermissions] = useState(DEFAULT_STAFF_PERMISSIONS)
  const [editing, setEditing] = useState<StaffAccount | null>(null)
  const [editPermissions, setEditPermissions] = useState(DEFAULT_STAFF_PERMISSIONS)
  const [resetTarget, setResetTarget] = useState<StaffAccount | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)

  async function reload() {
    const res = await fetchStaff()
    setStaff(res.data)
  }

  useEffect(() => {
    setLoading(true)
    void reload()
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load staff'))
      .finally(() => setLoading(false))
  }, [])

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    setError('')
    setMessage('')
    setSubmitting(true)
    try {
      await createStaff({
        username: username.trim(),
        password,
        permissions: normalizePermissions(permissions),
      })
      setUsername('')
      setPassword('')
      setPermissions(DEFAULT_STAFF_PERMISSIONS)
      setMessage('Staff account created. They can sign in with this username and password.')
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create staff')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleSavePermissions(e: FormEvent) {
    e.preventDefault()
    if (!editing) return
    setError('')
    setSubmitting(true)
    try {
      await updateStaff(editing._id, { permissions: normalizePermissions(editPermissions) })
      setMessage(`Permissions updated for ${editing.username}`)
      setEditing(null)
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update permissions')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleResetPassword(e: FormEvent) {
    e.preventDefault()
    if (!resetTarget) return
    setError('')
    setSubmitting(true)
    try {
      await updateStaff(resetTarget._id, { password: newPassword })
      setMessage(`Password updated for ${resetTarget.username}`)
      setResetTarget(null)
      setNewPassword('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update password')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(member: StaffAccount) {
    if (!window.confirm(`Delete staff account “${member.username}”? They will no longer be able to sign in.`)) {
      return
    }
    setError('')
    setDeletingId(member._id)
    try {
      await deleteStaff(member._id)
      setMessage(`Deleted ${member.username}`)
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete staff')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div>
      <section className="panel">
        <h1 className="page-title">Staff</h1>
        <p className="muted">
          Create logins for your staff and choose what they can view or edit. They sign in from the
          same login page with the username and password you set here.
        </p>
        {error ? <p className="error-text">{error}</p> : null}
        {message ? <p className="diff-pos">{message}</p> : null}
      </section>

      <section className="panel">
        <h2 className="panel-title">Add staff</h2>
        <form onSubmit={(e) => void handleCreate(e)}>
          <div className="filters">
            <label className="field">
              Username
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="off"
                minLength={3}
                required
              />
            </label>
            <label className="field">
              Password
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                minLength={6}
                required
              />
            </label>
          </div>
          <PermissionFields value={permissions} onChange={setPermissions} />
          <div className="toolbar" style={{ marginTop: 14 }}>
            <button type="submit" className="btn" disabled={submitting}>
              {submitting ? 'Creating…' : 'Create staff login'}
            </button>
          </div>
        </form>
      </section>

      {loading ? (
        <Loader fullPage label="Loading staff…" />
      ) : (
        <section className="panel">
          <h2 className="panel-title">Staff accounts</h2>
          <div className="table-wrap">
            <table className="data-table staff-table">
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Access</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {staff.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="empty-state">
                      No staff accounts yet. Create one above.
                    </td>
                  </tr>
                ) : (
                  staff.map((member) => {
                    const perms = normalizePermissions(member.permissions)
                    const summary = permissionSummary(perms)
                    return (
                      <tr key={member._id}>
                        <td>
                          <strong>{member.username}</strong>
                        </td>
                        <td>
                          {summary.length ? (
                            <div className="perm-chips">
                              {summary.map((label) => (
                                <span key={label} className="perm-chip">
                                  {label}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="muted">No access</span>
                          )}
                        </td>
                        <td>
                          <div className="staff-actions">
                            <button
                              type="button"
                              className="btn-ghost btn-sm"
                              onClick={() => {
                                setEditing(member)
                                setEditPermissions(perms)
                              }}
                            >
                              Permissions
                            </button>
                            <button
                              type="button"
                              className="btn-ghost btn-sm"
                              onClick={() => {
                                setResetTarget(member)
                                setNewPassword('')
                              }}
                            >
                              Password
                            </button>
                            <button
                              type="button"
                              className="btn-ghost btn-sm"
                              disabled={deletingId === member._id}
                              onClick={() => void handleDelete(member)}
                            >
                              {deletingId === member._id ? 'Deleting…' : 'Remove'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <Modal
        title={editing ? `Permissions · ${editing.username}` : 'Permissions'}
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
      >
        <ModalForm
          onSubmit={(e) => void handleSavePermissions(e)}
          onCancel={() => setEditing(null)}
          submitting={submitting}
          submitLabel="Save permissions"
        >
          <div className="span-2">
            <PermissionFields value={editPermissions} onChange={setEditPermissions} />
          </div>
        </ModalForm>
      </Modal>

      <Modal
        title={resetTarget ? `New password · ${resetTarget.username}` : 'New password'}
        open={Boolean(resetTarget)}
        onClose={() => setResetTarget(null)}
      >
        <ModalForm
          onSubmit={(e) => void handleResetPassword(e)}
          onCancel={() => setResetTarget(null)}
          submitting={submitting}
          submitLabel="Update password"
        >
          <label className="field span-2">
            New password
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
              minLength={6}
              required
            />
          </label>
        </ModalForm>
      </Modal>
    </div>
  )
}

export default StaffPage
