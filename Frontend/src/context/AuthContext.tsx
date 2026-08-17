import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  deleteAccountRequest,
  loginRequest,
  logoutRequest,
  meRequest,
  registerRequest,
  type AuthUser,
} from '../api/auth'

type AuthContextValue = {
  user: AuthUser | null
  loading: boolean
  login: (identifier: string, password: string) => Promise<void>
  register: (
    username: string,
    email: string,
    password: string,
    stationName: string
  ) => Promise<void>
  logout: () => Promise<void>
  deleteAccount: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

function persistSession(user: AuthUser, accessToken: string) {
  localStorage.setItem('accessToken', accessToken)
  localStorage.setItem('user', JSON.stringify(user))
}

function clearSession() {
  localStorage.removeItem('accessToken')
  localStorage.removeItem('user')
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('accessToken')
    const storedUser = localStorage.getItem('user')

    if (!token) {
      setLoading(false)
      return
    }

    if (storedUser) {
      setUser(JSON.parse(storedUser) as AuthUser)
    }

    meRequest()
      .then((payload) => {
        setUser(payload.data)
        localStorage.setItem('user', JSON.stringify(payload.data))
      })
      .catch(() => {
        clearSession()
        setUser(null)
      })
      .finally(() => setLoading(false))
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      async login(identifier, password) {
        const payload = await loginRequest({ identifier, password })
        persistSession(payload.data.user, payload.data.accessToken)
        setUser(payload.data.user)
      },
      async register(username, email, password, stationName) {
        const payload = await registerRequest({
          username,
          email,
          password,
          stationName,
        })
        persistSession(payload.data.user, payload.data.accessToken)
        setUser(payload.data.user)
      },
      async logout() {
        try {
          await logoutRequest()
        } finally {
          clearSession()
          setUser(null)
        }
      },
      async deleteAccount() {
        try {
          await deleteAccountRequest()
        } finally {
          clearSession()
          setUser(null)
        }
      },
    }),
    [user, loading]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
