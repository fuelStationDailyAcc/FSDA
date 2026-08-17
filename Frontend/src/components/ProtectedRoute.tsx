import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Loader from './Loader'
import type { ReactNode } from 'react'
import { hasPermission, isOwner, type PermissionKey } from '../lib/permissions'

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="app-shell">
        <Loader fullPage label="Loading FuelSNC…" />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return children
}

export function PermissionRoute({
  children,
  permission,
  ownerOnly,
}: {
  children: ReactNode
  permission?: PermissionKey
  ownerOnly?: boolean
}) {
  const { user } = useAuth()

  if (ownerOnly && (!isOwner(user) || user?.role === 'staff')) {
    return <Navigate to="/dashboard" replace />
  }

  if (permission && !hasPermission(user, permission)) {
    return <Navigate to="/dashboard" replace />
  }

  return children
}

export default ProtectedRoute
