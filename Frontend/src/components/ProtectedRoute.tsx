import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import PageShell from './PageShell'
import type { ReactNode } from 'react'

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <PageShell>
        <section className="hero-card">
          <p className="tagline">Loading...</p>
        </section>
      </PageShell>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return children
}

export default ProtectedRoute
