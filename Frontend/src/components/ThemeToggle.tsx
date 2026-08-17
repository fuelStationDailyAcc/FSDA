import { nextTheme, THEME_LABELS, useTheme, type Theme } from '../context/ThemeContext'

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="4.25" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M12 3.2v1.7M12 19.1v1.7M4.9 12H3.2M20.8 12h-1.7M6.05 6.05l1.2 1.2M16.75 16.75l1.2 1.2M17.95 6.05l-1.2 1.2M7.25 16.75l-1.2 1.2"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
      <path
        d="M15.2 3.6A8.4 8.4 0 1 0 20.4 14 6.6 6.6 0 0 1 15.2 3.6Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function OrangeIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="7" fill="#f58220" stroke="#002d56" strokeWidth="1.6" />
    </svg>
  )
}

function ThemeIcon({ theme }: { theme: Theme }) {
  if (theme === 'orange') return <OrangeIcon />
  if (theme === 'dark') return <MoonIcon />
  return <SunIcon />
}

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  const next = nextTheme(theme)

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggleTheme}
      aria-label={`Theme: ${THEME_LABELS[theme]}. Switch to ${THEME_LABELS[next]}`}
      title={`${THEME_LABELS[theme]} theme — click for ${THEME_LABELS[next]}`}
    >
      <ThemeIcon theme={theme} />
    </button>
  )
}

export default ThemeToggle
