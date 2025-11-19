import React, { useState, useEffect, useMemo } from 'react'
import type { ReactNode } from 'react'
import { ThemeContext, THEME_STORAGE_KEY } from './theme'
import type { Theme } from './theme'

// Re-export for backward compatibility
export { ThemeContext } from './theme'
export type { Theme, ThemeContextValue } from './theme'

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<Theme>(() => {
    // Check localStorage first
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY)
    if (savedTheme === 'light' || savedTheme === 'dark') {
      return savedTheme
    }

    // Check system preference
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
      return 'light'
    }

    // Default to dark
    return 'dark'
  })

  useEffect(() => {
    // Save to localStorage
    localStorage.setItem(THEME_STORAGE_KEY, theme)

    // Update document attribute for CSS
    document.documentElement.setAttribute('data-theme', theme)

    // Update body class for compatibility
    document.body.classList.remove('theme-dark', 'theme-light')
    document.body.classList.add(`theme-${theme}`)
  }, [theme])

  const toggleTheme = () => {
    setThemeState((prev) => (prev === 'dark' ? 'light' : 'dark'))
  }

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme)
  }

  const value = useMemo(() => ({ theme, toggleTheme, setTheme }), [theme])

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  )
}
