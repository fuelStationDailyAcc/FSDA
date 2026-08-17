import { THEMES, THEME_LABELS, useTheme, type Theme } from '../context/ThemeContext'

const THEME_HINTS: Record<Theme, string> = {
  orange: 'Original navy and orange station look',
  light: 'White grid, high contrast',
  dark: 'Black grid, high contrast',
}

function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  return (
    <div className="theme-picker" role="radiogroup" aria-label="Color theme">
      {THEMES.map((option) => {
        const selected = theme === option
        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={selected}
            className={`theme-picker-option${selected ? ' is-selected' : ''}`}
            onClick={() => setTheme(option)}
          >
            <span className={`theme-picker-swatch theme-picker-swatch-${option}`} aria-hidden="true" />
            <span className="theme-picker-copy">
              <span className="theme-picker-name">{THEME_LABELS[option]}</span>
              <span className="theme-picker-hint">{THEME_HINTS[option]}</span>
            </span>
          </button>
        )
      })}
    </div>
  )
}

export default ThemeToggle
