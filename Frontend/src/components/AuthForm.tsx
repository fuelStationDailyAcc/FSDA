import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

function AuthForm() {
  const { login, register } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setSubmitting(true)

    try {
      if (mode === 'register') {
        await register(username, email, password)
      } else {
        await login(email, password)
      }
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      {mode === 'register' && (
        <label className="auth-field">
          Username
          <input
            type="text"
            name="username"
            autoComplete="username"
            minLength={3}
            required
            value={username}
            onChange={(event) => setUsername(event.target.value)}
          />
        </label>
      )}
      <label className="auth-field">
        Email
        <input
          type="email"
          name="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </label>
      <label className="auth-field">
        Password
        <input
          type="password"
          name="password"
          autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
          minLength={6}
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </label>

      {error ? <p className="auth-error">{error}</p> : null}

      <button type="submit" className="cta" disabled={submitting}>
        {submitting ? 'PLEASE WAIT' : mode === 'register' ? 'REGISTER' : 'LOGIN'}
        <span className="cta-arrow" aria-hidden="true" />
      </button>

      <p className="auth-switch">
        {mode === 'login' ? 'New to FuelSNC?' : 'Already have an account?'}{' '}
        <button
          type="button"
          className="auth-switch-btn"
          onClick={() => {
            setError('')
            setMode(mode === 'login' ? 'register' : 'login')
          }}
        >
          {mode === 'login' ? 'Create an account' : 'Sign in'}
        </button>
      </p>
    </form>
  )
}

export default AuthForm
