import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

export const THEMES = ['orange', 'light', 'dark'] as const
export type Theme = (typeof THEMES)[number]

export const THEME_LABELS: Record<Theme, string> = {
  orange: 'Orange',
  light: 'Light',
  dark: 'Dark',
}

type ThemeContextValue = {
  theme: Theme
  toggleTheme: () => void
  setTheme: (theme: Theme) => void
}

const STORAGE_KEY = 'petrobook-theme'
const LEGACY_STORAGE_KEY = 'theme'
const ThemeContext = createContext<ThemeContextValue | null>(null)

function isTheme(value: string | null | undefined): value is Theme {
  return value === 'orange' || value === 'light' || value === 'dark'
}

export function nextTheme(theme: Theme): Theme {
  return THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length]
}

export function readStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'dark'
  const stored = localStorage.getItem(STORAGE_KEY)
  if (isTheme(stored)) return stored
  localStorage.removeItem(LEGACY_STORAGE_KEY)
  return 'dark'
}

const THEME_COLORS: Record<Theme, string> = {
  orange: '#002d56',
  light: '#ffffff',
  dark: '#000000',
}

export function applyTheme(theme: Theme) {
  const root = document.documentElement
  root.dataset.theme = theme
  root.style.colorScheme = theme === 'dark' ? 'dark' : 'light'
  root.classList.toggle('dark', theme === 'dark')
  localStorage.setItem(STORAGE_KEY, theme)
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', THEME_COLORS[theme])
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => readStoredTheme())

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  const setTheme = useCallback((next: Theme) => {
    applyTheme(next)
    setThemeState(next)
  }, [])

  const toggleTheme = useCallback(() => {
    setThemeState((current) => {
      const next = nextTheme(current)
      applyTheme(next)
      return next
    })
  }, [])

  const value = useMemo(
    () => ({ theme, toggleTheme, setTheme }),
    [theme, toggleTheme, setTheme]
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider')
  }
  return context
}
